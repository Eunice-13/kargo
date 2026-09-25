import { useState } from "react"
import { ClipboardList, ExternalLink, Paperclip } from "lucide-react"
import type { PayHistRow } from "@/types"
import { Modal, PrimaryBtn, StatusBadge } from "@/components/shared"
import { kargoApi } from "@/services"

export default function TransactionDetailModal({
  tx,
  onClose,
}: {
  tx: PayHistRow
  onClose: () => void
}) {
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null)
  const [receiptLoading, setReceiptLoading] = useState(false)
  const [receiptError, setReceiptError] = useState<string | null>(null)
  const openReceipt = async () => {
    if (!tx.receiptPath) return
    setReceiptLoading(true)
    setReceiptError(null)
    try {
      setReceiptUrl(await kargoApi.paymentReceiptUrl(tx.receiptPath))
    } catch (error) {
      setReceiptError(error instanceof Error ? error.message : "Unable to open the receipt.")
    } finally {
      setReceiptLoading(false)
    }
  }
  return (
    <>
    <Modal title="Transaction Details" onClose={onClose} width={460}>
      <div className="space-y-4">
        <div
          style={{
            background: "#F9FAFB",
            borderRadius: 8,
            padding: "14px 16px",
          }}
        >
          {([
            ["Product", tx.product],
            ["Batch", tx.batch || "—"],
            ["Method", tx.method],
            ["Amount", `₱${tx.amount.toLocaleString()}`],
            ["Date", tx.date],
            ["Status", tx.status],
            ...(tx.status === "Rejected"
              ? [["Rejection Reason", tx.rejectionReason || "No reason provided"] as [string, string]]
              : []),
            ...(tx.rejectionDeadline
              ? [["Resubmit By", new Date(tx.rejectionDeadline).toLocaleString()] as [string, string]]
              : []),
            ["Reference ID", tx.referenceNumber || "—"],
            ["Account Name", tx.payerAccountName || "—"],
            ["Phone Number", tx.payerPhone || "—"],
          ] as [string, string][]).map(([k, v]) => (
            <div
              key={k}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "6px 0",
                borderBottom: "1px solid #F3F4F6",
              }}
            >
              <span style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 500 }}>
                {k}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>
                {k === "Status" ? <StatusBadge status={tx.status} /> : v}
              </span>
            </div>
          ))}
          {tx.buyerContactUrl && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #F3F4F6" }}>
              <span style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 500 }}>Contact Link</span>
              <a href={tx.buyerContactUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, fontWeight: 700, color: "#191BA9", display: "inline-flex", alignItems: "center", gap: 4 }}>
                Open <ExternalLink size={12} aria-hidden="true" />
              </a>
            </div>
          )}
          {tx.receiptPath && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" }}>
              <span style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 500 }}>Receipt</span>
              <button type="button" onClick={openReceipt} disabled={receiptLoading} style={{ border: 0, background: "transparent", color: "#191BA9", cursor: "pointer", fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Paperclip size={12} aria-hidden="true" /> {receiptLoading ? "Opening…" : "View submitted proof"}
              </button>
            </div>
          )}
          {receiptError && <div style={{ color: "#B91C1C", fontSize: 11, marginTop: 6 }}>{receiptError}</div>}
        </div>
        <div
          style={{
            background: "#EEF0FF",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 12,
            color: "#374151",
            display: "flex",
            gap: 8,
          }}
        >
          <ClipboardList size={15} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
          <span>This record is for your reference only. Contact the seller directly
          for disputes.</span>
        </div>
        <PrimaryBtn
          style={{ width: "100%", display: "flex", justifyContent: "center" }}
          onClick={onClose}
        >
          Close
        </PrimaryBtn>
      </div>
    </Modal>
    {receiptUrl && (
      <Modal title="Your Submitted Receipt" onClose={() => setReceiptUrl(null)} width={760} topOffset={0}>
        <div style={{ textAlign: "center" }}>
          {tx.receiptPath?.toLowerCase().endsWith(".pdf") ? (
            <iframe title="Submitted payment receipt" src={receiptUrl} style={{ width: "100%", height: "70dvh", border: 0 }} />
          ) : (
            <img src={receiptUrl} alt="Your submitted payment receipt" style={{ display: "block", maxWidth: "100%", maxHeight: "72dvh", margin: "0 auto", objectFit: "contain", borderRadius: 8 }} />
          )}
          <a href={receiptUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 12, color: "#191BA9", fontSize: 12, fontWeight: 700 }}>
            <ExternalLink size={13} aria-hidden="true" /> Open in new tab
          </a>
        </div>
      </Modal>
    )}
    </>
  )
}
