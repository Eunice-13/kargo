import { PrimaryBtn, SecondaryBtn } from "@/components/shared"

type SecuritySectionProps = {
  twoFAEnabled: boolean
  setTwoFAEnabled: (v: boolean) => void
  setShow2FA: (v: boolean) => void
  setTfaStep: (v: "phone" | "code") => void
}

export default function SecuritySection({
  twoFAEnabled,
  setTwoFAEnabled,
  setShow2FA,
  setTfaStep,
}: SecuritySectionProps) {
  return (
    <div className="pr">
      <h3
        style={{
          fontFamily: "'Plus Jakarta Sans',sans-serif",
          fontSize: 16,
          fontWeight: 700,
          color: "#111827",
          marginBottom: 20,
        }}
      >
        Security
      </h3>
      <div className="space-y-5">
        {[
          ["Current Password", "••••••••"],
          ["New Password", ""],
        ].map(([label, val]) => (
          <div key={label}>
            <label
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#374151",
                display: "block",
                marginBottom: 4,
              }}
            >
              {label}
            </label>
            <input
              type="password"
              defaultValue={val}
              style={{
                width: "100%",
                maxWidth: 360,
                fontSize: 13,
                border: "1px solid #E5E7EB",
                borderRadius: 7,
                padding: "8px 12px",
                outline: "none",
                color: "#374151",
              }}
              className="placeholder:text-gray-400"
            />
          </div>
        ))}
        <PrimaryBtn>Update Password</PrimaryBtn>
        <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: 20 }}>
          <div className="flex items-center justify-between mb-2">
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "#111827",
              }}
            >
              Two-Factor Authentication
            </div>
            {twoFAEnabled ? (
              <span
                style={{
                  background: "#D4F5EA",
                  color: "#0B7A59",
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "3px 10px",
                  borderRadius: 999,
                }}
              >
                Enabled
              </span>
            ) : (
              <span
                style={{
                  background: "#F3F4F6",
                  color: "#9CA3AF",
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "3px 10px",
                  borderRadius: 999,
                }}
              >
                Not enabled
              </span>
            )}
          </div>
          <div
            style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 12 }}
          >
            {twoFAEnabled
              ? "Your account is protected with 2FA via SMS."
              : "Add an extra layer of security with SMS verification."}
          </div>
          {twoFAEnabled ? (
            <SecondaryBtn onClick={() => setTwoFAEnabled(false)}>
              Disable 2FA
            </SecondaryBtn>
          ) : (
            <PrimaryBtn
              onClick={() => {
                setShow2FA(true)
                setTfaStep("phone")
              }}
            >
              Enable 2FA
            </PrimaryBtn>
          )}
        </div>
      </div>
    </div>
  )
}
