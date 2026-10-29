---
paths:
  - "**/.claude-plugin/**"
  - "**/SKILL.md"
  - "**/hooks/hooks.json"
  - "**/hooks/*.js"
  - "**/hooks/*.mjs"
  - "**/agents/*.md"
  - "**/.claude/settings*.json"
---

# Building on Claude Code — plugins, hooks, skills, settings

## Verify every claim about how the agent tool behaves
Training data and memory are wrong about Claude Code (and any agent framework) more often than right: it ships changes weekly. Before a claim about loading, precedence, settings, hooks or plugins goes into a rule, a hook or a reply, check it in this order and stop at the first source that settles it:

1. **The current docs** (code.claude.com) — the documented behavior.
2. **The changelog for the installed version** (`claude --version`; local copy at `~/.claude/cache/changelog.md`) — what changed since the docs page was written.
3. **The installed binary** — `C:\Users\HamCh\.local\share\claude\versions\<version>` embeds the literal zod schemas for hook input and output as plain strings. A Node script that `indexOf`s a needle (e.g. `PostToolBatch`) and prints a window around each hit settles schema questions in about a minute. Its validation messages (`Hook JSON output had unrecognized keys`) show what the runtime checks.
4. **A live test** when the schema can't settle runtime behavior: a headless `claude -p` run with a logging hook (an `InstructionsLoaded` logger shows exactly which instruction files load), or a throwaway probe plugin loaded with `--plugin-dir`. Put a value the model cannot guess in the component, restrict `tools:` so it cannot fetch it another way, and always run a control without the feature. Undocumented behavior is only known once measured.

Write the version into the rule ("measured on 2.1.303"). When two sources disagree, that disagreement is the finding — say so instead of picking one.

Never settle a capability question on a WebFetch summary: it is a model's reading of the page and invents examples (giveaway: "Based on the table, X supports…"). The `PostToolBatch` hook accepts `additionalContext` per the binary, although the docs table lists only `decision`.

## Hooks point to rules, they never restate them
A hook that injects text is an instruction layer. If it carries its own copy of a rule, the copy drifts from the rule file, and because hook text arrives last (after a prompt, after compaction) the stale copy wins. Hook output names the rule file to read or states a fact about what just happened. The rule text lives only in the rule file.

## Developing a plugin locally
Iterate with `claude --plugin-dir "C:/Users/HamCh/code/<plugin>"` (repeat the flag for several) and `/reload-plugins`, not commit → push → update → restart. The local copy wins over the installed one for that session, and reload picks up skills, agents, hooks and plugin MCP/LSP servers. Commit and release only what is meant to ship.

## Releasing — one release per batch
Never cut one release per fix: each costs a version number, a CI run and a user restart (three braynee releases in one session, 2026-07-25).
1. Work: fix, gate green, commit. No bump, no tag, no cache deploy.
2. Release, once per batch: run `claude plugin validate .`, bump both version files (marketplace and `plugin.json`), tag, push, confirm the workflow published.
3. Deploy, once: stage the cache, flip the registry, ask for one restart.
Cut a release when the user asks to ship, the batch is finished, or the session is wrapping. "Ship it" authorizes one batch, not a release after every later fix. Hotfix needed live mid-batch: copy the file into the current cache version dir and restart, without a bump or tag.

## Skill and agent frontmatter
Quote every frontmatter value that starts with `[` (`argument-hint: "[new TITLE | find QUERY]"`). Unquoted, YAML reads it as a flow sequence, and a nested bracket fails the parse; since CC 2.1.186 a failed parse loads the skill with empty metadata (no name, description or allowed-tools) and no warning. braynee's comms skill shipped that way through an audit; `claude plugin tag .` caught it. braynee's `bin/braynee-self-test` section 15 checks for it: copy that check into other plugin repos.

## Why a skill goes unused
Check in this order (set up 2026-10-08):
- `skillOverrides` set to `"off"` in settings hides a skill completely.
- `skillListingBudgetFraction` in `~/.claude/settings.json` caps the listing; past it skills show by name only and Claude never picks them. 0.02 dropped descriptions for about 50 skills; 0.03 shows all 147 in `fivem-kit`.
- `user-invocable-only` skills (the video packs) are hidden from Claude by design.
- Some plugins are off globally and enabled per repo in `.claude/settings.local.json` (FiveM, Cloudflare).
- The skill is a stray copy or a missing link in `~/.claude/skills/`: see the `skills` rule.
- To see what a session lists, run `claude -p` from the repo and ask it to list its skills (runs on the claude.ai login, not API credits).
