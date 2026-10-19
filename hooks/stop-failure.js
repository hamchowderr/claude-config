// Hook: StopFailure — fires when turn ends due to API error
// Exit code and stderr are ignored; used for logging/alerting only
const { execSync } = require('child_process');

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => { input += c; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const errorType = data.error_type || 'unknown';
    const errorMsg = (data.error_message || '').slice(0, 120);

    try {
      execSync(
        `powershell -ExecutionPolicy Bypass -Command "` +
        `[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null; ` +
        `$template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02); ` +
        `$template.SelectSingleNode('//text[@id=1]').InnerText = 'Claude Code API Error'; ` +
        `$template.SelectSingleNode('//text[@id=2]').InnerText = '${errorType}: ${errorMsg.replace(/'/g, '')}'; ` +
        `[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('Claude Code').Show($template)"`,
        { timeout: 5000, stdio: 'ignore' }
      );
    } catch {}
  } catch {}
  process.exit(0);
});
