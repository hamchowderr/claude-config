// subagent-stop-check.js
// Hook: SubagentStop — Validates subagent work quality before reporting back
// Matcher: "" (all subagent stops)
// Input: JSON on stdin (includes transcript_path, agent_type, etc.)
// Exit 0 = allow, stdout = info message added to context

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);

    // Log which subagent completed for visibility
    const agentType = data.agent_type || 'unknown';
    const stopReason = data.stop_reason || 'completed';

    // If the agent hit max turns, flag it
    if (stopReason === 'max_turns') {
      process.stdout.write(
        `WARNING: Subagent "${agentType}" hit max turns limit — work may be incomplete. ` +
        `Review output carefully before using results.`
      );
    }

    // If the agent errored out, flag it
    if (stopReason === 'error') {
      process.stdout.write(
        `WARNING: Subagent "${agentType}" stopped due to error. ` +
        `Do not trust its output without verification.`
      );
    }

    process.exit(0);
  } catch (e) {
    process.exit(0);
  }
});
