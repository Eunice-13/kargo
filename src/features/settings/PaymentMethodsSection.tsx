import { PaymentIcon, PrimaryBtn } from "@/components/shared"
import type { PayMethod } from "./types"

type PaymentMethodsSectionProps = {
  payMethods: PayMethod[]
  setShowAddPM: (v: boolean) => void
  setVerifyTarget: (m: PayMethod | null) => void
  setRemoveTarget: (m: PayMethod | null) => void
}

export default function PaymentMethodsSection({
  payMethods,
  setShowAddPM,
  setVerifyTarget,
  setRemoveTarget,
}: PaymentMethodsSectionProps) {
  return (
    <div className="pr">
      <div className="flex items-center justify-between mb-5">
        <h3
          style={{
            fontFamily: "'Plus Jakarta Sans',sans-serif",
            fontSize: 16,
            fontWeight: 700,
            color: "#111827",
          }}
        >
          Payment Methods
        </h3>
        <PrimaryBtn
          size="sm"
          onClick={() => setShowAddPM(true)}
          style={{ display: "flex", alignItems: "center", gap: 5 }}
        >
          + Add Method
        </PrimaryBtn>
      </div>
      <div className="space-y-3">
        {payMethods.map((m) => (
          <div
            key={m.id}
            style={{
              border: "1px solid #E5E7EB",
              borderRadius: 9,
              padding: 14,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span style={{ fontSize: 24 }}><PaymentIcon method={m.name} size={24} /></span>
            <div className="flex-1">
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#111827",
                }}
              >
                {m.name}
              </div>
              <div style={{ fontSize: 12, color: "#9CA3AF" }}>
                {m.detail}
              </div>
            </div>
            {m.verified ? (
              <span
                style={{
                  background: "#D4F5EA",
                  color: "#0B7A59",
                  fontSize: 10,
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: 999,
                }}
              >
                Verified
              </span>
            ) : (
              <PrimaryBtn size="sm" onClick={() => setVerifyTarget(m)}>
                Verify
              </PrimaryBtn>
            )}
            <button
              onClick={() => setRemoveTarget(m)}
              style={{
                color: "#EF4444",
                background: "none",
                border: "none",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Remove
            </button>
          </div>
        ))}
        {payMethods.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "24px 0",
              color: "#9CA3AF",
              fontSize: 13,
            }}
          >
            No payment methods added yet.
          </div>
        )}
      </div>
    </div>
  )
}
