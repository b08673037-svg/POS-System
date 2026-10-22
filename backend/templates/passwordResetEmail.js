const esc = (s) => {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

export function buildPasswordResetEmail({ name, resetUrl, storeName }) {
  const subject = `Reset your password — ${storeName}`;

  const html = `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#f0f2f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f8;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,0.06);">
        <tr>
          <td style="background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);padding:24px 28px;color:#ffffff;">
            <div style="font-size:20px;font-weight:800;">${esc(storeName)}</div>
            <div style="font-size:13px;opacity:0.9;margin-top:2px;">Password reset request</div>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;">
            <p style="margin:0 0 12px;font-size:15px;color:#0a0f1f;font-weight:600;">Hi ${esc(name)},</p>
            <p style="margin:0 0 20px;font-size:14px;color:#4a5568;line-height:1.6;">
              We received a request to reset your password. Click the button below to choose a new one.
              This link expires in <strong>30 minutes</strong>.
            </p>
            <p style="margin:0 0 20px;">
              <a href="${esc(resetUrl)}" style="display:inline-block;background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px;">
                Reset password
              </a>
            </p>
            <p style="margin:0 0 8px;font-size:12.5px;color:#8b94ab;line-height:1.6;">
              If the button does not work, paste this link into your browser:
            </p>
            <p style="margin:0 0 16px;font-size:12px;color:#4a5568;word-break:break-all;">
              ${esc(resetUrl)}
            </p>
            <p style="margin:16px 0 0;font-size:12.5px;color:#8b94ab;line-height:1.6;">
              If you did not request this, you can safely ignore this email — your password will not change.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 28px;border-top:1px solid #eef0f5;background:#fafbff;font-size:11.5px;color:#8b94ab;text-align:center;">
            Automatic message from ${esc(storeName)} POS
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `Hi ${name},

A password reset was requested for your ${storeName} account.

Open this link to set a new password (valid for 30 minutes):
${resetUrl}

If you did not request this, ignore this email.

— ${storeName} POS
`;

  return { subject, html, text };
}