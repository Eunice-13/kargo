import { ArrowLeft } from "lucide-react"
import { Modal, PrimaryBtn, SecondaryBtn } from "@/components/shared"
import { CYAN_L, SKY } from "@/constants/theme"

type TwoFAModalProps = {
  setShow2FA: (v: boolean) => void
  tfaStep: "phone" | "code"
  setTfaStep: (v: "phone" | "code") => void
  tfaPhone: string
  setTfaPhone: (v: string) => void
  tfaCode: string
  setTfaCode: (v: string) => void
  tfaLoading: boolean
  submit2FA: () => void
}

export default function TwoFAModal({
  setShow2FA,
  tfaStep,
  setTfaStep,
  tfaPhone,
  setTfaPhone,
  tfaCode,
  setTfaCode,
  tfaLoading,
  submit2FA,
}: TwoFAModalProps) {
  return (
    <Modal
      title="Enable Two-Factor Authentication"
      onClose={() => {
        setShow2FA(false)
        setTfaStep("phone")
      }}
      width={420}
    >
      <div className="space-y-4">
        {tfaStep === "phone" ? (
          <>
            <div style={{ fontSize: 12, color: "#6B7280" }}>
              Enter your mobile number to receive a verification code.
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
                Mobile Number
              </label>
              <input
                value={tfaPhone}
                onChange={(e) => setTfaPhone(e.target.value)}
                placeholder="+63 9XX XXX XXXX"
                style={{
                  width: "100%",
                  fontSize: 13,
                  border: "1px solid #E5E7EB",
                  borderRadius: 7,
                  padding: "9px 12px",
                  outline: "none",
                  color: "#374151",
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                }}
                className="placeholder:text-gray-400"
              />
            </div>
            <div className="flex gap-3 pt-1">
              <SecondaryBtn
                style={{
                  flex: 1,
                  display: "flex",
                  justifyContent: "center",
                }}
                onClick={() => setShow2FA(false)}
              >
                Cancel
              </SecondaryBtn>
              <PrimaryBtn
                style={{
                  flex: 1,
                  display: "flex",
                  justifyContent: "center",
                }}
                onClick={submit2FA}
                loading={tfaLoading}
                disabled={!tfaPhone.trim()}
              >
                Send Code
              </PrimaryBtn>
            </div>
          </>
        ) : (
          <>
            <div
              style={{
                background: CYAN_L,
                border: `1px solid ${SKY}`,
                borderRadius: 8,
                padding: "10px 14px",
                fontSize: 12,
                color: "#0369A1",
              }}
            >
              A 6-digit code was sent to {tfaPhone}. For this demo, enter
              any 6 digits.
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
                Verification Code
              </label>
              <input
                value={tfaCode}
                onChange={(e) =>
                  setTfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="123456"
                maxLength={6}
                style={{
                  width: "100%",
                  fontSize: 20,
                  letterSpacing: 8,
                  textAlign: "center",
                  border: "1px solid #E5E7EB",
                  borderRadius: 7,
                  padding: "12px",
                  outline: "none",
                  color: "#111827",
                  fontFamily: "monospace",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div className="flex gap-3 pt-1">
              <SecondaryBtn
                style={{
                  flex: 1,
                  display: "flex",
                  justifyContent: "center",
                }}
                onClick={() => setTfaStep("phone")}
              >
                <ArrowLeft size={14} aria-hidden="true" style={{ marginRight: 4 }} /> Back
              </SecondaryBtn>
              <PrimaryBtn
                style={{
                  flex: 1,
                  display: "flex",
                  justifyContent: "center",
                }}
                onClick={submit2FA}
                loading={tfaLoading}
                disabled={tfaCode.length < 6}
              >
                Verify & Enable
              </PrimaryBtn>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
