import { useState, useEffect } from "react"
import { AMBER } from "@/constants/theme"

const deadlineTimestamps = new Map<string, number>()

// TODO: This currently uses local state/mock intervals; refactor to absolute system timestamps (Date.now() vs target deadline) for production.
function getDeadlineTimestamp(key: string, hours: number) {
  const existing = deadlineTimestamps.get(key)
  if (existing) return existing
  const deadline = Date.now() + Math.max(0, hours * 3_600_000)
  deadlineTimestamps.set(key, deadline)
  return deadline
}

export default function Countdown({ hours, id }: { hours: number; id?: string | number }) {
  const deadlineKey = String(id ?? `hours-${hours}`)
  const deadline = getDeadlineTimestamp(deadlineKey, hours)
  const [remaining, setRemaining] = useState(() => Math.max(0, Math.round((deadline - Date.now()) / 1000)))
  useEffect(() => {
    const updateRemaining = () => {
      setRemaining(Math.max(0, Math.round((deadline - Date.now()) / 1000)))
    }
    updateRemaining()
    const timer = window.setInterval(updateRemaining, 1000)
    return () => window.clearInterval(timer)
  }, [deadline])
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
