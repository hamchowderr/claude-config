---
paths:
  - "C:/Users/HamCh/code/**"
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

→ Vault: `2. Areas/Development/AI/Mastra/`
