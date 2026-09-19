import { INDIGO, CREAM } from "@/constants/theme"
import { Modal, PrimaryBtn } from "@/components/shared"

export default function BIRInfoModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal
      title="What is the BIR Registration Seal Badge?"
      onClose={onClose}
      width={420}
    >
      <div className="space-y-4">
        <div style={{ textAlign: "center", padding: "8px 0" }}>
          <div
            style={{
              width: 120,
              height: 120,
              margin: "0 auto",
              border: "3px solid #111827",
              borderRadius: 8,
              padding: 8,
              display: "grid",
              gridTemplateColumns: "repeat(7,1fr)",
              gap: 2,
            }}
          >
            {Array.from({ length: 49 }).map((_, i) => (
              <div
                key={i}
                style={{
                  borderRadius: 1,
                  background: [
                    0, 1, 2, 5, 6, 7, 8, 14, 15, 21, 27, 28, 29, 33, 34, 35, 41,
                    42, 43, 44, 48,
                  ].includes(i)
                    ? "#111827"
                    : "transparent",
                }}
              />
            ))}
          </div>
          <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 8 }}>
            BIR Digital Seal (placeholder)
          </div>
        </div>
        <div
          style={{ background: CREAM, borderRadius: 8, padding: "12px 14px" }}
          className="space-y-3"
        >
          {[
            "It is a digital badge with a QR code.",
            "It proves your business is registered with the Bureau of Internal Revenue (BIR).",
            "Sellers with this badge have submitted their BIR Certificate for verification.",
            "Kargo verifies the document before awarding the badge — it is not self-declared.",
          ].map((text, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 10,
                fontSize: 13,
                color: "#374151",
                lineHeight: 1.5,
              }}
            >
              <span style={{ color: INDIGO, fontWeight: 700, flexShrink: 0 }}>
                ✓
              </span>
              {text}
            </div>
          ))}
        </div>
        <PrimaryBtn
          style={{ width: "100%", display: "flex", justifyContent: "center" }}
          onClick={onClose}
        >
          Got it
        </PrimaryBtn>
      </div>
    </Modal>
  )
}

