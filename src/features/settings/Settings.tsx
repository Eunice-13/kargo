import { useState, useEffect, useRef } from "react"
import { UserRound, Link2, Bell, CreditCard, Lock } from "lucide-react"
import type { SettingsSection, SharedState } from "@/types"
import { INDIGO } from "@/constants/theme"
import { Card } from "@/components/shared"

const SECTION_ICONS: Record<SettingsSection, typeof UserRound> = {
  Profile: UserRound,
  "Linked Accounts": Link2,
  Notifications: Bell,
  "Payment Methods": CreditCard,
  Security: Lock,
}
import SocialConnectModal from "./SocialConnectModal"
import ProfileSection from "./ProfileSection"
import LinkedAccountsSection from "./LinkedAccountsSection"
import NotificationsSection from "./NotificationsSection"
import PaymentMethodsSection from "./PaymentMethodsSection"
import SecuritySection from "./SecuritySection"
import AddPaymentMethodModal from "./AddPaymentMethodModal"
import VerifyPaymentMethodModal from "./VerifyPaymentMethodModal"
import RemovePaymentMethodModal from "./RemovePaymentMethodModal"
import TwoFAModal from "./TwoFAModal"
import type { PayMethod } from "./types"

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
          icon: icons[pmType] || "",
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
                {(() => {
                  const Icon = SECTION_ICONS[s]
                  return <Icon size={15} aria-hidden="true" />
                })()}
                {s}
              </button>
            ))}
          </Card>
        </div>
        <Card>
          {section === "Profile" && (
            <ProfileSection
              user={user}
              firstName={firstName}
              setFirstName={setFirstName}
              lastName={lastName}
              setLastName={setLastName}
              email={email}
              setEmail={setEmail}
              bio={bio}
              setBio={setBio}
              saved={saved}
              saveProfile={saveProfile}
            />
          )}
          {section === "Linked Accounts" && (
            <LinkedAccountsSection
              fbConn={fbConn}
              fbUser={fbUser}
              setFbConn={setFbConn}
              setFbUser={setFbUser}
              igConn={igConn}
              igUser={igUser}
              setIgConn={setIgConn}
              setIgUser={setIgUser}
              setSocialModal={setSocialModal}
              idState={idState}
              handleIdPick={handleIdPick}
              idFileRef={idFileRef}
            />
          )}
          {section === "Notifications" && (
            <NotificationsSection notifs={notifs} setNotifs={setNotifs} />
          )}
          {section === "Payment Methods" && (
            <PaymentMethodsSection
              payMethods={payMethods}
              setShowAddPM={setShowAddPM}
              setVerifyTarget={setVerifyTarget}
              setRemoveTarget={setRemoveTarget}
            />
          )}
          {section === "Security" && (
            <SecuritySection
              twoFAEnabled={twoFAEnabled}
              setTwoFAEnabled={setTwoFAEnabled}
              setShow2FA={setShow2FA}
              setTfaStep={setTfaStep}
            />
          )}
        </Card>
      </div>

      {/* Add Payment Method modal */}
      {showAddPM && (
        <AddPaymentMethodModal
          pmType={pmType}
          setPmType={setPmType}
          pmName={pmName}
          setPmName={setPmName}
          pmNum={pmNum}
          setPmNum={setPmNum}
          pmLoading={pmLoading}
          addPayMethod={addPayMethod}
          setShowAddPM={setShowAddPM}
        />
      )}

      {/* Verify modal */}
      {verifyTarget && (
        <VerifyPaymentMethodModal
          verifyTarget={verifyTarget}
          setVerifyTarget={setVerifyTarget}
          pmLoading={pmLoading}
          confirmVerify={confirmVerify}
        />
      )}

      {/* Remove confirmation */}
      {removeTarget && (
        <RemovePaymentMethodModal
          removeTarget={removeTarget}
          setRemoveTarget={setRemoveTarget}
          confirmRemove={confirmRemove}
        />
      )}

      {/* 2FA setup modal */}
      {show2FA && (
        <TwoFAModal
          setShow2FA={setShow2FA}
          tfaStep={tfaStep}
          setTfaStep={setTfaStep}
          tfaPhone={tfaPhone}
          setTfaPhone={setTfaPhone}
          tfaCode={tfaCode}
          setTfaCode={setTfaCode}
          tfaLoading={tfaLoading}
          submit2FA={submit2FA}
        />
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
