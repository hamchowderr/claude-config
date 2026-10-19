---
paths:
  - "**/Dockerfile"
  - "**/Dockerfile.*"
  - "**/docker-compose*.yml"
  - "**/docker-compose*.yaml"
  - "**/compose*.yml"
  - "**/compose*.yaml"
---

# Docker — check first, restart cleanly, confirm before deleting

## Check what is running before naming a cause
For any local resource conflict — a port already in use, RAM or CPU starvation, "another project is running" — run `docker ps --format 'table {{.Names}}\t{{.Ports}}\t{{.Status}}'` and read this repo's own compose/config BEFORE naming a culprit or theorizing. State the cause from what is actually running, never from an error-string fragment. If the daemon is not answering, say so and stop; do not restart Docker Desktop on your own.

## Restart one thing, not everything
Stop and start the one container or service that is wrong. Never kill all Node or all containers to clear a port; find the owner from `docker ps` or the port listener and stop that. After a restart, verify with `docker ps` and the service's own health endpoint before reporting it fixed.

## Confirm before anything destructive
`rm`, `rmi`, `down -v`, `container prune`, `image prune`, and especially `system prune -a --volumes` (deletes unused images AND volumes, which is data loss): name exactly what will be deleted and get a yes first. Reclaim disk with `docker system df` then the narrowest prune that solves it.

## Prefer the repo's own commands
Use the repo's compose file and scripts (`docker compose up/down/logs -f SERVICE`) over ad-hoc `docker run`. Docker's own `--help` is the command reference; do not guess flags.
