import { useState, useRef } from "react"
import type { Role } from "@/types"
import { INDIGO, CREAM } from "@/constants/theme"
import Modal from "./Modal"
import PrimaryBtn from "./PrimaryBtn"
import SecondaryBtn from "./SecondaryBtn"

export const PAY_METHODS = ["GCash", "Maya", "Bank Transfer", "Cash on Meetup"]
export const SELLER_PAY_DETAILS: Record<string, { name: string; number: string }> = {
  GCash: { name: "Maria Santos", number: "0917 •••• 8821" },
  Maya: { name: "Maria Santos", number: "0917 •••• 5543" },
  "Bank Transfer": { name: "Maria Santos", number: "BDO •••• 4421" },
  "Cash on Meetup": { name: "", number: "" },
}
export default function PayModal({
  items,
  onConfirm,
  onClose,
}: {
  items: { product: string; amount: number }[]
  onConfirm: (method: string) => void
  onClose: () => void
}) {
  const [method, setMethod] = useState("GCash")
  const [refId, setRefId] = useState("")
  const [acctName, setAcctName] = useState("")
  const [acctNum, setAcctNum] = useState("")
  const [phone, setPhone] = useState("")
  const [amountPaid, setAmountPaid] = useState(
    String(items.reduce((s, i) => s + i.amount, 0)),
  )
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const total = items.reduce((s, i) => s + i.amount, 0)
  const isCOD = method === "Cash on Meetup"
  const details = SELLER_PAY_DETAILS[method]

  const handleFile = (file: File) => {
    setUploading(true)
    setTimeout(() => {
      setUploading(false)
      setUploaded(file.name)
    }, 1200)
  }

  const confirm = () => {
    if (!isCOD) {
      const e: Record<string, string> = {}
      if (!refId.trim()) e.refId = "Reference ID is required."
      if (!acctName.trim()) e.acctName = "Account name is required."
      if (!acctNum.trim()) e.acctNum = "Account number is required."
      if (!phone.trim()) e.phone = "Phone number is required."
      if (!amountPaid.trim()) e.amountPaid = "Amount paid is required."
      if (!uploaded) e.receipt = "Please upload your receipt."
      setErrors(e)
      if (Object.keys(e).length) return
    }
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      onConfirm(method)
    }, 1200)
  }

  const field = (
    label: string,
    val: string,
    set: (v: string) => void,
    key: string,
    placeholder: string,
    type = "text",
  ) => (
    <div>
      <label
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "#374151",
          display: "block",
          marginBottom: 4,
        }}
      >
        {label} <span style={{ color: "#E11D2E" }}>*</span>
      </label>
      <input
        type={type}
        value={val}
        onChange={(e) => {
          set(e.target.value)
          setErrors((p) => ({ ...p, [key]: "" }))
        }}
        placeholder={placeholder}
        style={{
          width: "100%",
          fontSize: 13,
          border: `1px solid ${errors[key] ? "#EF4444" : "#E5E7EB"}`,
          borderRadius: 7,
          padding: "8px 12px",
          outline: "none",
          color: "#374151",
          fontFamily: "inherit",
          boxSizing: "border-box" as const,
        }}
        className="placeholder:text-gray-400"
      />
      {errors[key] && (
        <p style={{ fontSize: 11, color: "#EF4444", marginTop: 3 }}>
          {errors[key]}
        </p>
      )}
    </div>
  )

  return (
    <Modal
      title={items.length > 1 ? "Pay All Pending" : "Confirm Payment"}
      onClose={onClose}
      width={500}
    >
      <div className="space-y-4">
        {/* Item list */}
        <div
          style={{
            background: CREAM,
            borderRadius: 8,
            border: "1px solid #EDE8E8",
          }}
          className="divide-y divide-gray-100"
        >
          {items.map((it, i) => (
            <div
              key={i}
              className="flex items-center justify-between px-4 py-3"
            >
              <span style={{ fontSize: 13, color: "#374151" }}>
                {it.product}
              </span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#111827",
                  fontFamily: "'Plus Jakarta Sans',sans-serif",
                }}
              >
                ₱{it.amount.toLocaleString()}
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between px-4 py-3">
            <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>
              Total
            </span>
            <span
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: INDIGO,
                fontFamily: "'Plus Jakarta Sans',sans-serif",
              }}
            >
              ₱{total.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Method selector */}
        <div>
          <label
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#374151",
              display: "block",
              marginBottom: 8,
            }}
          >
            Payment Method
          </label>
          <div className="grid grid-cols-2 gap-2">
            {PAY_METHODS.map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMethod(m)
                  setErrors({})
                }}
                style={{
                  border: `1.5px solid ${method === m ? INDIGO : "#E5E7EB"}`,
                  background: method === m ? "#EEF0FF" : "#fff",
                  color: method === m ? INDIGO : "#374151",
                  borderRadius: 8,
                  padding: "10px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  textAlign: "left" as const,
                }}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Seller payment details */}
        {!isCOD && (
          <div
            style={{
              background: "#EEF0FF",
              borderRadius: 8,
              padding: "12px 14px",
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "#374151",
                letterSpacing: 0.8,
                marginBottom: 8,
              }}
            >
              SEND PAYMENT TO
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
                {details.name}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, color: "#6B7280" }}>
                Account Number
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>
                {details.number}
              </span>
            </div>
          </div>
        )}

        {isCOD && (
          <div
            style={{
              background: "#FFF7ED",
              border: "1px solid #FCD34D",
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 12,
              color: "#92400E",
            }}
          >
             Coordinate pickup with the seller directly via Messenger or the
            in-app chat. No transfer required.
          </div>
        )}

        {/* Required fields — hidden for COD */}
        {!isCOD && (
          <>
            {field(
              "Reference / Transaction ID",
              refId,
              setRefId,
              "refId",
              "e.g. GC-20260910-3821",
            )}
            {field(
              "Your Account Name",
              acctName,
              setAcctName,
              "acctName",
              "Name used for the transfer",
            )}
            {field(
              "Your Account Number",
              acctNum,
              setAcctNum,
              "acctNum",
              "e.g. 09XX-XXX-XXXX",
            )}
            {field(
              "Your Mobile Number",
              phone,
              setPhone,
              "phone",
              "+63 9XX XXX XXXX",
              "tel",
            )}
            {field(
              "Amount Paid (₱)",
              amountPaid,
              setAmountPaid,
              "amountPaid",
              "e.g. 950",
              "number",
            )}

            {/* Receipt upload */}
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
                Receipt / Screenshot <span style={{ color: "#E11D2E" }}>*</span>
              </label>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) {
                    handleFile(f)
                    setErrors((p) => ({ ...p, receipt: "" }))
                  }
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
                  border: `2px dashed ${
                    errors.receipt ? "#EF4444" : "#D1D5DB"
                  }`,
                  borderRadius: 8,
                  padding: 18,
                  textAlign: "center",
                  cursor: "pointer",
                  background: "#FAFAFA",
                  transition: "border-color 0.15s",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLElement).style.borderColor = INDIGO)
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.borderColor =
                    errors.receipt ? "#EF4444" : "#D1D5DB")
                }
              >
                {uploading ? (
                  <div style={{ fontSize: 12, color: INDIGO, fontWeight: 600 }}>
                    Uploading…
                  </div>
                ) : uploaded ? (
                  <>
                    <div style={{ fontSize: 22 }}>✅</div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#065F46",
                        marginTop: 4,
                      }}
                    >
                      {uploaded}
                    </div>
                    <div
                      style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}
                    >
                      Click to replace
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 26 }}>📎</div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#374151",
                        marginTop: 4,
                      }}
                    >
                      Upload receipt or screenshot
                    </div>
                    <div
                      style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}
                    >
                      JPG, PNG, or PDF
                    </div>
                  </>
                )}
              </div>
              {errors.receipt && (
                <p style={{ fontSize: 11, color: "#EF4444", marginTop: 3 }}>
                  {errors.receipt}
                </p>
              )}
            </div>
          </>
        )}

        <div className="flex gap-3 pt-1">
          <SecondaryBtn
            style={{ flex: 1, display: "flex", justifyContent: "center" }}
            onClick={onClose}
          >
            Cancel
          </SecondaryBtn>
          <PrimaryBtn
            style={{ flex: 1, display: "flex", justifyContent: "center" }}
            onClick={confirm}
            loading={loading}
          >
            {loading
              ? "Processing…"
              : isCOD
                ? "Confirm COD Order"
                : "Submit Payment"}
          </PrimaryBtn>
        </div>
      </div>
    </Modal>
  )
}
