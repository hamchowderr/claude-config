// cwd-changed.js
// Hook: CwdChanged — Reloads .env when working directory changes
// Uses CLAUDE_ENV_FILE to persist new env vars into subsequent Bash commands
// Also returns watchPaths so FileChanged dynamically watches the new .env file
// Fires when Claude executes a cd command or changes working directory

const fs = require('fs');
const path = require('path');

const CODE_DIR = path.join(process.env.USERPROFILE, 'code');
const VAULT_DIR = path.join(process.env.USERPROFILE, 'Obsidian Vault');

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

// Find nearest .env / .env.local walking up from dir
function findEnvFile(dir) {
  let current = dir;
  const root = path.parse(current).root;
  while (current !== root) {
    for (const name of ['.env.local', '.env']) {
      const candidate = path.join(current, name);
      if (fs.existsSync(candidate)) return candidate;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

// Parse .env file into export statements safe for bash sourcing
function parseEnvToExports(envPath) {
  try {
    const lines = [];
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)\s*=(.*)$/i);
      if (match) {
        // Strip surrounding quotes from value, then re-quote safely
        let val = match[2].trim().replace(/^['"]|['"]$/g, '');
        val = val.replace(/"/g, '\\"');
        lines.push(`export ${match[1]}="${val}"`);
      }
    }
    return lines;
  } catch {
    return [];
  }
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const newCwd = data.new_cwd || '';
    const oldCwd = data.old_cwd || '';
    const envFile = process.env.CLAUDE_ENV_FILE;

    const envPath = findEnvFile(newCwd);
    const watchPaths = [];

    // Source the new .env into CLAUDE_ENV_FILE
    if (envFile && envPath) {
      const exports = parseEnvToExports(envPath);
      if (exports.length > 0) {
        fs.appendFileSync(envFile, exports.join('\n') + '\n');
      }
      watchPaths.push(envPath);

      // Also watch sibling (.env if we found .env.local, or vice versa)
      const sibling = envPath.endsWith('.env.local')
        ? path.join(path.dirname(envPath), '.env')
        : path.join(path.dirname(envPath), '.env.local');
      if (fs.existsSync(sibling)) watchPaths.push(sibling);
    }

    // Detect project switch for notification
    const oldFolder = path.basename(oldCwd);
    const newFolder = path.basename(newCwd);
    const isNowInCode = newCwd.toLowerCase().startsWith(CODE_DIR.toLowerCase());
    const wasInCode = oldCwd.toLowerCase().startsWith(CODE_DIR.toLowerCase());

    const output = {};
    if (watchPaths.length > 0) output.watchPaths = watchPaths;

    // Notify when switching between known projects
    if (isNowInCode && newFolder !== oldFolder && newFolder.toLowerCase() !== 'workspace') {
      const newProject = findProjectName(newFolder);
      if (newProject && wasInCode) {
        const envNote = envPath ? ` | .env loaded` : '';
        output.systemMessage =
          `Working directory changed to ${newProject}${envNote}. ` +
          `Load project context if needed: vault-query.mjs context "${newProject}"`;
      }
    }

    process.stdout.write(JSON.stringify(output));
    process.exit(0);
  } catch {
    process.exit(0);
  }
});
