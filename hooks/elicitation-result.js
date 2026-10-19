// Hook: ElicitationResult — fires after user responds to MCP elicitation
// Can override response or cancel via hookSpecificOutput { action, content }
// Exit 0 = pass response through as-is
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => { input += c; });
process.stdin.on('end', () => {
  process.exit(0);
});
