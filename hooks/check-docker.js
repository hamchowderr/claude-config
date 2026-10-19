// check-docker.js
// Hook: Verifies Docker Desktop is running before Supabase CLI commands
// Input: JSON on stdin from Claude Code
// Exit 0 = allow, Exit 2 = block (stderr shown to Claude)
// Matcher is "Bash" (all bash commands), so we filter for supabase here

const { execSync } = require('child_process');

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const command = (data.tool_input && data.tool_input.command) || '';

    // Only check Docker for supabase commands. Match the runner-prefixed forms
    // too — `npx supabase start` is what the docs actually tell you to run, and
    // a bare /^supabase/ never fired for it.
    const SUPABASE = /^\s*(?:(?:npx|bunx|pnpm\s+dlx|yarn\s+dlx)\s+(?:-y\s+|--yes\s+)?)?supabase\b/i;
    if (!SUPABASE.test(command)) {
      process.exit(0);
    }

    try {
      // `docker info` measures ~5.7s on this machine even when the daemon is
      // healthy, so a 5s budget timed out on every call and reported a false
      // "Docker is not running".
      execSync('docker info', { stdio: 'pipe', timeout: 15000 });
      process.exit(0);
    } catch (e) {
      process.stderr.write('BLOCKED: Docker Desktop is not running. Start Docker Desktop before using Supabase CLI.');
      process.exit(2);
    }
  } catch (e) {
    // JSON parse error or unexpected input, allow
    process.exit(0);
  }
});
