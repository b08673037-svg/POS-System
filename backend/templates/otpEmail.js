export function buildOtpEmail({ name, otp, storeName }) {
  const subject = `Your Verification Code - ${storeName}`;

  const html = `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="500" cellpadding="0" cellspacing="0" style="max-width:500px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,0.06);">
        <tr>
          <td style="background:#09090b;padding:24px 28px;color:#ffffff;">
            <div style="font-size:20px;font-weight:800;">${storeName}</div>
            <div style="font-size:13px;opacity:0.9;margin-top:2px;">Account Verification</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;text-align:center;">
            <p style="margin:0 0 16px;font-size:15px;color:#0a0f1f;font-weight:600;">Hi ${name},</p>
            <p style="margin:0 0 24px;font-size:14px;color:#4a5568;line-height:1.6;">
              Please use the following 6-digit code to verify your new POS account. This code expires in <strong>10 minutes</strong>.
            </p>
            <div style="background:#f8f9fa;border:1px dashed #d4d4d8;border-radius:12px;padding:20px;margin-bottom:24px;">
              <span style="font-size:32px;font-weight:900;letter-spacing:8px;color:#09090b;margin-left:8px;">${otp}</span>
            </div>
            <p style="margin:0;font-size:12.5px;color:#71717a;line-height:1.6;">
              If you did not request this, you can safely ignore this email.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `Hi ${name},\n\nYour verification code is: ${otp}\n\nThis code expires in 10 minutes.\n\n— ${storeName}`;

  return { subject, html, text };
}