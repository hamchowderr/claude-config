// Hook: PostToolUse (async) — logs tools that took longer than THRESHOLD_MS
// Writes to ~/.claude/slow-tools.log for profiling and retrospective review.
// Exit 0 always — informational only.

const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(process.env.USERPROFILE, '.claude', 'slow-tools.log');
const THRESHOLD_MS = 5000;
const MAX_LOG_LINES = 500;

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => { input += c; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const durationMs = data.duration_ms;

    if (!durationMs || durationMs < THRESHOLD_MS) process.exit(0);

    const toolName = data.tool_name || 'unknown';
    const toolInput = data.tool_input || {};
    const timestamp = new Date().toISOString();

    // Summarize tool input (truncate to avoid huge log entries)
    let inputSummary = '';
    if (toolInput.command) inputSummary = toolInput.command.slice(0, 120);
    else if (toolInput.file_path) inputSummary = toolInput.file_path;
    else if (toolInput.pattern) inputSummary = toolInput.pattern;
    else inputSummary = JSON.stringify(toolInput).slice(0, 120);

    const line = `${timestamp} | ${durationMs}ms | ${toolName} | ${inputSummary}\n`;

    // Append line, then trim to MAX_LOG_LINES if needed
    fs.appendFileSync(LOG_FILE, line, 'utf-8');

    const content = fs.readFileSync(LOG_FILE, 'utf-8');
    const lines = content.split('\n').filter(Boolean);
    if (lines.length > MAX_LOG_LINES) {
      fs.writeFileSync(LOG_FILE, lines.slice(-MAX_LOG_LINES).join('\n') + '\n', 'utf-8');
    }

    process.exit(0);
  } catch {
    process.exit(0);
  }
});
