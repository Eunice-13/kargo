import { useState } from "react"
import { CheckCircle2 } from "lucide-react"
import { CREAM } from "@/constants/theme"
import Modal from "./Modal"
import PrimaryBtn from "./PrimaryBtn"
import SecondaryBtn from "./SecondaryBtn"
import Avatar from "./Avatar"

export default function ContactSellerModal({
  seller,
  product,
  onClose,
}: {
  seller: string
  product: string
  onClose: () => void
}) {
  const [msg, setMsg] = useState("")
  const [sent, setSent] = useState(false)
  return (
    <Modal title="Contact Seller" onClose={onClose} width={440}>
      {sent ? (
        <div className="fi text-center py-6">
          <div style={{ color: "#0B7A59", marginBottom: 8, display: "flex", justifyContent: "center" }}>
            <CheckCircle2 size={36} aria-hidden="true" />
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#065F46" }}>
            Message Sent!
          </div>
          <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 4 }}>
            {seller} will reply within 24 hours.
          </div>
          <div style={{ marginTop: 16 }}>
            <PrimaryBtn onClick={onClose}>Done</PrimaryBtn>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div
            style={{
              background: CREAM,
              borderRadius: 8,
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Avatar name={seller} size={36} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>
                {seller}
              </div>
              <div style={{ fontSize: 11, color: "#9CA3AF" }}>
                Re: {product}
              </div>
            </div>
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
              Message
            </label>
            <textarea
              rows={5}
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              placeholder={`Hi ${seller.split(" ")[0]}, I have a question about my order…`}
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
                boxSizing: "border-box",
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
              disabled={!msg.trim()}
              onClick={() => setSent(true)}
            >
              Send Message
            </PrimaryBtn>
          </div>
        </div>
      )}
    </Modal>
  )
}
