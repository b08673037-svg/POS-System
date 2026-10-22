/**
 * Render an invoice's HTML into a hidden iframe and open the browser's
 * print dialog. When the user closes or prints, the iframe is removed.
 *
 * This approach is preferred over window.open() because it does not
 * trigger popup blockers and it keeps the main SPA untouched.
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

  // Give the browser a tick to lay out, then print
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