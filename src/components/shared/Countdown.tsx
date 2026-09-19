import { useState, useEffect } from "react"
import { AMBER } from "@/constants/theme"

export default function Countdown({ hours }: { hours: number }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, Math.round(hours * 3600)))
  useEffect(() => {
    const timer = window.setInterval(() => {
      setRemaining((value) => Math.max(0, value - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])
  const currentHours = remaining / 3600
  const urgent = currentHours < 6,
    warn = currentHours < 24
  const days = Math.floor(remaining / 86400)
  const clockHours = Math.floor((remaining % 86400) / 3600)
  const minutes = Math.floor((remaining % 3600) / 60)
  const seconds = remaining % 60
  const label = days > 0
    ? `${days}d ${String(clockHours).padStart(2, "0")}h`
    : `${String(clockHours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
  return (
    <span
      role="timer"
      aria-label={`${label} remaining`}
      className={`text-xs font-medium tabular-nums${urgent ? " cu" : ""}`}
      style={{ color: remaining === 0 || urgent ? "#EF4444" : warn ? AMBER : "#6B7280" }}
    >
      {label}
    </span>
  )
}
