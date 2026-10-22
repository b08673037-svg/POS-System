import { formatCurrency, formatDateTime } from "./formatters.js";

/** Escape user-supplied strings before embedding in the print template. */
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Build the standalone HTML for a sale receipt.
 * Used by both the Sales page and the Checkout page for printing.
 */
export function buildInvoiceHtml(sale) {
  const rows = (sale.items || [])
    .map(
      (it) => `
      <tr>
        <td>
          <div style="font-weight:600">${escapeHtml(it.name)}</div>
          <div style="font-size:11px;color:#666">${escapeHtml(it.sku)}</div>
        </td>
        <td class="num">${it.quantity}</td>
        <td class="num">${formatCurrency(it.sellingPrice)}</td>
        <td class="num">${formatCurrency(it.subtotal)}</td>
      </tr>`
    )
    .join("");

  const balanceRow =
    sale.balance > 0
      ? `<div class="print-totals-row balance"><span>Balance due</span><span>${formatCurrency(sale.balance)}</span></div>`
      : `<div class="print-totals-row settled"><span>Settled</span><span>${formatCurrency(0)}</span></div>`;

  return `
  <div class="print-root">
    <div class="print-header">
      <div class="print-brand">
        POS SYSTEM
        <small>Point of Sale</small>
      </div>
      <div class="print-title">
        <h1>Invoice</h1>
        <div class="print-inv">${escapeHtml(sale.invoiceNumber)}</div>
        <div class="print-date">${formatDateTime(sale.createdAt)}</div>
      </div>
    </div>

    <div class="print-meta">
      <div class="print-meta-block">
        <h3>Customer</h3>
        <p>
          <strong>${escapeHtml(sale.customerName || "Walk-in Customer")}</strong><br/>
          ${sale.customerPhone ? escapeHtml(sale.customerPhone) : ""}
        </p>
      </div>
      <div class="print-meta-block">
        <h3>Payment</h3>
        <p>
          Method: <strong>${escapeHtml(sale.paymentMethod || "cash")}</strong><br/>
          Status: <strong>${escapeHtml(sale.paymentStatus || "paid")}</strong>
        </p>
      </div>
    </div>

    <table class="print-table">
      <thead>
        <tr>
          <th>Item</th>
          <th class="num">Qty</th>
          <th class="num">Price</th>
          <th class="num">Subtotal</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="print-totals">
      <div class="print-totals-inner">
        <div class="print-totals-row"><span>Subtotal</span><span>${formatCurrency(sale.subtotal)}</span></div>
        <div class="print-totals-row"><span>Discount</span><span>− ${formatCurrency(sale.discount)}</span></div>
        <div class="print-totals-row"><span>Tax</span><span>+ ${formatCurrency(sale.tax)}</span></div>
        <div class="print-totals-row grand"><span>Total</span><span>${formatCurrency(sale.total)}</span></div>
        <div class="print-totals-row"><span>Amount paid</span><span>${formatCurrency(sale.amountPaid)}</span></div>
        ${balanceRow}
      </div>
    </div>

    <div class="print-footer">
      Thank you for your business.
    </div>
  </div>`;
}

/**
 * Open the browser's print dialog for the given invoice HTML.
 * Renders into a hidden iframe so no popup blocker is triggered.
 */
export function printInvoice(html) {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.setAttribute("aria-hidden", "true");

  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Invoice</title>
  <style>
    @page { margin: 16mm; }
    html, body { margin: 0; padding: 0; background: #fff; }
  </style>
</head>
<body>${html}</body>
</html>`);
  doc.close();

  const cleanup = () => {
    setTimeout(() => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }, 500);
  };

  iframe.contentWindow.focus();
  iframe.contentWindow.onafterprint = cleanup;
  setTimeout(() => {
    try {
      iframe.contentWindow.print();
    } catch (e) {
      cleanup();
    }
  }, 100);
}