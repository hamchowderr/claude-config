---
paths:
  - "**/vercel.json"
  - "**/.vercel/**"
  - "**/.github/workflows/**"
  - "**/package.json"
  - "**/.npmrc"
---

# Ship Pipeline — Definition of Done

**A project is DONE when CI is green and a preview deploy is live.** Production
promotion is a separate, human-gated step — never part of an autonomous run
(see the never-merge/push-to-main rule). Prefer the CLI over any dashboard;
inject secrets via `infisical run` / Agent Vault — never print or paste values.

## Phases (in order)
1. **Local build** — scaffold per `dev-defaults` (Next.js / Mastra); `biome check` clean; builds.
2. **Local test gate (pre-commit)** — Tier 1: Vitest + Supertest, fully mocked, **AIMock** at the LLM boundary. Green before any commit. (`testing` rule)
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

## npm trusted publishing")

## npm trusted publishing
- Publish npm packages from CI with trusted publishing (OIDC), not an `NPM_TOKEN` secret, because npm is deprecating tokens that bypass 2FA.
- One-time per package (needs account 2FA in a browser): `npm trust github <pkg> --file <workflow>.yml --repo owner/repo --allow-publish`, then `npm trust list <pkg>`.
- Check `npm --version` first: `npm trust` needs npm >= 11.15. Older npm (11.13, shipped with Node 24.16) lacks `--allow-publish` and gets a `400 Bad Request` with an empty body. The flag missing from `npm trust github --help` is the tell; `npm install -g npm@latest` fixes it.
- The package must already exist on the registry. One trust config per package (`npm trust revoke --id` to replace). Fields are case-sensitive and not validated on save, so a typo shows up only as a failed publish. Cloud-hosted runners only.
- Workflow: `permissions: id-token: write`, plain `npm publish` with no `NODE_AUTH_TOKEN`, no `--provenance` (trusted publishing attests itself). Upgrade the runner's npm; Node 22's npm 10.9.8 is below the 11.5.1 publish floor.

## Vercel traps")

## Vercel traps
- **Env vars are snapshotted at build.** Adding one never fixes an existing deployment, so a pinned preview URL (the one GitHub's PR comment links) keeps failing after the fix. Test the branch alias `<project>-git-<branch>-<team>.vercel.app`, which serves the newest build. Diagnose by comparing `GET /v10/projects/{id}/env` `createdAt` with `GET /v13/deployments/{uid}` `buildingAt`.
- **Each target is set separately.** Preview does not inherit Production or Development; check `vercel env ls preview`.
- **Preview env vars from an agent:** `vercel env add NAME preview --yes --force` fails non-interactively with `git_branch_required` (CLI 52), and its suggested `--value` fix fails the same way. Pass `""` as the branch and pipe the value on stdin: `<value on stdin> | vercel env add NAME preview "" --force --yes`; from Node, `spawnSync("vercel", ["env","add",NAME,"preview",'""',"--force","--yes"], {input: value, shell: true})`. Verified 2026-10-04. Fallback: `POST /v10/projects/{id}/env?upsert=true` with `{key, value, type:"encrypted", target:["preview"]}` (no `gitBranch` = all preview branches), values fed from `infisical run`.
- **Protected previews:** anonymous requests get a 302 to `vercel.com/sso-api`. Do not disable protection. Use `vercel curl <path> --deployment https://<deployment>.vercel.app --yes -- <curl flags>`, which sends the project's protection-bypass token (repo must be linked). Run it from Git Bash with `MSYS_NO_PATHCONV=1`; PowerShell strips the `--`, so every curl flag fails as "unknown or unexpected option". SSE works with `--no-buffer`. Find a commit's deployment with `vercel ls --format json -m githubCommitSha=<full sha>` or `gh api repos/<owner>/<repo>/commits/<sha>/status`; `vercel inspect <url>` shows target and status. (CLI 52, 2026-09-23.)
- **Production branch:** no API or CLI flag sets it (`PATCH /v9/projects/{id}` rejects `link`; `link.productionBranch` is response-only). Re-derive it from the repo's default branch with `vercel git disconnect --yes` then `vercel git connect https://github.com/<org>/<repo> --yes`; env vars survive. Read back `GET /v9/projects/{id}` → `link.productionBranch`. Renaming a GitHub branch does not update Vercel, which matches by name, so production silently stops deploying.
