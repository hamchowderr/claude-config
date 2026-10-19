// Hook: InstructionsLoaded — fires when CLAUDE.md or .claude/rules/*.md loads
// Observability only; no decision control
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => { input += c; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const filePath = data.file_path || '';
    const loadReason = data.load_reason || '';
    if (filePath && loadReason !== 'session_start') {
      process.stdout.write(`Instructions loaded: ${filePath} (${loadReason})`);
    }
  } catch {}
  process.exit(0);
});
