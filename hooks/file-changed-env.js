// file-changed-env.js
// Hook: FileChanged — Re-sources .env when it changes on disk mid-session
// Matcher: ".env|.env.local" (matches on file basename)
// Writes updated vars to CLAUDE_ENV_FILE so subsequent Bash commands see them
// Notifies user via systemMessage when the file changes

const fs = require('fs');
const path = require('path');

// Parse .env file into export statements safe for bash sourcing
function parseEnvToExports(envPath) {
  try {
    const lines = [];
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)\s*=(.*)$/i);
      if (match) {
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
    const filePath = data.file_path || '';
    const event = data.event || 'change';
    const envFile = process.env.CLAUDE_ENV_FILE;
    const basename = path.basename(filePath);

    if (event === 'unlink') {
      // File was deleted
      process.stdout.write(JSON.stringify({
        systemMessage: `${basename} was deleted on disk. Environment variables from it may still be active in this session.`
      }));
      process.exit(0);
    }

    if (!fs.existsSync(filePath)) {
      process.exit(0);
    }

    // Re-source into CLAUDE_ENV_FILE
    const exports = parseEnvToExports(filePath);
    let message = `${basename} changed on disk`;

    if (envFile && exports.length > 0) {
      fs.appendFileSync(envFile, exports.join('\n') + '\n');
      message += ` — ${exports.length} environment variable(s) reloaded into session`;
    } else {
      message += ` — restart session to pick up changes (CLAUDE_ENV_FILE not available)`;
    }

    process.stdout.write(JSON.stringify({
      systemMessage: message
    }));

    process.exit(0);
  } catch {
    process.exit(0);
  }
});
