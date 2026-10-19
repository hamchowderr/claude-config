// Hook: Elicitation — fires when an MCP server requests user input
// Can accept/decline/cancel via hookSpecificOutput { action, content }
// Exit 0 = let dialog proceed normally
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => { input += c; });
process.stdin.on('end', () => {
  process.exit(0);
});
