---
paths:
  - "**/commitlint.config.*"
  - "**/.commitlintrc*"
  - "**/.husky/**"
  - "**/.github/workflows/**"
---

# Commit conventions — tooling and enforcement

Loaded when working with commit hooks or CI. The conventions themselves are in the always-on `commit-pr-conventions` rule.

## What this unlocks

Following the format is what lets tooling work at all:

- **commitlint + husky** — reject a malformed message at commit time
- **commitizen** — interactive prompt instead of remembering the grammar
- **release-please / semantic-release / conventional-changelog** — changelog and
  semver derived from commit types, with no hand-maintained list

## Enforcement — three layers, deliberately different in strength

| Layer | Covers | Malformed subject/title | Size, mood, traceability |
|---|---|---|---|
| Claude-side hook | commits the agent makes | blocked | reported |
| `commit-msg` hook | every committer in the clone | rejected | warned |
| PR-title CI job | the title that lands on main | fails the check | warning annotation |

Only the **mechanical** failure — not Conventional Commits form — is ever hard-
blocked. It is unambiguous and fixable by rewording. Everything requiring
judgement is reported instead: a guard that fires on correct work is one people
switch off, and then it protects nothing.

The agent-side layer is automatic. The other two are **opt-in per repo** — commit
conventions on a repo with existing history and other people's workflows is a
decision, not a default.

### Adding the git-side layers to an existing repo

```bash
node <braynee>/scripts/install-commit-hooks.mjs --repo . --dry-run   # preview
node <braynee>/scripts/install-commit-hooks.mjs --repo .             # install
```

Then run the dependency-install command it prints. It is idempotent, keeps its
section between markers so re-running never duplicates it, and **never
overwrites an existing `commit-msg` hook** — it appends alongside. Repos with no
`package.json` get an equivalent dependency-free shell check instead.

The PR-title and PR-size jobs come from `gen-ci-workflow.mjs` (`--no-pr-lint`
opts out).

If the repo uses **beads**, these coexist: beads owns `pre-commit`,
`post-merge`, `pre-push`, `post-checkout` and `prepare-commit-msg` — never
`commit-msg`. Since `prepare-commit-msg` runs first, beads' trailers are already
in the message commitlint validates, which is why the generated config leaves
footer length unrestricted.

### Turning it off

```bash
git config --local braynee.allow-freeform-commits true   # agent-side hook
```

Per-repo and settable mid-session, for repos that intentionally use free-form
messages.
