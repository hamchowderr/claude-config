# Coda Integration — Claude Code Setup Guide

## What This Does

This gives Claude Code the ability to search and pull content from your Coda docs by name. You can say things like:

- "Pull the onboarding page from Coda"
- "What pages are in my Product Launch doc?"
- "Search my Coda docs for anything about marketing"
- "Go grab the API docs from Coda and save them"

Claude Code will find the doc/page by name, export the content, and either show it to you or save it to your filesystem.

---

## Setup

### 1. Get Your Coda API Token

1. Go to [https://coda.io/account#apiSettings](https://coda.io/account#apiSettings)
2. Click **"Generate API token"**
3. Copy the token

### 2. Set the Environment Variable

Add `CODA_API_TOKEN` to your shell profile so it's always available.

**PowerShell (Windows):**
```powershell
# Add to your PowerShell profile (run this once)
notepad $PROFILE

# Add this line to the file:
$env:CODA_API_TOKEN = "your-token-here"
```

**Bash/Zsh (Mac/Linux):**
```bash
# Add to ~/.bashrc or ~/.zshrc
export CODA_API_TOKEN="your-token-here"
```

Restart your terminal after saving.

### 3. Install the Script

Copy `coda-sync.mjs` to your Claude Code scripts directory:

```
~/.claude/scripts/coda-sync.mjs
```

### 4. Add CLAUDE.md Instructions

Add the following section to your `~/.claude/CLAUDE.md` (global preferences file). This is what tells Claude Code how and when to use the script:

```markdown
## Coda Integration (coda-sync.mjs)

Script: `node "%USERPROFILE%\.claude\scripts\coda-sync.mjs" <command>`

When the user asks to search, find, read, pull, or reference Coda docs — use this script. Do NOT ask the user for doc IDs or page IDs — resolve by name.

### Quick Reference
| Action | Command |
|:-------|:--------|
| List all docs | `coda-sync docs` |
| Search docs by name | `coda-sync docs search "query"` |
| List pages in a doc | `coda-sync pages "Doc Name"` |
| Export page to stdout | `coda-sync export "Doc Name" "Page Name"` |
| Export as HTML | `coda-sync export "Doc Name" "Page Name" --html` |
| Save page to vault | `coda-sync pull "Doc Name" "Page Name"` |
| Save all pages | `coda-sync pull "Doc Name"` |

### Natural Language Routing
- "search coda for X" / "find X in coda" → `docs search "X"`
- "what's in the X doc" / "show me pages in X" → `pages "X"`
- "pull X from coda" / "grab the X page" → `export` (to show) or `pull` (to save)
- "save the X doc" → `pull "X"`

### Behavior
- Use `export` when the user just wants to see/read content (outputs to stdout).
- Use `pull` when the user wants to save it to disk. Files are saved to `~/.coda/docs/<Doc Name>/` with frontmatter containing source metadata. Override with `CODA_OUTPUT_DIR` env var.
- Progress messages go to stderr, content goes to stdout — so you can capture content cleanly.
- If a doc or page name is ambiguous, the script matches the first partial match. If the user says the wrong one came back, try a more specific name.
```

### 5. Verify It Works

Open a new terminal and run:

```bash
node ~/.claude/scripts/coda-sync.mjs docs
```

You should see a list of your Coda docs. If you get an auth error, double-check your `CODA_API_TOKEN`.

Then open Claude Code and try:

> "Search my Coda docs for [something you know exists]"

Claude should run the script and show you results.

---

## How It Works (Under the Hood)

### The Three-Step Export Flow

Coda doesn't let you grab page content in a single API call. Instead, it uses an async export process:

1. **Submit** — You POST to `/docs/{docId}/pages/{pageId}/export` with your desired format (markdown or HTML). Coda returns a `requestId`.

2. **Poll** — You GET `/docs/{docId}/pages/{pageId}/export/{requestId}` repeatedly until the `status` is `"complete"`. This usually takes 2-10 seconds.

3. **Download** — Once complete, the response includes a temporary `downloadLink`. You fetch that URL to get the actual content. The link expires, so grab it promptly.

The script handles all three steps automatically. It polls every 2 seconds and times out after 60 seconds.

### Name Resolution

You never need to know doc or page IDs. The script:
1. Lists all your docs via the API
2. Does a case-insensitive partial match against the name you provided
3. Returns the first match

Same for pages within a doc.

### Saved File Format

When you use `pull`, files are saved as markdown with YAML frontmatter:

```yaml
---
source: coda
doc_name: "Product Launch Hub"
doc_id: "AbCDeFGH"
page_name: "Launch Status"
page_id: "canvas-IjkLmnO"
synced_at: 2026-02-18
---

[page content here]
```

This makes them queryable by frontmatter just like any other vault note.

---

## API Endpoints Used

| Endpoint | Purpose |
|:---------|:--------|
| `GET /docs` | List/search docs |
| `GET /docs/{id}/pages` | List pages in a doc |
| `POST /docs/{id}/pages/{id}/export` | Start content export |
| `GET /docs/{id}/pages/{id}/export/{requestId}` | Check export status |
| Download link from export response | Get the actual content |

Full API reference: [https://coda.io/developers/apis/v1](https://coda.io/developers/apis/v1)
