#!/usr/bin/env node
/**
 * coda-sync.mjs — Coda API Content Sync
 * Zero-dependency Node.js script for searching and pulling Coda doc content.
 * Designed to work naturally with Claude Code via CLAUDE.md instructions.
 *
 * Usage: node coda-sync.mjs <command> [options]
 *
 * Commands:
 *   docs                      List all accessible docs
 *   docs search <query>       Search docs by name
 *   pages <doc>               List pages in a doc (name or ID)
 *   export <doc> <page>       Export page content as markdown (name or ID)
 *   pull <doc> [page]         Export and save to vault (default: all pages)
 *
 * Environment:
 *   CODA_API_TOKEN            Required. Coda API token.
 *   CODA_OUTPUT_DIR           Optional. Where to save pulled content.
 *                             Default: reads .coda/config.json output_dir, then ./work-pages/coda/
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { setTimeout as sleep } from 'timers/promises';

// ─── Configuration ──────────────────────────────────────────────────────────
const API_BASE = 'https://coda.io/apis/v1';
const TOKEN = process.env.CODA_API_TOKEN;
// Resolve output dir: env var > project .coda/config.json > ./work-pages/coda
function resolveOutputDir() {
  if (process.env.CODA_OUTPUT_DIR) return process.env.CODA_OUTPUT_DIR;
  try {
    const cfg = JSON.parse(readFileSync(join(process.cwd(), '.coda', 'config.json'), 'utf-8'));
    if (cfg.output_dir) return resolve(process.cwd(), cfg.output_dir);
  } catch { /* no config */ }
  return join(process.cwd(), 'work-pages', 'coda');
}
const OUTPUT_DIR = resolveOutputDir();
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 30;

// ─── API Helpers ────────────────────────────────────────────────────────────
async function codaFetch(path, options = {}, retries = 3) {
  if (!TOKEN) {
    console.error('Error: CODA_API_TOKEN environment variable is required.');
    console.error('Get your token at: https://coda.io/account#apiSettings');
    process.exit(1);
  }

  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (res.ok) return res.json();

    // Retry on 5xx (server errors) and 429 (rate limit)
    if ((res.status >= 500 || res.status === 429) && attempt < retries) {
      const waitSec = attempt * 3;
      console.error(`  Server error ${res.status}, retrying in ${waitSec}s... (${attempt}/${retries})`);
      await sleep(waitSec * 1000);
      continue;
    }

    const body = await res.text();
    // Strip HTML from error responses
    const cleanBody = body.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 200);
    throw new Error(`Coda API ${res.status}: ${cleanBody}`);
  }
}

// ─── Doc Resolution ─────────────────────────────────────────────────────────
// Accepts a name or ID and returns { id, name }
async function resolveDoc(nameOrId) {
  // If it looks like an ID (no spaces, short alphanumeric), try direct fetch first
  if (/^[A-Za-z0-9_-]+$/.test(nameOrId) && nameOrId.length < 30) {
    try {
      const doc = await codaFetch(`/docs/${nameOrId}`);
      return { id: doc.id, name: doc.name };
    } catch {
      // Fall through to name search
    }
  }

  // Search by name
  const query = nameOrId.toLowerCase();
  let pageToken = null;
  do {
    const params = pageToken ? `?pageToken=${pageToken}` : '';
    const res = await codaFetch(`/docs${params}`);
    for (const doc of res.items) {
      if (doc.name.toLowerCase() === query || doc.name.toLowerCase().includes(query)) {
        return { id: doc.id, name: doc.name };
      }
    }
    pageToken = res.nextPageToken || null;
  } while (pageToken);

  throw new Error(`Doc not found: "${nameOrId}"`);
}

// ─── Page Resolution ────────────────────────────────────────────────────────
async function resolvePage(docId, nameOrId) {
  // Try direct fetch by ID first
  if (/^canvas-/.test(nameOrId) || /^[A-Za-z0-9_-]+$/.test(nameOrId)) {
    try {
      const page = await codaFetch(`/docs/${docId}/pages/${encodeURIComponent(nameOrId)}`);
      return { id: page.id, name: page.name };
    } catch {
      // Fall through to name search
    }
  }

  // Search by name
  const query = nameOrId.toLowerCase();
  let pageToken = null;
  do {
    const params = pageToken ? `?pageToken=${pageToken}` : '';
    const res = await codaFetch(`/docs/${docId}/pages${params}`);
    for (const page of res.items) {
      if (page.name.toLowerCase() === query || page.name.toLowerCase().includes(query)) {
        return { id: page.id, name: page.name };
      }
    }
    pageToken = res.nextPageToken || null;
  } while (pageToken);

  throw new Error(`Page not found: "${nameOrId}" in doc ${docId}`);
}

