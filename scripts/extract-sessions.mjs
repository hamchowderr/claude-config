#!/usr/bin/env node
/**
 * extract-sessions.mjs
 *
 * Scans ~/.claude/projects/ for JSONL conversation transcripts and generates
 * Obsidian session notes in 2. Areas/Sessions/.
 *
 * Usage:
 *   node extract-sessions.mjs                   # Full run: manifest + notes
 *   node extract-sessions.mjs --manifest-only   # Only generate manifest JSON
 *   node extract-sessions.mjs --dry-run         # Show what would be created
 *   node extract-sessions.mjs --update-projects # Update project note ## Sessions sections
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'fs';
import { join, basename } from 'path';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { homedir } from 'os';

// ─── Paths ───────────────────────────────────────────────────────────────────
const HOME = homedir();
const CLAUDE_PROJECTS = join(HOME, '.claude', 'projects');
const VAULT = join(HOME, 'Obsidian Vault');
const SESSIONS_DIR = join(VAULT, '2. Areas', 'Sessions');
const PROJECTS_DIR = join(VAULT, '1. Projects');
const MANIFEST_PATH = join(HOME, '.claude', 'session-manifest.json');

// ─── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const MANIFEST_ONLY = args.includes('--manifest-only');
const DRY_RUN = args.includes('--dry-run');
const UPDATE_PROJECTS = args.includes('--update-projects');

// ─── Build folder→project mapping from vault project notes ───────────────────
function buildFolderMapping() {
  const mapping = {}; // folder → { name, noteFile }
  const files = readdirSync(PROJECTS_DIR).filter(f => f.endsWith('.md'));

  for (const f of files) {
    const content = readFileSync(join(PROJECTS_DIR, f), 'utf-8').replace(/^\uFEFF/, '');
    const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fmMatch) continue;

    const fm = fmMatch[1];
    const folderMatch = fm.match(/^folder:\s*["']?([^"'\r\n]+?)["']?\s*$/m);
    const nameMatch = fm.match(/^name:\s*["']?([^"'\r\n]+?)["']?\s*$/m);

    if (folderMatch) {
      const folder = folderMatch[1].trim();
      const name = nameMatch ? nameMatch[1].trim() : basename(f, '.md');
      mapping[folder] = { name, noteFile: f };
    }
  }

  return mapping;
}

// ─── Extract folder name from JSONL project directory name ───────────────────
function dirToFolder(dirName) {
  // Pattern: C--Users-HamCh-code-{folder}
  const match = dirName.match(/^C--Users-HamCh-code-(.+)$/);
  return match ? match[1] : null;
}

// ─── Parse a single JSONL file (streaming for memory efficiency) ─────────────
async function parseJsonlFile(filePath) {
  const rl = createInterface({
    input: createReadStream(filePath, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  });

  let sessionId = null;
  let cwd = null;
  let slug = null;
  let gitBranch = null;
  let firstTimestamp = null;
  let lastTimestamp = null;
  let userMessageCount = 0;
  let firstUserContent = null;
  const userMessages = []; // first 5 non-trivial user messages

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);

      // Extract metadata from any line that has it
      if (obj.sessionId && !sessionId) sessionId = obj.sessionId;
      if (obj.cwd && !cwd) cwd = obj.cwd;
      if (obj.slug && !slug) slug = obj.slug;
      if (obj.gitBranch && gitBranch !== obj.gitBranch) gitBranch = obj.gitBranch;

      // Track timestamps
      if (obj.timestamp) {
        if (!firstTimestamp) firstTimestamp = obj.timestamp;
        lastTimestamp = obj.timestamp;
      }

      // Count real user messages (not meta/system)
      if (obj.type === 'user' && obj.isMeta !== true) {
        const content = extractTextContent(obj.message?.content);
        // Skip empty or very short messages, and skip /command messages
        if (content && content.length > 5 && !content.startsWith('<command-name>')) {
          userMessageCount++;
          if (userMessages.length < 5) {
            userMessages.push(content.substring(0, 250));
          }
        }
      }
    } catch (e) {
      // Skip malformed lines
    }
  }

  return {
    sessionId: sessionId || basename(filePath, '.jsonl'),
    cwd,
    slug,
    gitBranch: gitBranch === 'HEAD' ? null : gitBranch,
    firstTimestamp,
    lastTimestamp,
    userMessageCount,
    userMessages,
    filePath,
  };
}

// ─── Extract text from message content (string or array of content blocks) ───
function extractTextContent(content) {
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content
      .filter(c => c.type === 'text' && c.text)
      .map(c => c.text)
      .join(' ')
      .trim();
  }
  return '';
}

// ─── Scan all project dirs for JSONL files ───────────────────────────────────
async function scanAllSessions(folderMapping) {
  const sessions = [];
  const dirs = readdirSync(CLAUDE_PROJECTS).filter(d => {
    return statSync(join(CLAUDE_PROJECTS, d)).isDirectory();
  });

  for (const dir of dirs) {
    const dirPath = join(CLAUDE_PROJECTS, dir);
    const jsonlFiles = readdirSync(dirPath).filter(f => f.endsWith('.jsonl'));

    if (jsonlFiles.length === 0) continue;

    // Resolve folder → project
    const folder = dirToFolder(dir);
    const projectInfo = folder ? folderMapping[folder] : null;
    const projectName = projectInfo ? projectInfo.name : null;

    for (const file of jsonlFiles) {
      const filePath = join(dirPath, file);
      console.log(`  Scanning: ${dir}/${file}`);

      try {
        const session = await parseJsonlFile(filePath);
        session.project = projectName;
        session.folder = folder;
        session.dirName = dir;
        sessions.push(session);
      } catch (e) {
        console.error(`  Error parsing ${file}: ${e.message}`);
      }
    }
  }

  return sessions;
}

// ─── Filter sessions ─────────────────────────────────────────────────────────
function filterSessions(sessions) {
  return sessions.filter(s => {
    // Must have at least 4 real user messages
    if (s.userMessageCount < 4) return false;
    // Must have timestamps
    if (!s.firstTimestamp) return false;
    return true;
  });
}

// ─── Generate session note filename ──────────────────────────────────────────
function generateFilename(session, existingFilenames) {
  const date = session.firstTimestamp.split('T')[0]; // YYYY-MM-DD
  const slug = (session.project || session.slug || 'general')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const type = 'code'; // default session type

  let filename = `${date}-${slug}-${type}.md`;

  // Handle duplicates with counter
  if (existingFilenames.has(filename)) {
    let counter = 2;
    while (existingFilenames.has(`${date}-${slug}-${type}-${counter}.md`)) {
      counter++;
    }
    filename = `${date}-${slug}-${type}-${counter}.md`;
  }

  existingFilenames.add(filename);
  return filename;
}

// ─── Calculate duration string ───────────────────────────────────────────────
function formatDuration(startIso, endIso) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const diffMs = end - start;
  if (diffMs < 0) return 'unknown';

  const hours = Math.floor(diffMs / 3600000);
  const minutes = Math.floor((diffMs % 3600000) / 60000);

  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// ─── Truncate text to a max length, breaking at word boundary ────────────────
function truncate(text, maxLen = 200) {
  if (!text || text.length <= maxLen) return text;
  const cut = text.substring(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > maxLen * 0.5 ? cut.substring(0, lastSpace) : cut) + '...';
}

// ─── Clean user message for display (strip XML tags, ANSI codes, system prompts)
function cleanMessage(msg) {
  if (!msg) return '';
  // Remove ANSI escape codes
  let cleaned = msg.replace(/\x1b\[[0-9;]*m/g, '').replace(/\[(?:\d+;)*\d*m/g, '');
  // Remove XML-like tags
  cleaned = cleaned.replace(/<[^>]+>/g, '').trim();
  // Remove "This session is being continued..." preamble
  if (cleaned.startsWith('This session is being continued')) {
    const newlineIdx = cleaned.indexOf('\n\n');
    if (newlineIdx > 0) cleaned = cleaned.substring(newlineIdx + 2).trim();
  }
  // Remove system-reminder content
  cleaned = cleaned.replace(/Contents of .*?CLAUDE\.md[\s\S]*$/m, '').trim();
  // Remove unicode box-drawing/symbol noise
  cleaned = cleaned.replace(/[⛁⛀]+/g, '').trim();
  return cleaned;
}

// ─── Check if a message is trivial/noise ─────────────────────────────────────
function isTrivialMessage(msg) {
  if (!msg) return true;
  const cleaned = cleanMessage(msg);
  if (cleaned.length < 10) return true;
  // Filter out interrupted messages
  if (cleaned.includes('[Request interrupted by user')) return true;
  // Filter out pure terminal output noise
  if (/^[\s\W]*$/.test(cleaned)) return true;
  // Filter out context usage displays
  if (cleaned.startsWith('Context Usage')) return true;
  // Filter out MCP server messages
  if (/^Disabled \d+ MCP server/.test(cleaned)) return true;
  if (/^Enabled \d+ MCP server/.test(cleaned)) return true;
  // Filter out claude model info lines
  if (/claude-opus|claude-sonnet|claude-haiku/.test(cleaned) && cleaned.length < 100) return true;
  // Filter out background command outputs
  if (cleaned.startsWith('Background command')) return true;
  // Filter out bare hashes (commit SHAs)
  if (/^[a-f0-9]{6,40}$/.test(cleaned)) return true;
  // Filter out file paths alone
  if (/^C:\\Users\\/.test(cleaned) && cleaned.split('\n').length <= 2) return true;
  return false;
}

// ─── Generate session note content ───────────────────────────────────────────
function generateNoteContent(session) {
  const projectRef = session.project ? `"[[${session.project}]]"` : 'null';
  const branch = session.gitBranch || '';
  const tags = ['session', 'code'];

  // Get first meaningful user message as goal
  const goalMsg = session.userMessages.find(m => !isTrivialMessage(m));
  const goal = truncate(cleanMessage(goalMsg || ''), 200) || 'Session imported from conversation history';

  // Build summary bullets from user messages, filtering noise
  const summaryBullets = session.userMessages
    .filter(m => !isTrivialMessage(m))
    .map(m => cleanMessage(m))
    .filter(m => m.length > 10)
    .slice(0, 5)
    .map(m => `- ${truncate(m, 150)}`);

  const duration = session.lastTimestamp
    ? formatDuration(session.firstTimestamp, session.lastTimestamp)
    : 'unknown';

  const contextLines = [];
  if (session.project) contextLines.push(`- Working on [[${session.project}]]`);
  else contextLines.push('- General session (no specific project)');
  if (branch) contextLines.push(`- Branch: \`${branch}\``);
  contextLines.push(`- Duration: ${duration}`);
  contextLines.push(`- Messages: ${session.userMessageCount}`);

  return `---
type: session
project: ${projectRef}
status: done
session_type: code
branch: "${branch}"
started: ${session.firstTimestamp}
ended: ${session.lastTimestamp || 'null'}
tags:
  - session
  - code
---

## Goal
${goal}

## Context
${contextLines.join('\n')}

## Session Summary
${summaryBullets.length > 0 ? summaryBullets.join('\n') : '- (Imported from conversation history — no detailed summary available)'}
`;
}

// ─── Update project notes with session links ─────────────────────────────────
function updateProjectNotes(sessions) {
  // Group sessions by project
  const byProject = {};
  for (const s of sessions) {
    if (!s.project) continue;
    if (!byProject[s.project]) byProject[s.project] = [];
    byProject[s.project].push(s);
  }

  let updated = 0;
  const projectFiles = readdirSync(PROJECTS_DIR).filter(f => f.endsWith('.md'));

  for (const f of projectFiles) {
    const filePath = join(PROJECTS_DIR, f);
    const content = readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '');

    // Get project name from frontmatter
    const nameMatch = content.match(/^name:\s*["']?([^"'\r\n]+?)["']?\s*$/m);
    const projectName = nameMatch ? nameMatch[1].trim() : basename(f, '.md');

    const projectSessions = byProject[projectName];
    if (!projectSessions || projectSessions.length === 0) continue;

    // Sort by date, newest first
    projectSessions.sort((a, b) => b.firstTimestamp.localeCompare(a.firstTimestamp));

    // Build session links — use first meaningful user message as description
    const sessionLinks = projectSessions.map(s => {
      const filename = s._generatedFilename?.replace('.md', '') || '';
      const msg = s.userMessages?.find(m => {
        const c = cleanMessage(m);
        return c.length > 10 && !c.includes('[Request interrupted');
      });
      const goal = truncate(cleanMessage(msg || ''), 60);
      return `- [[${filename}]]${goal ? ' — ' + goal : ''}`;
    });

    const sessionsSection = `## Sessions\n${sessionLinks.join('\n')}`;

    // Replace existing ## Sessions section (match until next ## heading or end of file)
    let newContent;
    const sessionsRegex = /## Sessions\r?\n[\s\S]*?(?=\r?\n## )/;
    if (sessionsRegex.test(content)) {
      newContent = content.replace(sessionsRegex, sessionsSection + '\n');
    } else if (/## Sessions/.test(content)) {
      // Sessions is the last section — replace to end of file
      newContent = content.replace(/## Sessions\r?\n[\s\S]*$/, sessionsSection + '\n');
    } else {
      // Append if no Sessions section exists
      newContent = content.trimEnd() + '\n\n' + sessionsSection + '\n';
    }

    if (newContent !== content) {
      if (DRY_RUN) {
        console.log(`  [DRY RUN] Would update: ${f} (${projectSessions.length} sessions)`);
      } else {
        writeFileSync(filePath, newContent, 'utf-8');
        console.log(`  Updated: ${f} (${projectSessions.length} sessions)`);
      }
      updated++;
    }
  }

  return updated;
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Session Extraction ===\n');

  // Step 1: Build project mapping
  console.log('Building folder→project mapping...');
  const folderMapping = buildFolderMapping();
  console.log(`  Found ${Object.keys(folderMapping).length} project mappings\n`);

  // If only updating project notes, read manifest and update
  if (UPDATE_PROJECTS) {
    console.log('Updating project notes from manifest...');
    if (!existsSync(MANIFEST_PATH)) {
      console.error('No manifest found. Run without --update-projects first.');
      process.exit(1);
    }
    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));
    const updated = updateProjectNotes(manifest);
    console.log(`\nDone. Updated ${updated} project notes.`);
    return;
  }

  // Step 2: Scan all JSONL files
  console.log('Scanning JSONL files...');
  const allSessions = await scanAllSessions(folderMapping);
  console.log(`\n  Total sessions found: ${allSessions.length}`);

  // Step 3: Filter
  const sessions = filterSessions(allSessions);
  console.log(`  After filtering (≥4 user messages): ${sessions.length}`);

  // Sort by timestamp
  sessions.sort((a, b) => (a.firstTimestamp || '').localeCompare(b.firstTimestamp || ''));

  // Step 4: Generate filenames
  const existingFilenames = new Set();
  // Also check what already exists in the sessions dir
  if (existsSync(SESSIONS_DIR)) {
    readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.md')).forEach(f => existingFilenames.add(f));
  }

  for (const s of sessions) {
    s._generatedFilename = generateFilename(s, existingFilenames);
  }

  // Step 5: Write manifest
  console.log(`\nWriting manifest to ${MANIFEST_PATH}...`);
  const manifestData = sessions.map(s => ({
    sessionId: s.sessionId,
    project: s.project,
    folder: s.folder,
    slug: s.slug,
    gitBranch: s.gitBranch,
    firstTimestamp: s.firstTimestamp,
    lastTimestamp: s.lastTimestamp,
    userMessageCount: s.userMessageCount,
    filePath: s.filePath,
    _generatedFilename: s._generatedFilename,
    userMessages: s.userMessages,
  }));

  writeFileSync(MANIFEST_PATH, JSON.stringify(manifestData, null, 2), 'utf-8');
  console.log(`  Manifest saved with ${manifestData.length} entries.`);

  if (MANIFEST_ONLY) {
    console.log('\n--manifest-only: stopping here.');
    return;
  }

  // Step 6: Generate session notes
  console.log('\nGenerating session notes...');
  if (!existsSync(SESSIONS_DIR)) {
    mkdirSync(SESSIONS_DIR, { recursive: true });
  }

  let created = 0;
  let skipped = 0;

  for (const s of sessions) {
    const filename = s._generatedFilename;
    const filePath = join(SESSIONS_DIR, filename);

    if (existsSync(filePath)) {
      skipped++;
      continue;
    }

    const content = generateNoteContent(s);

    if (DRY_RUN) {
      console.log(`  [DRY RUN] Would create: ${filename} (${s.project || 'no project'}, ${s.userMessageCount} msgs)`);
    } else {
      writeFileSync(filePath, content, 'utf-8');
      console.log(`  Created: ${filename}`);
    }
    created++;
  }

  console.log(`\nDone. Created: ${created}, Skipped (existing): ${skipped}`);

  // Step 7: Summary
  console.log('\n=== Summary by Project ===');
  const byProject = {};
  for (const s of sessions) {
    const key = s.project || '(no project)';
    byProject[key] = (byProject[key] || 0) + 1;
  }
  Object.entries(byProject)
    .sort((a, b) => b[1] - a[1])
    .forEach(([proj, count]) => console.log(`  ${proj}: ${count} sessions`));
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
