import { useState } from "react"

import type { ClaimRow } from "@/types"
import {
  Countdown,
  LocationPinPicker,
  Modal,
  PrimaryBtn,
  SecondaryBtn,
  SummaryBlock,
} from "@/components/shared"

export default function SetShippingFeeModal({
  claim,
  onSave,
  onRequestCorrection,
  onDecline,
  onClose,
}: {
  claim: ClaimRow
  onSave: (fee: number) => void | Promise<void>
  onRequestCorrection: () => void
  onDecline: () => void
  onClose: () => void
}) {
  const [fee, setFee] = useState(String(claim.shippingFee ?? ""))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const numericFee = Number(fee)
  const valid =
    fee.trim() !== "" && Number.isFinite(numericFee) && numericFee >= 0

  return (
    <Modal title="Set shipping fee" onClose={onClose} width={540}>
      <div className="space-y-4">
        <div>
          <SummaryBlock
            title={`${claim.product} ×${claim.qty}`}
            product={claim.product}
            details={[`Item amount: ₱${claim.amount.toLocaleString()}`]}
          />
          <div className="mt-2">
            <Countdown hours={claim.hours} expiresAt={claim.expiresAt} paused />
          </div>
        </div>
        <LocationPinPicker
          readOnly
          value={{
            lat: claim.deliveryPinLat,
            lng: claim.deliveryPinLng,
            url: claim.deliveryPinUrl,
            address: claim.deliveryPinAddress,
          }}
        />
        <label className="block text-xs font-semibold text-gray-700">
          Shipping fee (₱)
          <input
            type="number"
            min="0"
            step="0.01"
            value={fee}
            onChange={(event) => setFee(event.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            placeholder="0 for free shipping"
          />
        </label>
        {valid && (
          <p className="text-sm text-gray-600">
            New total:{" "}
            <strong>₱{(claim.amount + numericFee).toLocaleString()}</strong>
          </p>
        )}
        <div className="grid grid-cols-2 gap-3 max-[480px]:grid-cols-1">
          <SecondaryBtn onClick={onRequestCorrection}>
            Request location correction
          </SecondaryBtn>
          <SecondaryBtn onClick={onDecline}>Decline order</SecondaryBtn>
        </div>
        <div className="kargo-modal-actions">
          <SecondaryBtn onClick={onClose} disabled={saving}>
            Cancel
          </SecondaryBtn>
          <PrimaryBtn
            disabled={!valid || saving}
            loading={saving}
            onClick={async () => {
              setSaving(true)
              setError(null)
              try {
                await onSave(numericFee)
              } catch (err) {
                // Supabase/PostgREST errors are plain objects ({ message, code,
                // details, hint }), not Error instances, so read the message off
                // whatever shape we get. Log the raw error for the Postgres code.
                console.error("Set shipping fee failed:", err)
                const parts =
                  err && typeof err === "object"
                    ? [
                        (err as { message?: unknown }).message,
                        (err as { details?: unknown }).details,
                        (err as { hint?: unknown }).hint,
                      ].filter(
                        (part): part is string =>
                          typeof part === "string" && part.trim() !== "",
                      )
                    : []
                setError(
                  parts.length > 0
                    ? parts.join(" — ")
                    : "Could not save the shipping fee. Please try again.",
                )
              } finally {
                setSaving(false)
              }
            }}
          >
            Save fee and resume timer
          </PrimaryBtn>
        </div>
        {error && (
          <p role="alert" className="text-sm font-medium text-red-600">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}
