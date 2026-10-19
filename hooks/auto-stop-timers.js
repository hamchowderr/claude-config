// auto-stop-timers.js
// Hook: Stop — Stops any running mtn timer when session ends.
// Uses mtn CLI directly — no localhost:8081 dependency.

const { execSync } = require('child_process');

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', timeout: 8000, stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  } catch { return null; }
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => { input += c; });
process.stdin.on('end', () => {
  try {
    const timerStatus = run('mtn timer status');
    const timerRunning = timerStatus && !/no.*(active|running|timer)|not running|stopped/i.test(timerStatus);

    if (!timerRunning) {
      process.exit(0);
    }

    const taskLine = timerStatus.split('\n')[0];
    run('mtn timer stop');

    process.stdout.write(JSON.stringify({ systemMessage: `Auto-stopped mtn timer: ${taskLine}` }));
    process.exit(0);
  } catch {
    process.exit(0);
  }
});
