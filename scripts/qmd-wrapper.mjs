#!/usr/bin/env node
// qmd-wrapper.mjs (stable shim)
//
// Resolves the latest installed braynee plugin cache and execs ITS bundled
// scripts/qmd-wrapper.mjs, forwarding all args. This gives a STABLE path
// (~/.claude/scripts/qmd-wrapper.mjs) that CLAUDE.md and ~/.claude/rules/ can
// reference without rotting when braynee version-bumps its versioned cache dir.
// Same rationale braynee uses for copying statusline.js to a stable path.
//
// Usage: node ~/.claude/scripts/qmd-wrapper.mjs <search|vsearch|query|get|...> [args]

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';

const base = join(os.homedir(), '.claude', 'plugins', 'cache', 'braynee', 'braynee');

let target = null;
try {
  const versions = readdirSync(base)
    .filter(v => existsSync(join(base, v, 'scripts', 'qmd-wrapper.mjs')))
    // highest version first (numeric compare on dotted parts)
    .sort((a, b) => {
      const pa = a.split('.').map(n => parseInt(n, 10) || 0);
      const pb = b.split('.').map(n => parseInt(n, 10) || 0);
      for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        if ((pa[i] || 0) !== (pb[i] || 0)) return (pb[i] || 0) - (pa[i] || 0);
      }
      return 0;
    });
  if (versions[0]) target = join(base, versions[0], 'scripts', 'qmd-wrapper.mjs');
} catch { /* base missing → handled below */ }

if (!target) {
  process.stderr.write(`qmd-wrapper shim: no braynee plugin cache with scripts/qmd-wrapper.mjs under ${base}\n`);
  process.exit(127);
}

const r = spawnSync(process.execPath, [target, ...process.argv.slice(2)], { stdio: 'inherit', windowsHide: true });
process.exit(r.status ?? 0);
