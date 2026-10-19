---
name: Pre-Flight Check
description: Verify development environment is ready before starting work
---

Run these checks and report a clear pass/fail for each:

1. **Docker**: Run `docker ps` — confirm Docker Desktop is running
2. **Git**: Run `git branch --show-current` and `git status --short` — show current branch and any uncommitted changes
3. **Port 3000**: Run `netstat -ano | findstr :3000` — check if dev server port is already in use
4. **Environment files**: Run `dir .env* 2>$null` — list any .env files present
5. **Node modules**: Check if `node_modules` exists — if not, suggest running `npm install`
6. **Supabase** (if project uses it): Run `supabase status` — confirm local Supabase is running

Format results as a checklist. If any check fails, flag it clearly and suggest the fix. Do NOT proceed with other work until I acknowledge the results.
