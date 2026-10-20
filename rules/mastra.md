---
paths:
  - "**/mastra/**"
  - "**/*mastra*"
---

# Mastra — the standing setup

Every LLM/agent build here is Mastra. Mastra ships first-party tooling for coding
agents; use it instead of hand-rolling. Check this before writing Mastra code,
before answering any question about Mastra behaviour, and before adding
Mastra-related config to a project.

## Never answer Mastra from memory

The framework ships breaking minors weekly. Training data is wrong. Verify every
claim against a live source, in this order:

1. **The `mastra` skill** — the vendor's own guide to finding current docs and
   building against current APIs. Mastra names this the recommended path for
   everyday work, over the MCP docs server.
2. **Embedded package docs** — `node_modules/@mastra/<pkg>/dist/docs/`, carrying
   `SKILL.md`, `references/`, and `assets/SOURCE_MAP.json`. Version-matched to
   what is installed, so they beat anything published. Not every package ships
   them — `@mastra/core` and `@mastra/libsql` do; `@mastra/factory` and
   `@mastra/code-sdk` do not.
3. **The installed package itself** — `node_modules/@mastra/*`. This is what
   actually runs. Cite `file:line`.
4. **The `mastra-docs` MCP server** — for packages with no embedded docs, and for
   the published-docs view. Its `[📦 LOCAL PACKAGES]` tools read `node_modules`
   and each require `projectPath`; its `[🌐 REMOTE]` tools read the published
   docs and may be ahead of what is installed.

**When two sources disagree, that disagreement is the finding.** Say so rather
than silently trusting one. A docstring describing behaviour the code cannot
perform is a reportable bug.

## Skills

Installed globally from the vendor's repo, so every Mastra project gets them:

```bash
npx skills add mastra-ai/skills --global --skill '*' --agent claude-code -y
npx skills update -g          # they move; refresh rather than assume
```

- **`mastra`** — framework guide: agents, workflows, tools, memory, storage, and
  the `mastra api` CLI.
- **`mastra-factory`** — operating a Factory through `mastra api factory`:
  status, queues, work items, metrics, health, supervisor sessions.

`npx skills list` shows what is installed and where. A skill named in a project's
`skills-lock.json` is a declaration, not proof of installation — check disk.

## The docs MCP server, when a project needs one

Use Mastra's documented config:

```json
{
  "mcpServers": {
    "mastra-docs": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@mastra/mcp-docs-server@latest"]
    }
  }
}
```

Project-scoped `.mcp.json`, checked in — not a global entry. One server per
project that needs it, never both. Requires Node >= 22.13.0.

## Before wiring anything Mastra-shaped

Mastra or the project usually already ships it. Check, in this order, and only
then consider writing something:

1. `npx mastra --help` and the subcommand's `--help` — the CLI covers create,
   init, dev, build, lint, api, and `factory`.
2. `scripts/` in the project — a previous session may have built it already.
3. The `mastra` and `mastra-factory` skills.
4. The package's exports — `getMastraExports` via the MCP, or read `dist/*.d.ts`.

Hand-rolling something the framework ships is the recurring failure here. It
wastes a session and produces a worse version that then has to be maintained.

## Product architecture — one shape for every agentic product
Every agentic product (internal, SaaS or client) is a standalone headless Mastra/Hono service with no vendor lock-in, so an internal tool can become a product, and a client can run it on their own infrastructure, without re-architecture.
- Expose REST, A2A and MCP. A frontend is optional and always a separate deployment, never baked into the service.
- Design agents and tools for many consumers; never couple them to one UI. Auth works across channels: Clerk for SaaS, API keys for direct access, session headers for A2A.
- Same codebase, different `.env` = different deployment target. Docker-ready for client deployments. No Vercel, Convex or database lock-in.
- Storage: every template ships in two deliberate variant lines, Postgres (`@mastra/pg` + PgVector, Docker locally) and Turso (libSQL, `file:` locally, edge-native). Pick a line; don't merge their facts. Vault: [[Mastra Templates - Postgres vs Turso]].

## Deploying — three levels
Frame every Mastra deploy decision as three levels with the rest nested under them; never present the docs' flat list of about seven targets as equals.
1. **Vercel** — serverless, Mastra inside Next.js (Cloudflare Workers, Netlify, AWS Lambda are variants). Deploys from the Vercel git hook.
2. **Mastra Cloud** — managed first-party hosting. Officially "Mastra platform"; call it Mastra Cloud in notes. Deploys from its GitHub integration (the only level that uses it).
3. **VPS** — Docker + Coolify on the Hostinger VPS, the Otaku default (EC2, DO, Azure, bare Node are variants). One docker-compose stack via Coolify; not PM2/nginx.
Vault: [[Mastra Deployment]].

## Template — fork mastra-base
Scaffold new Mastra agents by forking `mastra-base` (`hamchowderr/mastra-base`); children (rag, voice, chat, ncat, descript, skool, learning) add their category on top.
- Stack: Hono on port 4111 (`/api/agents/{id}/generate`, `/health`), Postgres/Supabase via `@mastra/pg` for memory, Studio and PgVector RAG, optional Dolt (`DOLT_HOST/PORT/USER/PASSWORD`), AIMock (`USE_AIMOCK`, OpenAI-compatible only, so eval agents use `openai/*` models; boot order env → `configureAIMock()` → `new Mastra()`).
- Deploy: one compose stack (mastra + Postgres/pgvector + Dolt) on `node:22-slim`, never Alpine: `@mastra/fastembed`'s onnxruntime binding needs glibc.
- **Check `main` before stating versions.** As measured 2026-08-05, `main` ran `@mastra/core` 1.36 without fastembed, ClickHouse or `embedder.ts`; those live on the unmerged `chore/bump-mastra-latest` branch (merge tracked as `template-mastra-base-iu9`; on landing the observability store stays DuckDB, not ClickHouse).
- Self-hosting does not buy a shared team Studio: `mastra build --studio` exists, but its parity with the hosted Studio is unconfirmed. The chosen shape is agents self-hosted on the VPS plus `MastraPlatformExporter` sending traces to hosted Observe (free tier) for the central dashboard.
- A hosted Mastra Cloud Server needs the hosted Data store (Turso/LibSQL) attached; a local file/LibSQL will not deploy (observed 2026-05-26).

## Agent tool design
- **Validate every identifier a tool receives against the live set**, not only enum fields: small local models (4B–8B) paraphrase long strings (`Verc_20 Deprecation Audit.md` for `Vercel Node 20 Deprecation Audit.md`, Qwen3 4B, 2026-08-18). On a mismatch return a corrective string (`No note named "X". Valid notes: A | B | C`), never throw. Treat it as a safety net only: the model did not self-correct from it.
- **Put closed value sets verbatim in the system prompt**, as a list plus "never drop the leading number". In a single-variable A/B on the same model, that fixed the dropped `2. ` prefix on the first try, where the tool description alone failed every time.
- **Don't let the model carry a value it will also be speaking.** Hand it an opaque id and take ids back; refuse ids you did not issue. Claude Haiku 4.5, told twice to copy a timestamp verbatim, rewrote it into the buyer's timezone with the wrong year (2026-09-04). Same shape: no tool accepts a price.
- Answer duplicates with "already done, move on". Count rejections per run as a health metric.

→ Vault: `2. Areas/Development/AI/Mastra/`
