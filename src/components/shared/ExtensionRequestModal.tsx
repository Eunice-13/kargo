import { useMemo, useState } from "react"
import type { ClaimRow } from "@/types"
import Modal from "./Modal"
import PrimaryBtn from "./PrimaryBtn"
import SecondaryBtn from "./SecondaryBtn"

const MIN_HOURS = 1
const MAX_HOURS = 168

export default function ExtensionRequestModal({
  claim,
  onSubmit,
  onClose,
}: {
  claim: ClaimRow
  onSubmit: (hours: number, reason: string) => void | Promise<void>
  onClose: () => void
}) {
  const [preset, setPreset] = useState<"24" | "48" | "custom">("24")
  const [customHours, setCustomHours] = useState("")
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const hours = preset === "custom" ? Number(customHours) : Number(preset)
  const trimmedReason = reason.trim()
  const valid = useMemo(
    () => Number.isInteger(hours) && hours >= MIN_HOURS && hours <= MAX_HOURS && trimmedReason.length >= 10 && trimmedReason.length <= 500,
    [hours, trimmedReason],
  )
  const reasonError = trimmedReason.length > 0 && trimmedReason.length < 10 ? "Please provide at least 10 characters." : trimmedReason.length > 500 ? "Reason must be 500 characters or fewer." : ""
  const hoursError = preset === "custom" && (!Number.isInteger(hours) || hours < MIN_HOURS || hours > MAX_HOURS) ? `Enter a whole number from ${MIN_HOURS} to ${MAX_HOURS} hours.` : ""
  async function submit() {
    if (!valid || submitting) return
    setSubmitting(true)
    try { await onSubmit(hours, trimmedReason) } finally { setSubmitting(false) }
  }
  return (
    <Modal title="Request Extension" onClose={onClose} width={420}>
      <div className="space-y-4">
        <div
          style={{
            background: "#EEF0FF",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 12,
            color: "#374151",
          }}
        >
          Requesting extension for <strong>{claim.product}</strong> from{" "}
          {claim.seller}.
        </div>
        <div>
          <label
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#374151",
              display: "block",
              marginBottom: 5,
            }}
          >
            Additional Time Needed
          </label>
          <div className="flex gap-2">
            {([["24", "24 hours"], ["48", "48 hours"], ["custom", "Custom"]] as const).map(([value, label]) => (
              <button key={value} type="button" onClick={() => setPreset(value)} className="flex-1 rounded-md border px-3 py-2 text-xs font-semibold" style={{ borderColor: preset === value ? "#191BA9" : "#E5E7EB", background: preset === value ? "#EEF0FF" : "#fff", color: preset === value ? "#191BA9" : "#374151" }}>{label}</button>
            ))}
          </div>
          {preset === "custom" && <div className="mt-2"><input type="number" min={MIN_HOURS} max={MAX_HOURS} step={1} value={customHours} onChange={(e) => setCustomHours(e.target.value)} placeholder="Number of hours" className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm" />{hoursError && <p className="mt-1 text-xs text-red-600">{hoursError}</p>}</div>}
        </div>
        <div>
          <label
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#374151",
              display: "block",
              marginBottom: 5,
            }}
          >
            Reason <span style={{ color: "#DC2626" }}>*</span>
          </label>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Waiting for my next paycheck on Friday…"
            style={{
              width: "100%",
              fontSize: 13,
              border: "1px solid #E5E7EB",
              borderRadius: 7,
              padding: "9px 12px",
              outline: "none",
              resize: "none",
              color: "#374151",
              fontFamily: "inherit",
              boxSizing: "border-box" as const,
            }}
            className="placeholder:text-gray-400"
          />
          <div className="mt-1 flex justify-between text-[11px] text-gray-400"><span className={reasonError ? "text-red-600" : ""}>{reasonError || "Minimum 10 characters."}</span><span>{reason.length}/500</span></div>
        </div>
        <div className="flex gap-3">
          <SecondaryBtn
            onClick={onClose}
          >
            Cancel
          </SecondaryBtn>
          <PrimaryBtn onClick={submit} disabled={!valid || submitting}>
            {submitting ? "Sending…" : "Send Request"}
          </PrimaryBtn>
        </div>
      </div>
    </Modal>
  )
}
