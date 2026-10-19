// Hook: TeammateIdle — fires when an agent teammate is about to go idle
// Return exit 2 with continue: false JSON to keep teammate working
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => { input += c; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const agentType = data.agent_type || 'unknown';
    process.stdout.write(`Teammate idle: ${agentType}`);
  } catch {}
  process.exit(0);
});
