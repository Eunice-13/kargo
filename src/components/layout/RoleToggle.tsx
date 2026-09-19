import type { Role } from "@/types"
import { INDIGO, CREAM } from "@/constants/theme"

export default function RoleToggle({
  role,
  setRole,
}: {
  role: Role
  setRole: (r: Role) => void
}) {
  return (
    <div
      data-spotlight="role-toggle"
      style={{
        background: CREAM,
        border: "1px solid #E5E7EB",
        borderRadius: 999,
        padding: 2,
        position: "relative",
        display: "inline-flex",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 2,
          left: role === "Seller" ? "50%" : 2,
          width: "calc(50% - 2px)",
          bottom: 2,
          background: INDIGO,
          borderRadius: 999,
          transition: "left 0.22s cubic-bezier(.22,1,.36,1)",
          pointerEvents: "none",
        }}
      />
      {(["Buyer", "Seller"] as Role[]).map((r) => (
        <button
          key={r}
          onClick={() => setRole(r)}
          style={{
            position: "relative",
            zIndex: 1,
            color: role === r ? "#fff" : "#6B7280",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 600,
            padding: "3px 14px",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            transition: "color 0.2s",
            fontFamily: "'Plus Jakarta Sans',sans-serif",
          }}
        >
          {r}
        </button>
      ))}
    </div>
  )
}
