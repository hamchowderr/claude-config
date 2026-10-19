# Claude Code — Global User Preferences
> Windows (skate). This file is **cross-cutting only** — path-scoped rules in `~/.claude/rules/` (`beads`, `mastra`, `stack`, `secrets`, `shipping`, `testing`, `vault`, `workspace`) carry the domain detail and load only in their scope. Project CLAUDE.md overrides per scope.

## Environment
- Windows. **PowerShell is the default shell** (`CLAUDE_CODE_USE_POWERSHELL_TOOL=1`) — use it for Windows-native binaries, registry, services, junctions, paths with spaces. Git Bash only for POSIX dev tooling (git, npm, node, curl).
- `/` for paths in Node.js/npm. `\` in PowerShell.
- `.env` / `.env.local`: read freely. Use placeholders (`YOUR_KEY_HERE`) when creating.
- Never use `tar` from Git Bash — fails silently on Windows.
- Git Bash ignores `PATHEXT` — bare commands resolve to `.exe`, never `.com`. Windows apps shipping a `.com` console shim (Obsidian) silently lose ALL stdout when called from it: the command runs, you just never see the result. Call the `.com` by full path, or use PowerShell.

## Behavior
- Simple requests: act, don't explore.
- Before writing code against a tool: run its `--help` first. WebFetch docs only if the CLI isn't enough.
- **CLI-first for all dev tooling** (Stripe, Clerk, Vercel, Supabase, GitHub, Infisical, Mastra, Biome…) — not the dashboard/UI.
- Check DB schema before inserts; check logs before guessing deploy failures.
- Stop and ask after 3 failed attempts with the same approach.
- Blunt feedback = direction. "Yes"/"done" = proceed.
- **Never estimate time.** Scope the work and start; carve phases if too big.

## Search — QMD (mandatory)
Never grep/find/Glob the vault — QMD is the only vault search tool (commands injected each turn by the QMD hook; detail in the `stack` rule). Use the whole tool, not just one mode: `search` for exact terms, structured `query` (`intent:`/`lex:`/`vec:`/`hyde:`, written by you) for concepts, then `get`/`multi-get` the source before stating a fact — hits are leads, not answers. Run 3+ angles for open-ended questions. Full doctrine: the `qmd` skill.

## Vault
`C:\Users\HamCh\Obsidian Vault`. Never Write/Edit vault files directly — use the `obsidian` CLI (Obsidian must be running). Full pattern in the `vault` rule + [[feedback_obsidian_cli_eval_pattern]].

## Secrets (never expose values)
Never read or print a secret value. Inject at runtime: `infisical run --path=/<project> --silent -- <cmd>` — never `--recursive`, never `infisical secrets/get/export`. Confirm presence by MASK only (type/length/first chars). otaku-internal is per-project (id `e56e0da5-6460-4bab-bdd6-2fd12ac5447b`, env `dev`). Full contract in the `secrets` rule + [[reference_infisical_secrets]].

## Git (cross-cutting safety)
- Never push to `main`/`master`. Always branch: `feature/` / `fix/` / `chore/`.
- **Exception — CC plugin repos (braynee, beads, insightful…): ship DIRECTLY to `main`, no branch/PR.** "ship" = push to main; don't re-confirm. See [[braynee-ship-push-no-pr]].
- Before merging: `gh pr checks`. After merging: pull latest. Never `--no-verify` without explicit OK.
- Code-project definition-of-done / deploy pipeline: the `shipping` rule.

## Beads (source of truth for tasks)
Mirrors: `bd` (truth) → `TodoWrite` (live UI). **TodoWrite mirror is mandatory** — when the `beads-todo-reminder` hook fires after a `bd` change, call TodoWrite immediately. Before editing code: `bd list --status in_progress` → else `bd ready` → else ask (never invent work). Fields + discipline in the `beads` rule.

## Memory hygiene (context budget)
Keep always-on context lean. Targets: this file < 5k · project CLAUDE.md < 5k · MEMORY.md entries ≤150 chars (retire to `ARCHIVED.md`). Domain detail belongs in a path-scoped `~/.claude/rules/*.md`, not here; don't duplicate hook-enforced or skill-covered facts. When vault/CLI/sessions feel off, run `/braynee:health`.

## Braynee
Source: `C:\Users\HamCh\code\braynee` (local CC plugin). Second-brain: Obsidian vault + skills. Reach for: `/braynee:health`, `/braynee:query`, `/braynee:recap`, `/braynee:pour`, `/braynee:daily`, `/braynee:tasks`.
