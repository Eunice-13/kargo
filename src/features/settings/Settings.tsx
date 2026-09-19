import { useState, useEffect, useRef } from "react"
import { Check, Lock, Plus } from "lucide-react"
import type { SettingsSection, SharedState } from "@/types"
import { INDIGO, CREAM, CYAN_L, SKY, GREEN } from "@/constants/theme"
import { Modal, Card, PrimaryBtn, SecondaryBtn, Avatar, PaymentIcon, Toggle } from "@/components/shared"
import SocialConnectModal from "./SocialConnectModal"

export const NOTIF_DEFAULTS = [
  {
    label: "Payment deadline reminders",
    sub: "Get notified 24h and 6h before payment is due",
    key: "payments",
  },
  {
    label: "Claim status updates",
    sub: "When your claim is reserved, cancelled, or expires",
    key: "claims",
  },
  {
    label: "New batches from followed sellers",
    sub: "First to know when a seller posts a new batch",
    key: "newBatches",
  },
  {
    label: "Waitlist position updates",
    sub: "When you move up the waitlist",
    key: "waitlist",
  },
  {
    label: "Delivery tracking",
    sub: "Shipping and delivery status changes",
    key: "delivery",
  },
  {
    label: "Seller messages",
    sub: "Direct messages from sellers about your orders",
    key: "messages",
  },
]

