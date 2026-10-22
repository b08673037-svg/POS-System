import { formatCurrency, formatDateTime } from "../utils/format.js";

/** Escape any user-supplied string before embedding in HTML. */
const esc = (s) => {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

/**
 * Build the admin notification for a completed sale.
 * Returns { subject, html, text }.
 */
export function buildAdminSaleEmail(sale, store) {
  const subject = `New Sale — Invoice ${sale.invoiceNumber} — ${formatCurrency(
    sale.total
  )}`;

  /* ---------- Item rows ---------- */
  const itemRowsHtml = (sale.items || [])
    .map(
      (it) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #eef0f5;">
          <div style="font-weight:600;color:#0a0f1f;">${esc(it.name)}</div>
          <div style="font-size:12px;color:#8b94ab;">${esc(it.sku)}</div>
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #eef0f5;text-align:right;color:#4a5568;">
          ${it.quantity}
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #eef0f5;text-align:right;color:#4a5568;">
          ${formatCurrency(it.sellingPrice)}
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #eef0f5;text-align:right;font-weight:600;color:#0a0f1f;">
          ${formatCurrency(it.subtotal)}
        </td>
      </tr>`
    )
    .join("");

  const textItems = (sale.items || [])
    .map(
      (it) =>
        `  ${it.quantity} × ${it.name} (${it.sku}) @ ${formatCurrency(
          it.sellingPrice
        )} = ${formatCurrency(it.subtotal)}`
    )
    .join("\n");

  /* ---------- HTML body ---------- */
  const html = `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#f0f2f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f8;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,0.06);">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);padding:26px 28px;color:#ffffff;">
            <div style="font-size:22px;font-weight:800;letter-spacing:-0.02em;">
              ${esc(store.name)}
            </div>
            <div style="font-size:13px;opacity:0.85;margin-top:4px;">
              New sale notification
            </div>
          </td>
        </tr>

        <!-- Amount banner -->
        <tr>
          <td style="padding:26px 28px 8px;">
            <div style="font-size:12px;color:#8b94ab;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">
              Sale total
            </div>
            <div style="font-size:32px;font-weight:900;color:#0a0f1f;letter-spacing:-0.03em;margin-top:2px;">
              ${formatCurrency(sale.total)}
            </div>
            <div style="font-size:13px;color:#4a5568;margin-top:6px;">
              Invoice <strong>${esc(sale.invoiceNumber)}</strong> · ${formatDateTime(sale.createdAt)}
            </div>
          </td>
        </tr>

        <!-- Meta grid -->
        <tr>
          <td style="padding:14px 28px 4px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f8fc;border-radius:10px;">
              <tr>
                <td style="padding:14px 16px;font-size:13px;color:#4a5568;width:50%;">
                  <div style="font-size:11px;color:#8b94ab;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:4px;">Customer</div>
                  <div style="color:#0a0f1f;font-weight:600;">${esc(sale.customerName || "Walk-in Customer")}</div>
                  ${sale.customerPhone ? `<div style="color:#8b94ab;font-size:12px;">${esc(sale.customerPhone)}</div>` : ""}
                </td>
                <td style="padding:14px 16px;font-size:13px;color:#4a5568;width:50%;">
                  <div style="font-size:11px;color:#8b94ab;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:4px;">Payment</div>
                  <div style="color:#0a0f1f;font-weight:600;text-transform:capitalize;">${esc(sale.paymentMethod)}</div>
                  <div style="color:#8b94ab;font-size:12px;text-transform:capitalize;">${esc(sale.paymentStatus)}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Items -->
        <tr>
          <td style="padding:20px 28px 4px;">
            <div style="font-size:12px;color:#8b94ab;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:10px;">
              Items (${(sale.items || []).length})
            </div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
              <thead>
                <tr>
                  <th style="text-align:left;padding:8px 12px;font-size:11px;color:#8b94ab;text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid #e8ebf3;">Item</th>
                  <th style="text-align:right;padding:8px 12px;font-size:11px;color:#8b94ab;text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid #e8ebf3;">Qty</th>
                  <th style="text-align:right;padding:8px 12px;font-size:11px;color:#8b94ab;text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid #e8ebf3;">Price</th>
                  <th style="text-align:right;padding:8px 12px;font-size:11px;color:#8b94ab;text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid #e8ebf3;">Subtotal</th>
                </tr>
              </thead>
              <tbody>${itemRowsHtml}</tbody>
            </table>
          </td>
        </tr>

        <!-- Totals -->
        <tr>
          <td style="padding:16px 28px 24px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f8fc;border-radius:10px;padding:14px 16px;">
              <tr><td style="padding:4px 0;color:#4a5568;font-size:13px;">Subtotal</td><td style="text-align:right;padding:4px 0;color:#0a0f1f;font-weight:600;">${formatCurrency(sale.subtotal)}</td></tr>
              ${sale.discount > 0 ? `<tr><td style="padding:4px 0;color:#4a5568;font-size:13px;">Discount</td><td style="text-align:right;padding:4px 0;color:#0a0f1f;font-weight:600;">− ${formatCurrency(sale.discount)}</td></tr>` : ""}
              ${sale.tax > 0 ? `<tr><td style="padding:4px 0;color:#4a5568;font-size:13px;">Tax</td><td style="text-align:right;padding:4px 0;color:#0a0f1f;font-weight:600;">+ ${formatCurrency(sale.tax)}</td></tr>` : ""}
              <tr>
                <td style="padding:10px 0 0;color:#0a0f1f;font-weight:800;border-top:2px solid #e8ebf3;">Total</td>
                <td style="text-align:right;padding:10px 0 0;color:#6366f1;font-weight:900;font-size:18px;border-top:2px solid #e8ebf3;">${formatCurrency(sale.total)}</td>
              </tr>
              <tr><td style="padding:6px 0 0;color:#4a5568;font-size:13px;">Amount paid</td><td style="text-align:right;padding:6px 0 0;color:#0a0f1f;font-weight:600;">${formatCurrency(sale.amountPaid)}</td></tr>
              ${sale.balance > 0 ? `<tr><td style="padding:4px 0;color:#b45309;font-size:13px;font-weight:600;">Balance due</td><td style="text-align:right;padding:4px 0;color:#b45309;font-weight:700;">${formatCurrency(sale.balance)}</td></tr>` : `<tr><td style="padding:4px 0;color:#047857;font-size:13px;font-weight:600;">Settled</td><td style="text-align:right;padding:4px 0;color:#047857;font-weight:700;">${formatCurrency(0)}</td></tr>`}
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:18px 28px;border-top:1px solid #eef0f5;background:#fafbff;font-size:11.5px;color:#8b94ab;text-align:center;">
            Automatic notification from ${esc(store.name)} POS System
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  /* ---------- Plain-text fallback ---------- */
  const text = `${store.name} — New Sale

Invoice:   ${sale.invoiceNumber}
Date:      ${formatDateTime(sale.createdAt)}
Customer:  ${sale.customerName || "Walk-in Customer"}${sale.customerPhone ? ` (${sale.customerPhone})` : ""}
Payment:   ${sale.paymentMethod} — ${sale.paymentStatus}

Items:
${textItems}

Subtotal:  ${formatCurrency(sale.subtotal)}
${sale.discount > 0 ? `Discount:  − ${formatCurrency(sale.discount)}\n` : ""}${sale.tax > 0 ? `Tax:       + ${formatCurrency(sale.tax)}\n` : ""}Total:     ${formatCurrency(sale.total)}
Paid:      ${formatCurrency(sale.amountPaid)}
${sale.balance > 0 ? `Balance:   ${formatCurrency(sale.balance)}` : "Settled"}

— ${store.name} POS System
`;

  return { subject, html, text };
}