#!/usr/bin/env node
import { execSync } from 'child_process';

let raw = '';
process.stdin.on('data', chunk => (raw += chunk));
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(raw);
    const filePath = data.tool_input?.file_path || '';

    if (!filePath.endsWith('.sql')) process.exit(0);

    const status = execSync('dolt status 2>/dev/null', { encoding: 'utf8' }).trim();

    // Not a dolt repo if command failed or returned nothing meaningful
    if (!status) process.exit(0);

    const result = {
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: `[Dolt] Status after SQL file write:\n${status}\n\nNext: dolt add . && dolt commit -m "<describe change>"`,
      },
    };
    process.stdout.write(JSON.stringify(result));
  } catch {
    process.exit(0);
  }
});
