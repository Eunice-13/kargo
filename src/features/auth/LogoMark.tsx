import { INDIGO } from "@/constants/theme"
import logoUrl from "@/assets/kargo-logo.png"

export default function LogoMark({
  size = 40,
  inverse = false,
}: {
  size?: number
  inverse?: boolean
}) {
  const color = inverse ? "#FFFFFF" : INDIGO

  return (
    <div
      className="auth-logo"
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        gap: size * 0.05,
        color,
      }}
    >
      <img
        src={logoUrl}
        alt="Kargo"
        style={{ width: size, height: size, objectFit: "contain" }}
      />
    </div>
  )
}

