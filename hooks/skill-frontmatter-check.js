// skill-frontmatter-check.js
// Hook: PostToolUse (Write + Edit) — after a SKILL.md, agent or command file is
// written, flag frontmatter that YAML will misread. An unquoted string value that
// starts with `[` or `{` parses as a list or map, and a nested bracket fails the
// parse; since CC 2.1.186 a failed parse loads the skill with empty metadata and
// no warning.
// Rule text lives in the plugin-dev rule ("Skill and agent frontmatter"); this
// hook only names the lines.

const fs = require('fs');

// Keys whose value must be a string. List-valued keys (tools, allowed-tools,
// skills, paths) may legitimately be YAML flow sequences.
const STRING_KEYS = /^(name|description|argument-hint|when_to_use|when-to-use|model|color|version)$/;
const TARGET = /(^|[\\/])(SKILL\.md|agents[\\/][^\\/]+\.md|commands[\\/][^\\/]+\.md)$/;

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => { input += c; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const file = (data.tool_input && data.tool_input.file_path) || '';
    if (!TARGET.test(file)) process.exit(0);

    const text = fs.readFileSync(file, 'utf8').replace(/\r/g, '');
    const m = text.match(/^---\n([\s\S]*?)\n---/);
    if (!m) process.exit(0);

    const bad = [];
    for (const line of m[1].split('\n')) {
      const kv = line.match(/^([A-Za-z_-]+):\s*(.+)$/);
      if (!kv) continue;
      const [, key, value] = kv;
      if (!/^[[{]/.test(value)) continue;
      // A flow sequence holding another bracket fails to parse for any key.
      const nested = /[[{]/.test(value.slice(1, -1));
      if (STRING_KEYS.test(key) || nested) bad.push(`\`${key}\``);
    }
    if (!bad.length) process.exit(0);

    process.stdout.write(JSON.stringify({
      decision: 'block',
      reason: `${file}: frontmatter ${bad.join(', ')} starts with an unquoted bracket, so YAML reads it as a list or map (or fails, and the skill loads with no metadata). Quote the value, e.g. argument-hint: "[new TITLE | find QUERY]". See the plugin-dev rule.`,
    }));
    process.exit(0);
  } catch {
    process.exit(0);
  }
});
