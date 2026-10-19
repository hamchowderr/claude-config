# This machine (skate): Windows 11

Facts true only on this PC. Never packaged or shared. Check again after a tool update.

## Shell
- **PowerShell is the default shell** (`CLAUDE_CODE_USE_POWERSHELL_TOOL=1`): Windows-native binaries, registry, services, junctions, paths with spaces. Git Bash only for POSIX dev tooling (git, npm, node, curl).
- `/` for paths in Node.js/npm. `\` in PowerShell.
- Never use `tar` from Git Bash: it fails silently.
- Git Bash ignores `PATHEXT`: bare commands resolve to `.exe`, never `.com`. Apps that ship a `.com` console shim (Obsidian) lose ALL stdout when called from it. Call the `.com` by full path, or use PowerShell.
- Git Bash rewrites a leading-slash argument (`--path=/x`) into a Windows path. Run those commands from PowerShell.

## Locations
- Vault: `C:\Users\HamCh\Obsidian Vault`. The `obsidian` CLI needs Obsidian running.
- Code: `C:\Users\HamCh\code`. braynee source: `C:\Users\HamCh\code\braynee`.
- shadcn UI Kit catalog: `C:\Users\HamCh\Code\shadcn-ui-kit`.
- QMD wrapper: `~/.claude/scripts/qmd-wrapper.mjs`.
- Workspace junctions in `C:\Users\HamCh\code\workspace\` point to real project roots. Manage them ONLY with `workspace-swap.ps1`; never `rm`, `rmdir`, `mv`, `cp` or `git rm` on them.

## Known local limits
- `mastra dev` hangs: use `mastra build` + start.
- Agent Vault through Windows curl needs `-k --proxy-insecure` (or run it from WSL). Recipe in the `secrets` rule.
