import { Check } from "lucide-react"
import { PaymentIcon, PrimaryBtn } from "@/components/shared"

type Props = {
  fbConn: boolean
  fbUser: string
  setFbConn: (value: boolean) => void
  setFbUser: (value: string) => void
  igConn: boolean
  igUser: string
  setIgConn: (value: boolean) => void
  setIgUser: (value: string) => void
  setSocialModal: (provider: "Facebook" | "Instagram" | null) => void
}

export default function LinkedAccountsSection(props: Props) {
  const accounts = [
    {
      name: "Facebook" as const,
      connected: props.fbConn,
      username: props.fbUser,
      background: "#1877F2",
      disconnect: () => {
        props.setFbConn(false)
        props.setFbUser("")
      },
    },
    {
      name: "Instagram" as const,
      connected: props.igConn,
      username: props.igUser,
      background: "linear-gradient(135deg,#F58529,#DD2A7B,#8134AF)",
      disconnect: () => {
        props.setIgConn(false)
        props.setIgUser("")
      },
    },
  ]

  return (
    <div className="pr">
      <h3 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 4 }}>
        Linked Accounts
      </h3>
      <p style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 20 }}>
        Connect social profiles so buyers and sellers can coordinate.
      </p>
      <div className="space-y-3">
        {accounts.map((account) => (
          <div key={account.name} style={{ border: "1px solid #E5E7EB", borderRadius: 10, padding: 16, display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: account.background, display: "grid", placeItems: "center" }}>
              <PaymentIcon method={account.name} size={18} />
            </div>
            <div className="flex-1">
              <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{account.name}</div>
              <div style={{ fontSize: 12, color: account.connected ? "#065F46" : "#9CA3AF" }}>
                {account.connected ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <Check size={12} aria-hidden="true" /> Connected as {account.username}
                  </span>
                ) : "Not connected"}
              </div>
            </div>
            {account.connected ? (
              <button type="button" onClick={account.disconnect} style={{ background: "#FEE2E2", color: "#991B1B", border: "none", borderRadius: 7, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                Disconnect
              </button>
            ) : (
              <PrimaryBtn size="sm" onClick={() => props.setSocialModal(account.name)}>Connect</PrimaryBtn>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
