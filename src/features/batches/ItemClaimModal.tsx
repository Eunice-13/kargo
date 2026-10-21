import SavedAddressSelector from "@/components/shared/SavedAddressSelector"
import DeliveryAddressFields from "@/components/shared/DeliveryAddressFields"
import { productAvailability } from "./productAvailability"

import { useEffect, useState } from "react"

import { Clock3, ClipboardList } from "lucide-react"

import type { BatchType, ClaimReservationInput } from "@/types"
import { INDIGO, CREAM } from "@/constants/theme"

import {
  Modal,
  PrimaryBtn,
  SecondaryBtn,
  Avatar,
  ProductThumb,
  type LocationPinValue,
} from "@/components/shared"
import { isSupabaseConfigured } from "@/lib/supabase"

import { kargoApi } from "@/services"

import type { SellerReceiveMethod } from "@/services/kargoApi"
import { productImageUrl } from "@/components/shared/ProductThumb"

export default function ItemClaimModal({
  batch,

  product,

  onConfirm,

  onClose,
}: {
  batch: BatchType

  product: {
    name: string

    price: number

    qty: number

    claimed: number

    waitlist: number

    imageUrl?: string

    locked?: boolean

    limitPerUser?: number
  }

  onConfirm: (reservation: ClaimReservationInput) => void | Promise<void>
  onClose: () => void
}) {
  const [qty, setQty] = useState(1)

  const [showReminders, setShowReminders] = useState(false)

  const [showPhotoZoom, setShowPhotoZoom] = useState(false)

  const [submitting, setSubmitting] = useState(false)

  const [paymentMethods, setPaymentMethods] = useState<SellerReceiveMethod[]>(
    isSupabaseConfigured
      ? []
      : [
          { methodType: "GCash", accountName: null, accountNumber: null },
          {
            methodType: "Bank Transfer",
            accountName: null,
            accountNumber: null,
          },
          {
            methodType: "Cash on Meetup",
            accountName: null,
            accountNumber: null,
          },
        ],
  )
  const [paymentMethodsLoading, setPaymentMethodsLoading] =
    useState(isSupabaseConfigured)
  const [paymentMethodsError, setPaymentMethodsError] = useState<string | null>(
    null,
  )
  const [selectedMethod, setSelectedMethod] = useState(
    isSupabaseConfigured ? "" : "GCash",
  )
  const [pin, setPin] = useState<LocationPinValue>({})
  const [savedPinVersion, setSavedPinVersion] = useState(0)
  const [acceptedShipping, setAcceptedShipping] = useState(false)
  const left = product.qty - product.claimed

  // Keep the legacy cap only for products without a valid seller-configured limit.

  const perUser =
    product.limitPerUser && product.limitPerUser > 0 ? product.limitPerUser : 5

  const maxQty = Math.max(1, Math.min(left, perUser))

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setPaymentMethodsLoading(false)

      return
    }

    if (!batch.sellerId) {
      setPaymentMethodsLoading(false)

      setPaymentMethodsError("The seller's payment methods are unavailable.")

      return
    }

    kargoApi

      .loadSellerReceiveMethods(batch.sellerId)

      .then((methods) => {
        setPaymentMethods(methods)
        setSelectedMethod(methods[0]?.methodType ?? "")
        setPaymentMethodsError(
          methods.length === 0
            ? "This seller has not configured any payment methods."
            : null,
        )
      })

      .catch((error) =>
        setPaymentMethodsError(
          error instanceof Error
            ? error.message
            : "Unable to load the seller's payment methods.",
        ),
      )

      .finally(() => setPaymentMethodsLoading(false))
  }, [batch.sellerId])

  const shippingApplies = Boolean(
    selectedMethod && selectedMethod !== "Cash on Meetup",
  )
  const hasLocation =
    (pin.lat != null && pin.lng != null) || Boolean(pin.url?.trim())
  const canConfirm =
    Boolean(selectedMethod) &&
    (!shippingApplies ||
      (hasLocation && !pin.isResolvingAddress && acceptedShipping)) &&
    productAvailability(product, batch.locked).canClaim &&
    qty <= left

  return (
    <>
    <Modal title="Review Claim" onClose={onClose} width={480}>
      <div className="space-y-4">
        <section className="kargo-summary-block" aria-label={product.name}>
          <button
            type="button"
            className="claim-review-photo-button"
            aria-label={`Zoom photo of ${product.name}`}
            onClick={() => setShowPhotoZoom(true)}
          >
            <ProductThumb name={product.name} imageUrl={product.imageUrl} />
          </button>
          <div>
            <strong>{product.name}</strong>
            <span>from {batch.title}</span>
            <span>₱{product.price.toLocaleString()}</span>
          </div>
        </section>

        {/* Seller trust row */}
        <div
          style={{
            display: "flex",

            alignItems: "center",

            gap: 10,

            padding: "8px 0",

            borderBottom: "1px solid #F3F4F6",
          }}
        >
          <Avatar name={batch.seller} size={28} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>
              {batch.seller}
            </div>
            <div style={{ fontSize: 11, color: "#9CA3AF" }}>Seller</div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            {["FB", "IG", "TT"].map((s) => (
              <span
                key={s}
                style={{
                  width: 22,

                  height: 22,

                  borderRadius: "50%",

                  background:
                    s === "FB" ? "#1877F2" : s === "IG" ? "#E1306C" : "#000",

                  color: "#fff",

                  fontSize: 9,

                  fontWeight: 700,

                  display: "flex",

                  alignItems: "center",

                  justifyContent: "center",
                }}
              >
                {s[0]}
              </span>
            ))}
          </div>
        </div>

        {/* Reservation countdown notice */}
        <div
          style={{
            background: "#FFF7ED",

            border: "1px solid #FCD34D",

            borderRadius: 8,

            padding: "10px 14px",

            display: "flex",

            gap: 10,

            alignItems: "flex-start",
          }}
        >
          <Clock3 size={18} aria-hidden="true" />
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#92400E" }}>
              48-hour payment window
            </div>
            <div style={{ fontSize: 11, color: "#B45309", marginTop: 2 }}>
              Your reservation expires if payment is not submitted within 48
              hours of claiming.
            </div>
          </div>
        </div>

        {/* Qty selector */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>
            Quantity
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              style={{
                width: 28,

                height: 28,

                borderRadius: "50%",

                border: "1px solid #E5E7EB",

                background: "#fff",

                cursor: "pointer",

                fontSize: 16,

                display: "flex",

                alignItems: "center",

                justifyContent: "center",

                color: "#374151",
              }}
            >
              −
            </button>
            <span
              style={{
                fontSize: 14,

                fontWeight: 700,

                color: "#111827",

                minWidth: 20,

                textAlign: "center",
              }}
            >
              {qty}
            </span>
            <button
              onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
              style={{
                width: 28,

                height: 28,

                borderRadius: "50%",

                border: "1px solid #E5E7EB",

                background: "#fff",

                cursor: "pointer",

                fontSize: 16,

                display: "flex",

                alignItems: "center",

                justifyContent: "center",

                color: "#374151",
              }}
            >
              +
            </button>
          </div>
          <span style={{ fontSize: 11, color: "#9CA3AF" }}>
            {left} slot{left !== 1 ? "s" : ""} left
            {` · max ${perUser}/buyer`}
          </span>
        </div>

        {/* Accepted payment methods */}
        <div>
          <div
            style={{
              fontSize: 12,

              fontWeight: 600,

              color: "#374151",

              marginBottom: 8,
            }}
          >
            Choose payment method <span style={{ color: "#DC2626" }}>*</span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {paymentMethodsLoading ? (
              <span style={{ color: "#9CA3AF", fontSize: 11 }}>
                Loading seller payment methods...
              </span>
            ) : paymentMethods.length > 0 ? (
              paymentMethods.map((method) => (
                <button
                  type="button"
                  key={method.methodType}
                  onClick={() => {
                    setSelectedMethod(method.methodType)
                    setAcceptedShipping(false)
                  }}
                  aria-pressed={selectedMethod === method.methodType}
                  style={{
                    background:
                      selectedMethod === method.methodType
                        ? "#EEF0FF"
                        : "#F3F4F6",
                    color:
                      selectedMethod === method.methodType ? INDIGO : "#374151",
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "4px 10px",
                    borderRadius: 999,
                    border: `1px solid ${
                      selectedMethod === method.methodType ? INDIGO : "#E5E7EB"
                    }`,
                    cursor: "pointer",
                  }}
                >
                  {method.methodType}
                </button>
              ))
            ) : (
              <span style={{ color: "#B45309", fontSize: 11 }}>
                {paymentMethodsError ?? "No payment methods available."}
              </span>
            )}
          </div>
        </div>

        {shippingApplies && (
          <div className="space-y-3 rounded-lg border border-gray-200 p-3">
            <div>
              <div className="text-xs font-semibold text-gray-700">
                Delivery location <span className="text-red-600">*</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Search for the address, then confirm or fine-tune the pin on the
                map.
              </p>
            </div>
            <SavedAddressSelector value={pin} onChange={(next) => {
              setPin(next)
              setSavedPinVersion(version => version + 1)
            }} onManage={onClose} />
            <DeliveryAddressFields mapKey={savedPinVersion} value={pin} onChange={setPin} />
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
              The shipping fee is shouldered by the buyer and will be set by the
              seller before you can pay. Your payment deadline pauses while you
              wait.
            </div>
            <label className="item-claim-shipping-ack flex cursor-pointer items-start gap-3 text-xs leading-5 text-gray-700">
              <input
                type="checkbox"
                checked={acceptedShipping}
                onChange={(event) => setAcceptedShipping(event.target.checked)}
                className="mt-1"
              />
              <span>
                I understand and accept that I will shoulder the shipping fee.
              </span>
            </label>
          </div>
        )}

        {/* Reminders accordion */}
        <div
          style={{
            border: "1px solid #E5E7EB",

            borderRadius: 8,

            overflow: "hidden",
          }}
        >
          <button
            onClick={() => setShowReminders((v) => !v)}
            style={{
              width: "100%",

              display: "flex",

              justifyContent: "space-between",

              alignItems: "center",

              padding: "10px 14px",

              background: CREAM,

              border: "none",

              cursor: "pointer",

              fontSize: 12,

              fontWeight: 600,

              color: "#374151",
            }}
          >
            <span
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <ClipboardList size={13} aria-hidden="true" /> Important Reminders
            </span>
            <span style={{ fontSize: 10, color: "#9CA3AF" }}>
              {showReminders ? "▲" : "▼"}
            </span>
          </button>
          <div
            style={{
              maxHeight: showReminders ? 200 : 0,

              overflow: "hidden",

              transition: "max-height 0.25s ease",
            }}
          >
            <ul
              style={{
                margin: 0,

                padding: "10px 14px 10px 28px",

                fontSize: 11,

                color: "#6B7280",

                lineHeight: 1.8,
              }}
            >
              <li>
                Pay before the 48-hour timer ends or your reservation will
                expire.
              </li>
              <li>
                COD is for tracking purposes only — coordinate pickup with the
                seller.
              </li>
              <li>
                Extensions are subject to seller approval and not guaranteed.
              </li>
              <li>Claims are non-transferable to another buyer.</li>
            </ul>
          </div>
        </div>

        <div
          style={{
            fontSize: 14,

            fontWeight: 700,

            color: "#111827",

            textAlign: "right",

            fontFamily: "'Josefin Sans',sans-serif",
          }}
        >
          Total: ₱{(product.price * qty).toLocaleString()}
        </div>

        <div className="kargo-modal-actions">
          <SecondaryBtn onClick={onClose}>
            Cancel
          </SecondaryBtn>
          <PrimaryBtn
            disabled={submitting || !canConfirm}
            onClick={async () => {
              setSubmitting(true)

              try {
                await onConfirm({
                  quantity: qty,
                  paymentMethod: selectedMethod,
                  pinLat: pin.lat,
                  pinLng: pin.lng,
                  pinUrl: pin.url,
                  pinAddress: pin.address,
                  acceptShipping: shippingApplies ? acceptedShipping : false,
                })
              } finally {
                setSubmitting(false)
              }
            }}
          >
            {submitting ? "Claiming…" : "Yes, confirm claim"}
          </PrimaryBtn>
        </div>
      </div>
    </Modal>
    {showPhotoZoom && (
      <Modal
        title={`${product.name} photo`}
        variant="detail"
        showTitleIcon={false}
        width={900}
        onClose={() => setShowPhotoZoom(false)}
      >
        <div className="claim-review-photo-zoom">
          <img
            src={productImageUrl(product.name, 1200, product.imageUrl)}
            alt={product.name}
          />
        </div>
      </Modal>
    )}
    </>
  )
}
