#!/usr/bin/env node
// Names Claude Code threads "Project: Task" when they end.
//
// SessionEnd hook mode (`--hook`): reads the hook JSON from stdin, queues the
// transcript, starts a detached worker and exits at once (SessionEnd hooks get
// a 1.5 s budget). Worker mode (`--worker`): drains the queue one thread at a
// time under a lock, so a burst of automated sessions never runs in parallel.
//
// The name is written the way /rename stores it: a `custom-title` line appended
// to the transcript. A thread renamed by hand (its latest title is not one this
// script wrote) is left alone. Project parent names come from
// ~/.claude/state/thread-namer/families.json (untracked; edit there).
//
// Manual run: node thread-namer.mjs --name <transcript.jsonl> [--dry]
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const STATE = path.join(os.homedir(), '.claude', 'state', 'thread-namer');
const QUEUE = path.join(STATE, 'queue');
const LOCK = path.join(STATE, 'worker.lock');
const DB = path.join(STATE, 'named.json'); // sessionId -> { title, userCount }
const LOG = path.join(STATE, 'thread-namer.log');
const FAMILIES = path.join(STATE, 'families.json');
const SELF = fileURLToPath(import.meta.url);
const GUARD = 'CLAUDE_THREAD_NAMER';

fs.mkdirSync(QUEUE, { recursive: true });
const log = (m) => { try { fs.appendFileSync(LOG, `${new Date().toISOString()} ${m}\n`); } catch {} };
const readJson = (p, d) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return d; } };
const textOf = (c) => typeof c === 'string' ? c : Array.isArray(c) ? c.filter((p) => p.type === 'text').map((p) => p.text).join(' ') : '';

// ---------- hook mode ----------
async function hook() {
  if (process.env[GUARD]) return; // our own claude -p child
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  let input = null;
  try { input = JSON.parse(raw); } catch { return; }
  if (!input?.transcript_path || !input?.session_id) return;
  fs.writeFileSync(path.join(QUEUE, `${input.session_id}.json`), JSON.stringify({ transcript: input.transcript_path, id: input.session_id, at: Date.now() }));
  const child = spawn(process.execPath, [SELF, '--worker'], { detached: true, stdio: 'ignore', windowsHide: true, env: { ...process.env } });
  child.unref();
}

// ---------- digest ----------
function digest(file) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  let cwd = '', lastTitle = '', users = [], lastAssistant = '', assistantCount = 0;
  for (const l of lines) {
    if (!l.trim()) continue;
    let o; try { o = JSON.parse(l); } catch { continue; }
    if (o.type === 'custom-title') lastTitle = o.customTitle;
    if (o.cwd && !cwd) cwd = o.cwd;
    if (o.isSidechain) continue;
    if (o.type === 'user' && o.message && !o.isMeta) {
      const t = textOf(o.message.content).trim();
      if (!t || (t.startsWith('<') && !t.startsWith('<command-name>'))) continue;
      users.push(t.replace(/\s+/g, ' '));
    }
    if (o.type === 'assistant' && o.message) {
      assistantCount++;
      const t = textOf(o.message.content).trim();
      if (t) lastAssistant = t.replace(/\s+/g, ' ').slice(0, 300);
    }
  }
  return { cwd, lastTitle, users, lastAssistant, assistantCount };
}

// ---------- naming ----------
const isTrivialCmd = (m) => /^<command-name>\/(clear|exit|resume|model|config|plugin|mcp|login|status|rename)<\/command-name>/.test(m);

function deterministic(d) {
  const real = d.users.filter((m) => !isTrivialCmd(m));
  if (!real.length) return d.users.length ? 'Empty: Cleared Thread' : null;
  const first = real[0];
  if (/^You previously responded with tool calls/.test(first)) return 'Automation / Session Summary: Retry Prompt';
  if (/^You produce concise, factual weekly communication/.test(first)) {
    const client = (first.match(/Client: (.+?)(?= [A-Z][a-z]+:| -|$)/) || [])[1]?.trim();
    return `Automation / Comms Digest: ${client || 'Unknown Client'}`;
  }
  return undefined; // needs the model
}

function promptFor(d) {
  const real = d.users.filter((m) => !isTrivialCmd(m));
  const first = real[0];
  const automated = /^Session transcript:/.test(first) || /^<relay from=/.test(first);
  const msgs = (real.length > 30 ? [...real.slice(0, 15), `… ${real.length - 30} more …`, ...real.slice(-15)] : real)
    .map((m) => m.slice(0, automated ? 600 : 180));
  const fam = readJson(FAMILIES, { map: {} }).map;
  const parents = [...new Set(Object.values(fam).map(([p]) => p))].join(', ');
  return [
    'Name this Claude Code thread. Reply with the name only, one line, no quotes.',
    automated
      ? 'It is an automated session-summary run; the messages are the conversation it summarized. Format: "Automation / Session Summary: <Project> - <Task>".'
      : 'Format: "Project: Task" in Title Case. Two distinct tasks: "Project: Task A + Task B". Three or more: the main one or two then " + More" (main = most messages or what it ended on).',
    'Project = the product/repo/area. Derive it from the working directory (a git worktree path .../<repo>/.claude/worktrees/<x> means <repo>); when the directory is a notes vault or home folder, pick the real project or business from the messages. Never use a folder name such as "Obsidian Vault", "code", "Temp" or a user name as the project; use "Vault" only for note-keeping tasks.',
    `Use these parent project names when one fits: ${parents}. For a sub-project write "Parent / Sub", e.g. "Mastra / Chat Kit: Fix Login".`,
    'Task: specific plain words, what was actually done or asked. Under 70 characters total. No "Session", "Work", "Misc", "Chat", no metaphors.',
    '',
    `Working directory: ${d.cwd}`,
    'User messages in order:',
    ...msgs.map((m, i) => `${i + 1}. ${m}`),
    `Last assistant message: ${d.lastAssistant}`,
  ].join('\n');
}

