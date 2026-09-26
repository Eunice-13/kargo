import { useState } from "react"
import { Check } from "lucide-react"
import { PrimaryBtn, SH } from "@/components/shared"
import { GREEN } from "@/constants/theme"

export default function SecuritySection() {
  const [curPw, setCurPw] = useState("")
  const [newPw, setNewPw] = useState("")
  const [pwError, setPwError] = useState("")
  const [pwSaved, setPwSaved] = useState(false)

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
            <input
              type="password"
              value={val}
              onChange={(e) => set(e.target.value)}
              placeholder={
                label === "New Password" ? "At least 8 characters" : undefined
              }
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
