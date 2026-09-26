import { useState } from "react"
import { Check, Eye, EyeOff } from "lucide-react"
import { PrimaryBtn, SH } from "@/components/shared"
import { GREEN } from "@/constants/theme"

export default function SecuritySection() {
  const [curPw, setCurPw] = useState("")
  const [newPw, setNewPw] = useState("")
  const [pwError, setPwError] = useState("")
  const [pwSaved, setPwSaved] = useState(false)
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({})

  const updatePassword = () => {
    if (!curPw || !newPw) {
      setPwError("Enter your current and new password.")
      return
    }
    if (newPw.length < 8) {
      setPwError("New password must be at least 8 characters.")
      return
    }
    setPwError("")
    setCurPw("")
    setNewPw("")
    setPwSaved(true)
    setTimeout(() => setPwSaved(false), 2400)
  }

  return (
    <div className="pr">
      <SH title="Security" />
      <div className="space-y-5">
        {(
          [
            ["Current Password", curPw, setCurPw],
            ["New Password", newPw, setNewPw],
          ] as [string, string, (v: string) => void][]
        ).map(([label, val, set]) => (
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
            <div style={{ position: "relative", maxWidth: 360 }}>
              <input
                type={visiblePasswords[label] ? "text" : "password"}
                value={val}
                onChange={(e) => set(e.target.value)}
                placeholder={
                  label === "New Password" ? "At least 8 characters" : undefined
                }
                style={{
                  width: "100%",
                  fontSize: 13,
                  border: "1px solid #E5E7EB",
                  borderRadius: 7,
                  padding: "8px 42px 8px 12px",
                  outline: "none",
                  color: "#374151",
                }}
                className="placeholder:text-gray-400"
              />
              <button
                type="button"
                onClick={() => setVisiblePasswords((current) => ({
                  ...current,
                  [label]: !current[label],
                }))}
                aria-label={`${visiblePasswords[label] ? "Hide" : "Show"} ${label.toLowerCase()}`}
                aria-pressed={Boolean(visiblePasswords[label])}
                title={`${visiblePasswords[label] ? "Hide" : "Show"} password`}
                style={{
                  position: "absolute",
                  top: "50%",
                  right: 6,
                  display: "grid",
                  width: 32,
                  height: 32,
                  placeItems: "center",
                  border: 0,
                  borderRadius: 6,
                  background: "transparent",
                  color: "#748391",
                  cursor: "pointer",
                  transform: "translateY(-50%)",
                }}
              >
                {visiblePasswords[label] ? <Eye size={16} aria-hidden="true" /> : <EyeOff size={16} aria-hidden="true" />}
              </button>
            </div>
          </div>
        ))}
        {pwError && (
          <div role="alert" style={{ fontSize: 12, color: "#B91C1C" }}>
            {pwError}
          </div>
        )}
        <div className="flex items-center gap-3">
          <PrimaryBtn onClick={updatePassword}>Update Password</PrimaryBtn>
          {pwSaved && (
            <span
              className="fi"
              style={{
                fontSize: 12,
                color: GREEN,
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Check size={13} aria-hidden="true" /> Password updated
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
