import { formatCurrency, formatDateTime } from "../utils/format.js";

const esc = (s) => {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

export function buildCustomerSaleEmail(sale, store) {
  const subject = `Your purchase at ${store.name} — Invoice ${sale.invoiceNumber}`;

  const itemRowsHtml = (sale.items || [])
    .map(
      (it) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #eef0f5;">
          <div style="font-weight:600;color:#0a0f1f;">${esc(it.name)}</div>
          <div style="font-size:12px;color:#8b94ab;">${esc(it.sku)}</div>
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #eef0f5;text-align:right;color:#4a5568;">${it.quantity}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eef0f5;text-align:right;color:#4a5568;">${formatCurrency(it.sellingPrice)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eef0f5;text-align:right;font-weight:600;color:#0a0f1f;">${formatCurrency(it.subtotal)}</td>
      </tr>`
    )
    .join("");

  const textItems = (sale.items || [])
    .map(
      (it) =>
        `  ${it.quantity} × ${it.name} @ ${formatCurrency(it.sellingPrice)} = ${formatCurrency(it.subtotal)}`
    )
    .join("\n");

  const html = `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#f0f2f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f8;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,0.06);">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#10b981 0%,#34d399 100%);padding:26px 28px;color:#ffffff;">
            <div style="font-size:22px;font-weight:800;letter-spacing:-0.02em;">
              Thank you for shopping with us!
            </div>
            <div style="font-size:13px;opacity:0.9;margin-top:4px;">
              ${esc(store.name)}
            </div>
          </td>
        </tr>

        <!-- Greeting + amount -->
        <tr>
          <td style="padding:26px 28px 8px;">
            <div style="font-size:15px;color:#0a0f1f;font-weight:600;">
              Hi ${esc((sale.customerName || "").split(" ")[0] || "there")},
            </div>
            <div style="font-size:13.5px;color:#4a5568;margin-top:6px;line-height:1.6;">
              Your purchase has been confirmed. Here is your receipt.
            </div>
            <div style="margin-top:16px;font-size:11.5px;color:#8b94ab;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Amount charged</div>
            <div style="font-size:32px;font-weight:900;color:#0a0f1f;letter-spacing:-0.03em;margin-top:2px;">${formatCurrency(sale.total)}</div>
            <div style="font-size:12.5px;color:#4a5568;margin-top:6px;">
              Invoice <strong>${esc(sale.invoiceNumber)}</strong> · ${formatDateTime(sale.createdAt)}
            </div>
          </td>
        </tr>

        <!-- Items -->
        <tr>
          <td style="padding:16px 28px 4px;">
            <div style="font-size:12px;color:#8b94ab;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:10px;">Your items</div>
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
              <tr><td style="padding:6px 0 0;color:#4a5568;font-size:13px;">Paid</td><td style="text-align:right;padding:6px 0 0;color:#0a0f1f;font-weight:600;">${formatCurrency(sale.amountPaid)}</td></tr>
              ${sale.balance > 0 ? `<tr><td style="padding:4px 0;color:#b45309;font-size:13px;font-weight:600;">Balance</td><td style="text-align:right;padding:4px 0;color:#b45309;font-weight:700;">${formatCurrency(sale.balance)}</td></tr>` : ""}
            </table>
          </td>
        </tr>

        <!-- Thank you + contact -->
        <tr>
          <td style="padding:18px 28px;border-top:1px solid #eef0f5;background:#fafbff;font-size:12.5px;color:#4a5568;text-align:center;line-height:1.7;">
            <div style="font-weight:700;color:#0a0f1f;margin-bottom:6px;">Thank you for your business!</div>
            ${store.phone ? `<div>📞 ${esc(store.phone)}</div>` : ""}
            ${store.address ? `<div>📍 ${esc(store.address)}</div>` : ""}
            ${store.email ? `<div>✉️ ${esc(store.email)}</div>` : ""}
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `Hi ${(sale.customerName || "").split(" ")[0] || "there"},

Thank you for shopping at ${store.name}.

Invoice:  ${sale.invoiceNumber}
Date:     ${formatDateTime(sale.createdAt)}

Items:
${textItems}

Subtotal: ${formatCurrency(sale.subtotal)}
${sale.discount > 0 ? `Discount: − ${formatCurrency(sale.discount)}\n` : ""}${sale.tax > 0 ? `Tax:      + ${formatCurrency(sale.tax)}\n` : ""}Total:    ${formatCurrency(sale.total)}
Paid:     ${formatCurrency(sale.amountPaid)}
${sale.balance > 0 ? `Balance:  ${formatCurrency(sale.balance)}` : ""}

Thank you for your business!
${store.phone ? `Phone:   ${store.phone}\n` : ""}${store.address ? `Address: ${store.address}\n` : ""}${store.email ? `Email:   ${store.email}\n` : ""}
`;

  return { subject, html, text };
}