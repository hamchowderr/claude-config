// Hook: SubagentStart — fires when a subagent is spawned
// Injects cached vault project context so the orchestrating Claude
// can include it when briefing the subagent. Cache is written by
// vault-context-prime.js at session start (async, background).
// If cache is missing or stale, logs only and exits cleanly.

const path = require('path');
const fs = require('fs');

const CACHE_FILE = path.join(process.env.USERPROFILE, '.claude', 'vault-context-cache.json');
const CACHE_MAX_AGE_MS = 4 * 60 * 60 * 1000; // 4 hours

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => { input += c; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const agentType = data.agent_type || 'unknown';

    // Skip built-in utility agents that don't need project context
    const skipAgents = ['Explore', 'Plan', 'general-purpose'];
    if (skipAgents.includes(agentType)) {
      process.stdout.write(`Subagent starting: ${agentType}`);
      process.exit(0);
    }

    // Try to load vault context cache
    if (!fs.existsSync(CACHE_FILE)) {
      process.stdout.write(`Subagent starting: ${agentType} (no vault cache)`);
      process.exit(0);
    }

    const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    const age = Date.now() - new Date(cache.timestamp).getTime();

    if (age > CACHE_MAX_AGE_MS || !cache.context) {
      process.stdout.write(`Subagent starting: ${agentType} (vault cache stale)`);
      process.exit(0);
    }

    // Inject vault context — appears as system context the main Claude sees
    // before dispatching to the subagent, so it can include relevant details
    // in the subagent's task prompt.
    const output = [
      `Subagent starting: ${agentType} — injecting vault project context below.`,
      ``,
      `=== VAULT CONTEXT (${cache.project}) ===`,
      cache.context.split('\n').slice(0, 60).join('\n'), // cap at 60 lines
      `=== END VAULT CONTEXT ===`,
    ].join('\n');

    process.stdout.write(output);
    process.exit(0);
  } catch {
    process.exit(0);
  }
});
