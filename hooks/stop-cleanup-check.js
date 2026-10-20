// stop-cleanup-check.js
// Hook: Stop — if agent-browser is still running when Claude is about to finish,
// block the stop once and tell Claude to close it and any server it started.
// Rule text lives in the working-style rule ("Tools and environment"); this hook
// only reports what is running.
// Dev-server ports are listed but never block on their own: Chowderr runs their
// own servers too, and only Claude knows which ones it started.

const { execSync } = require('child_process');

const DEV_PORTS = new Set([3000, 3001, 3002, 3003, 4111, 4321, 5173, 6006, 8080, 8787]);

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', timeout: 8000, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch { return ''; }
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => { input += c; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    // Already blocked once this turn: let Claude stop, never loop.
    if (data.stop_hook_active) process.exit(0);

    const browser = /agent-browser/i.test(run('tasklist /FI "IMAGENAME eq agent-browser-win32-x64.exe" /NH'));
    if (!browser) process.exit(0);

    const ports = [...new Set(run('netstat -ano -p tcp').split('\n')
      .filter(l => /LISTENING/.test(l))
      .map(l => Number((l.trim().split(/\s+/)[1] || '').split(':').pop()))
      .filter(p => DEV_PORTS.has(p)))].sort((a, b) => a - b);

    const reason = 'agent-browser is still running. Run `agent-browser close --all`'
      + (ports.length ? `, and stop any server you started (listening dev ports: ${ports.join(', ')}; leave the ones Chowderr started)` : '')
      + ' before finishing. See the working-style rule, "Tools and environment".';
    process.stdout.write(JSON.stringify({ decision: 'block', reason }));
    process.exit(0);
  } catch {
    process.exit(0);
  }
});
