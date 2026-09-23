import { useState, useRef, useEffect } from "react"
import { CheckCircle2, Paperclip } from "lucide-react"
import type { ToPayRow } from "@/types"
import { Modal, PrimaryBtn, SecondaryBtn } from "@/components/shared"
import { getSellerPaymentDetails } from "./sellerPaymentDetails"
import type { BuyerPaymentMethod } from "./buyerPaymentMethods"
import { isCashMethod, cashCoordinationReminder } from "./buyerPaymentMethods"
import { isSupabaseConfigured } from "@/lib/supabase"
import { kargoApi } from "@/services"
import type { SellerReceiveMethod } from "@/services/kargoApi"
import { deadlineHasPassed } from "@/features/claims/claimExpiry"

// Cash methods (Meetup / Delivery) carry no online-payment details; the buyer
// just coordinates with the seller. Keep their real label as the method key.

export default function PaymentSubmitModal({
  item,
  onConfirm,
  onClose,
  contactPrefill = "",
  savedMethods = [],
}: {
  item: ToPayRow
  onConfirm: (method: string, refNo: string, receipt?: File) => void
  onClose: () => void
  contactPrefill?: string
  savedMethods?: BuyerPaymentMethod[]
}) {
  useEffect(() => {
    const closeIfExpired = () => {
      if (!deadlineHasPassed(item)) return
      onClose()
      alert("This claim has expired and can no longer be paid.")
    }
    closeIfExpired()
    const timer = window.setInterval(closeIfExpired, 1000)
    return () => window.clearInterval(timer)
  }, [item, onClose])
  // Method options are filtered to what THIS SELLER accepts (Part 3), loaded
  // below. Until they load (or in demo mode) we fall back to the buyer's saved
  // methods, then to a default set.
  const fallbackOptions =
    savedMethods.length > 0
      ? savedMethods.map((m) => ({ label: m.type, key: m.type }))
      : [
          { label: "GCash", key: "GCash" },
          { label: "Maya", key: "Maya" },
          { label: "Bank Transfer", key: "Bank Transfer" },
          { label: "Cash on Meetup", key: "Cash on Meetup" },
        ]
  const [method, setMethod] = useState(fallbackOptions[0]?.key ?? "GCash")
  const [refNo, setRefNo] = useState("")
  const [acctName, setAcctName] = useState("")
  const [phone, setPhone] = useState("")
  const [contactLink, setContactLink] = useState(contactPrefill)
  const [amountPaid, setAmountPaid] = useState(String(item.amount))
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState<string | null>(null)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const sellerDetails = getSellerPaymentDetails(item.seller)
  const paymentMethods = {
    ...sellerDetails.methods,
    COD: { number: "" },
  }
  const details = paymentMethods[method as keyof typeof paymentMethods] ?? { number: "—" }

  // Real seller-accepted methods (Part 3) with QR (Part 4), loaded on Supabase.
  const [sellerMethods, setSellerMethods] = useState<SellerReceiveMethod[]>([])
  const [sellerLoaded, setSellerLoaded] = useState(false)
  useEffect(() => {
    if (!isSupabaseConfigured || !item.sellerId) return
    let active = true
    kargoApi
      .loadSellerReceiveMethods(item.sellerId)
      .then((rows) => {
        if (active) {
          setSellerMethods(rows)
          setSellerLoaded(true)
        }
      })
      .catch(() => {
        /* fall back to buyer's saved / default options */
      })
    return () => {
      active = false
    }
  }, [item.sellerId])

  // Part 3: restrict options to exactly what the seller accepts. Only trust the
  // seller list once it has actually loaded with entries; otherwise fall back.
  const methodOptions =
    sellerLoaded && sellerMethods.length > 0
      ? sellerMethods.map((m) => ({ label: m.methodType, key: m.methodType }))
      : fallbackOptions
  const acceptedLabels = methodOptions.map((m) => m.label)

  // Keep the selected method valid whenever the option list changes.
  useEffect(() => {
    if (methodOptions.length > 0 && !methodOptions.some((m) => m.key === method)) {
      setMethod(methodOptions[0].key)
    }
  }, [methodOptions, method])

  const isCash = isCashMethod(method)
  // Match the selected method to a seller-uploaded one (case-insensitive).
  const sellerMethod = sellerMethods.find(
    (m) => m.methodType.toLowerCase() === method.toLowerCase(),
  )

  // For cash methods, the buyer's default Address auto-fills as the handoff
  // location; they can still override it for this order (default stays saved).
  const [handoffAddress, setHandoffAddress] = useState("")
  const [handoffTouched, setHandoffTouched] = useState(false)
  useEffect(() => {
    if (!isSupabaseConfigured) {
      if (!handoffTouched) setHandoffAddress("12 Mabini St., Barangay San Antonio, Makati City")
      return
    }
    let active = true
    kargoApi
      .loadAddresses()
      .then((rows) => {
        if (!active || handoffTouched) return
        const def = rows.find((r) => r.is_default) ?? rows[0]
        if (def) {
          setHandoffAddress([def.address_line, def.city].filter(Boolean).join(", "))
        }
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [handoffTouched])

  const handleFile = (file: File) => {
    setUploading(true)
    setTimeout(() => {
      setUploading(false)
      setUploaded(file.name)
      setUploadedFile(file)
    }, 1200)
  }

  return (
    <Modal title="Submit Payment" onClose={onClose} width={480}>
      <div className="space-y-4">
        <div
          style={{
            background: "#F9FAFB",
            borderRadius: 8,
            padding: "10px 14px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>
              {item.product}
            </div>
            <div style={{ fontSize: 11, color: "#9CA3AF" }}>
              Seller: {item.seller}
            </div>
          </div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: "#111827",
              fontFamily: "'Plus Jakarta Sans',sans-serif",
            }}
          >
            ₱{item.amount.toLocaleString()}
          </div>
        </div>

        <div>
          <label
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#374151",
              display: "block",
              marginBottom: 6,
            }}
          >
            Payment Method
          </label>
          {acceptedLabels.length > 0 && (
            <div style={{ fontSize: 11.5, color: "#6B7280", marginBottom: 8 }}>
              This seller only accepts: <strong>{acceptedLabels.join(", ")}</strong>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {methodOptions.map((m) => (
              <button
                key={m.key}
                onClick={() => setMethod(m.key)}
                style={{
                  padding: "7px 14px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  border: `2px solid ${method === m.key ? "#191BA9" : "#E5E7EB"}`,
                  background: method === m.key ? "#EEF0FF" : "#fff",
                  color: method === m.key ? "#191BA9" : "#6B7280",
                  transition: "all 0.15s",
                  fontFamily: "'Plus Jakarta Sans',sans-serif",
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {!isCash && (
          <div
            style={{
              background: "#EEF0FF",
              borderRadius: 8,
              padding: "12px 14px",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#374151",
                marginBottom: 8,
                letterSpacing: 0.5,
              }}
            >
              SEND TO
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <span style={{ fontSize: 12, color: "#6B7280" }}>
                Account Name
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>
                {sellerMethod?.accountName || sellerDetails.name}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, color: "#6B7280" }}>
                Account Number
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>
                {sellerMethod?.accountNumber || details.number}
              </span>
            </div>
            {sellerMethod?.qrUrl ? (
              <div style={{ marginTop: 10, textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 6 }}>
                  Scan to pay
                </div>
                <img
                  src={sellerMethod.qrUrl}
                  alt={`${item.seller} ${method} payment QR`}
                  style={{
                    width: 180,
                    maxWidth: "100%",
                    borderRadius: 8,
                    border: "1px solid #E5E7EB",
                    background: "#fff",
                  }}
                />
              </div>
            ) : (
              <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 8 }}>
                No QR on file for this method — use the account details above, or
                contact the seller.
              </div>
            )}
          </div>
        )}

        {isCash && (
          <>
            <div
              style={{
                background: "#FFF7ED",
                border: "1px solid #FCD34D",
                borderRadius: 8,
                padding: "10px 14px",
                fontSize: 12,
                color: "#92400E",
                lineHeight: 1.5,
              }}
            >
              {cashCoordinationReminder(method)}
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
                {method === "Cash on Delivery" ? "Delivery address" : "Meetup location"}
              </label>
              <textarea
                rows={2}
                value={handoffAddress}
                onChange={(e) => {
                  setHandoffTouched(true)
                  setHandoffAddress(e.target.value)
                }}
                placeholder="Where should the seller meet or deliver?"
                style={{
                  width: "100%",
                  fontSize: 13,
                  border: "1px solid #E5E7EB",
                  borderRadius: 7,
                  padding: "9px 12px",
                  outline: "none",
                  color: "#374151",
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                  resize: "vertical",
                }}
                className="placeholder:text-gray-400"
              />
              <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>
                Pre-filled from your default address. Edit it for this order if
                needed — your saved default won't change.
              </div>
            </div>
          </>
        )}

        {!isCash && (
          <>
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
                Reference / Transaction Number
              </label>
              <input
                value={refNo}
                onChange={(e) => setRefNo(e.target.value)}
                placeholder="e.g. GC-20260910-3821"
                style={{
                  width: "100%",
                  fontSize: 13,
                  border: "1px solid #E5E7EB",
                  borderRadius: 7,
                  padding: "9px 12px",
                  outline: "none",
                  color: "#374151",
                  fontFamily: "inherit",
                  boxSizing: "border-box" as const,
                }}
                className="placeholder:text-gray-400"
              />
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
                Account Name Used for Transfer
              </label>
              <input
                value={acctName}
                onChange={(e) => setAcctName(e.target.value)}
                placeholder="Your GCash / bank account name"
                style={{
                  width: "100%",
                  fontSize: 13,
                  border: "1px solid #E5E7EB",
                  borderRadius: 7,
                  padding: "9px 12px",
                  outline: "none",
                  color: "#374151",
                  fontFamily: "inherit",
                  boxSizing: "border-box" as const,
                }}
                className="placeholder:text-gray-400"
              />
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
                Mobile Number <span style={{ color: "#E11D2E" }}>*</span>
              </label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+63 9XX XXX XXXX"
                type="tel"
                style={{
                  width: "100%",
                  fontSize: 13,
                  border: "1px solid #E5E7EB",
                  borderRadius: 7,
                  padding: "9px 12px",
                  outline: "none",
                  color: "#374151",
                  fontFamily: "inherit",
                  boxSizing: "border-box" as const,
                }}
                className="placeholder:text-gray-400"
              />
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
                Your Facebook profile or contact link
              </label>
              <input
                value={contactLink}
                onChange={(e) => setContactLink(e.target.value)}
                placeholder="e.g. facebook.com/yourname"
                style={{
                  width: "100%",
                  fontSize: 13,
                  border: "1px solid #E5E7EB",
                  borderRadius: 7,
                  padding: "9px 12px",
                  outline: "none",
                  color: "#374151",
                  fontFamily: "inherit",
                  boxSizing: "border-box" as const,
                }}
                className="placeholder:text-gray-400"
              />
              <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>
                So the seller can reach you if there's an issue with your
                payment. Optional but recommended.
              </div>
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
                Amount Paid (₱) <span style={{ color: "#E11D2E" }}>*</span>
              </label>
              <input
                type="number"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                placeholder={String(item.amount)}
                style={{
                  width: "100%",
                  fontSize: 13,
                  border: "1px solid #E5E7EB",
                  borderRadius: 7,
                  padding: "9px 12px",
                  outline: "none",
                  color: "#374151",
                  fontFamily: "inherit",
                  boxSizing: "border-box" as const,
                }}
              />
            </div>

            <div>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#374151",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Upload Receipt / Screenshot
              </label>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleFile(f)
                }}
              />
              <div
                onClick={() => fileRef.current?.click()}
                role="button"
                tabIndex={0}
                aria-label="Upload receipt or screenshot"
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    fileRef.current?.click()
                  }
                }}
                style={{
                  border: "2px dashed #D1D5DB",
                  borderRadius: 8,
                  padding: 20,
                  textAlign: "center",
                  cursor: "pointer",
                  background: "#FAFAFA",
                }}
                onMouseEnter={(e) => {
                  ; (e.currentTarget as HTMLElement).style.borderColor =
                    "#191BA9"
                }}
                onMouseLeave={(e) => {
                  ; (e.currentTarget as HTMLElement).style.borderColor =
                    "#D1D5DB"
                }}
              >
                {uploading ? (
                  <div style={{ fontSize: 12, color: "#191BA9" }}>
                    Uploading…
                  </div>
                ) : uploaded ? (
                  <>
                    <div style={{ color: "#0B7A59", display: "flex", justifyContent: "center" }}><CheckCircle2 size={24} aria-hidden="true" /></div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#065F46",
                      }}
                    >
                      {uploaded}
                    </div>
                    <div
                      style={{ fontSize: 11, color: "#9CA3AF", marginTop: 3 }}
                    >
                      Click to replace
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ color: "#9CA3AF", display: "flex", justifyContent: "center" }}><Paperclip size={28} aria-hidden="true" /></div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#374151",
                      }}
                    >
                      Drop your receipt here or click to browse
                    </div>
                    <div
                      style={{ fontSize: 11, color: "#9CA3AF", marginTop: 3 }}
                    >
                      JPG, PNG, PDF
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}

        <div className="flex gap-3 pt-1">
          <SecondaryBtn
            style={{ flex: 1, display: "flex", justifyContent: "center", fontSize: 12 }}
            onClick={onClose}
          >
            Cancel
          </SecondaryBtn>
          <PrimaryBtn
            style={{ flex: 1, display: "flex", justifyContent: "center", fontSize: 12 }}
            onClick={() => {
              if (deadlineHasPassed(item)) {
                onClose()
                alert("This claim has expired and can no longer be paid.")
                return
              }
              onConfirm(
                method,
                isCash ? handoffAddress.trim() : refNo,
                uploadedFile ?? undefined,
              )
            }}
            disabled={
              isCash
                ? !handoffAddress.trim()
                : !refNo.trim() ||
                  !uploaded ||
                  !phone.trim() ||
                  !amountPaid.trim()
            }
          >
            {isCash ? "Confirm Order" : "Submit Payment"}
          </PrimaryBtn>
        </div>
      </div>
    </Modal>
  )
}
