# This machine (skate): Windows 11

Facts true only on this PC. Never packaged or shared. Check again after a tool update.

## Shell
- **PowerShell is the default shell** (`CLAUDE_CODE_USE_POWERSHELL_TOOL=1`): Windows-native binaries, registry, services, junctions, paths with spaces. Git Bash only for POSIX dev tooling (git, npm, node, curl).
- `/` for paths in Node.js/npm. `\` in PowerShell.
- Never use `tar` from Git Bash: it fails silently.
- Git Bash ignores `PATHEXT`: bare commands resolve to `.exe`, never `.com`. Apps that ship a `.com` console shim (Obsidian) lose ALL stdout when called from it. Call the `.com` by full path, or use PowerShell.
- Git Bash rewrites any argument that looks like an absolute POSIX path (`--path=/x`, `--value /app/dist`) into a Windows path, silently. Quoting does not stop it. Run those commands from PowerShell, or prefix `MSYS_NO_PATHCONV=1`.
- Bash tool with `run_in_background`: never chain `cd <relative> && cmd`; the background shell drops the cwd and exits 0 silently. Use absolute paths.
- Postgres in Docker: use `127.0.0.1` in the DSN, never `localhost` (IPv6 `::1` port-forward randomly resets: `read ECONNRESET`).

## Locations
- Vault: `C:\Users\HamCh\Obsidian Vault`. The `obsidian` CLI needs Obsidian running.
- Code: `C:\Users\HamCh\code`. braynee source: `C:\Users\HamCh\code\braynee`.
- shadcn UI Kit catalog: `C:\Users\HamCh\Code\shadcn-ui-kit`.
- QMD wrapper: `~/.claude/scripts/qmd-wrapper.mjs`.
- Workspace junctions in `C:\Users\HamCh\code\workspace\` point to real project roots. Manage them ONLY with `workspace-swap.ps1`; never `rm`, `rmdir`, `mv`, `cp` or `git rm` on them.
- Dolt used by beads: `C:\Users\HamCh\bin\dolt.exe` (2.1.8 as of 2026-06-18), not the winget `DoltHub.Dolt` 1.86.4, which beads never uses (that copy is why `winget upgrade` nags; removing it needs an elevated shell). No self-update: `gh release download vX.Y.Z --repo dolthub/dolt --pattern "*windows-amd64.zip"`, stop every `dolt.exe`, overwrite `~/bin/dolt.exe`, check `dolt version`, smoke-test with `bd list`, delete the old copy.
- NCA Toolkit: the instance on the VPS. Never start Docker Desktop or the local `nca-content-workflows` stack for it. Call it from PowerShell with `infisical run --projectId e56e0da5-6460-4bab-bdd6-2fd12ac5447b --env dev --path=/nca-toolkit --silent -- <cmd>` (keys `NCA_BASE_URL`, `NCA_PUBLIC_URL`, `NCA_API_KEY` sent as `x-api-key`, `APIFY_API_TOKEN`).
- Hostinger VPS SSH key: `C:/Users/HamCh/.ssh/vps_hostinger` (`.pub` beside it). Test: `ssh -i C:/Users/HamCh/.ssh/vps_hostinger root@191.101.15.236 "hostname"`.

## Known local limits
- `mastra dev` hangs: use `mastra build` + start.
- agent-browser headed (0.31.1, Chrome for Testing 150, checked 2026-10-20): Chrome opens its own blank "New Tab" window on top of the window agent-browser drives, so Chowderr sees white windows. `"args": "--no-startup-window"` in `~/.agent-browser/config.json` leaves only the driven window. The window opens behind the terminal; it does not take focus.
- Agent Vault through Windows curl needs `-k --proxy-insecure` (or run it from WSL). Recipe in the `secrets` rule.

## Deleting or renaming old project folders
Three different locks all show as `Device or resource busy` / `is in use`. Close every editor that ever opened the folder first.
- **Orphan `dolt sql-server`** from an old `bd init`, on a non-standard port (3308, 3309): find it with `Get-CimInstance Win32_Process -Filter "Name='dolt.exe'" | Select-Object ProcessId, CommandLine`, then `Stop-Process -Id <PID> -Force`.
- **Empty directory left after a large delete** (`handle.exe` finds no handles): Defender or an editor watcher holds it at the filter-driver level. Wait, then try an elevated `Remove-Item -LiteralPath <path> -Recurse -Force`, else leave it until reboot; it takes no space.
- **This Claude Code session's own watch handle** (`handle.exe` shows `claude.exe`): any folder this session touched stays locked until the session ends, and child shells inherit it. Expect renames of inspected folders to fail; ask the user to run the rename or delete from a separate terminal. Never kill `claude.exe` or force-close its handle.
