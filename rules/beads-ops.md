---
paths:
  - "**/.beads/**"
  - "**/beads-dr*"
---

# Beads — operations reference

Loaded when working with `.beads/` files. The day-to-day rules are in the always-on `beads` rule.

## Execution metadata — make an issue a dispatch spec

An issue can carry **optional** metadata that says *how* to run it, so an orchestrator
(autopilot today, a Mastra worker loop tomorrow) can pick the right agent/model/effort
**before** dispatch — without re-reading the prose. Every key is optional; **absent = use
session defaults**, so this is fully backward-compatible.

| Key | Values | Meaning |
|---|---|---|
| `execution_agent_type` | an agent/subagent type name (`braynee:autopilot`, `general-purpose`, `Explore`, `braynee:beads-auditor`, …) | who should run it |
| `execution_suggested_model` | `opus` \| `sonnet` \| `haiku` | model to launch the runner with |
| `execution_reasoning_effort` | `low` \| `medium` \| `high` | reasoning effort for the runner |
| `execution_mode` | `autonomous` \| `review` \| `plan` | latitude — run it / run-then-review / plan-only |
| `execution_parallel_group` | free-form key (e.g. `phase2-features`) | issues sharing a key may run **concurrently** |

**Write** — one key at a time (idempotent per key), or as a JSON blob at create:
```bash
bd update <id> --set-metadata execution_agent_type=general-purpose \
               --set-metadata execution_suggested_model=sonnet \
               --set-metadata execution_reasoning_effort=medium \
               --set-metadata execution_mode=autonomous \
               --set-metadata execution_parallel_group=phase2-features

bd create "…" --design "…" --acceptance "…" --metadata '{"execution_agent_type":"Explore","execution_suggested_model":"haiku"}'
```

**Read** — before dispatch:
```bash
bd show <id> --json | jq '.[0].metadata'
```

**Rule — read execution metadata before prose.** A parent/orchestrator must read these keys
*before* spawning a subagent, because a running subagent cannot change its model or reasoning
effort after launch. `description` is the work scope; `notes` is rationale/fallback. Set only
keys you can justify — leave the rest unset rather than guess — and never clobber human-set
metadata on a re-run.

## Agent commits — sign the work

When an **agent** prepares a commit, leave a lightweight execution trail so `bd doctor` /
audit can attribute it — *on top of* normal attribution, not instead of it:
```text
Agent-Signature: {runtime}-{model}-{reasoning} on behalf of {git user.name}
```
Keep the `(<issue-id>)` in the subject (so `bd doctor` links the commit to its issue) and any
`Co-Authored-By:` trailer. Use **reliable runtime/session** metadata only — fall back to
`unknown-model` / `unknown-reasoning` rather than guess; never infer the model or reasoning
effort from prompt text, default settings, a cached model list, or memory.

```text
Fix token refresh race (cp-abc)

Agent-Signature: claude-code-opus-4.8-high on behalf of <git user.name>
Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

## Backups — configuring is not protecting

Issue history lives in a local Dolt database. Without a recovery path, one
corrupting unclean shutdown loses it.

**Default posture: a Dolt-native backup destination outside the project.**

```bash
node <braynee>/scripts/beads-dr.mjs              # audit, read-only
node <braynee>/scripts/beads-dr.mjs --init --sync   # configure + populate
```

Destination is `~/beads-backups/<repo>`, deliberately **outside** the repo —
an in-project `.beads/backup` dies with `rm -rf <project>`, which is a likelier
way to lose a repo than disk failure. New projects get this automatically at
`bd init`.

Scope is measured, not curated: a repo qualifies when it has issue history and a
database. Backing up an empty scaffold protects nothing and buries the repos
that matter in the report.

### The trap: two different "backup" numbers

`bd backup status` prints both, and the reassuring one is not the one that
protects you:

| Line | What it is | Runs by itself? |
|---|---|---|
| `Last backup:` | bd's internal auto-backup, on by default when a git remote is detected | yes, every 15m |
| `Last sync:` | the Dolt-native **destination** — the actual recovery path | **no, `bd backup sync` is manual** |

A destination nobody pushes to rots silently while `Last backup` still reads
minutes. Measured on one fleet: 107 repos held archives that *looked* like
coverage, most 23 days stale. Whatever adopts this must run `bd backup sync` on
a schedule — braynee does it daily from a SessionStart hook.

Also note `Database size:` is a **global** figure. The same number prints in
repos with no destination at all; it is not this repo's backup size.

### What this does and does not survive

Survives DB corruption and unclean-shutdown journal damage. **Does not survive
losing the disk** — the backup sits on the same drive. Off-machine protection
needs a Dolt remote, which stays opt-in per project rather than mandatory.

A backup you have never restored is a hypothesis. Verify with
`scripts/beads-dr-verify.mjs`, which restores into a throwaway directory and
compares issue counts. It refuses to report success unless the probe is provably
isolated — a check that cannot prove isolation must never claim a restore worked.
