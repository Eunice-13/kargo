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
      <svg
        width={size}
        height={size * 0.78}
        viewBox="0 0 180 142"
        fill="none"
        aria-hidden="true"
      >
        <path d="M31 91V42L90 7l59 35v49" stroke="currentColor" strokeWidth="6" />
        <path d="M42 86V48L90 20l48 28v38" stroke="currentColor" strokeWidth="2.5" opacity=".55" />
        <path d="M90 28v7M79 42l11-6 11 6M69 55l21-11 21 11M60 70l30-15 30 15M51 86l39-17 39 17" stroke="currentColor" strokeWidth="6" strokeLinejoin="round" />
        <path d="M38 90l53-9 51 9-13 37-39 8-39-8-13-37Z" fill="currentColor" />
        <path d="M91 82v50l38-8 11-31-49-11Z" fill={inverse ? "#668ED1" : "#FFFFFF"} opacity=".9" />
        <circle cx="72" cy="96" r="5" fill={inverse ? "#668ED1" : "#FFFFFF"} />
        <path d="M17 128c28-5 49-2 73 3 25 5 48 6 73-1M25 137c26-3 44 0 65 3 24 3 43 2 65-1" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity=".9" />
      </svg>
      <span
        style={{
          color,
          fontFamily: "'Manrope', sans-serif",
          fontWeight: 700,
          fontSize: size * 0.31,
          letterSpacing: size * 0.005,
          lineHeight: 1,
        }}
      >
        KARGO
      </span>
    </div>
  )
}

