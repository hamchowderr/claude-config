// pii-commit-guard.js
// Hook: PreToolUse (Bash + PowerShell) — before `git commit`, scan the lines
// being added for personal data (phone numbers, street addresses, a batch of
// email addresses) and ask first if any turn up.
// Rule text lives in the secrets rule ("What stays out of git and out of
// Infisical"); this hook only reports where it found something. It never prints
// the matched values, since they are the personal data.
// The Obsidian vault is skipped: it is the trusted home for contact notes.

const { execSync } = require('child_process');
const path = require('path');

const SKIP_FILE = /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|.*\.min\.(js|css)|.*\.(png|jpe?g|gif|webp|ico|pdf|zip|woff2?))$/i;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const EMAIL_OK = /(noreply|no-reply|example\.(com|org)|@anthropic\.com|@users\.noreply\.github\.com|otakusolutions\.io)/i;
const PHONE = /(?<![\d.])(?:\+1[-. ]?|1[- ])?\(?\d{3}\)?[-. ]\d{3}[-. ]\d{4}(?![\d.])/;
const ADDRESS = /\b\d{2,6}\s+(?:[A-Z][a-z]+\s){1,3}(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Dr|Drive|Ln|Lane|Way|Ct|Court)\b/;

function git(args, cwd) {
  return execSync(`git ${args}`, { cwd, encoding: 'utf8', timeout: 10000, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => { input += c; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const cmd = (data.tool_input && data.tool_input.command) || '';
    if (!/\bgit\b[^\n|;&]*\scommit\b/.test(cmd)) process.exit(0);

    const cwd = data.cwd || process.cwd();
    const top = git('rev-parse --show-toplevel', cwd).trim();
    if (path.basename(top) === 'Obsidian Vault') process.exit(0);

    const all = /\scommit\b[^\n|;&]*\s(-a|--all|-am)\b/.test(cmd);
    const diff = git(all ? 'diff HEAD -U0 --no-color' : 'diff --cached -U0 --no-color', top);

    const found = {};
    const emails = new Set();
    let file = null;
    for (const line of diff.split('\n')) {
      if (line.startsWith('+++ ')) { file = line.replace(/^\+\+\+ (b\/)?/, ''); continue; }
      if (!file || SKIP_FILE.test(file) || !line.startsWith('+') || line.startsWith('+++')) continue;
      const kinds = [];
      if (PHONE.test(line)) kinds.push('phone number');
      if (ADDRESS.test(line)) kinds.push('street address');
      for (const e of line.match(EMAIL) || []) if (!EMAIL_OK.test(e)) emails.add(`${file}\u0000${e.toLowerCase()}`);
      if (kinds.length) found[file] = new Set([...(found[file] || []), ...kinds]);
    }
    const perFile = {};
    for (const k of emails) { const f = k.split('\u0000')[0]; perFile[f] = (perFile[f] || 0) + 1; }
    for (const [f, n] of Object.entries(perFile)) if (n >= 3) found[f] = new Set([...(found[f] || []), `${n} email addresses`]);

    const files = Object.keys(found);
    if (!files.length) process.exit(0);
    const list = files.slice(0, 8).map(f => `${f} (${[...found[f]].join(', ')})`).join('; ');
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'ask',
        permissionDecisionReason: `The commit adds what looks like personal data: ${list}${files.length > 8 ? `; and ${files.length - 8} more files` : ''}. Customer PII never goes into git, even a private repo. See the secrets rule.`,
      },
    }));
    process.exit(0);
  } catch {
    process.exit(0);
  }
});
