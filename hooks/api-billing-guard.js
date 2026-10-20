// api-billing-guard.js
// Hook: PreToolUse (Bash + PowerShell) — ask before a command that would spend
// Anthropic Console credits instead of the claude.ai login.
// Rule text lives in the working-style rule ("Permission and outward actions");
// this hook only names what it saw.
//
// Catches: direct calls to api.anthropic.com, `claude --bare` (skips the login),
// setting ANTHROPIC_API_KEY (inline, setx, SetEnvironmentVariable), and
// `claude -p` while ANTHROPIC_API_KEY is set in the environment without being
// stripped for that command. Never prints the key.

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => { input += c; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const cmd = (data.tool_input && data.tool_input.command) || '';
    const hits = [];

    if (/api\.anthropic\.com/i.test(cmd)) hits.push('a direct call to api.anthropic.com');
    if (/\bclaude\b[^\n|;&]*\s--bare\b/.test(cmd)) hits.push('`claude --bare`, which skips the login and bills the API key');
    if (/(?:^|[\s;&|])(?:export\s+)?ANTHROPIC_API_KEY=\S|\$env:ANTHROPIC_API_KEY\s*=\s*['"]?[^'"\s$]|setx\s+ANTHROPIC_API_KEY|SetEnvironmentVariable\(\s*['"]ANTHROPIC_API_KEY/i.test(cmd)) {
      hits.push('setting ANTHROPIC_API_KEY');
    }
    const stripped = /env\s+-u\s+ANTHROPIC_API_KEY|unset\s+ANTHROPIC_API_KEY|Remove-Item\s+Env:\\?ANTHROPIC_API_KEY|\$env:ANTHROPIC_API_KEY\s*=\s*(\$null|''|"")/i.test(cmd);
    if (process.env.ANTHROPIC_API_KEY && !stripped && /\bclaude\b[^\n|;&]*\s(-p|--print)\b/.test(cmd)) {
      hits.push('`claude -p` with ANTHROPIC_API_KEY set in the environment');
    }

    if (!hits.length) process.exit(0);
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'ask',
        permissionDecisionReason: `This may spend Anthropic Console credits: ${hits.join('; ')}. Run claude -p on the login with ANTHROPIC_API_KEY stripped unless Chowderr asked for API mode. See the working-style rule.`,
      },
    }));
    process.exit(0);
  } catch {
    process.exit(0);
  }
});
