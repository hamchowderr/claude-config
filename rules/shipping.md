---
paths:
  - "**/vercel.json"
  - "**/.vercel/**"
  - "**/.github/workflows/**"
---

# Ship Pipeline — Definition of Done

**A project is DONE when CI is green and a preview deploy is live.** Production
promotion is a separate, human-gated step — never part of an autonomous run
(see the never-merge/push-to-main rule). Prefer the CLI over any dashboard;
inject secrets via `infisical run` / Agent Vault — never print or paste values.

## Phases (in order)
1. **Local build** — scaffold per `dev-defaults` (Next.js / Mastra); `biome check` clean; builds.
2. **Local test gate (pre-commit)** — Tier 1: Vitest + Supertest, fully mocked, **AIMock** at the LLM boundary. Green before any commit. (`testing-tiers.md`)
3. **Repo** — `gh repo create <name> --private`; work a `feature/*` branch. Never commit to main.
4. **Link** — `vercel link` (+ `vercel git connect` to wire the repo).
5. **Env vars** — `vercel env add <NAME> production|preview|development` across all three scopes; values from Infisical/Agent Vault.
6. **CI gate** — GitHub Actions runs the full tiers (Vitest + Supertest + Playwright) with **AIMock** serving LLM calls (copy the AIMock block verbatim from `mastra-base/.github/workflows/ci.yml`; image takes `-f <fixtures-dir>`, never `-c`). Must be green on the PR.
7. **Preview** — push the branch → Vercel preview deploy. Capture the preview URL.
8. **DNS** *(only if a custom domain is in scope)* — Cloudflare scoped *Edit-zone-DNS* token + `curl` the CF API: Vercel A/CNAME + Resend SPF/DKIM/DMARC. Else use the `*.vercel.app` URL.

> **DONE = CI green + preview live.** Stop and report. Do not promote to production.

## Production promotion (human-gated, out of band)
Only on explicit approval: merge the PR → Vercel prod deploy. An agent never does this autonomously.

## Per-project overrides
A project may narrow this — no custom domain → skip phase 8; no LLM in the loop → AIMock not required. State any deviation in the PRD.
