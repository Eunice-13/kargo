import { Check } from "lucide-react"
import { CREAM, INDIGO } from "@/constants/theme"
import Modal from "./Modal"
import PrimaryBtn from "./PrimaryBtn"

export default function BIRInfoModal({ onClose, status = "Verified" }: { onClose: () => void; status?: "Verified" | "Checking" }) {
  return (
    <Modal title="BIR Registration Seal Badge" onClose={onClose} width={500}>
      <div className="space-y-4">
        <div style={{ display: "flex", justifyContent: "center" }}>
          <span style={{ borderRadius: 999, padding: "5px 10px", background: status === "Verified" ? "#D4F5EA" : "#FEF3C7", color: status === "Verified" ? "#065F46" : "#92400E", fontSize: 11, fontWeight: 800 }}>
            Current status: {status}
          </span>
        </div>
        <figure style={{ margin: 0 }}>
          <img
            src="/bir-seal-placeholder.svg"
            alt="Sample BIR Registration Seal Badge placeholder; not an official verified badge"
            style={{ width: "100%", maxHeight: 260, objectFit: "contain", borderRadius: 10, border: "1px solid #E5E7EB", background: "#fff" }}
          />
          <figcaption style={{ fontSize: 11, color: "#9CA3AF", marginTop: 7, textAlign: "center" }}>
            Development placeholder — a real verified badge image is not yet available.
          </figcaption>
        </figure>
        <div style={{ background: CREAM, borderRadius: 8, padding: "12px 14px" }} className="space-y-3">
          {[
            "The badge is a reference that the seller submitted BIR registration information.",
            "KARGO checks the submitted badge and its QR destination before showing verified seller access.",
            "This sample image is illustrative and must not be treated as an official BIR document.",
          ].map((text) => (
            <div key={text} style={{ display: "flex", gap: 10, fontSize: 13, color: "#374151", lineHeight: 1.5 }}>
              <Check size={16} color={INDIGO} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
              <span>{text}</span>
            </div>
          ))}
        </div>
        <PrimaryBtn style={{ width: "100%", display: "flex", justifyContent: "center" }} onClick={onClose}>Got it</PrimaryBtn>
      </div>
    </Modal>
  )
}
