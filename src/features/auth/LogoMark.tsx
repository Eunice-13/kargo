import { INDIGO } from "@/constants/theme"

export default function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <div
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
      }}
    >
      <div
        style={{
          width: size,
          height: size,
          background: INDIGO,
          borderRadius: size * 0.22,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 14px rgba(25,27,169,0.28)",
        }}
      >
        <svg
          width={size * 0.5}
          height={size * 0.5}
          viewBox="0 0 20 20"
          fill="none"
        >
          <path
            d="M2 5h16M2 10h10M2 15h13"
            stroke="#fff"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <span
        style={{
          fontFamily: "'Plus Jakarta Sans',sans-serif",
          color: INDIGO,
          fontWeight: 800,
          fontSize: size * 0.52,
          letterSpacing: -0.8,
          lineHeight: 1,
        }}
      >
        Kargo
      </span>
    </div>
  )
}

