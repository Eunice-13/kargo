import { useState } from "react"
import type { ClaimRow } from "@/types"
import { Modal, PrimaryBtn, SecondaryBtn } from "@/components/shared"

export default function ExtensionRequestModal({
  claim,
  onSubmit,
  onClose,
}: {
  claim: ClaimRow
  onSubmit: (hours: number, reason: string) => void | Promise<void>
  onClose: () => void
}) {
  const [days, setDays] = useState("3")
  const [reason, setReason] = useState("")
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
            Additional Days Needed
          </label>
          <select
            value={days}
            onChange={(e) => setDays(e.target.value)}
            style={{
              width: "100%",
              fontSize: 13,
              border: "1px solid #E5E7EB",
              borderRadius: 7,
              padding: "9px 12px",
              outline: "none",
              color: "#374151",
              background: "#fff",
            }}
          >
            {["1", "2", "3", "5", "7"].map((d) => (
              <option key={d} value={d}>
                {d} day{d !== "1" ? "s" : ""}
              </option>
            ))}
          </select>
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
            Reason (optional)
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
        </div>
        <div className="flex gap-3">
          <SecondaryBtn
            style={{ flex: 1, display: "flex", justifyContent: "center" }}
            onClick={onClose}
          >
            Cancel
          </SecondaryBtn>
          <PrimaryBtn
            style={{ flex: 1, display: "flex", justifyContent: "center" }}
            onClick={() => onSubmit(Number(days) * 24, reason.trim())}
          >
            Send Request
          </PrimaryBtn>
        </div>
      </div>
    </Modal>
  )
}
