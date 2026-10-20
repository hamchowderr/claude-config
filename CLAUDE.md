# Claude Code — Global User Preferences
> **Cross-cutting only.** Always-on rules in `~/.claude/rules/`: `machine` (OS, shell, paths), `working-style`, `personal` (business facts), `writing`, `beads`, `commit-pr-conventions`. Path-scoped rules load when matching files are read or edited: `docker`, `mastra`, `stack`, `secrets`, `shipping`, `testing`, `frontend`, `wordpress`, `plugin-dev`, `beads-ops`, `commit-hooks-setup`; the vault rule lives in the vault repo. `paths:` globs match relative to the session's project root — never write absolute paths in them. Project CLAUDE.md overrides per scope.

## Behavior
- Simple requests: act, don't explore.
- Before writing code against a tool: run its `--help` first. WebFetch docs only if the CLI isn't enough.
- Claims about how Claude Code or any agent tool behaves get checked against its current docs and the installed version's changelog (then a live test if the docs are silent) before they go into a rule, hook or reply. Name the version. Detail: the `plugin-dev` rule.
- **CLI-first for all dev tooling** (Stripe, Clerk, Vercel, Supabase, GitHub, Infisical, Mastra, Biome…) — not the dashboard/UI.
- Check DB schema before inserts; check logs before guessing deploy failures.
- Stop and ask after 3 failed attempts with the same approach.
- Blunt feedback = direction. "Yes"/"done" = proceed.
- **Never estimate time.** Scope the work and start; carve phases if too big. Plans, briefs and checklists use ordered steps with plain headings, never durations or "Day 1 / Week 2".

## Search — QMD (mandatory)
Never grep/find/Glob the vault — QMD is the only vault search tool (commands injected each turn by the QMD hook; detail in the `stack` rule). Use the whole tool, not just one mode: `search` for exact terms, structured `query` (`intent:`/`lex:`/`vec:`/`hyde:`, written by you) for concepts, then `get`/`multi-get` the source before stating a fact — hits are leads, not answers. Run 3+ angles for open-ended questions. Full doctrine: the `qmd` skill.

## Vault
Never Write/Edit vault files directly — use the `obsidian` CLI. Full pattern, including the eval recipe, in the vault repo's `vault` rule.

## Secrets (never expose values)
Never read or print a secret value. Inject at runtime, never by reading the value into output. Confirm presence by MASK only (type/length/first chars). Full contract in the `secrets` rule.

## Git (cross-cutting safety)
- Product work never goes straight to `main`/`master`: it goes on a branch typed by the work, tied to its beads issue, then a PR the user merges. Branch naming, commit format and PR scope: the `commit-pr-conventions` rule.
- **Exceptions — commit DIRECTLY to `main`, no branch/PR:** CC plugin repos (braynee, beads, insightful…), where "ship" = push to main and needs no re-confirm; repairs to agent tooling I broke (`.mcp.json`, hooks, scripts); and the Obsidian vault.
- Before merging: `gh pr checks`. After merging: pull latest. Never `--no-verify` without explicit OK.
- Code-project definition-of-done / deploy pipeline: the `shipping` rule.

## Beads
Beads (`bd`) is the source of truth for development work in repos. Fields, discipline and what goes where: the `beads` rule.

## Memory hygiene (context budget)
Keep always-on context lean. Targets: this file < 5k · project CLAUDE.md < 5k · MEMORY.md under 200 lines and 25 KB (only that much loads), entries ≤150 chars (retire to `ARCHIVED.md`). Domain detail belongs in a path-scoped `~/.claude/rules/*.md`, not here; don't duplicate hook-enforced or skill-covered facts. **A correction to a rule edits the rule's home file. Memory is only for knowledge with no other home.** Every change to this config layer (CLAUDE.md, rules, agents, hooks, settings) gets a dated entry with the why in the vault's `2. Areas/Claude Code/Configuration Changelog.md`; git in `~/.claude` holds the diff. When vault/CLI/sessions feel off, run `/braynee:health`.

## Braynee
Local CC plugin: Obsidian vault + skills as a second brain. Reach for: `/braynee:health`, `/braynee:query`, `/braynee:recap`, `/braynee:pour`, `/braynee:daily`.
