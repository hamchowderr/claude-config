// post-tool-failure.js
// Hook: PostToolUseFailure — Injects contextual recovery hints when bash commands fail
// Matcher: "Bash"
// Input: JSON on stdin (tool_input.command, error)
// Output: additionalContext JSON for Claude — informational only
// Exit 0 always (can't block what already failed)

process.stdin.setEncoding('utf8');
let input = '';
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const command = (data.tool_input?.command || '').toLowerCase();
    const error = (data.error || '').toLowerCase();

    const hints = [];

    // Supabase — Docker check
    if (/^\s*supabase/.test(command)) {
      hints.push('Supabase failed — is Docker Desktop running? Verify: docker info');
    }

    // Docker daemon not running
    if (/docker/.test(command) && /daemon|not running|connect|cannot connect/.test(error)) {
      hints.push('Docker daemon not running — start Docker Desktop first.');
    }

    // Convex auth
    if (/^\s*convex/.test(command) && /auth|login|unauthorized|unauthenticated/.test(error)) {
      hints.push('Convex auth error — run: npx convex login');
    }

    // Prisma connection
    if (/prisma migrate|prisma db push|prisma db pull/.test(command) && /connection|database_url|env|p1001|p1002/.test(error)) {
      hints.push('Prisma connection failed — check DATABASE_URL in .env. Database must be running.');
    }

    // npm/pnpm/yarn engine mismatch
    if (/npm install|npm ci|pnpm install|yarn install|bun install/.test(command) && /engine|node.*version|unsupported engine/.test(error)) {
      hints.push('Package install failed on engine mismatch — check engines field in package.json. Consider: nvm use <version>');
    }

    // Git push rejected
    if (/git push/.test(command) && /rejected|non-fast-forward|fetch first/.test(error)) {
      hints.push('Push rejected — remote has diverged. Run: git pull --rebase, then push again.');
    }

    // Git push to protected branch
    if (/git push/.test(command) && /protected|cannot push to|not allowed/.test(error)) {
      hints.push('Branch is protected — create a PR instead of pushing directly.');
    }

    // Vercel auth
    if (/^\s*vercel/.test(command) && /token|auth|login|unauthorized/.test(error)) {
      hints.push('Vercel auth error — run: vercel login');
    }

    // Stripe auth
    if (/^\s*stripe/.test(command) && /api.*key|auth|login/.test(error)) {
      hints.push('Stripe CLI auth error — run: stripe login');
    }

    // Fly.io auth
    if (/^\s*fly\b/.test(command) && /auth|login|token|unauthorized/.test(error)) {
      hints.push('Fly.io auth error — run: fly auth login');
    }

    // Infisical auth
    if (/^\s*infisical/.test(command) && /auth|login|token|unauthorized/.test(error)) {
      hints.push('Infisical auth error — run: infisical login');
    }

    // Wrangler auth
    if (/^\s*wrangler/.test(command) && /auth|login|token|unauthorized/.test(error)) {
      hints.push('Wrangler auth error — run: wrangler login');
    }

    // gh CLI auth
    if (/^\s*gh\b/.test(command) && /auth|login|token|credentials/.test(error)) {
      hints.push('GitHub CLI auth error — run: gh auth login');
    }

    // Command not found
    if (/enoent|command not found|is not recognized|not found in path/.test(error)) {
      hints.push('Command not found — check if the tool is installed and in PATH. May need: npm install (local) or winget install / npm install -g (global).');
    }

    // Permission denied
    if (/eacces|permission denied|access is denied/.test(error)) {
      hints.push('Permission denied — try running as Administrator, or check file/directory ownership.');
    }

    // Port already in use
    if (/eaddrinuse|address already in use|port.*in use/.test(error)) {
      const portMatch = error.match(/:\s*(\d{3,5})/);
      const port = portMatch ? portMatch[1] : 'the port';
      hints.push(`Port ${port} is already in use — find what's using it: netstat -ano | findstr :${port}`);
    }

    const durationMs = data.duration_ms;
    const durationNote = durationMs ? ` (failed after ${durationMs}ms)` : '';

    if (hints.length > 0) {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PostToolUseFailure',
          additionalContext: `Recovery hint${durationNote}: ` + hints.join(' | ')
        }
      }));
    } else if (false && durationMs) {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PostToolUseFailure',
          additionalContext: `Tool failed${durationNote}.`
        }
      }));
    }

    process.exit(0);
  } catch {
    process.exit(0);
  }
});
