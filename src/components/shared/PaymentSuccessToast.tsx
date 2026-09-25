import { CheckCircle2, X } from "lucide-react"

export default function PaymentSuccessToast({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fi"
      style={{
        position: "fixed",
        top: 72,
        right: 18,
        zIndex: 1200,
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        width: "min(390px, calc(100vw - 36px))",
        padding: "13px 14px",
        borderRadius: 10,
        border: "1px solid #A7F3D0",
        background: "#ECFDF5",
        boxShadow: "0 12px 30px rgba(6, 95, 70, 0.18)",
        color: "#065F46",
      }}
    >
      <CheckCircle2 size={20} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Payment proof submitted</div>
        <div style={{ fontSize: 12, marginTop: 2, lineHeight: 1.4 }}>
          Your submission was saved and is ready for the seller to review. You can view it in Payment History.
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss payment confirmation"
        style={{ border: 0, background: "transparent", color: "#047857", cursor: "pointer", padding: 0 }}
      >
        <X size={17} aria-hidden="true" />
      </button>
    </div>
  )
}
