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
3. **A live test** when the docs are silent: a headless `claude -p` run with a logging hook (an `InstructionsLoaded` logger shows exactly which instruction files load). Undocumented behavior is only known once measured.

Write the version into the rule ("measured on 2.1.303"). When two sources disagree, that disagreement is the finding — say so instead of picking one.

## Hooks point to rules, they never restate them
A hook that injects text is an instruction layer. If it carries its own copy of a rule, the copy drifts from the rule file, and because hook text arrives last (after a prompt, after compaction) the stale copy wins. Hook output names the rule file to read or states a fact about what just happened. The rule text lives only in the rule file.
