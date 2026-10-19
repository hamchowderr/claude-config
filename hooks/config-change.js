// Hook: ConfigChange — fires when a config file changes during session
// Can block to prevent change (except policy_settings)
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => { input += c; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const source = data.config_source || 'unknown';
    const keys = (data.changed_keys || []).join(', ');
    process.stdout.write(`Config changed — ${source}${keys ? `: ${keys}` : ''}`);
  } catch {}
  process.exit(0);
});
