---
paths:
  - "C:/Users/HamCh/Obsidian Vault/**/*.md"
  - "C:/Users/HamCh/Obsidian Vault/**/*.base"
  - "C:/Users/HamCh/Obsidian Vault/**/*.canvas"
---

# Vault File Rules

- Use the `obsidian` CLI for all Obsidian content files — notes (`.md`), Bases (`.base`), Canvas (`.canvas`). Never use Write/Edit directly on them. Obsidian app must be running.
- **Invoke it as `Obsidian.com`, never bare `obsidian`** — `C:/Users/HamCh/AppData/Local/Programs/Obsidian/Obsidian.com`. Git Bash ignores `PATHEXT` and resolves bare `obsidian` to the 225MB GUI `.exe`, which has no console: the command still runs, but all output is lost. PowerShell resolves to the `.com` correctly on its own.
- **HARD LIMIT: the total command line must stay under 4000 bytes.** At 4001+ the CLI **fails silently** (exit 0, no output, nothing written) and then kills its own IPC socket, wedging every later call. The budget covers path + flags + content, not just `content=`. Root cause is an unfixed upstream bug ([forum 117325](https://forum.obsidian.md/t/cli-create-with-content-over-4-kb-crashes-the-main-process-with-a-json-parse-error/117325)); there is no stdin or file-input flag. Verified 2026-09-03 on 1.13.7.
- **So: never pass note content through `content=`.** For anything beyond a one-liner use the temp-file + `eval` + `adapter.read` pattern — the eval argument stays a fixed ~200 chars regardless of note size. Full recipe in [[feedback_obsidian_cli_eval_pattern]].
- **Exit codes are unreliable both ways** — exit 0 with empty output is the silent >4000-byte failure; exit 1 with no output can mean the write landed. `Error:` on stdout is an ordinary failure. **Verify actual state on disk; never trust `$?` or output alone.**
- If the CLI hangs or says "unable to find Obsidian": check for an Obsidian window titled `Error` and dismiss it; else toggle Settings → General → Command line interface off/on. Ask before restarting the user's editor.
- New notes: `obsidian create ...` (or the eval pattern for frontmatter/structured content) — never the Write tool.
- **`property:set` / `property:read` silently ignore `path=` and `file=`** — they edit the ACTIVE file and exit 0 either way. Use `eval` + `app.fileManager.processFrontMatter` (no `await` — it hangs the CLI), then verify on disk. Blocked by `obsidian-cli-guard` rule (5).
- **Batch operations lie.** For renames, deletes, or any multi-file run, poll disk until stable and verify actual state — `app.vault.renameFile` has silently no-op'd mid-batch, and `eval` returns before writes flush. Keep batch scripts idempotent.
- **`move` and `rename` HANG on 1.13.7** — exit 124, every time. Isolated 2026-09-07 across plain vs parenthesised names, disk vs API-created files, fresh vs long-indexed destinations, and before/after a full restart. Not parentheses (`delete` works on those) and not the IPC wedge (`create`/`eval`/`delete` keep working). `app.fileManager.renameFile()` via eval is not a workaround either — it returns `started` and silently no-ops. **Move by read → `app.vault.create` → verify byte-identical → `app.vault.trash`.** Blocked by `obsidian-cli-guard` rule (4), which prints the recipe. Check `obsidian backlinks` first: moving keeps the basename so wikilinks survive, **renaming does not**.
- **Exception — self-contained HTML artifacts** (e.g. presentations/decks under `3. Resources/Presentations/`): these are NOT Obsidian notes; edit them directly with Write/Edit.
- When a session produces reusable knowledge, file it to `3. Resources/` or the appropriate area immediately.
