# Beads — every piece of work is traceable

Beads is the source of truth for trackable work. The point is a clean, detailed
back-trace to **any** decision — not a graveyard of one-line titles. Two questions
decide everything: *"Is this trackable work?"* and *"Could I resume it in 2 weeks?"*

## What goes where

| It is… | Home |
|---|---|
| Trackable **work** — feature, bug, fix, task, chore, epic — and the decisions behind it | **beads issue** (`bd create`) |
| A durable **insight / fact** (not work) — "this API behaves like X" | **`bd remember`** (recall via `bd memories`) |
| An **ephemeral** single-session checklist | **TodoWrite** (lost after the session, by design) |
| **Personal / preference / reference / cross-project** knowledge | **vault** (Claude Memory / notes) |

**Beads is for product work in this repo only.** Before `bd create`, ask: is this a
change to the product in this repo? Vault chores, ops and personal housekeeping never
become beads issues; do them, or tell the user. A slipped-in one: `bd delete <id> --force`.

Don't put work in TodoWrite (it dies on compaction). Don't put insights or
preferences in issues. And don't over-file — if a 2-weeks-away you wouldn't need
it, it's probably TodoWrite, not a bead.

## Writing an issue — five fields, distinct jobs
- **Title** — specific, action-oriented (`Fix: auth token expires before refresh`, not `Fix bug`).
- **Description** — the problem **+ why it matters**.
- **Design** (`--design`) — **HOW + the trade-offs**. This is the decision record: "chose X over Y because…". Allowed to change.
- **Acceptance** (`--acceptance`) — **WHAT success looks like**: outcome-focused, each criterion verifiable (a definite yes/no), stable even if you re-implement. *Not* steps.
- **Notes** (`--notes` / `--append-notes`) — running log + session handoffs; the compaction lifeline.

> **design-vs-acceptance test:** if you rewrote the solution a different way and a
> criterion no longer applied, it was **design**, not acceptance.
> `Use JWT` = design; `tokens persist across sessions` = acceptance.

## Keep the trace clean
- **Capture the why** in `--design` as you decide — not just what you did.
- **Reversed a decision?** `bd supersede <old> --with <new>` — link old → new. Never silently close-and-delete; the trail must show *why it changed*.
- **Found work mid-task?** `bd create "…" --design "…" --acceptance "…" --deps discovered-from:<current>` — preserve the causal link, and file it complete (a bare create is refused).
- **Close with a reason:** `bd close <id> --reason "…"` — how/why it ended, with evidence.

## No user-specific data in shareable artifacts
A beads tracker travels with its repository. The whole database — issues, close reasons,
**memories** — is pushed to **`refs/dolt/data`** on the git remote, and commits carry
`Closes:`/`Refs:` links into that history. That ref is invisible (not a branch, absent
from the host's web UI, not fetched by a plain `git clone`) and nonetheless readable by
anyone who can read the repo. So a beads issue (title, description, design, acceptance,
notes, **close-reason**), anything stored with `bd remember`, and any commit that links
one must contain **zero user-specific / private references**: real product names, client
names, private repos, or internal business context.
- When a private thing is only a design reference — "go look at *<my product>* for the
  styling" — name it by **role**, never by name: "a reference chat app," "the house
  style," "downstream products."
- Treat every repo whose beads could ever be published as **public-by-default**, even
  before it's pushed — kits, templates and plugins always, product repos the moment
  open-sourcing is on the table.
- **Deleting does not remove.** Dolt keeps history like git. `bd forget` and `bd delete`
  write a *new* commit without the row; every earlier commit still holds it, on the
  remote too. Check with
  `dolt sql -q "select count(*) from dolt_history_<table> where …"`. Scrubbing after the
  fact takes `bd flatten --force` (all history) or `bd compact --days N --force` (older
  than N days), plus a force push — a delete on its own does nothing.
- This has bitten more than once — it's a hard rule, not a preference. If names slip in,
  scrub them from issues *and* the exported `issues.jsonl` *and* commit messages *and*
  the Dolt history.

## Discipline
- **Before coding** in a beads repo: `bd list --status in_progress` → else `bd ready` → claim atomically (`bd update <id> --claim`). Don't invent work. Check the cwd is the repo's own folder first. If `bd` is unavailable (cloud or thread sessions), say so in the first reply instead of skipping it — untracked PRs come from exactly those sessions.
- **Research before you create.** Before filing a new issue — or building it — `bd search "<keywords>"` for existing or duplicate work (and, in a repo with PRs, `gh pr list --search "<keywords>"`). If it already exists, **link** (`--deps discovered-from:`/`related:`) or `bd supersede` instead of filing a duplicate; **abort** work that's already claimed or already has an open PR. (This is the beads "check before you build" discipline.)
- **Create-time guard is `error`:** `validation.on-create=error` refuses a create missing its type's sections (task/feature: Acceptance; bug: Steps to Reproduce + Acceptance; epic: Success Criteria; chore: none). braynee sets it on init and `/braynee:health` repairs it. Always pass `--design` too — the guard can't require it, you must.
- **A claim needs a plan:** braynee's claim gate runs `bd lint <id>` before `--claim` / `--status in_progress` and blocks an issue missing sections or still carrying the seeded-stub acceptance. Fill it (`bd update <id> --design … --acceptance …`), then claim. `bd mol pour` bypasses the create guard, so poured steps meet the gate at claim time.
- **Signing:** braynee's beads-actor-sign hook adds `--actor claude` / `claude/<agent_type>` to every bd command Claude runs. Never pass `--actor` by hand.
- `bd lint` finds issues missing sections; `bd prime` recovers context after compaction.
- **`bd prime` is a subset, not the index.** It lists ~40 commands and omits `query`,
  `graph`, `epic`, `swarm`, `gate`, `provenance`, `federation`, `compact`, `flatten` and
  `gc`. Never conclude a capability is missing because it wasn't injected — run
  `bd --help`, then `bd <command> --help`, before hand-rolling anything beads already does.

Reference detail (Execution metadata, Agent commits, Backups) lives in `beads-ops.md`.
