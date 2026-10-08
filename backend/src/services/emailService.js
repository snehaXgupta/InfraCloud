const nodemailer = require('nodemailer');
const { getEmailMute } = require('./notificationSettings');

// Initialize reusable transporter with smart Gmail detection & sanitization
const getTransporter = () => {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER ? process.env.SMTP_USER.trim() : undefined;
  // Automatically strip all spaces and quotes from password
  const pass = process.env.SMTP_PASS ? process.env.SMTP_PASS.replace(/[\s"']/g, '') : undefined;

  if (!user || !pass) {
    return null;
  }

  // If using Gmail, nodemailer's built-in 'gmail' service is most reliable
  if (host.includes('gmail') || user.toLowerCase().endsWith('@gmail.com')) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user,
        pass,
      },
    });
  }

  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });
};

/**
 * Send rich HTML alert email for infrastructure threshold breaches
 */
const sendAlertEmail = async ({
  serverName,
  ip,
  severity = 'Critical',
  metric = 'CPU',
  currentValue = '95%',
  threshold = '>90%',
  message,
  ignoreMute = false, // only the explicit "send test email" button bypasses the mute
}) => {
  if (!ignoreMute) {
    const mute = await getEmailMute().catch(() => ({ muted: false }));
    if (mute.muted) {
      console.log(`[SMTP Notice] Email skipped: alert emails are muted${mute.until ? ` until ${mute.until.toISOString()}` : ''}`);
      return { success: false, reason: 'Alert emails are muted' };
    }
  }

  const transporter = getTransporter();

  if (!transporter) {
    console.log('[SMTP Notice] Email skipped: SMTP_USER or SMTP_PASS not set in .env');
    return { success: false, reason: 'SMTP credentials missing in .env' };
  }

  const isServerDown = metric.toLowerCase().includes('heartbeat') || metric.toLowerCase().includes('server down') || message?.toLowerCase().includes('down') || message?.toLowerCase().includes('unreachable');
  const isCritical = severity.toLowerCase() === 'critical' || isServerDown;
  
  let badgeBg = '#d97706'; // Amber for Warning
  let badgeText = 'WARNING ALERT';
  let subjectPrefix = '[WARNING]';

  if (isServerDown) {
    badgeBg = '#e11d48'; // Crimson/Rose for Server Down
    badgeText = 'SERVER DOWN';
    subjectPrefix = '[SERVER DOWN]';
  } else if (isCritical) {
    badgeBg = '#dc2626'; // Bright Red for Critical
    badgeText = 'CRITICAL ALERT';
    subjectPrefix = '[CRITICAL]';
  }

  // Build subject line
  const subject = isServerDown
    ? `${subjectPrefix} ${serverName || 'Server'}: Heartbeat Missing (Node Unreachable)`
    : `${subjectPrefix} ${serverName || 'Server'}: ${metric} ${severity === 'Critical' ? 'Critical' : 'High'} (${currentValue})`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0c0e14; color: #f1f5f9; margin: 0; padding: 24px; }
          .container { max-width: 580px; margin: 0 auto; background-color: #10131b; border: 1px solid #212636; border-radius: 12px; padding: 24px; overflow: hidden; }
          .header { border-bottom: 1px solid #1c202c; padding-bottom: 16px; margin-bottom: 16px; }
          .badge { background-color: ${badgeBg}; color: #ffffff; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; font-family: monospace; }
          .title { font-size: 18px; font-weight: 700; color: #ffffff; margin: 12px 0 4px 0; }
          .subtitle { font-size: 12px; color: #94a3b8; font-family: monospace; }
          .message-box { background-color: #0d0f15; border: 1px solid #1f2434; border-radius: 8px; padding: 14px; margin: 16px 0; font-size: 13px; color: #e2e8f0; line-height: 1.5; }
          .stats-table { width: 100%; border-collapse: collapse; font-size: 12px; margin: 16px 0; font-family: monospace; }
          .stats-table td { padding: 8px 0; border-bottom: 1px solid #1c202c; }
          .stats-label { color: #64748b; }
          .stats-value { color: #f8fafc; font-weight: 700; text-align: right; }
          .btn { display: inline-block; background-color: #0069ff; color: #ffffff !important; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 13px; font-weight: 600; margin-top: 8px; }
          .footer { margin-top: 24px; font-size: 11px; color: #475569; text-align: center; font-family: monospace; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <span class="badge">${badgeText}</span>
            <div class="title">${serverName || 'Infrastructure Node'}</div>
            <div class="subtitle">IP: ${ip || '127.0.0.1'} · Simpel SPACES PANEL</div>
          </div>

          <div class="message-box">
            ${message || (isServerDown ? `Agent heartbeat stopped responding. The server appears to be offline or network routing has degraded.` : `Threshold limit exceeded for ${metric}. Immediate inspection advised.`)}
          </div>

          <table class="stats-table">
            <tr>
              <td class="stats-label">Trigger Rule</td>
              <td class="stats-value">${metric} ${isServerDown ? 'Failure' : (severity === 'Critical' ? 'Critical' : 'High')}</td>
            </tr>
            <tr>
              <td class="stats-label">Measured Value</td>
              <td class="stats-value" style="color: ${badgeBg};">${currentValue}</td>
            </tr>
            <tr>
              <td class="stats-label">Configured Threshold</td>
              <td class="stats-value">${threshold}</td>
            </tr>
            <tr>
              <td class="stats-label">Timestamp</td>
              <td class="stats-value">${new Date().toUTCString()}</td>
            </tr>
          </table>

          <div style="text-align: center; margin-top: 20px;">
            <a href="http://localhost:5173/alerts" class="btn">Open Alerts Control Plane &rarr;</a>
          </div>

          <div class="footer">
            Automated notification dispatch from Simpel Server Management Platform.
          </div>
        </div>
      </body>
    </html>
  `;

  const recipient = process.env.ALERT_RECIPIENT_EMAIL || process.env.SMTP_USER;

  try {
    const info = await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME || 'SPACES PANEL Alerts'}" <${process.env.SMTP_USER}>`,
      to: recipient,
      subject,
      html: htmlContent,
    });

    console.log(`[SMTP Success] Alert email sent to ${recipient} (MessageID: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[SMTP Error] Failed to send email alert:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Verify SMTP connection credentials
 */
const verifySMTP = async () => {
  const transporter = getTransporter();
  if (!transporter) {
    return { success: false, message: 'SMTP credentials missing in .env' };
  }
  try {
    await transporter.verify();
    return { success: true, message: 'SMTP connection verified successfully!' };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

module.exports = {
  sendAlertEmail,
  verifySMTP,
};
