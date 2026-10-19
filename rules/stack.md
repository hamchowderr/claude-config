---
paths:
  - "C:/Users/HamCh/code/**"
---

# Dev Defaults

Sensible defaults for development work. Deviate only with a concrete reason — and say so.

## Vault-first — check it before deciding, asking, or guessing
The vault is the source of truth for the stack, conventions, and tool docs below. Before asking the user a stack/architecture/convention question or assuming an answer, **search the vault** — the answer is almost always already there.
- Search with QMD (the only search tool — never grep/find/Glob the vault): the QMD wrapper (path in the `machine` rule) — `search "terms"` (BM25, exact), structured `query $'intent: …\nlex: …\nvec: …\nhyde: …'` (hybrid, you write the fields), `vsearch "concept"` (vectors), then `get "#docid"` / `multi-get "#a,#b"` to read the source you cite. The `qmd` skill carries the full doctrine. → Vault: `2. Areas/Development/Tooling/QMD/`
- The `→ Vault:` paths below are canonical reference docs — read them on demand before deciding.

General: run a tool's `--help` before writing code against it; prefer the CLI over MCP when both exist; reach for a CLI before a web dashboard.

## Auth → Clerk
Default auth provider is Clerk. Use Clerk's CLI / SDK setup — don't hand-roll sessions or token handling.
→ Vault: `2. Areas/Development/Auth/Clerk/` (Overview, CLI, Next.js, Supabase JWT, Organizations, Webhooks)

## LLM / agent work → Mastra, backend-first
- Build any LLM or agent feature as a standalone Mastra (Hono) service.
- Scaffold with the Mastra CLI (`mastra dev`, `mastra build`) or start from a template — don't hand-assemble.
- Get the agent working and testable as a **service** before building any UI.
→ Vault: `2. Areas/Development/AI/Mastra/`

## Databases — separate layers, pick by need
Dolt and Supabase/Convex are not interchangeable; they solve different problems.

- **Dolt** — version-controlled SQL (MySQL-compatible; `branch`/`diff`/`merge`/`commit` on data). Use when you need data history, audit trails, lineage, or reproducible state. Default data/state layer for LLM/agent builds (Beads itself runs on Dolt). `dolt add` + `dolt commit` after every schema/data change. DoltHub org: `otaku-solutions` (push to `otaku-solutions/<db>`).
  → Vault: `2. Areas/Development/Database/Dolt/`
- **Supabase / Convex** — the application backend: realtime, auth, serverless/edge functions, storage, vector search. This is what Dolt does *not* do. Use the CLI (`supabase` / `convex dev`), never the dashboard; let it generate types + migrations.
  → Vault: `2. Areas/Development/Database/Supabase/`, `2. Areas/Development/Database/Convex/`

## Frontend / UI → shadcn (registry + UI Kit)
- Components are shadcn/ui. Before pulling a community component, check the **Otaku registry** for a patched version: `npx shadcn@latest add https://otaku-registry.vercel.app/r/<item>.json` (hosts upstream-bug-fixed components, e.g. `platform-kit-nextjs`; add `--overwrite` to replace a broken upstream install).
- **Reuse before building:** source dashboards, app screens, pages, and components from the **Shadcn UI Kit** catalog (folder in the `machine` rule; Next.js 16 / React 19 / Tailwind 4) rather than hand-rolling.
→ Vault: `2. Areas/Development/DevOps/Vercel/Otaku shadcn Registry.md` (registry) · `…/Vercel/shadcn UI Kit.md` (UI Kit catalog)

## Linting / formatting → Biome
One tool for both (not ESLint + Prettier). `biome check .` is the CI gate; `biome check --write --unsafe .` for local fixes. Per-project rules go in `biome.json` `overrides` (not custom ESLint). Run `check:fix` in its own commit so the format pass doesn't bloat a feature diff.
→ Vault: `2. Areas/Development/Tooling/Biome/Linting and Formatting.md`

## Secrets
Never read or print secret values — inject at runtime. See the `secrets` rule for the full contract.
