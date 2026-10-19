---
paths:
  - "C:/Users/HamCh/code/workspace/**"
---

# Workspace Junction Safety

Workspace junctions (`C:\Users\HamCh\code\workspace\`) point to real project roots. ONLY use `workspace-swap.ps1` to manage them. Never `rm`, `rmdir`, `mv`, `cp`, or `git rm` on workspace dirs.
