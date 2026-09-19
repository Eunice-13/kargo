import type React from "react"
import { Check, IdCard, Clock3, CheckCircle2 } from "lucide-react"
import { PaymentIcon, PrimaryBtn } from "@/components/shared"
import { CREAM, INDIGO } from "@/constants/theme"

type LinkedAccountsSectionProps = {
  fbConn: boolean
  fbUser: string
  setFbConn: (v: boolean) => void
  setFbUser: (v: string) => void
  igConn: boolean
  igUser: string
  setIgConn: (v: boolean) => void
  setIgUser: (v: string) => void
  setSocialModal: (p: "Facebook" | "Instagram" | null) => void
  idState: "none" | "uploading" | "submitted"
  handleIdPick: () => void
  idFileRef: React.RefObject<HTMLInputElement | null>
}

export default function LinkedAccountsSection({
  fbConn,
  fbUser,
  setFbConn,
  setFbUser,
  igConn,
  igUser,
  setIgConn,
  setIgUser,
  setSocialModal,
  idState,
  handleIdPick,
  idFileRef,
}: LinkedAccountsSectionProps) {
  return (
    <div className="pr">
      <h3
        style={{
          fontFamily: "'Plus Jakarta Sans',sans-serif",
          fontSize: 16,
          fontWeight: 700,
          color: "#111827",
          marginBottom: 4,
        }}
      >
        Linked Accounts
      </h3>
      <p style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 20 }}>
        Connect your social media accounts to discover batches and
        sellers.
      </p>
      <div className="space-y-3 mb-6">
        {[
          {
            name: "Facebook" as const,
            grad: "#1877F2",
            icon: (
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="white"
              >
                <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
              </svg>
            ),
            connected: fbConn,
            username: fbUser,
            disconnect: () => {
              setFbConn(false)
              setFbUser("")
            },
          },
          {
            name: "Instagram" as const,
            grad: "linear-gradient(135deg,#F58529,#DD2A7B,#8134AF)",
            icon: (
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
              >
                <rect
                  x="2"
                  y="2"
                  width="20"
                  height="20"
                  rx="5"
                  ry="5"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                />
                <circle
                  cx="12"
                  cy="12"
                  r="4"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                />
                <circle cx="17.5" cy="6.5" r="1" fill="white" />
              </svg>
            ),
            connected: igConn,
            username: igUser,
            disconnect: () => {
              setIgConn(false)
              setIgUser("")
            },
          },
        ].map((m) => (
          <div
            key={m.name}
            style={{
              border: "1px solid #E5E7EB",
              borderRadius: 10,
              padding: 16,
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: m.grad,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <PaymentIcon method={m.name} size={18} />
            </div>
            <div className="flex-1">
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#111827",
                }}
              >
                {m.name}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: m.connected ? "#065F46" : "#9CA3AF",
                  fontWeight: m.connected ? 500 : 400,
                }}
              >
                {m.connected ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <Check size={12} aria-hidden="true" /> Connected as {m.username}
                  </span>
                ) : (
                  "Not connected"
                )}
              </div>
            </div>
            {m.connected ? (
              <button
                onClick={m.disconnect}
                style={{
                  background: "#FEE2E2",
                  color: "#991B1B",
                  border: "none",
                  borderRadius: 7,
                  padding: "7px 14px",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Disconnect
              </button>
            ) : (
              <PrimaryBtn
                size="sm"
                onClick={() => setSocialModal(m.name)}
              >
                Connect
              </PrimaryBtn>
            )}
          </div>
        ))}
      </div>
      <div
        style={{
          border: "1px solid #E5E7EB",
          borderRadius: 10,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            background: CREAM,
            padding: "12px 16px",
            borderBottom: "1px solid #E5E7EB",
          }}
        >
          <div
            style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}
          >
            Government ID Verification
          </div>
          <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>
            Required to become a verified seller. Accepted: PhilSys,
            Driver's License, Passport, SSS, UMID.
          </div>
        </div>
        <div className="p-4">
          <input
            ref={idFileRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              if (e.target.files?.[0]) handleIdPick()
            }}
          />
          {idState === "none" && (
            <div
              onClick={() => idFileRef.current?.click()}
              role="button"
              tabIndex={0}
              aria-label="Upload Government ID"
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  idFileRef.current?.click()
                }
              }}
              style={{
                border: "2px dashed #D1D5DB",
                borderRadius: 8,
                padding: 28,
                textAlign: "center",
                cursor: "pointer",
                background: CREAM,
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLElement).style.borderColor =
                  INDIGO
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLElement).style.borderColor =
                  "#D1D5DB"
              }}
            >
              <div style={{ color: "#9CA3AF", marginBottom: 8, display: "flex", justifyContent: "center" }}><IdCard size={32} aria-hidden="true" /></div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#374151",
                }}
              >
                Upload Government ID
              </div>
              <div
                style={{ fontSize: 12, color: "#9CA3AF", marginTop: 4 }}
              >
                Click to browse or drag & drop
              </div>
              <div style={{ marginTop: 12 }}>
                <PrimaryBtn size="sm">Choose File</PrimaryBtn>
              </div>
            </div>
          )}
          {idState === "uploading" && (
            <div
              className="fi"
              style={{
                background: "#EEF0FF",
                borderRadius: 8,
                padding: 24,
                textAlign: "center",
              }}
            >
              <div style={{ color: INDIGO, marginBottom: 8, display: "flex", justifyContent: "center" }}><Clock3 size={28} aria-hidden="true" /></div>
              <div
                style={{ fontSize: 13, fontWeight: 600, color: INDIGO }}
                className="lsh"
              >
                Uploading ID…
              </div>
            </div>
          )}
          {idState === "submitted" && (
            <div
              className="fi"
              style={{
                background: "#D4F5EA",
                borderRadius: 8,
                padding: 16,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <CheckCircle2 size={24} aria-hidden="true" style={{ color: "#0B7A59", flexShrink: 0 }} />
              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#065F46",
                  }}
                >
                  Submitted — Pending Review
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "#6B7280",
                    marginTop: 2,
                  }}
                >
                  Usually verified within 24–48 hours.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
