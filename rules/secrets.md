---
paths:
  - "**/.env*"
  - "**/*.env"
  - "**/.infisical*"
---

# Secrets — never expose, always inject

Secret values flow **user → vault → process env**. They must never land in the chat — not printed by you, not pasted by the user. When in doubt, check the vault first: `2. Areas/Development/DevOps/Infisical/`.

## Reading / using secrets
- Inject at runtime; never read a value into tool output.
  - **Infisical:** `infisical run --path=/<project> --silent -- <cmd>` (injects that project's folder + the `/shared` set it imports). **Never `--recursive`** — it over-injects every project's keys (retired 2026-06-28 when otaku-internal went per-project). Exception: a project with no folder yet can still use `--recursive`. otaku-internal is per-project (id `e56e0da5-6460-4bab-bdd6-2fd12ac5447b`, env `dev`).
  - **Server and personal credentials are not in `/shared`.** They live in Infisical project **VPS** (id `56fe6a1e-69bf-487d-b885-3ac9851e2f1f`, env `prod`): `/server` (HOSTINGER_VPS_*) and `/admin` (GITHUB_TOKEN, SLACK_USER_TOKEN, COOLIFY_API_TOKEN, VERCEL_PLATFORM_KEY, SUPABASE_MANAGEMENT_KEY, RAILWAY_API_TOKEN, CLOUDFLARE_ACCOUNT_KEY, DOLTHUB_*, DOLT2_API_KEY, LINEAR_API_KEY, CLICKUP_*, MAKE/N8N/POSTMAN keys, SHADCN_UI_KIT_TOKEN, MASTRA_CLOUD_ACCESS_TOKEN, STRIPE_API_KEY, STRIPE_TEST_API_KEY, HIGGSFIELD_API_TOKEN). Only your own login reads that project; no app login does. Inject with `infisical run --projectId 56fe6a1e-69bf-487d-b885-3ac9851e2f1f --env prod --path=/admin -- <cmd>`. `/shared` holds only keys deployed apps use.
  - **Agent Vault** (self-hosted broker on the VPS): route secret-needing CLIs through it via a manual `HTTPS_PROXY` — `agent-vault run` is broken here (control-plane :443 and proxy :14322 are split hosts). Recipe:
    ```bash
    NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS="C:/Users/HamCh/.agent-vault/vps-ca.pem" \
    HTTPS_PROXY="http://$AVT:broker@100.97.92.73:14322" HTTP_PROXY="http://$AVT:broker@100.97.92.73:14322" <cli>
    ```
    Gotchas: scheme is `http://` (not https, since v0.26.2) · vault is `broker` (not `default`) · host is the Tailscale IP (not the domain) · `$AVT` = long-lived agent token at Infisical `otaku-internal/agent-vault/AGENT_VAULT_AGENT_TOKEN_CLAUDE_CODE`. Full detail: vault [[Agent Vault]].
- Never run value-printing commands: `infisical secrets`, `infisical secrets get`, `infisical export`. The PreToolUse hook denies these.
- To confirm a secret exists, print a MASK only (type / length / first chars). To find one, list folder NAMES only. Value-safe name check: `infisical run --path=/<project> --silent -- pwsh -NoProfile -c '(Get-ChildItem Env:).Name'`.

- **Leaked test keys are not incidents.** A `sk_test_`, sandbox or throwaway key in a transcript gets one sentence, then drop it: no follow-up item, no rotation request (they move no money and touch no customer data). Live credentials (`sk_live_`, prod DB URLs, passwords, service-account keys) stay flagged until handled.
- **Client-owned projects are out of scope for otaku-internal.** Brokerboard/Flowsper (Briggs), Dreaming Room AI (Alan) and KnowBS (Rachel) keep secrets in the client's own Infisical and run on the client's own infra. Never audit, inject from or add them to otaku-internal, because the client owns their production credentials; a 403 from otaku-internal on them is correct. Their leftover otaku-internal folders (`/flowsper`, `/dreaming-room-ai`, `/knowbs`) and the `rachel-knowbs` app on Otaku's Coolify are migration leftovers to retire once the client side is confirmed; do not fix their drift. A repo whose `.infisical.json` points at another workspace is a client repo; never switch it to otaku-internal. The knowbs repo's `infisical run` entrypoint (`scripts/docker-entrypoint.sh` + the Dockerfile CLI stage) is the reference implementation for Otaku's own Coolify apps.

## Adding / writing secrets
- Never type a raw secret literal — it lands in the transcript. Write only by reference to an already-injected var: `infisical secrets set NEWKEY="$EXISTING"`.
- Brand-new secret values are added by the user (Infisical UI / Agent Vault). From then on, propagate by reference only.
- `.env` / `.env.local`: reading them is fine. When creating one, key names + placeholders (`YOUR_KEY_HERE`) only. Real values inject at runtime — never commit or write them to disk.

## What stays out of git and out of Infisical
- **Customer PII never goes into version control**, even a private repo with no remote: a private repo is one setting, collaborator or fork from public, and history is permanent. Don't propose committing PII-bearing work, and don't offer "move the addresses to a gitignored file" as the fix. Exclude it with `.git/info/exclude` (not `.gitignore`, so the folder name never reaches a remote either).
- **OAuth scope lists are code, not secrets.** Keep them as constants next to the OAuth code; they change and get reviewed with it. If a codebase reads scopes from env (e.g. `GHL_SCOPES`), file it as a code change instead of setting the variable. Infisical holds IDs and credentials only: client ID, client secret, app ID, webhook secrets.

## Environments and keys contract (added 2026-09-21 after the Fire Enrich setup slipped)
- **Every project gets its folder in all three Infisical environments, always:** `dev` = this machine · `staging` = Vercel *preview* deploys (the "preview live" DoD target) · `prod` = Vercel production. Creating only dev and prod is a defect. Staging gets its own databases (`<name>_staging`), never prod's.
- **Placeholders live in Infisical, not in files.** When a project needs keys, create the folder and every key with the value `YOUR_VALUE_HERE` directly, from PowerShell: `infisical secrets folders create --name <project> --path / --projectId <id> --env <env>` then `infisical secrets set KEY=YOUR_VALUE_HERE ... --path /<project> --projectId <id> --env <env>`, once per environment. Pass keys as arguments (`--file` aborts on any empty value). Omit a key that must stay empty in an environment instead of setting it blank. The user fills values in the UI. Deleting needs `--type shared` (the CLI defaults to `personal` and fails silently otherwise).
- **One model key, ever.** No per-provider keys (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, ...). Vercel-hosted stacks use the Vercel AI Gateway: `AI_GATEWAY_API_KEY` locally and in staging/prod for raw SDK clients; the `@ai-sdk/gateway` provider authenticates itself on Vercel. A legacy `openai` SDK client goes through the gateway too: `baseURL: 'https://ai-gateway.vercel.sh/v1'` with model ids prefixed `openai/`. Mastra Cloud stacks use the Mastra gateway: `MASTRA_GATEWAY_API_KEY`, model strings `mastra/<provider>/<model>`, seeded automatically on Mastra Cloud. A stack on neither uses OpenRouter (`OPENROUTER_API_KEY`).
- **Model ids are never env vars.** They are runtime settings (a profile, a settings table, a picker) with code defaults, because a gateway accepts any `provider/model` string at call time. The only non-secret env allowed is a temporary deploy switch (feature flag) with a recorded removal date.
- A local `.infisical/upload/<project>.<env>.env` (git-excluded) may exist as the per-key "what it is, where to get it" guide. It is documentation, never the thing the user uploads.

## Cloud sessions (Claude Code web/mobile, Vibin environment)
Load secrets with `infisical run --projectId=$INFISICAL_PROJECT_ID --env=<env> --path=/<project> -- <cmd>` (verified 2026-10-10, dev and prod).
- Identity `claude-cloud` (Token Auth, Viewer on the Otaku Solutions project, all folders and environments; token valid to 2027-10-10). The token lives in a Claude Code **Network secret** (Bearer, allowed site `app.infisical.com`); the proxy replaces the Authorization header, so the session's `INFISICAL_TOKEN=placeholder` only makes the CLI start.
- A "malformed token" 403 means the proxy is injecting but the saved value is wrong. Network secrets can't be edited: delete and add it again.
- Revoke by deleting the `claude-cloud` identity. Agent Vault is Tailscale-only, so cloud sessions can't use it.

## Copying Infisical secrets into Vercel
Use a script, not `vercel env add` (verified 2026-09-23, Vercel CLI 52, Infisical CLI 0.43): with the value on stdin, `vercel env add NAME preview` stops with `git_branch_required` in non-interactive mode, and `--value` puts the secret in the process list.
- Run a scratchpad `.mjs` under `infisical run --projectId <id> --env staging --path /<project> --silent -- node sync.mjs preview` (then `--env prod … production`). Per key it reads `process.env[KEY]`, skips missing or `YOUR_VALUE_HERE`, and pipes `{ key, value, type: 'sensitive', target: [target] }` on stdin to `node <npm root -g>/vercel/dist/index.js api '/v10/projects/<prj>/env?teamId=<team>&upsert=true' --method POST --input -`. It prints only `KEY: added to preview len=N`.
- Confirm with `vercel env ls preview` (names only). It is a one-shot copy: rerun after changing a value in Infisical.
- Don't copy `AI_GATEWAY_API_KEY` for the `@ai-sdk/gateway` provider: on Vercel it authenticates with the project's OIDC token. Confirm OIDC by pulling env to a scratch file, checking the name `VERCEL_OIDC_TOKEN` exists, then deleting the file. Inside functions read it with `getVercelOidcToken()` from `@vercel/oidc` (it arrives as a request header, not an env var).

→ Vault: `2. Areas/Development/DevOps/Infisical/` (setup, CLI patterns, folder inventory, Agent Vault recipe)
