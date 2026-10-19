// Hook: PermissionRequest — fires before permission dialog is shown
// Can auto-approve or modify input via hookSpecificOutput
// Exit 0 = show dialog as normal
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => { input += c; });
process.stdin.on('end', () => {
  process.exit(0);
});
