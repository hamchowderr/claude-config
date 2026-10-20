---
paths:
  - "**/*.test.*"
  - "**/*.spec.*"
  - "**/vitest.config.*"
  - "**/playwright.config.*"
  - "**/tests/**"
  - "**/__tests__/**"
  - "**/e2e/**"
---

# Testing

## Four tools, four layers (they stack, don't overlap)
- **Vitest** — unit + integration. Pure functions, hooks, modules in-process. Fast; the dev loop. (`npm test`)
- **Supertest** — API / HTTP boundary. Fire a request at a route, assert the response. No browser. Pairs with Vitest.
- **Playwright** — browser / E2E. Real user flows, multi-browser. Few, slow, full-stack. (`npm i -D @playwright/test` + `npx playwright install`; `npm run test:e2e`)
- **AIMock** (`@copilotkit/aimock`, aka LLMock) — the **LLM boundary**. A deterministic mock LLM *server* the other three point at via `ANTHROPIC_BASE_URL` / `OPENAI_BASE_URL`. A dependency, not a replacement — runs whenever an LLM is in the loop so tests stay fast, free, repeatable.

Pyramid: lots of Vitest → some Supertest → few Playwright; AIMock alongside whenever an agent is in the loop.

## Execution tiers (mocked first, live gated)
- **Tier 1 — always-green:** `npm test` — Vitest + Supertest, fully mocked (AIMock for LLM, supabase-js chain mock for DB). No network/server. Pre-commit + CI.
- **Tier 2 — live DB:** `npx supabase start`, then the live config; auto-skip when Supabase unreachable.
- **Tier 3 — live server / protocols (A2A, MCP):** build + start; tests auto-detect & skip otherwise.
- **Tier 4 — real external SDK / API:** gated behind explicit creds; provide read-only (safe) vs write (side-effect) variants.
  - Paid live tests use dedicated test keys whose spend limit the provider enforces, never production keys, because a hand-rolled call counter in test code is a spend guard that can fail with real money.
  - Keep them in a separate Infisical path `/<project>-live-tests` (otaku-internal, env `dev`) with the same variable names the app reads, and run `infisical run --path=/<project>-live-tests --silent -- <cmd>` so tests cannot reach production keys or databases.
  - AI Gateway key: `vercel ai-gateway api-keys create --name <project>-tests --budget <usd> --refresh-period monthly --scope <team>`, captured and written to Infisical in the same command (the value prints once), printing only its length. Check budget for free with `GET https://ai-gateway.vercel.sh/v1/credits`. Firecrawl: the user creates the key with a monthly credit limit (dashboard only) and pastes it into the Infisical placeholder.
  - Tests count calls for the report only; the provider limit is the hard stop. No "refuse past N" logic.
  - A live run inside those monthly limits needs no per-run approval. A higher limit or production keys still needs the user's OK.
  - Starting limits (2026-09-28): $10/month AI Gateway, 1,000 Firecrawl credits/month. Offer the same budget cap when a demo goes public.
- **E2E (Playwright):** `npm run test:e2e` against a running app, with AIMock serving any LLM calls.

Real API keys are the **last** tier, never the first — exercise the whole pipeline before spending money.

## Discipline
- Mock at **boundaries** (HTTP, LLM, DB) — never the unit under test. A test that mocks what it tests is a test of the mock.
- Integration tests against a real (test) DB catch bugs unit tests can't.
- CI runs Vitest + Supertest + Playwright on every PR. **AIMock in CI:** copy the block verbatim from `mastra-base/.github/workflows/ci.yml`; the Docker image takes `-f <fixtures-dir>` only, never `-c <config>`.
- Skip list: **Jest** (use Vitest) · **Cypress** (use Playwright) · Storybook-for-tests (use Playwright component testing).

## Verify before calling a change "done"
Asserting logic is **not** proving behavior. Run BOTH layers — skipping the second is how a hook bug once shipped with green tests:
1. **Logic** — run the relevant tests / self-test (`npm test`, project self-test). Green means the code does what the unit claims.
2. **Behavior** — exercise the change through the REAL path it runs in (the running app, a live session, the actual CLI), not a synthetic harness. Confirm the observable effect, not just a return value.
- **Hooks:** a stdin-piping test cannot see the boundary between Claude Code and `hooks.json`. Confirm the hook fired in a live session. Repo-specific steps live in that repo's own instructions.
- **Report honestly:** if you only ran layer 1, say so — don't narrate a change as verified when only its logic was checked.

## Before review
- The builder runs the feature through the real app (browser at the target sizes) BEFORE asking for review, and includes the results. Review is not testing.
- Test inputs are built through the real code path (the same function/hook the app uses), never hand-copied request bodies or fake shapes.
- Confirm scope with the user before building anything they didn't explicitly ask for; never turn features off as a "recommendation" without naming what's lost.

## Reviews
- Reviewers read code and behavior; they don't re-run suites CI already ran on that SHA.
- Merge only after reading `gh pr checks` as its own step — never chained with the merge.
