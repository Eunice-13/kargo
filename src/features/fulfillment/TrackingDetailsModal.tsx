import { useState } from "react"

import type { CourierCompany, FulfillmentOrder } from "@/types"
import {
  COURIER_COMPANIES,
  Modal,
  PrimaryBtn,
  SecondaryBtn,
  SummaryBlock,
} from "@/components/shared"

export type TrackingDetailsInput = {
  courier: string
  riderName: string
  riderContact: string
  trackingNumber: string
  eta: string
  trackingUrl?: string
}

export default function TrackingDetailsModal({
  order,
  onSave,
  onClose,
}: {
  order: FulfillmentOrder
  onSave: (details: TrackingDetailsInput) => void | Promise<void>
  onClose: () => void
}) {
  const initialCourier = COURIER_COMPANIES.includes(
    order.courierCompany as CourierCompany,
  )
    ? order.courierCompany as CourierCompany
    : "Others"
  const [courier, setCourier] = useState<CourierCompany>(initialCourier)
  const [otherCourier, setOtherCourier] = useState(
    initialCourier === "Others" ? (order.courierCompany ?? "") : "",
  )
  const [riderName, setRiderName] = useState(order.riderName ?? "")
  const [riderContact, setRiderContact] = useState(order.riderContact ?? "")
  const [trackingNumber, setTrackingNumber] = useState(
    order.trackingNumber ?? "",
  )
  const [eta, setEta] = useState(order.eta?.slice(0, 16) ?? "")
  const [trackingUrl, setTrackingUrl] = useState(order.trackingUrl ?? "")
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState("")
  const resolvedCourier = courier === "Others" ? otherCourier.trim() : courier
  const valid =
    resolvedCourier &&
    riderName.trim() &&
    riderContact.trim() &&
    trackingNumber.trim() &&
    eta

  return (
    <Modal
      title={order.trackingNumber ? "Edit tracking details" : "Add tracking details"}
      variant="form"
      onClose={onClose}
      width={520}
    >
      <div className="space-y-4">
        <SummaryBlock
          title={order.product}
          product={order.product}
          details={[
            `Buyer: ${order.buyer} · ×${order.qty}`,
            `₱${order.amount.toLocaleString()}`,
          ]}
        />
        <p className="text-sm leading-6 text-gray-600">
          Add the courier and rider information the buyer will use after this
          order is marked shipped.
        </p>
        <label className="block text-xs font-semibold text-gray-700">
          Courier company
          <select
            value={courier}
            onChange={(event) =>
              setCourier(event.target.value as CourierCompany)
            }
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          >
            {COURIER_COMPANIES.map((company) => (
              <option key={company}>{company}</option>
            ))}
          </select>
        </label>
        {courier === "Others" && (
          <label className="block text-xs font-semibold text-gray-700">
            Courier name
            <input
              value={otherCourier}
              onChange={(event) => setOtherCourier(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
        )}
        <div className="grid grid-cols-2 gap-3 max-[620px]:grid-cols-1">
          <label className="block text-xs font-semibold text-gray-700">
            Rider name
            <input
              value={riderName}
              onChange={(event) => setRiderName(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs font-semibold text-gray-700">
            Rider contact
            <input
              value={riderContact}
              onChange={(event) => setRiderContact(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs font-semibold text-gray-700">
            Tracking number
            <input
              value={trackingNumber}
              onChange={(event) => setTrackingNumber(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs font-semibold text-gray-700">
            ETA
            <input
              type="datetime-local"
              value={eta}
              onChange={(event) => setEta(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
        </div>
        <label className="block text-xs font-semibold text-gray-700">
          Tracking URL{" "}
          <span className="font-normal text-gray-500">(optional)</span>
          <input
            type="url"
            value={trackingUrl}
            onChange={(event) => setTrackingUrl(event.target.value)}
            placeholder="Courier share link"
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
        </label>
        {saveError && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700"
          >
            {saveError}
          </p>
        )}
        <div className="kargo-modal-actions">
          <SecondaryBtn onClick={onClose} disabled={saving}>
            Cancel
          </SecondaryBtn>
          <PrimaryBtn
            disabled={!valid || saving}
            loading={saving}
            onClick={async () => {
              setSaveError("")
              setSaving(true)
              try {
                await onSave({
                  courier: resolvedCourier,
                  riderName: riderName.trim(),
                  riderContact: riderContact.trim(),
                  trackingNumber: trackingNumber.trim(),
                  eta: new Date(eta).toISOString(),
                  trackingUrl: trackingUrl.trim() || undefined,
                })
              } catch (error) {
                setSaveError(
                  error instanceof Error
                    ? error.message
                    : "Unable to save tracking details. Please try again.",
                )
              } finally {
                setSaving(false)
              }
            }}
          >
            Save tracking details
          </PrimaryBtn>
        </div>
      </div>
    </Modal>
  )
}