// Sonnet for threads the user started (Haiku misfiled client work under "Vault" in testing); Haiku for automated runs.
function askModel(prompt, model) {
  const env = { ...process.env, [GUARD]: '1' };
  delete env.ANTHROPIC_API_KEY; // subscription only, never Console billing
  // No shell: a shell drops the empty "" arguments that turn off settings and tools.
  const exe = process.platform === 'win32' ? path.join(os.homedir(), '.local', 'bin', 'claude.exe') : 'claude';
  const r = spawnSync(exe, ['-p', '--model', model,'--no-session-persistence', '--setting-sources', '', '--tools', ''], {
    input: prompt, env, encoding: 'utf8', timeout: 120000, windowsHide: true,
  });
  if (r.status !== 0) throw new Error(`claude -p exit ${r.status}: ${(r.stderr || '').slice(0, 200)}`);
  return r.stdout.trim().split('\n').pop().replace(/^["'`]|["'`]$/g, '').trim();
}

// Map the project prefix onto its parent name ("FiveM Studio: X" -> "myRP.build / FiveM Studio: X").
function regroup(title) {
  const fam = readJson(FAMILIES, { map: {} }).map;
  const i = title.indexOf(': ');
  if (i < 0) return title;
  const head = title.slice(0, i);
  const m = fam[head]; // automated names ("Automation / ...") never match a family key
  if (!m) return title;
  const [parent, sub] = m;
  return `${parent}${sub ? ' / ' + sub : ''}: ${title.slice(i + 2)}`;
}

function nameOne(file, id, dry) {
  if (!fs.existsSync(file)) return log(`skip missing ${id}`);
  const db = readJson(DB, {});
  const d = digest(file);
  const mine = db[id];
  if (d.lastTitle && (!mine || mine.title !== d.lastTitle)) return log(`skip manual ${id} "${d.lastTitle}"`);
  // Empty thread (no Claude reply and no user message beyond /clear-type commands): delete it.
  if (!d.assistantCount && !d.users.some((m) => !isTrivialCmd(m))) {
    if (dry) return console.log('(would delete: empty)');
    const root = path.join(os.homedir(), '.claude', 'projects');
    if (!path.resolve(file).startsWith(root + path.sep)) return log(`skip delete outside projects ${id}`);
    fs.rmSync(file);
    const side = path.join(path.dirname(file), id);
    if (fs.existsSync(side)) fs.rmSync(side, { recursive: true });
    const db2 = readJson(DB, {}); delete db2[id]; fs.writeFileSync(DB, JSON.stringify(db2));
    return log(`deleted empty ${id}`);
  }
  if (mine && mine.userCount === d.users.length) return log(`skip unchanged ${id}`);
  let title = deterministic(d);
  if (title === null) return log(`skip empty ${id}`);
  if (title === undefined) {
    const auto = /^(Session transcript:|<relay from=)/.test(d.users.find((m) => !isTrivialCmd(m)) || '');
    title = regroup(askModel(promptFor(d), auto ? 'haiku' : 'sonnet'));
  }
  if (!title || !title.includes(': ') || title.length > 120) return log(`bad title ${id} "${title}"`);
  if (dry) return console.log(title);
  const b = fs.readFileSync(file);
  fs.appendFileSync(file, (b.length && b[b.length - 1] !== 10 ? '\n' : '') + JSON.stringify({ type: 'custom-title', customTitle: title, sessionId: id }) + '\n');
  const db2 = readJson(DB, {});
  db2[id] = { title, userCount: d.users.length };
  fs.writeFileSync(DB, JSON.stringify(db2));
  log(`named ${id} "${title}"`);
}

// ---------- worker ----------
function worker() {
  try {
    if (fs.existsSync(LOCK) && Date.now() - fs.statSync(LOCK).mtimeMs > 15 * 60e3) fs.unlinkSync(LOCK);
    fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
  } catch { return; } // another worker is draining the queue
  try {
    for (;;) {
      const items = fs.readdirSync(QUEUE).filter((f) => f.endsWith('.json'));
      if (!items.length) break;
      for (const f of items) {
        const p = path.join(QUEUE, f);
        const job = readJson(p, null);
        try { fs.unlinkSync(p); } catch {}
        if (!job) continue;
        fs.utimesSync(LOCK, new Date(), new Date());
        try { nameOne(job.transcript, job.id, false); } catch (e) { log(`error ${job.id} ${e.message}`); }
      }
    }
  } finally { try { fs.unlinkSync(LOCK); } catch {} }
}

const arg = process.argv[2];
if (arg === '--hook') await hook();
else if (arg === '--worker') worker();
else if (arg === '--name') {
  const file = process.argv[3];
  nameOne(file, path.basename(file, '.jsonl'), process.argv.includes('--dry'));
} else console.error('usage: thread-namer.mjs --hook | --worker | --name <transcript.jsonl> [--dry]');