// ─── Plain Text Fallback (listPageContent) ──────────────────────────────────
async function getPageContentPlainText(docId, pageId) {
  let allItems = [];
  let pageToken = null;
  do {
    const params = pageToken ? `?pageToken=${pageToken}&limit=500` : '?limit=500';
    const res = await codaFetch(`/docs/${docId}/pages/${pageId}/content${params}`);
    allItems.push(...res.items);
    pageToken = res.nextPageToken || null;
  } while (pageToken);

  // Reconstruct content from line items
  return allItems
    .map(item => {
      const content = item.itemContent?.content || '';
      const style = item.itemContent?.style || '';
      const level = item.itemContent?.lineLevel || 0;
      const indent = '  '.repeat(level);

      switch (style) {
        case 'heading1': return `# ${content}`;
        case 'heading2': return `## ${content}`;
        case 'heading3': return `### ${content}`;
        case 'blockQuote': return `> ${content}`;
        case 'bulletedList': return `${indent}- ${content}`;
        case 'numberedList': return `${indent}1. ${content}`;
        case 'checkboxList': return `${indent}- [ ] ${content}`;
        default: return `${indent}${content}`;
      }
    })
    .join('\n');
}

// ─── Three-Step Export Flow ─────────────────────────────────────────────────
async function exportPageContent(docId, pageId, format = 'markdown') {
  try {
    // Step 1: Submit the export job
    const exportRes = await codaFetch(`/docs/${docId}/pages/${pageId}/export`, {
      method: 'POST',
      body: JSON.stringify({ outputFormat: format }),
    });

    const requestId = exportRes.id;
    console.error(`  Export submitted (requestId: ${requestId}), polling...`);

    // Step 2: Poll until ready
    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      await sleep(POLL_INTERVAL_MS);
      const status = await codaFetch(`/docs/${docId}/pages/${pageId}/export/${requestId}`);

      if (status.status === 'complete') {
        if (!status.downloadLink) {
          throw new Error('Export completed but no download link returned.');
        }

        // Step 3: Download the content
        console.error(`  Export ready, downloading...`);
        const downloadRes = await fetch(status.downloadLink);
        if (!downloadRes.ok) {
          throw new Error(`Download failed: ${downloadRes.status}`);
        }
        return await downloadRes.text();
      }

      if (status.error) {
        throw new Error(`Export failed: ${status.error}`);
      }

      console.error(`  Polling... (${i + 1}/${MAX_POLL_ATTEMPTS})`);
    }

    throw new Error(`Export timed out after ${MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS / 1000}s`);
  } catch (err) {
    // Fallback to plain text if export fails
    console.error(`  Export failed (${err.message}), falling back to plain text...`);
    return await getPageContentPlainText(docId, pageId);
  }
}

// ─── Commands ───────────────────────────────────────────────────────────────

async function cmdDocs(searchQuery) {
  let pageToken = null;
  const results = [];

  do {
    const params = pageToken ? `?pageToken=${pageToken}` : '';
    const res = await codaFetch(`/docs${params}`);
    for (const doc of res.items) {
      if (!searchQuery || doc.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        results.push(doc);
      }
    }
    pageToken = res.nextPageToken || null;
  } while (pageToken);

  if (results.length === 0) {
    console.log(searchQuery ? `No docs matching "${searchQuery}".` : 'No docs found.');
    return;
  }

  console.log(searchQuery ? `Docs matching "${searchQuery}":\n` : `All accessible docs:\n`);
  for (const doc of results) {
    const updated = doc.updatedAt ? ` (updated ${doc.updatedAt.split('T')[0]})` : '';
    console.log(`  ${doc.name}${updated}`);
    console.log(`    ID: ${doc.id}`);
    console.log(`    Link: ${doc.browserLink}`);
    console.log('');
  }
  console.log(`${results.length} doc(s) found.`);
}

async function cmdPages(docRef) {
  const doc = await resolveDoc(docRef);
  console.log(`Pages in "${doc.name}":\n`);

  let pageToken = null;
  let count = 0;
  do {
    const params = pageToken ? `?pageToken=${pageToken}` : '';
    const res = await codaFetch(`/docs/${doc.id}/pages${params}`);
    for (const page of res.items) {
      const hidden = page.isHidden ? ' [hidden]' : '';
      const sub = page.parent ? `  (under: ${page.parent.name})` : '';
      console.log(`  ${page.name}${hidden}${sub}`);
      console.log(`    ID: ${page.id}`);
      count++;
    }
    pageToken = res.nextPageToken || null;
  } while (pageToken);

  console.log(`\n${count} page(s) found.`);
}

async function cmdExport(docRef, pageRef, format = 'markdown') {
  const doc = await resolveDoc(docRef);
  const page = await resolvePage(doc.id, pageRef);

  console.error(`Exporting "${page.name}" from "${doc.name}" as ${format}...`);
  const content = await exportPageContent(doc.id, page.id, format);

  // Output to stdout so Claude Code can capture it directly
  console.log(content);
}

