import { useState } from "react"
import { MailCheck } from "lucide-react"
import type { BatchType } from "@/types"
import { Modal, PrimaryBtn, SecondaryBtn } from "@/components/shared"

export default function BuyerRequestFormModal({
  batches,
  onClose,
}: {
  batches: BatchType[]
  onClose: () => void
}) {
  const [batch, setBatch] = useState(batches[0]?.title || "")
  const [product, setProduct] = useState("")
  const [qty, setQty] = useState("1")
  const [message, setMessage] = useState("")
  const [sent, setSent] = useState(false)

  if (sent)
    return (
      <Modal title="Request Sent" onClose={onClose} width={400}>
        <div className="space-y-4 text-center" style={{ padding: "12px 0" }}>
          <div style={{ color: "#0B7A59", display: "flex", justifyContent: "center" }}><MailCheck size={48} aria-hidden="true" /></div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "#111827",
              fontFamily: "'Plus Jakarta Sans',sans-serif",
            }}
          >
            Request Sent!
          </div>
          <div style={{ fontSize: 13, color: "#6B7280" }}>
            The seller will review your request and reply in-app or via
            Messenger.
          </div>
          <PrimaryBtn
            onClick={onClose}
            style={{
              display: "flex",
              margin: "0 auto",
              justifyContent: "center",
            }}
          >
            Done
          </PrimaryBtn>
        </div>
      </Modal>
    )

  return (
    <Modal title="Request an Item" onClose={onClose} width={440}>
      <div className="space-y-4">
        <div>
          <label
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#374151",
              display: "block",
              marginBottom: 5,
            }}
          >
            Batch
          </label>
          <select
            value={batch}
            onChange={(e) => setBatch(e.target.value)}
            style={{
              width: "100%",
              fontSize: 13,
              border: "1px solid #E5E7EB",
              borderRadius: 7,
              padding: "9px 12px",
              outline: "none",
              color: "#374151",
              background: "#fff",
            }}
          >
            {batches.map((b) => (
              <option key={b.id} value={b.title}>
                {b.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#374151",
              display: "block",
              marginBottom: 5,
            }}
          >
            Item / Product Name
          </label>
          <input
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            placeholder="e.g. Hada Labo Premium Lotion 170ml"
            style={{
              width: "100%",
              fontSize: 13,
              border: "1px solid #E5E7EB",
              borderRadius: 7,
              padding: "9px 12px",
              outline: "none",
              color: "#374151",
              fontFamily: "inherit",
              boxSizing: "border-box" as const,
            }}
            className="placeholder:text-gray-400"
          />
        </div>
        <div>
          <label
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#374151",
              display: "block",
              marginBottom: 5,
            }}
          >
            Quantity
          </label>
          <input
            type="number"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            min="1"
            max="10"
            style={{
              width: 100,
              fontSize: 13,
              border: "1px solid #E5E7EB",
              borderRadius: 7,
              padding: "9px 12px",
              outline: "none",
              color: "#374151",
              fontFamily: "inherit",
            }}
          />
        </div>
        <div>
          <label
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#374151",
              display: "block",
              marginBottom: 5,
            }}
          >
            Message to Seller
          </label>
          <textarea
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Any special notes, size, variant preferences…"
            style={{
              width: "100%",
              fontSize: 13,
              border: "1px solid #E5E7EB",
              borderRadius: 7,
              padding: "9px 12px",
              outline: "none",
              resize: "none",
              color: "#374151",
              fontFamily: "inherit",
              boxSizing: "border-box" as const,
            }}
            className="placeholder:text-gray-400"
          />
        </div>
        <div className="flex gap-3">
          <SecondaryBtn
            style={{ flex: 1, display: "flex", justifyContent: "center" }}
            onClick={onClose}
          >
            Cancel
          </SecondaryBtn>
          <PrimaryBtn
            style={{ flex: 1, display: "flex", justifyContent: "center" }}
            onClick={() => {
              if (product.trim()) setSent(true)
            }}
            disabled={!product.trim()}
          >
            Send Request
          </PrimaryBtn>
        </div>
      </div>
    </Modal>
  )
}

