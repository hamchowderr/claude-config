# Skills — where each kind lives, and how to add, update and remove it

Every folder in `~/.claude/skills/` is a **link**, except `synced/`. A real folder there is a stray copy: nothing updates it and nothing backs it up. Check with `Get-ChildItem ~/.claude/skills | Select Name, LinkType, Target`.

| Kind | Real files live in | Link in `~/.claude/skills/<name>` | Add | Update | Remove |
|---|---|---|---|---|---|
| Third-party (a GitHub skills repo) | `~/.agents/skills/<name>`, tracked in `~/.agents/.skill-lock.json` | junction → `~/.agents/skills/<name>` | `npx skills add <owner/repo> -g --agent claude-code -s <name> -y` | `npx skills update -g` | `npx skills remove -g -s <name> -y` |
| Shipped inside a CLI (agent-browser, apify-cli) | the CLI's npm package (`%APPDATA%/npm/node_modules/<pkg>/skills/<name>`) | junction → that folder, so the skill stays version-matched to the CLI | `npm i -g <pkg>`, then make the junction | `npm i -g <pkg>@latest` | delete the junction, `npm rm -g <pkg>` |
| Chowderr's own | `C:/Users/HamCh/code/claude-skills/<name>` (git repo) | junction → that folder | create it there, commit, make the junction | edit there, commit | delete the junction, `git rm -r <name>`, commit |
| claude.ai account | `~/.claude/skills/synced/` (written by Claude Code) | none | turn on in claude.ai | edit on claude.ai | turn off in claude.ai |
| Project | `<repo>/.claude/skills/<name>`, committed with the repo | none | create and commit in the repo | edit and commit | `git rm -r` and commit |
| Plugin | the plugin's own repo | none | `/plugin` | plugin release | `/plugin` |

- Make a junction from PowerShell: `New-Item -ItemType Junction -Path "$HOME\.claude\skills\<name>" -Target <real folder>`. Remove one with `(Get-Item <path>).Delete()`: that deletes the link, not the target.
- `npx skills` remembers the last agents chosen (`lastSelectedAgents` in the lock file), and that list omits Claude Code. Always pass `--agent claude-code`. After an add or update, check `~/.claude/skills/<name>` is a junction to `~/.agents/skills/<name>`; if it is a real folder, replace it with the junction.
- `claude-config` (the `~/.claude` git repo) is **public** and ignores `skills/`. Own skills hold business details, so they live in `code/claude-skills`, never in `claude-config`.
- A skill name exists once. Before adding one, check `~/.claude/skills`, `synced/` and enabled plugins for the same name; a personal copy of a synced skill loads twice.
- Hiding is not removing. `skillOverrides` (`off`, `name-only`, `user-invocable-only`) in `~/.claude/settings.json` applies everywhere; the `/skills` menu writes to the current project's `.claude/settings.local.json` only. When a skill is removed, delete its `skillOverrides` entries in both places.
- Every add or remove gets a dated entry in the vault's Configuration Changelog.
