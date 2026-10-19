---
paths:
  - "C:/Users/HamCh/code/**"
  - "**/.env*"
---

# Secrets — never expose, always inject

Secret values flow **user → vault → process env**. They must never land in the chat — not printed by you, not pasted by the user. When in doubt, check the vault first: `2. Areas/Development/DevOps/Infisical/`.

## Reading / using secrets
- Inject at runtime; never read a value into tool output.
  - **Infisical:** `infisical run --path=/<project> --silent -- <cmd>` (injects that project's folder + the `/shared` set it imports). **Never `--recursive`** — it over-injects every project's keys (retired 2026-06-28 when otaku-internal went per-project). Exception: a project with no folder yet can still use `--recursive`. On Windows run from PowerShell — Git Bash mangles a leading-slash `--path`.
  - **Agent Vault** (self-hosted broker on the VPS): route secret-needing CLIs through it via a manual `HTTPS_PROXY` — `agent-vault run` is broken here (control-plane :443 and proxy :14322 are split hosts). Recipe:
    ```bash
    NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS="C:/Users/HamCh/.agent-vault/vps-ca.pem" \
    HTTPS_PROXY="http://$AVT:broker@100.97.92.73:14322" HTTP_PROXY="http://$AVT:broker@100.97.92.73:14322" <cli>
    ```
    Gotchas: scheme is `http://` (not https, since v0.26.2) · vault is `broker` (not `default`) · host is the Tailscale IP (not the domain) · `$AVT` = long-lived agent token at Infisical `otaku-internal/agent-vault/AGENT_VAULT_AGENT_TOKEN_CLAUDE_CODE` · Windows curl needs `-k --proxy-insecure` (or run it from WSL). Full detail: vault [[Agent Vault]].
- Never run value-printing commands: `infisical secrets`, `infisical secrets get`, `infisical export`. The PreToolUse hook denies these.
- To confirm a secret exists, print a MASK only (type / length / first chars). To find one, list folder NAMES only. Value-safe name check: `infisical run --path=/<project> --silent -- pwsh -NoProfile -c '(Get-ChildItem Env:).Name'`.

## Adding / writing secrets
- Never type a raw secret literal — it lands in the transcript. Write only by reference to an already-injected var: `infisical secrets set NEWKEY="$EXISTING"`.
- Brand-new secret values are added by the user (Infisical UI / Agent Vault). From then on, propagate by reference only.
- `.env` / `.env.local`: key names + placeholders (`YOUR_KEY_HERE`) only. Real values inject at runtime — never commit or write them to disk.

## Environments and keys contract (added 2026-09-21 after the Fire Enrich setup slipped)
- **Every project gets its folder in all three Infisical environments, always:** `dev` = this machine · `staging` = Vercel *preview* deploys (the "preview live" DoD target) · `prod` = Vercel production. Creating only dev and prod is a defect. Staging gets its own databases (`<name>_staging`), never prod's.
- **Placeholders live in Infisical, not in files.** When a project needs keys, create the folder and every key with the value `YOUR_VALUE_HERE` directly, from PowerShell: `infisical secrets folders create --name <project> --path / --projectId <id> --env <env>` then `infisical secrets set KEY=YOUR_VALUE_HERE ... --path /<project> --projectId <id> --env <env>`, once per environment. Pass keys as arguments (`--file` aborts on any empty value). Omit a key that must stay empty in an environment instead of setting it blank. The user fills values in the UI. Deleting needs `--type shared` (the CLI defaults to `personal` and fails silently otherwise).
- **One model key, ever.** No per-provider keys (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, ...). Vercel-hosted stacks use the Vercel AI Gateway: `AI_GATEWAY_API_KEY` locally and in staging/prod for raw SDK clients; the `@ai-sdk/gateway` provider authenticates itself on Vercel. A legacy `openai` SDK client goes through the gateway too: `baseURL: 'https://ai-gateway.vercel.sh/v1'` with model ids prefixed `openai/`. Mastra Cloud stacks use the Mastra gateway. See [[llm-gateway-vs-direct-keys]].
- **Model ids are never env vars.** They are runtime settings (a profile, a settings table, a picker) with code defaults, because a gateway accepts any `provider/model` string at call time. The only non-secret env allowed is a temporary deploy switch (feature flag) with a recorded removal date.
- A local `.infisical/upload/<project>.<env>.env` (git-excluded) may exist as the per-key "what it is, where to get it" guide. It is documentation, never the thing the user uploads.

→ Vault: `2. Areas/Development/DevOps/Infisical/` (setup, CLI patterns, folder inventory, Agent Vault recipe)
