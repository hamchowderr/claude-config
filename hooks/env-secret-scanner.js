// env-secret-scanner.js
// Hook: PreToolUse — Blocks .env file writes containing real secret patterns
// Matcher: "Write" (all Write tool calls; script self-filters to .env files)
// Returns permissionDecision: "deny" if real API keys/tokens are detected
// Placeholder values (YOUR_KEY_HERE, etc.) are always allowed through

const path = require('path');

// Patterns that suggest real secrets (not placeholders)
const SECRET_PATTERNS = [
  // Anthropic
  /sk-ant-[a-zA-Z0-9\-_]{20,}/,
  // OpenAI
  /sk-[a-zA-Z0-9]{48,}/,
  // AWS access key
  /AKIA[A-Z0-9]{16}/,
  // AWS secret key (key=<40 char base64-ish>)
  /(?:aws_secret_access_key|aws_secret)\s*=\s*[A-Za-z0-9\/+]{30,}/i,
  // Stripe live keys
  /sk_live_[a-zA-Z0-9]{20,}/,
  /rk_live_[a-zA-Z0-9]{20,}/,
  // Supabase JWT / service role (long JWT pattern)
  /eyJ[a-zA-Z0-9\-_]{40,}\.[a-zA-Z0-9\-_]{40,}\.[a-zA-Z0-9\-_]{20,}/,
  // GitHub personal access token (classic)
  /ghp_[a-zA-Z0-9]{36}/,
  // GitHub fine-grained PAT
  /github_pat_[a-zA-Z0-9_]{82}/,
  // Twilio account SID + auth token
  /AC[a-f0-9]{32}/,
  // Generic 40+ char hex secret (not a hash placeholder)
  /=\s*[a-f0-9]{40,}(?!\s*#[^\n]*placeholder)/i,
  // Generic long random token (base64, 50+ chars, not a placeholder)
  /=\s*[A-Za-z0-9\/+]{50,}={0,2}(?!\s*#[^\n]*placeholder)/,
];

// Patterns that indicate a safe placeholder — these skip scanning
const PLACEHOLDER_PATTERNS = [
  /your[_-][a-z_]+[_-]here/i,
  /YOUR_[A-Z_]+_HERE/,
  /replace[_-]me/i,
  /placeholder/i,
  /todo/i,
  /example[_-]/i,
  /test[_-]key/i,
  /xxx+/i,
  /\.\.\./,
  /<[^>]+>/,         // <MY_KEY>
  /\$\{[^}]+\}/,     // ${MY_KEY}
];

process.stdin.setEncoding('utf8');
let input = '';
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    // Claude Code's Write sends `file_path`; Mastra Code's write_file sends
    // `path`. Reading only one spelling makes this scanner silently pass every
    // write on the other host, which is the worst way for a secret guard to fail.
    const filePath = data.tool_input?.file_path || data.tool_input?.path || '';
    const content = data.tool_input?.content || '';

    // Only check .env files
    const basename = path.basename(filePath);
    const isEnvFile = basename === '.env' || basename.startsWith('.env.');
    if (!isEnvFile) {
      process.exit(0);
    }

    const suspiciousKeys = [];

    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) continue;

      // Extract key name for error reporting
      const keyMatch = trimmed.match(/^([A-Z_][A-Z0-9_]*)\s*=/i);
      const keyName = keyMatch ? keyMatch[1] : null;

      // If the value is clearly a placeholder, skip
      const isPlaceholder = PLACEHOLDER_PATTERNS.some(p => p.test(trimmed));
      if (isPlaceholder) continue;

      // Check for secret patterns
      const hasSecret = SECRET_PATTERNS.some(p => p.test(trimmed));
      if (hasSecret && keyName) {
        suspiciousKeys.push(keyName);
      }
    }

    if (suspiciousKeys.length > 0) {
      const reason =
        `BLOCKED: .env write appears to contain real secrets in: ${suspiciousKeys.join(', ')}. ` +
        `Use placeholder values (YOUR_KEY_HERE) instead. ` +
        `The agent must never write real API keys or tokens.`;

      // Claude Code honours this richer decision object. Mastra Code does NOT —
      // its executor blocks only on exit code 2 and discards JSON it cannot use,
      // so denying the Claude Code way there would silently allow the write.
      // MASTRA_HOOK_EVENT is injected by Mastra Code's hook executor.
      if (process.env.MASTRA_HOOK_EVENT) {
        process.stderr.write(reason);
        process.exit(2);
      }

      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: reason
        }
      }));
    }

    process.exit(0);
  } catch {
    process.exit(0);
  }
});
