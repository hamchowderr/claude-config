// check-workspace-safety.js
// Hook: Blocks dangerous filesystem commands targeting workspace project directories
// Matcher: "Bash" (matches ALL bash commands - this script filters to workspace-targeting ops)
// Input: JSON on stdin from Claude Code
// Exit 0 = allow, Exit 2 = block (stderr shown to Claude)

const path = require('path');

const WORKSPACE_DIR = 'C:\\Users\\HamCh\\code\\workspace';
const WORKSPACE_POSIX = 'C:/Users/HamCh/code/workspace';

// Commands that are dangerous when targeting workspace junction directories
const DANGEROUS_PATTERNS = [
  /\brm\b/,
  /\brmdir\b/,
  /\bdel\b/,
  /\brd\b/,
  /\bln\s/,
  /\bmklink\b/,
  /\bmv\b/,
  /\bcp\b/,
  /\bmove\b/,
  /\bcopy\b/,
  /\bxcopy\b/,
  /\brobocopy\b.*\/MIR/i,
  /\bgit\s+rm\b/,
  /Remove-Item.*workspace/i,
];

// Safe commands that should always be allowed even if they reference workspace
const SAFE_PATTERNS = [
  /workspace-swap\.ps1/,
  /check-workspace/,
  /\bls\b/,
  /\bdir\b/,
  /\bcat\b/,
  /\btype\b/,
  /\bhead\b/,
  /\btail\b/,
  /\bgrep\b/,
  /\bfind\b.*-name/,
  /\bGet-ChildItem\b/i,
  /\bGet-Item\b/i,
  /\bTest-Path\b/i,
  /\bGet-Content\b/i,
  /powershell.*workspace-swap/,
];

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const command = (data.tool_input && data.tool_input.command) || '';

    // Only care about commands that reference the workspace directory.
    // Use a regex with explicit path-boundary so workspace-mcp / workspace-foo
    // don't trip the guard. Match: code/workspace followed by a path separator,
    // quote, end-of-string, or whitespace — NOT a hyphen/underscore/letter.
    const WORKSPACE_BOUNDARY = /[\\/]workspace(?=[\\/"'\s]|$)/i;
    const refsWorkspace = WORKSPACE_BOUNDARY.test(command);

    if (!refsWorkspace) {
      process.exit(0);
    }

    // Allow safe/read-only commands
    for (const safe of SAFE_PATTERNS) {
      if (safe.test(command)) {
        process.exit(0);
      }
    }

    // Block dangerous commands
    for (const dangerous of DANGEROUS_PATTERNS) {
      if (dangerous.test(command)) {
        process.stderr.write(
          'BLOCKED: Dangerous filesystem command targeting workspace directory.\n' +
          'Workspace directories are Windows junctions — rm/mv/cp/ln will damage real projects.\n\n' +
          'Use workspace-swap.ps1 instead:\n' +
          '  Add:    powershell -ExecutionPolicy Bypass -File "C:\\Users\\HamCh\\code\\workspace\\scripts\\workspace-swap.ps1" add <name>\n' +
          '  Remove: powershell -ExecutionPolicy Bypass -File "C:\\Users\\HamCh\\code\\workspace\\scripts\\workspace-swap.ps1" remove <name>\n' +
          '  List:   powershell -ExecutionPolicy Bypass -File "C:\\Users\\HamCh\\code\\workspace\\scripts\\workspace-swap.ps1" list'
        );
        process.exit(2);
      }
    }

    // Not a recognized dangerous command, allow
    process.exit(0);
  } catch (e) {
    // JSON parse error or unexpected input, allow
    process.exit(0);
  }
});
