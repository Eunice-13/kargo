import { useState, useEffect } from "react"

import { AMBER } from "@/constants/theme"

const deadlineTimestamps = new Map<string, number>()

// Display the persisted deadline against the browser clock, so ticking does not
// depend on a server request after the order is loaded.

function getDeadlineTimestamp(key: string, hours: number) {
  const existing = deadlineTimestamps.get(key)

  if (existing) return existing

  const safeHours = Number.isFinite(hours) ? Math.max(0, hours) : 0
  const deadline = Date.now() + safeHours * 3_600_000

  deadlineTimestamps.set(key, deadline)

  return deadline
}

export default function Countdown({
  hours,
  id,
  expiresAt,
  compact = false,
  paused = false,
}: {
  hours: number
  id?: string | number
  expiresAt?: string
  compact?: boolean
  paused?: boolean
}) {
  const deadlineKey = String(id ?? `hours-${hours}`)

  const parsedExpiry = expiresAt ? new Date(expiresAt).getTime() : Number.NaN
  const deadline = Number.isFinite(parsedExpiry)
    ? parsedExpiry
    : getDeadlineTimestamp(deadlineKey, hours)

  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.round((deadline - Date.now()) / 1000)),
  )

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
  if (paused) {
    return (
      <span className="text-xs font-semibold text-amber-700">
        Paused — waiting for seller
      </span>
    )
  }
  const label =
    remaining === 0
      ? "Expired"
      : compact
        ? currentHours >= 24
          ? `${days}d ${clockHours}h`
          : `${Math.ceil(currentHours)}h`
        : days > 0
          ? `${days}d ${String(clockHours).padStart(2, "0")}h`
          : `${String(clockHours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`

  return (
    <span
      role="timer"
      aria-label={remaining === 0 ? "Expired" : `${label} remaining`}
      className={`text-xs font-medium tabular-nums${urgent ? " cu" : ""}`}
      style={{
        color: compact
          ? AMBER
          : remaining === 0 || urgent
            ? "#EF4444"
            : warn
              ? AMBER
              : "#6B7280",
      }}
    >
      {label}
    </span>
  )
}