async function cmdPull(docRef, pageRef, format = 'markdown') {
  const doc = await resolveDoc(docRef);

  // Ensure output directory exists
  const docDir = join(OUTPUT_DIR, sanitizeFilename(doc.name));
  if (!existsSync(docDir)) {
    mkdirSync(docDir, { recursive: true });
  }

  if (pageRef) {
    // Pull a single page
    const page = await resolvePage(doc.id, pageRef);
    console.error(`Pulling "${page.name}" from "${doc.name}"...`);
    const content = await exportPageContent(doc.id, page.id, format);
    const ext = format === 'html' ? '.html' : '.md';
    const filepath = join(docDir, `${sanitizeFilename(page.name)}${ext}`);
    const withFrontmatter = addFrontmatter(content, doc, page);
    writeFileSync(filepath, withFrontmatter, 'utf-8');
    console.log(`Saved: ${filepath}`);
  } else {
    // Pull all pages
    console.error(`Pulling all pages from "${doc.name}"...`);
    let pageToken = null;
    let count = 0;
    do {
      const params = pageToken ? `?pageToken=${pageToken}` : '';
      const res = await codaFetch(`/docs/${doc.id}/pages${params}`);
      for (const page of res.items) {
        if (page.isHidden) {
          console.error(`  Skipping hidden page: ${page.name}`);
          continue;
        }
        try {
          console.error(`  Exporting: ${page.name}...`);
          const content = await exportPageContent(doc.id, page.id, format);
          const ext = format === 'html' ? '.html' : '.md';
          const filepath = join(docDir, `${sanitizeFilename(page.name)}${ext}`);
          const withFrontmatter = addFrontmatter(content, doc, page);
          writeFileSync(filepath, withFrontmatter, 'utf-8');
          console.error(`  Saved: ${filepath}`);
          count++;
        } catch (err) {
          console.error(`  Failed to export "${page.name}": ${err.message}`);
        }
      }
      pageToken = res.nextPageToken || null;
    } while (pageToken);

    console.log(`Pulled ${count} page(s) to: ${docDir}`);
  }
}

// ─── Utilities ──────────────────────────────────────────────────────────────
function sanitizeFilename(name) {
  return name.replace(/[<>:"/\\|?*]/g, '-').replace(/\s+/g, ' ').trim();
}

function addFrontmatter(content, doc, page) {
  const now = new Date().toISOString().split('T')[0];
  return `---
source: coda
doc_name: "${doc.name}"
doc_id: "${doc.id}"
page_name: "${page.name}"
page_id: "${page.id}"
synced_at: ${now}
---

${content}`;
}

function printHelp() {
  console.log(`
coda-sync — Coda API Content Sync

Usage: node coda-sync.mjs <command> [options]

Commands:
  docs                        List all accessible docs
  docs search <query>         Search docs by name
  pages <doc>                 List pages in a doc (by name or ID)
  export <doc> <page>         Export a page to stdout (markdown by default)
  export <doc> <page> --html  Export as HTML instead
  pull <doc> [page]           Export and save to vault
  pull <doc> --html           Save as HTML instead

Environment:
  CODA_API_TOKEN              Required. Get yours at https://coda.io/account#apiSettings
  CODA_OUTPUT_DIR             Optional. Default: reads .coda/config.json, then ./work-pages/coda/

Examples:
  node coda-sync.mjs docs
  node coda-sync.mjs docs search "Product"
  node coda-sync.mjs pages "Product Launch Hub"
  node coda-sync.mjs export "Product Launch Hub" "Launch Status"
  node coda-sync.mjs pull "Product Launch Hub" "Launch Status"
  node coda-sync.mjs pull "Product Launch Hub"
`.trim());
}

// ─── Main ───────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  printHelp();
  process.exit(0);
}

const cmd = args[0];
const hasHtml = args.includes('--html');
const cleanArgs = args.filter(a => a !== '--html');
const format = hasHtml ? 'html' : 'markdown';

try {
  switch (cmd) {
    case 'docs':
      if (cleanArgs[1] === 'search' && cleanArgs[2]) {
        await cmdDocs(cleanArgs.slice(2).join(' '));
      } else if (cleanArgs.length === 1) {
        await cmdDocs();
      } else {
        // Treat everything after 'docs' as a search query
        await cmdDocs(cleanArgs.slice(1).join(' '));
      }
      break;

    case 'pages':
      if (!cleanArgs[1]) {
        console.error('Usage: coda-sync pages <doc name or ID>');
        process.exit(1);
      }
      await cmdPages(cleanArgs.slice(1).join(' '));
      break;

    case 'export':
      if (!cleanArgs[1] || !cleanArgs[2]) {
        console.error('Usage: coda-sync export <doc> <page>');
        process.exit(1);
      }
      // Last arg is page, everything between 'export' and last is doc
      // But that's ambiguous — use a separator approach
      // For now: export "doc name" "page name" (quotes handle spaces)
      await cmdExport(cleanArgs[1], cleanArgs.slice(2).join(' '), format);
      break;

    case 'pull':
      if (!cleanArgs[1]) {
        console.error('Usage: coda-sync pull <doc> [page]');
        process.exit(1);
      }
      await cmdPull(cleanArgs[1], cleanArgs[2] || null, format);
      break;

    default:
      console.error(`Unknown command: ${cmd}`);
      printHelp();
      process.exit(1);
  }
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}
