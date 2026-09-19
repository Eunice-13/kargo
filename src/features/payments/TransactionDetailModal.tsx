import { ClipboardList } from "lucide-react"
import type { PayHistRow } from "@/types"
import { Modal, PrimaryBtn, StatusBadge } from "@/components/shared"

export default function TransactionDetailModal({
  tx,
  onClose,
}: {
  tx: PayHistRow
  onClose: () => void
}) {
  return (
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
  )
}
