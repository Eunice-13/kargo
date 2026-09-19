import { useState } from "react"
import { CREAM } from "@/constants/theme"
import { Modal, PrimaryBtn, SecondaryBtn } from "@/components/shared"

export default function SocialConnectModal({
  platform,
  onConnect,
  onClose,
}: {
  platform: string
  onConnect: (username: string) => void
  onClose: () => void
}) {
  const [username, setUsername] = useState("")
  const [loading, setLoading] = useState(false)
  const confirm = () => {
    if (!username.trim()) return
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      onConnect(username.trim())
      onClose()
    }, 1000)
  }
  return (
    <Modal title={`Connect ${platform}`} onClose={onClose} width={400}>
      <div className="space-y-4">
        <div
          style={{
            background: CREAM,
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 12,
            color: "#6B7280",
          }}
        >
          This is a demo connection flow. Enter your {platform} username to link
          your account.
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
            {platform} Username
          </label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={
              platform === "Instagram" ? "@yourhandle" : "Your name on Facebook"
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
        <div className="flex gap-3">
          <SecondaryBtn
            style={{ flex: 1, display: "flex", justifyContent: "center" }}
            onClick={onClose}
          >
            Cancel
          </SecondaryBtn>
          <PrimaryBtn
            style={{ flex: 1, display: "flex", justifyContent: "center" }}
            onClick={confirm}
            loading={loading}
            disabled={!username.trim()}
          >
            {loading ? "Connecting…" : "Connect Account"}
          </PrimaryBtn>
        </div>
      </div>
    </Modal>
  )
}
