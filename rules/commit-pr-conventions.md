# Commits & PRs — one change, one story

A **commit** is one saved change. A **PR** is a branch — a bundle of 1..N commits
telling one story. These are different units, and conflating them is the usual
source of unreviewable pull requests: a 250-commit branch is still **one**
squash-merged commit on main. Commit count and PR count are unrelated.

## Commit subject — Conventional Commits

```
type(scope)!: summary
```

| Type | Use for | Release |
|---|---|---|
| `feat` | new user-visible capability | minor |
| `fix` | bug fix | patch |
| `perf` | faster/lighter, same behavior | patch |
| `refactor` | restructure, no behavior change | — |
| `test` | tests only | — |
| `docs` | docs only | — |
| `build` / `ci` | build system, pipelines | — |
| `chore` | housekeeping | — |
| `style` | formatting only, no code change | — |
| `revert` | undo a previous commit | — |

Breaking changes: `feat!:` / `feat(api)!:`, or a `BREAKING CHANGE:` footer. Either
one means a **major** bump.

## The 50/72 rule

- Subject **≤50 chars**, **imperative** mood — "add", not "added" or "adds".
  Read it as *"if applied, this commit will …"*.
- Blank line.
- Body wrapped at ~72 — **what** changed and **why**, not *how*. The diff already
  says how; it can never say why.

## Atomic commits

One logical change per commit. Each one builds and passes **on its own** — that is
what makes `git bisect`, `git revert`, and cherry-picking work at all.

No `wip`, `fix typo`, `oops`, `address review` noise. If it happened while you
worked, squash it before merge.

## Branches

`<type>/<issue-id>-<slug>` — the type is the work's type, the same one its commit
and its beads issue carry: `feat/` (or `feature/`), `fix/`, `chore/`, `refactor/`,
`docs/`, `test/`, `hotfix/`, `spike/` (time-boxed investigation). The issue id ties
the branch to the beads issue, which every PR needs (create or claim it before
code, name it in the PR body, close it on merge). **Never commit product work
straight to `main`/`master`.** Direct-to-main repos (plugin repos, the vault,
repairs to broken agent tooling) are listed in the user CLAUDE.md, not decided by
habit.

## Grouping a PR

One coherent story. Several small related issues may ride together, one commit
each, if they serve that story.

Group by the **story**, not the folder — *same surface, not same directory*.

> **The "and" test:** if you cannot name the PR without saying "and", it is two PRs.

Type the PR by its **highest-impact** commit: `feat` > `fix` > `refactor`/`perf` >
`test`/`chore`/`docs`. Don't default everything to `feat`.

## Sizing

Keep the diff reviewable in one sitting — roughly **200–400 LOC**, under ~60
minutes. Past that, split or stack the PRs.

This is not taste. In the SmartBear/Cisco study of ~2,500 reviews (Jason Cohen,
*Best Kept Secrets of Peer Code Review*, 2006), defect detection drops sharply
beyond ~200–400 LOC, above ~500 LOC/hour, or past ~60 minutes of review. A bigger
PR does not get reviewed more slowly — it gets reviewed *worse*.

## Merging

- **Squash-merge** — the default. Collapses a branch's internal commits into one
  clean commit on main.
- **Rebase-merge** — when every commit is genuinely atomic and worth keeping
  linear.
- **Merge commit** — noisiest; use when you need the branch topology preserved.

## Traceability

Reference the tracked work in the commit body or footer, so a commit can always be
traced back to the issue that motivated it — and the issue forward to what shipped
it. See the beads conventions rule for how work is tracked.

Reference detail (What this unlocks, Enforcement) lives in `commit-hooks-setup.md`.