export default function Settings({ user, setUser, role }: SharedState) {
  const [section, setSection] = useState<SettingsSection>("Profile")
  const [fbConn, setFbConn] = useState(false)
  const [fbUser, setFbUser] = useState("")
  const [igConn, setIgConn] = useState(false)
  const [igUser, setIgUser] = useState("")
  const [socialModal, setSocialModal] =
    useState<"Facebook" | "Instagram" | null>(null)
  const [idState, setIdState] = useState<"none" | "uploading" | "submitted">(
    "none",
  )
  const idFileRef = useRef<HTMLInputElement>(null)
  const [notifs, setNotifs] = useState<Record<string, boolean>>({
    payments: true,
    claims: true,
    newBatches: false,
    waitlist: true,
    delivery: true,
    messages: true,
  })
  const [firstName, setFirstName] = useState(user.name.split(" ")[0] || "")
  const [lastName, setLastName] = useState(
    user.name.split(" ").slice(1).join(" ") || "",
  )
  const [email, setEmail] = useState(user.email || "")
  const [bio, setBio] = useState(user.bio || "")
  const [saved, setSaved] = useState(false)
  const sections: SettingsSection[] =
    role === "Seller"
      ? [
          "Profile",
          "Linked Accounts",
          "Notifications",
          "Payment Methods",
          "Security",
        ]
      : ["Profile", "Notifications", "Security"]
  useEffect(() => {
    if (!sections.includes(section)) setSection("Profile")
  }, [role])

  // Payment methods state
  type PayMethod = {
    id: number
    name: string
    detail: string
    icon: string
    verified: boolean
  }
  const [payMethods, setPayMethods] = useState<PayMethod[]>([
    {
      id: 1,
      name: "GCash",
      detail: "09XX-XXX-8821",
      icon: "",
      verified: true,
    },
    {
      id: 2,
      name: "Maya",
      detail: "09XX-XXX-5543",
      icon: "",
      verified: true,
    },
    {
      id: 3,
      name: "BDO Bank Transfer",
      detail: "Account •••• 4421",
      icon: "",
      verified: false,
    },
  ])
  const [showAddPM, setShowAddPM] = useState(false)
  const [verifyTarget, setVerifyTarget] = useState<PayMethod | null>(null)
  const [removeTarget, setRemoveTarget] = useState<PayMethod | null>(null)
  const [pmType, setPmType] = useState("GCash")
  const [pmName, setPmName] = useState("")
  const [pmNum, setPmNum] = useState("")
  const [pmLoading, setPmLoading] = useState(false)

  // 2FA state
  const [twoFAEnabled, setTwoFAEnabled] = useState(false)
  const [show2FA, setShow2FA] = useState(false)
  const [tfaStep, setTfaStep] = useState<"phone" | "code">("phone")
  const [tfaPhone, setTfaPhone] = useState("")
  const [tfaCode, setTfaCode] = useState("")
  const [tfaLoading, setTfaLoading] = useState(false)

  const saveProfile = () => {
    const newName = [firstName, lastName].filter(Boolean).join(" ") || user.name
    setUser((u) => ({ ...u, name: newName, email, bio }))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleIdPick = () => {
    setIdState("uploading")
    setTimeout(() => setIdState("submitted"), 1500)
  }

  const addPayMethod = () => {
    if (!pmName.trim() || !pmNum.trim()) return
    setPmLoading(true)
    setTimeout(() => {
      const icons: Record<string, string> = {
        GCash: "",
        Maya: "",
        "Bank Transfer": "",
        "Cash on Meetup": "",
      }
      setPayMethods((prev) => [
        ...prev,
        {
          id: Date.now(),
          name: pmType,
          detail: pmNum.trim(),
          icon: icons[pmType] || "💳",
          verified: false,
        },
      ])
      setPmName("")
      setPmNum("")
      setPmLoading(false)
      setShowAddPM(false)
    }, 800)
  }

  const confirmVerify = () => {
    if (!verifyTarget) return
    setPmLoading(true)
    setTimeout(() => {
      setPayMethods((p) =>
        p.map((m) => (m.id === verifyTarget.id ? { ...m, verified: true } : m)),
      )
      setPmLoading(false)
      setVerifyTarget(null)
    }, 900)
  }

  const confirmRemove = () => {
    if (!removeTarget) return
    setPayMethods((p) => p.filter((m) => m.id !== removeTarget.id))
    setRemoveTarget(null)
  }

  const submit2FA = () => {
    if (tfaStep === "phone") {
      setTfaLoading(true)
      setTimeout(() => {
        setTfaLoading(false)
        setTfaStep("code")
      }, 800)
    } else {
      setTfaLoading(true)
      setTimeout(() => {
        setTfaLoading(false)
        setTwoFAEnabled(true)
        setShow2FA(false)
        setTfaStep("phone")
        setTfaPhone("")
        setTfaCode("")
      }, 800)
    }
  }

  return (
    <div className="p-6">
      <div className="grid gap-6" style={{ gridTemplateColumns: "220px 1fr" }}>
        <div>
          <Card className="!p-2">
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "#9CA3AF",
                padding: "6px 10px",
                letterSpacing: 1,
              }}
            >
              ACCOUNT
            </div>
            {sections.map((s) => (
              <button
                key={s}
                onClick={() => setSection(s)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: section === s ? 600 : 400,
                  color: section === s ? INDIGO : "#374151",
                  background: section === s ? "#EEF0FF" : "transparent",
                  border: "none",
                  cursor: "pointer",
                  gap: 8,
                  transition: "all 0.15s",
                }}
              >
                <span style={{ fontSize: 15 }}>
                  {s === "Profile"
                    ? "👤"
                    : s === "Linked Accounts"
                      ? "🔗"
                      : s === "Notifications"
                        ? "🔔"
                        : s === "Payment Methods"
                          ? "💳"
                          : "Lock"}
                </span>
                {s}
              </button>
            ))}
          </Card>
        </div>
        <Card>
          {section === "Profile" && (
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
                Profile
              </h3>
              <div className="flex items-center gap-5 mb-6">
                <Avatar name={user.name || "User"} size={64} />
                <div>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: "#111827",
                      fontFamily: "'Plus Jakarta Sans',sans-serif",
                    }}
                  >
                    {user.name || "—"}
                  </div>
                  <div style={{ fontSize: 13, color: "#9CA3AF" }}>
                    {user.email || "—"} · Member since{" "}
                    {new Date().toLocaleDateString("en-PH", {
                      month: "long",
                      year: "numeric",
                    })}
                  </div>
                  <SecondaryBtn style={{ marginTop: 8 }}>
                    Change Photo
                  </SecondaryBtn>
                </div>
              </div>
              <div
                className="grid gap-4"
                style={{ gridTemplateColumns: "1fr 1fr" }}
              >
                {[
                  ["First Name", firstName, setFirstName],
                  ["Last Name", lastName, setLastName],
                ].map(([label, val, set]) => (
                  <div key={label as string}>
                    <label
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#374151",
                        display: "block",
                        marginBottom: 4,
                      }}
                    >
                      {label as string}
                    </label>
                    <input
                      value={val as string}
                      onChange={(e) =>
                        (set as (v: string) => void)(e.target.value)
                      }
                      style={{
                        width: "100%",
                        fontSize: 13,
                        border: "1px solid #E5E7EB",
                        borderRadius: 7,
                        padding: "8px 12px",
                        outline: "none",
                        color: "#374151",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                ))}
                <div className="col-span-2">
                  <label
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#374151",
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    Email
                  </label>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{
                      width: "100%",
                      fontSize: 13,
                      border: "1px solid #E5E7EB",
                      borderRadius: 7,
                      padding: "8px 12px",
                      outline: "none",
                      color: "#374151",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div className="col-span-2">
                  <label
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#374151",
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    Bio
                  </label>
                  <textarea
                    rows={2}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell sellers a bit about yourself…"
                    style={{
                      width: "100%",
                      fontSize: 13,
                      border: "1px solid #E5E7EB",
                      borderRadius: 7,
                      padding: "8px 12px",
                      outline: "none",
                      resize: "none",
                      color: "#374151",
                      fontFamily: "inherit",
                      boxSizing: "border-box",
                    }}
                    className="placeholder:text-gray-400"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 mt-5">
                {saved && (
                  <span
                    className="fi"
                    style={{ fontSize: 12, color: GREEN, fontWeight: 600 }}
                  >
                    ✓ Changes saved!
                  </span>
                )}
                <PrimaryBtn onClick={saveProfile}>Save Changes</PrimaryBtn>
              </div>
            </div>
          )}
          {section === "Linked Accounts" && (
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
                        {m.connected
                          ? `✓ Connected as ${m.username}`
                          : "Not connected"}
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
                      <div style={{ fontSize: 32, marginBottom: 8 }}>🪪</div>
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
                      <div style={{ fontSize: 28, marginBottom: 8 }}>⏳</div>
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
                      <span style={{ fontSize: 24 }}>✅</span>
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
          )}
          {section === "Notifications" && (
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
                Notification Preferences
              </h3>
              {NOTIF_DEFAULTS.map((n) => (
                <div
                  key={n.key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 0",
                    borderBottom: "1px solid #F3F4F6",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#111827",
                      }}
                    >
                      {n.label}
                    </div>
                    <div
                      style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}
                    >
                      {n.sub}
                    </div>
                  </div>
                  <Toggle
                    on={notifs[n.key]}
                    onChange={(v) => setNotifs((p) => ({ ...p, [n.key]: v }))}
                  />
                </div>
              ))}
            </div>
          )}
          {section === "Payment Methods" && (
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
          )}
          {section === "Security" && (
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
          )}
        </Card>
      </div>

      {/* Add Payment Method modal */}
      {showAddPM && (
        <Modal
          title="Add Payment Method"
          onClose={() => setShowAddPM(false)}
          width={420}
        >
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
                Method Type
              </label>
              <select
                value={pmType}
                onChange={(e) => setPmType(e.target.value)}
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
                {["GCash", "Maya", "Bank Transfer", "Cash on Meetup"].map(
                  (t) => (
                    <option key={t}>{t}</option>
                  ),
                )}
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
                Account Name
              </label>
              <input
                value={pmName}
                onChange={(e) => setPmName(e.target.value)}
                placeholder="Full name on account"
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
                {pmType === "Bank Transfer"
                  ? "Account Number"
                  : "Mobile Number"}
              </label>
              <input
                value={pmNum}
                onChange={(e) => setPmNum(e.target.value)}
                placeholder={
                  pmType === "Bank Transfer"
                    ? "e.g. 1234-5678-9012"
                    : "e.g. 09XX-XXX-XXXX"
                }
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
                style={{ flex: 1, display: "flex", justifyContent: "center" }}
                onClick={() => setShowAddPM(false)}
              >
                Cancel
              </SecondaryBtn>
              <PrimaryBtn
                style={{ flex: 1, display: "flex", justifyContent: "center" }}
                onClick={addPayMethod}
                loading={pmLoading}
                disabled={!pmName.trim() || !pmNum.trim()}
              >
                Add Method
              </PrimaryBtn>
            </div>
          </div>
        </Modal>
      )}

      {/* Verify modal */}
      {verifyTarget && (
        <Modal
          title="Verify Payment Method"
          onClose={() => setVerifyTarget(null)}
          width={400}
        >
          <div className="space-y-4">
            <div
              style={{
                background: CREAM,
                borderRadius: 8,
                padding: "12px 16px",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span style={{ fontSize: 24 }}><PaymentIcon method={verifyTarget.name} size={24} /></span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {verifyTarget.name}
                </div>
                <div style={{ fontSize: 12, color: "#9CA3AF" }}>
                  {verifyTarget.detail}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.6 }}>
              Kargo will send a small verification amount (₱1) to confirm
              ownership. Check your account to confirm you received it.
            </div>
            <div className="flex gap-3">
              <SecondaryBtn
                style={{ flex: 1, display: "flex", justifyContent: "center" }}
                onClick={() => setVerifyTarget(null)}
              >
                Cancel
              </SecondaryBtn>
              <PrimaryBtn
                style={{ flex: 1, display: "flex", justifyContent: "center" }}
                onClick={confirmVerify}
                loading={pmLoading}
              >
                Confirm Ownership
              </PrimaryBtn>
            </div>
          </div>
        </Modal>
      )}

      {/* Remove confirmation */}
      {removeTarget && (
        <Modal
          title="Remove Payment Method"
          onClose={() => setRemoveTarget(null)}
          width={400}
        >
          <div className="space-y-4">
            <div style={{ fontSize: 13, color: "#374151" }}>
              Are you sure you want to remove{" "}
              <strong>
                {removeTarget.name} ({removeTarget.detail})
              </strong>
              ? This cannot be undone.
            </div>
            <div className="flex gap-3">
              <SecondaryBtn
                style={{ flex: 1, display: "flex", justifyContent: "center" }}
                onClick={() => setRemoveTarget(null)}
              >
                Cancel
              </SecondaryBtn>
              <button
                onClick={confirmRemove}
                style={{
                  flex: 1,
                  background: "#EF4444",
                  color: "#fff",
                  border: "none",
                  borderRadius: 7,
                  padding: "8px 0",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "'Plus Jakarta Sans',sans-serif",
                }}
              >
                Remove
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* 2FA setup modal */}
      {show2FA && (
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
                    ← Back
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
      )}

      {socialModal && (
        <SocialConnectModal
          platform={socialModal}
          onConnect={(u) => {
            if (socialModal === "Facebook") {
              setFbConn(true)
              setFbUser(u)
            } else {
              setIgConn(true)
              setIgUser(u)
            }
          }}
          onClose={() => setSocialModal(null)}
        />
      )}
    </div>
  )
}
