import type { VerifyItem } from "./verifyTypes"

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function money(amount: number) {
  return `₱${amount.toLocaleString("en-PH")}`
}

function invoiceNumber(item: VerifyItem) {
  const reference = String(item.orderId ?? item.groupOrderId ?? item.id)
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(-10)
    .toUpperCase()
  return `INV-${reference || "PAYMENT"}`
}

/**
 * Printable invoice for a verified ("Paid and Reserved") seller payment. The
 * seller opens this from Payment History and can hand it to the customer or
 * save it as a PDF.
 */
export function buildPaymentInvoiceHtml(item: VerifyItem, shopName: string) {
  const paid = item.amountPaid != null ? Number(item.amountPaid) : item.amount
  const balance = Math.max(0, item.amount - paid)
  const issued = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
  const rows = [
    ["Invoice No.", invoiceNumber(item)],
    ["Date Issued", issued],
    ["Payment Date", item.date],
    ["Payment Method", item.method],
    ["Reference ID", item.ref || "—"],
    ["Order ID", item.orderId ?? item.groupOrderId ?? String(item.id)],
  ]

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(invoiceNumber(item))} · ${escapeHtml(shopName)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 32px;
    background: #f3f4f6;
    color: #111827;
    font-family: "Segoe UI", Arial, Helvetica, sans-serif;
    font-size: 13px;
    line-height: 1.5;
  }
  .sheet {
    max-width: 720px;
    margin: 0 auto;
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 36px 40px;
  }
  .top { display: flex; justify-content: space-between; gap: 24px; }
  .shop { font-size: 20px; font-weight: 800; letter-spacing: .3px; }
  .kicker { font-size: 11px; font-weight: 700; letter-spacing: 1.4px; text-transform: uppercase; color: #6b7280; }
  .title { font-size: 26px; font-weight: 800; text-align: right; color: #191ba9; margin: 0; }
  .muted { color: #6b7280; }
  .divider { border-top: 1px dashed #d1d5db; margin: 22px 0; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 28px; }
  .meta div { display: flex; justify-content: space-between; gap: 12px; }
  .meta dt { color: #6b7280; }
  .meta dd { margin: 0; font-weight: 600; text-align: right; overflow-wrap: anywhere; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th {
    text-align: left;
    font-size: 10px;
    letter-spacing: .8px;
    text-transform: uppercase;
    color: #6b7280;
    padding: 0 0 8px;
    border-bottom: 1px solid #e5e7eb;
  }
  th:last-child, td:last-child { text-align: right; }
  td { padding: 12px 0; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
  .totals { margin-left: auto; margin-top: 14px; width: 100%; max-width: 280px; }
  .totals div { display: flex; justify-content: space-between; padding: 4px 0; }
  .totals .due { border-top: 2px solid #111827; margin-top: 8px; padding-top: 10px; font-weight: 800; font-size: 16px; }
  .status {
    display: inline-block;
    margin-top: 18px;
    padding: 5px 12px;
    border-radius: 999px;
    background: #d4f5ea;
    color: #065f46;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: .4px;
    text-transform: uppercase;
  }
  .note { margin-top: 22px; font-size: 11px; color: #6b7280; font-style: italic; }
  .toolbar { max-width: 720px; margin: 0 auto 14px; display: flex; justify-content: flex-end; gap: 8px; }
  .toolbar button {
    border: 1px solid #191ba9;
    background: #191ba9;
    color: #fff;
    border-radius: 8px;
    padding: 9px 16px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }
  .toolbar button.secondary { background: #fff; color: #374151; border-color: #d1d5db; }
  @media print {
    body { background: #fff; padding: 0; }
    .sheet { border: 0; border-radius: 0; padding: 0; max-width: none; }
    .toolbar { display: none; }
    @page { margin: 18mm; }
  }
</style>
</head>
<body>
  <div class="toolbar">
    <button class="secondary" onclick="window.close()">Close</button>
    <button onclick="window.print()">Print / Save as PDF</button>
  </div>
  <main class="sheet">
    <div class="top">
      <div>
        <div class="kicker">Invoice</div>
        <div class="shop">${escapeHtml(shopName)}</div>
      </div>
      <div>
        <h1 class="title">INVOICE</h1>
        <div class="muted" style="text-align:right">${escapeHtml(invoiceNumber(item))}</div>
      </div>
    </div>

    <div class="divider"></div>

    <div class="meta">
      <div><span class="muted">Billed To</span><strong>${escapeHtml(item.buyer)}</strong></div>
      <div><span class="muted">Phone</span><span>${escapeHtml(item.phone || "—")}</span></div>
    </div>

    <div class="divider"></div>

    <dl class="meta" style="margin:0">
      ${rows
        .map(
          ([label, value]) =>
            `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`,
        )
        .join("")}
    </dl>

    <div class="divider"></div>

    <table>
      <thead>
        <tr><th>Description</th><th>Amount</th></tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <strong>${escapeHtml(item.product)}</strong>
            <div class="muted">Payment for reserved order${item.orderId ? ` · ${escapeHtml(item.orderId)}` : ""}</div>
          </td>
          <td>${escapeHtml(money(item.amount))}</td>
        </tr>
      </tbody>
    </table>

    <div class="totals">
      <div><span class="muted">Total</span><span>${escapeHtml(money(item.amount))}</span></div>
      <div><span class="muted">Amount Paid</span><span>${escapeHtml(money(paid))}</span></div>
      <div class="due"><span>Balance</span><span>${escapeHtml(money(balance))}</span></div>
    </div>

    <div class="status">Paid and Reserved</div>

    <p class="note">
      This invoice confirms the payment received for the order above. Thank you for your purchase!
    </p>
  </main>
</body>
</html>`
}

export function printPaymentInvoice(item: VerifyItem, shopName: string) {
  const invoice = window.open("", "_blank", "width=860,height=900")
  if (!invoice) {
    alert("Please allow pop-ups to print this invoice.")
    return
  }
  invoice.document.open()
  invoice.document.write(buildPaymentInvoiceHtml(item, shopName))
  invoice.document.close()
  invoice.focus()
  // Give the new window a moment to lay out before opening its print dialog.
  setTimeout(() => {
    try {
      invoice.print()
    } catch {
      // The window's own Print button remains available if this is blocked.
    }
  }, 300)
}
