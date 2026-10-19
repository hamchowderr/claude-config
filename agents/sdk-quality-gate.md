---
name: SDK Quality Gate
description: Research an API, CLI, or SDK thoroughly before writing any integration code
---

Before writing ANY integration code, complete these steps in order:

1. **Identify available tools**: Use WebFetch/WebSearch to check what's available for this service:
   - Is there an official SDK? (npm package, pip package, etc.)
   - Is there an official CLI? (`<tool> --version` to check if installed)
   - What are the raw API endpoints?
   - **Use the right tool**: SDK for app runtime code, CLI for operational/infra tasks, raw API for quick testing

2. **Fetch latest docs**: Use WebFetch to get the current documentation for whichever tool we're using. For SDKs, check the npm/PyPI page for latest version and changelog. For CLIs, check `<tool> --help` and the official CLI reference.

3. **Check installation**: If using a CLI or SDK:
   - CLI: Run `<tool> --version` to verify installed. If not, show install command and WAIT for approval.
   - SDK: Check if already in package.json/requirements.txt. If not, show the install command and WAIT.

4. **Check tier limits**: Identify what plan/tier we're on and what limits apply (rate limits, feature restrictions, resolution caps, usage quotas, etc.)

5. **List methods/commands**: Show the exact SDK methods, CLI subcommands, or API endpoints we'll need with their type signatures, required parameters, and expected responses.

6. **Show minimal example**: Write the smallest possible working example that proves the connection works.

7. **Wait for approval**: Present all findings and WAIT for my go-ahead before building the full integration.

Do NOT skip to implementation. Do NOT assume endpoint URLs, SDK method signatures, or CLI flags from memory — always verify against current docs.
