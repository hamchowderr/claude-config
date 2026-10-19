// Hook: PermissionDenied — fires when auto mode classifier denies a tool call
// Can return { retry: true } to allow model to retry
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => { input += c; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const toolName = data.tool_name || 'unknown';
    const cmd = data.tool_input?.command || '';
    const detail = cmd ? `: ${cmd.slice(0, 80)}` : '';
    process.stdout.write(`Permission denied — ${toolName}${detail}`);
  } catch {}
  process.exit(0);
});
