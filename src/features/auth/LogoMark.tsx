import { INDIGO } from "@/constants/theme"

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
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        gap: size * 0.05,
        color,
      }}
    >
      <img
        src="/kargo-logo.png"
        alt="Kargo"
        style={{ width: size, height: size, objectFit: "contain" }}
      />
    </div>
  )
}

