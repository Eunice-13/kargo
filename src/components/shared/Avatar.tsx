import { INDIGO } from "@/constants/theme"

export default function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const ini = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
  const bg = [INDIGO, "#0369A1", "#065F46", "#7C3AED", "#B45309", "#BE185D"][
    name.charCodeAt(0) % 6
  ]
  return (
    <span
      style={{
        width: size,
        height: size,
        background: bg,
        fontSize: size * 0.38,
        flexShrink: 0,
      }}
      className="rounded-full flex items-center justify-center text-white font-semibold select-none"
    >
      {ini}
    </span>
  )
}
