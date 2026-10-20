---
paths:
  - "**/package.json"
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
  - "**/*.mjs"
  - "**/biome.json"
  - "**/components.json"
---

# Dev Defaults

Sensible defaults for development work. Deviate only with a concrete reason — and say so.

## Vault-first — check it before deciding, asking, or guessing
The vault is the source of truth for the stack, conventions, and tool docs below. Before asking the user a stack/architecture/convention question or assuming an answer, **search the vault** — the answer is almost always already there.
- Search with QMD (the only search tool — never grep/find/Glob the vault): the QMD wrapper (path in the `machine` rule) — `search "terms"` (BM25, exact), structured `query $'intent: …\nlex: …\nvec: …\nhyde: …'` (hybrid, you write the fields), `vsearch "concept"` (vectors), then `get "#docid"` / `multi-get "#a,#b"` to read the source you cite. The `qmd` skill carries the full doctrine. → Vault: `2. Areas/Development/Tooling/QMD/`
- The `→ Vault:` paths below are canonical reference docs — read them on demand before deciding.

General: run a tool's `--help` before writing code against it; prefer the CLI over MCP when both exist; reach for a CLI before a web dashboard.

## Dependencies — use theirs, read their docs
- **If the dependency ships it, use theirs and delete ours.** A hand-rolled equivalent silently misses upstream fixes: Foreman's 341-line trigger-inbox poller kept polling on Zapier SDK 0.97.1 while the SDK's `watchTriggerInbox` had moved to SSE (0.69.0) and added 5xx/429 retries (0.70.0).
  - Before writing a loop, retry policy, poller, queue consumer or client wrapper, enumerate the library's whole surface (`--help`, the `.d.ts` exports). A changelog diff shows only what changed, never what was there all along.
  - When auditing, ask "does the dependency already do this?", not "does our code work?".
  - Hand-rolling needs a recorded reason in the beads issue's `--design`; an unrecorded one reads later as an oversight.
  - Adopting the upstream version is not an open question. Recommend it and scope the migration.
- **Fetch the vendor's prose docs before writing integration code against any library you configure** (WebFetch, the `defuddle` skill, or the `SDK Quality Gate` agent). Reading `node_modules` is not a substitute: source shows what the code does, and warnings live only in prose. Wiring Better Auth's mail callbacks from source alone (2026-09-22) shipped an account-enumeration timing oracle that their docs warn about ("avoid awaiting the email sending").
  - Look for three things, in order: what it already ships that you are about to write; the security notes (timing, CSRF, origin, enumeration); then the API shape.
  - Record what the docs said next to the `file:line` that implements it.
  - The `mastra` rule's source ladder covers Mastra only. Another library's config gets this pass.

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

- **Dolt** — version-controlled SQL (MySQL-compatible; `branch`/`diff`/`merge`/`commit` on data). Use when you need data history, audit trails, lineage, or reproducible state. Default data/state layer for LLM/agent builds (Beads itself runs on Dolt). `dolt add` + `dolt commit` after every schema/data change. DoltHub owner: `chowderr` (push to `chowderr/<db>`). Checked 2026-10-20: `chowderr/foreman`, `chowderr/brokerboard` and `chowderr/waas` live there, and DoltHub has no owner named `otaku-solutions`. DoltHub Pro is on, so private repos work.
- **DoltHub has two credentials, and they are not interchangeable.** The dolt CLI creds (`dolt creds ls`, about 52 characters; Infisical `DOLTHUB_API_KEY` / `DOLT2_API_KEY`) only push and pull data; used as a web API token they return `invalid authorization header`. The web API token (Infisical prod `/shared`, `DOLTHUB_API_TOKEN`) creates and deletes repos.
- **Create a DoltHub repo from the CLI, never the web UI** (verified 2026-10-09):
  ```bash
  MSYS_NO_PATHCONV=1 infisical run --projectId e56e0da5-6460-4bab-bdd6-2fd12ac5447b --env prod --path=/shared --silent -- bash -c '
    curl -s -X POST "https://www.dolthub.com/api/v1alpha1/database" \
      -H "authorization: token $DOLTHUB_API_TOKEN" -H "Content-Type: application/json" \
      -d "{\"ownerName\":\"chowderr\",\"repoName\":\"<db>\",\"visibility\":\"private\"}"'
  bd dolt remote add origin chowderr/<db> && bd dolt commit -m "..." && bd dolt push
  ```
  If it answers "a repository with that name already exists", query that repo before reusing it; an empty repo returns "branch not found". Name the DoltHub repo after the beads db / GitHub repo. A DoltHub remote stays optional and owner-only.
- **Embedded databases are single-writer, every one of them.** Use an embedded file locally and a real server the moment more than one process writes. Don't research whether some embedded engine can do multi-process writes: no server process means nothing arbitrates between writers. Checked 2026-09-02 on libSQL embedded, `@dolthub/doltlite` (`SQLITE_BUSY`), Turso native (`BEGIN CONCURRENT` needs MVCC, which refuses multiprocess access) and PGlite (single connection). Local Postgres does not need Docker (vault: [[Local Postgres Without Docker]]).
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

## Scraping
When a platform walls logged-out access (Instagram serves 12 posts then a login dialog; yt-dlp's Instagram profile extractor is broken upstream), use the Apify MCP (`apify/instagram-scraper` and siblings: `search-actors`, then `fetch-actor-details`) instead of grinding on browser login. Name the cost before running; stream large datasets to disk from `https://api.apify.com/v2/datasets/<id>/items?clean=true&format=json`, not through the chat.

## Secrets
Never read or print secret values — inject at runtime. See the `secrets` rule for the full contract.
