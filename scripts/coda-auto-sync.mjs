#!/usr/bin/env node
/**
 * coda-auto-sync.mjs — Reads ~/.coda/config.json and syncs all configured docs.
 * Called by Claude Code SessionStart hook or manually.
 *
 * Usage: node coda-auto-sync.mjs [--project-dir <path>]
 *
 * Looks for config in this order:
 *   1. ./.coda/config.json (project-level)
 *   2. ~/.coda/config.json (user-level fallback)
 *
 * If no config found, silently exits (not everyone uses Coda).
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, resolve, isAbsolute } from 'path';
import { setTimeout as sleep } from 'timers/promises';

// ─── Find Config ────────────────────────────────────────────────────────────
const projectDir = process.argv.includes('--project-dir')
  ? process.argv[process.argv.indexOf('--project-dir') + 1]
  : process.cwd();

const HOME = process.env.USERPROFILE || process.env.HOME;

function findConfig() {
  const projectConfig = join(projectDir, '.coda', 'config.json');
  if (existsSync(projectConfig)) return { path: projectConfig, root: projectDir };

  const userConfig = join(HOME, '.coda', 'config.json');
  if (existsSync(userConfig)) return { path: userConfig, root: HOME };

  return null;
}

const configResult = findConfig();
if (!configResult) {
  // No config = not a Coda user, exit silently
  process.exit(0);
}

const config = JSON.parse(readFileSync(configResult.path, 'utf-8'));

// ─── Validate ───────────────────────────────────────────────────────────────
const TOKEN = process.env[config.token_env || 'CODA_API_TOKEN'];
if (!TOKEN) {
  console.error(`[coda-sync] Warning: ${config.token_env || 'CODA_API_TOKEN'} not set, skipping sync.`);
  process.exit(0);
}

if (!config.sync || config.sync.length === 0) {
  // Nothing configured to sync
  process.exit(0);
}

// ─── Resolve output dir ─────────────────────────────────────────────────────
const outputDir = isAbsolute(config.output_dir || '')
  ? config.output_dir
  : resolve(projectDir, config.output_dir || 'work-pages/coda');

const format = config.format || 'markdown';

// ─── API Helpers (same as coda-sync.mjs) ────────────────────────────────────
const API_BASE = 'https://coda.io/apis/v1';

async function codaFetch(path, options = {}, retries = 3) {
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

    if ((res.status >= 500 || res.status === 429) && attempt < retries) {
      const waitSec = attempt * 3;
      console.error(`[coda-sync] Server error ${res.status}, retrying in ${waitSec}s...`);
      await sleep(waitSec * 1000);
      continue;
    }

    const body = await res.text();
    const clean = body.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 200);
    throw new Error(`Coda API ${res.status}: ${clean}`);
  }
}

async function resolveDoc(nameOrId) {
  if (/^[A-Za-z0-9_-]+$/.test(nameOrId) && nameOrId.length < 30) {
    try {
      const doc = await codaFetch(`/docs/${nameOrId}`);
      return { id: doc.id, name: doc.name };
    } catch { /* fall through */ }
  }

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

async function resolvePage(docId, nameOrId) {
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

  throw new Error(`Page not found: "${nameOrId}"`);
}

async function listAllPages(docId) {
  const pages = [];
  let pageToken = null;
  do {
    const params = pageToken ? `?pageToken=${pageToken}` : '';
    const res = await codaFetch(`/docs/${docId}/pages${params}`);
    for (const page of res.items) {
      if (!page.isHidden) pages.push({ id: page.id, name: page.name });
    }
    pageToken = res.nextPageToken || null;
  } while (pageToken);
  return pages;
}

async function getPageContentPlainText(docId, pageId) {
  let allItems = [];
  let pageToken = null;
  do {
    const params = pageToken ? `?pageToken=${pageToken}&limit=500` : '?limit=500';
    const res = await codaFetch(`/docs/${docId}/pages/${pageId}/content${params}`);
    allItems.push(...res.items);
    pageToken = res.nextPageToken || null;
  } while (pageToken);

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

async function exportPageContent(docId, pageId, fmt = 'markdown') {
  try {
    const exportRes = await codaFetch(`/docs/${docId}/pages/${pageId}/export`, {
      method: 'POST',
      body: JSON.stringify({ outputFormat: fmt }),
    });

    for (let i = 0; i < 30; i++) {
      await sleep(2000);
      const status = await codaFetch(`/docs/${docId}/pages/${pageId}/export/${exportRes.id}`);
      if (status.status === 'complete' && status.downloadLink) {
        const downloadRes = await fetch(status.downloadLink);
        if (downloadRes.ok) return await downloadRes.text();
      }
      if (status.error) throw new Error(status.error);
    }
    throw new Error('Export timed out');
  } catch (err) {
    console.error(`[coda-sync] Export failed, falling back to plain text...`);
    return await getPageContentPlainText(docId, pageId);
  }
}

function sanitizeFilename(name) {
  return name.replace(/[<>:"/\\|?*]/g, '-').replace(/\s+/g, ' ').trim();
}

// ─── Sync ───────────────────────────────────────────────────────────────────
console.error(`[coda-sync] Syncing ${config.sync.length} doc(s)...`);

let totalPages = 0;
let errors = 0;

for (const entry of config.sync) {
  try {
    const doc = await resolveDoc(entry.doc);
    const docDir = join(outputDir, sanitizeFilename(doc.name));
    if (!existsSync(docDir)) mkdirSync(docDir, { recursive: true });

    // Determine which pages to sync
    let pages;
    if (entry.pages && entry.pages.length > 0) {
      pages = [];
      for (const pageName of entry.pages) {
        try {
          pages.push(await resolvePage(doc.id, pageName));
        } catch (err) {
          console.error(`[coda-sync] Page "${pageName}" not found in "${doc.name}", skipping.`);
          errors++;
        }
      }
    } else {
      pages = await listAllPages(doc.id);
    }

    for (const page of pages) {
      try {
        const content = await exportPageContent(doc.id, page.id, format);
        const ext = format === 'html' ? '.html' : '.md';
        const filepath = join(docDir, `${sanitizeFilename(page.name)}${ext}`);
        const now = new Date().toISOString().split('T')[0];
        const withFrontmatter = `---\nsource: coda\ndoc_name: "${doc.name}"\ndoc_id: "${doc.id}"\npage_name: "${page.name}"\npage_id: "${page.id}"\nsynced_at: ${now}\n---\n\n${content}`;
        writeFileSync(filepath, withFrontmatter, 'utf-8');
        console.error(`[coda-sync] ✓ ${doc.name} → ${page.name}`);
        totalPages++;
      } catch (err) {
        console.error(`[coda-sync] ✗ ${doc.name} → ${page.name}: ${err.message}`);
        errors++;
      }
    }
  } catch (err) {
    console.error(`[coda-sync] ✗ Doc "${entry.doc}": ${err.message}`);
    errors++;
  }
}

console.error(`[coda-sync] Done. ${totalPages} page(s) synced${errors ? `, ${errors} error(s)` : ''}.`);
