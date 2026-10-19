// auto-format.js
// Hook: PostToolUse — Runs project-local formatters/linters on files after Write or Edit
// Matcher: "Write|Edit"
// Input: JSON on stdin from Claude Code (includes tool_input with file_path)
// Exit 0 = success (stdout shown to Claude as info)
//
// Detection priority:
//   1. Biome (biome.json) — single tool for format + lint. Used by NextBase/Ultracite projects.
//   2. Prettier + ESLint — legacy two-tool setup. Used by older projects.
//   3. Neither — skip silently.
//
// Strategy: Walk up from the file looking for biome.json (Biome project) or
//           node_modules/.bin/prettier|eslint (Prettier/ESLint project).
//           Only run tools that exist locally. No npx, no global installs.

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Extensions that Biome handles (format + lint)
const BIOME_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.json', '.jsonc', '.css', '.graphql', '.gql',
  '.vue', '.svelte', '.astro',
]);

// Extensions for Prettier (superset — also handles md, yaml, html, etc.)
const PRETTIER_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.json', '.css', '.scss', '.less', '.html', '.md',
  '.yaml', '.yml', '.graphql', '.gql', '.vue', '.svelte',
]);

// Extensions for ESLint
const ESLINT_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.vue', '.svelte',
]);

function findBin(filePath, toolName) {
  // Walk up from the file's directory looking for node_modules/.bin/<tool>.cmd (Windows)
  let dir = path.dirname(filePath);
  const root = path.parse(dir).root;

  while (dir !== root) {
    const cmdPath = path.join(dir, 'node_modules', '.bin', `${toolName}.cmd`);
    if (fs.existsSync(cmdPath)) return cmdPath;

    const binPath = path.join(dir, 'node_modules', '.bin', toolName);
    if (fs.existsSync(binPath)) return binPath;

    dir = path.dirname(dir);
  }
  return null;
}

function findBiomeConfig(filePath) {
  // Walk up from the file's directory looking for biome.json or biome.jsonc
  let dir = path.dirname(filePath);
  const root = path.parse(dir).root;

  while (dir !== root) {
    if (fs.existsSync(path.join(dir, 'biome.json'))) return dir;
    if (fs.existsSync(path.join(dir, 'biome.jsonc'))) return dir;
    dir = path.dirname(dir);
  }
  return null;
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    // Claude Code's Write/Edit send `file_path`; Mastra Code's write_file and
    // string_replace_lsp send `path`.
    const filePath = data.tool_input?.file_path || data.tool_input?.path;

    if (!filePath || !fs.existsSync(filePath)) {
      process.exit(0);
    }

    const ext = path.extname(filePath).toLowerCase();
    const results = [];

    // Priority 1: Check for Biome project
    const biomeRoot = findBiomeConfig(filePath);
    if (biomeRoot && BIOME_EXTENSIONS.has(ext)) {
      const biomeBin = findBin(filePath, 'biome');
      if (biomeBin) {
        try {
          // biome check --write = format + lint + auto-fix in one pass
          execSync(`"${biomeBin}" check --write "${filePath}"`, {
            stdio: 'pipe',
            timeout: 15000,
            cwd: biomeRoot,
          });
          results.push('biome');
        } catch (e) {
          // Biome exits non-zero if unfixable errors remain — that's fine
          if (e.status === 1) {
            results.push('biome (warnings remain)');
          }
        }

        // Biome handled it — skip Prettier/ESLint
        if (results.length > 0) {
          process.stdout.write(`Auto-formatted: ${results.join(', ')}`);
          process.exit(0);
        }
      }
    }

    // Priority 2: Fall back to Prettier + ESLint for non-Biome projects

    // Run Prettier if applicable
    if (PRETTIER_EXTENSIONS.has(ext)) {
      const prettierBin = findBin(filePath, 'prettier');
      if (prettierBin) {
        try {
          execSync(`"${prettierBin}" --write "${filePath}"`, {
            stdio: 'pipe',
            timeout: 10000,
          });
          results.push('prettier');
        } catch (e) {
          // Prettier failed — don't block, just skip
        }
      }
    }

    // Run ESLint --fix if applicable
    if (ESLINT_EXTENSIONS.has(ext)) {
      const eslintBin = findBin(filePath, 'eslint');
      if (eslintBin) {
        try {
          execSync(`"${eslintBin}" --fix "${filePath}"`, {
            stdio: 'pipe',
            timeout: 15000,
          });
          results.push('eslint --fix');
        } catch (e) {
          if (e.status === 1) {
            results.push('eslint --fix (warnings remain)');
          }
        }
      }
    }

    if (results.length > 0) {
      process.stdout.write(`Auto-formatted: ${results.join(', ')}`);
    }

    process.exit(0);
  } catch (e) {
    // Don't block on errors
    process.exit(0);
  }
});
