// vault-context-prime.js
// Hook: SessionStart (async, background)
// Primes a vault context cache so SubagentStart hook can inject it instantly.
// Detects the current project from cwd, runs vault-query context, writes cache.
// SubagentStart reads this file — no blocking wait on vault-query per spawn.

const { execSync, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const VAULT_QUERY = path.join(process.env.USERPROFILE, '.claude', 'scripts', 'vault-query.mjs');
const VAULT_DIR = path.join(process.env.USERPROFILE, 'Obsidian Vault');
const CODE_DIR = path.join(process.env.USERPROFILE, 'code');
const CACHE_FILE = path.join(process.env.USERPROFILE, '.claude', 'vault-context-cache.json');

function findProjectName(folderName) {
  const projectsDir = path.join(VAULT_DIR, '1. Projects');
  if (!fs.existsSync(projectsDir)) return null;
  const files = fs.readdirSync(projectsDir).filter(f => f.endsWith('.md'));
  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(projectsDir, file), 'utf8');
      const folderMatch = content.match(/^folder:\s*"?([^"\n]+)"?$/m);
      if (folderMatch && folderMatch[1].trim().toLowerCase() === folderName.toLowerCase()) {
        const nameMatch = content.match(/^name:\s*"?([^"\n]+)"?$/m);
        if (nameMatch) return nameMatch[1].trim();
        return file.replace('.md', '');
      }
    } catch { continue; }
  }
  return null;
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => { input += c; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const cwd = data.cwd || process.cwd();
    const folderName = path.basename(cwd);
    const isInCodeDir = cwd.toLowerCase().startsWith(CODE_DIR.toLowerCase());

    if (!isInCodeDir || folderName.toLowerCase() === 'workspace') process.exit(0);

    const projectName = findProjectName(folderName);
    if (!projectName) process.exit(0);

    // Run vault-query context — this is the slow part; running async so it doesn't block session start
    const result = spawnSync('node', [VAULT_QUERY, 'context', projectName], {
      encoding: 'utf8',
      timeout: 30000,
    });

    const contextText = (result.stdout || '').trim();
    if (!contextText) process.exit(0);

    const cache = {
      project: projectName,
      cwd,
      timestamp: new Date().toISOString(),
      context: contextText,
    };

    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
    process.exit(0);
  } catch {
    process.exit(0);
  }
});
