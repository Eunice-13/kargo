import { useState, useRef, useEffect } from "react"
import { CheckCircle2, Paperclip } from "lucide-react"
import type { ToPayRow } from "@/types"
import { Modal, PrimaryBtn, SecondaryBtn } from "@/components/shared"
import { deadlineHasPassed } from "@/features/claims/claimExpiry"
import { isSupabaseConfigured } from "@/lib/supabase"
import { kargoApi } from "@/services"
import type { SellerReceiveMethod } from "@/services/kargoApi"

// Cash methods (Meetup / Delivery) carry no online-payment details; the buyer
// just coordinates with the seller. Keep their real label as the method key.

export type PaymentSubmissionDetails = {
  amountPaid: number
  payerAccountName?: string
  payerPhone?: string
  buyerContactUrl?: string
}

export default function PaymentSubmitModal({
  item,
  onConfirm,
  onClose,
  contactPrefill = "",
}: {
  item: ToPayRow
  onConfirm: (
    method: string,
    refNo: string,
    receipt: File | undefined,
    details: PaymentSubmissionDetails,
  ) => unknown | Promise<unknown>
  onClose: () => void
  contactPrefill?: string
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
  const [methodOptions, setMethodOptions] = useState<SellerReceiveMethod[]>(
    isSupabaseConfigured
      ? []
      : [
          { methodType: "GCash", accountName: null, accountNumber: null },
          { methodType: "Maya", accountName: null, accountNumber: null },
          { methodType: "Bank Transfer", accountName: null, accountNumber: null },
          { methodType: "Cash on Meetup", accountName: null, accountNumber: null },
        ],
  )
  const [method, setMethod] = useState(isSupabaseConfigured ? "" : "GCash")
  const [methodsError, setMethodsError] = useState<string | null>(null)
  const [refNo, setRefNo] = useState("")
  const [acctName, setAcctName] = useState("")
  const [phone, setPhone] = useState("")
  const [contactLink, setContactLink] = useState(contactPrefill)
  const [amountPaid, setAmountPaid] = useState(String(item.amount))
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState<string | null>(null)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isSupabaseConfigured) return
    if (!item.sellerId) {
      setMethodsError("The seller account could not be identified.")
      return
    }
    kargoApi
      .loadSellerReceiveMethods(item.sellerId)
      .then((methods) => {
        setMethodOptions(methods)
        setMethod(methods[0]?.methodType ?? "")
        setMethodsError(
          methods.length === 0
            ? "This seller has not configured a payment method yet."
            : null,
        )
      })
      .catch((error) =>
        setMethodsError(
          error instanceof Error
            ? error.message
            : "Unable to load the seller's payment methods.",
        ),
      )
  }, [item.sellerId])

  const isCash = method === "Cash on Meetup" || method === "Cash on Delivery"
  const numericAmountPaid = Number(amountPaid)
  const hasValidAmount = Number.isFinite(numericAmountPaid) && numericAmountPaid > 0

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
              fontFamily: "'Josefin Sans',sans-serif",
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
          <div style={{ fontSize: 11.5, color: "#6B7280", marginBottom: 8 }}>
            Select your payment method
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {methodOptions.map((m) => (
              <button
                key={`${m.methodType}-${m.accountNumber ?? "cash"}`}
                onClick={() => setMethod(m.methodType)}
                style={{
                  padding: "7px 14px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  border: `2px solid ${method === m.methodType ? "#191BA9" : "#E5E7EB"}`,
                  background: method === m.methodType ? "#EEF0FF" : "#fff",
                  color: method === m.methodType ? "#191BA9" : "#6B7280",
                  transition: "all 0.15s",
                  fontFamily: "'Josefin Sans',sans-serif",
                }}
              >
                {m.methodType}
              </button>
            ))}
          </div>
          {methodsError && (
            <div role="alert" style={{ marginTop: 8, color: "#B91C1C", fontSize: 11.5 }}>
              {methodsError}
            </div>
          )}
          {methodOptions.find((option) => option.methodType === method) &&
            !isCash && (
              <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 7, background: "#F9FAFB", color: "#374151", fontSize: 11.5 }}>
                {[
                  methodOptions.find((option) => option.methodType === method)?.accountName,
                  methodOptions.find((option) => option.methodType === method)?.accountNumber,
                ].filter(Boolean).join(" · ")}
              </div>
            )}
        </div>

        {isCash && (
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
            Please coordinate directly with the seller to arrange {method === "Cash on Delivery" ? "delivery" : "the meetup"} and payment.
          </div>
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
              <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 5 }}>
                Enter the exact reference from your transaction. Each payment
                needs its own reference — you cannot reuse one already submitted
                for this order.
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
                min="0.01"
                step="0.01"
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
            onClick={async () => {
              if (deadlineHasPassed(item)) {
                onClose()
                alert("This claim has expired and can no longer be paid.")
                return
              }
              setSubmitting(true)
              try {
                await onConfirm(
                  method,
                  refNo,
                  uploadedFile ?? undefined,
                  {
                    amountPaid: numericAmountPaid,
                    payerAccountName: acctName.trim() || undefined,
                    payerPhone: phone.trim() || undefined,
                    buyerContactUrl: contactLink.trim() || undefined,
                  },
                )
              } finally {
                setSubmitting(false)
              }
            }}
            disabled={
              submitting || !method || (!isCash
                ? !refNo.trim() ||
                  !uploaded ||
                  !phone.trim() ||
                  !hasValidAmount
                : false)
            }
          >
            {submitting ? "Submitting..." : isCash ? "Confirm Order" : "Submit Payment"}
          </PrimaryBtn>
        </div>
      </div>
    </Modal>
  )
}
