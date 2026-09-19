import { useState, useRef } from "react"
import type { ToPayRow } from "@/types"
import { Modal, PrimaryBtn, SecondaryBtn } from "@/components/shared"

export default function PaymentSubmitModal({
  item,
  onConfirm,
  onClose,
}: {
  item: ToPayRow
  onConfirm: (method: string, refNo: string) => void
  onClose: () => void
}) {
  const [method, setMethod] = useState("GCash")
  const [refNo, setRefNo] = useState("")
  const [acctName, setAcctName] = useState("")
  const [phone, setPhone] = useState("")
  const [amountPaid, setAmountPaid] = useState(String(item.amount))
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const SELLER_DETAILS: Record<string, {
    name: string
    number: string
    icon: string
  }> = {
    GCash: { name: "Maria Santos", number: "0917 •••• 8821", icon: "" },
    Maya: { name: "Maria Santos", number: "0917 •••• 5543", icon: "" },
    "Bank Transfer": {
      name: "Maria Santos",
      number: "BDO •••• 4421",
      icon: "",
    },
    COD: { name: "", number: "", icon: "" },
  }
  const details = SELLER_DETAILS[method]
  const isCOD = method === "COD"

  const handleFile = (file: File) => {
    setUploading(true)
    setTimeout(() => {
      setUploading(false)
      setUploaded(file.name)
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
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["GCash", "Maya", "Bank Transfer", "COD"].map((m) => (
              <button
                key={m}
                onClick={() => setMethod(m)}
                style={{
                  padding: "7px 14px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  border: `2px solid ${method === m ? "#191BA9" : "#E5E7EB"}`,
                  background: method === m ? "#EEF0FF" : "#fff",
                  color: method === m ? "#191BA9" : "#6B7280",
                  transition: "all 0.15s",
                  fontFamily: "'Plus Jakarta Sans',sans-serif",
                }}
              >
                {SELLER_DETAILS[m].icon} {m}
              </button>
            ))}
          </div>
        </div>

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
             COD: Coordinate pickup directly with the seller via Messenger or
            the in-app chat. No payment details required.
          </div>
        )}

        {!isCOD && (
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
                  ;(e.currentTarget as HTMLElement).style.borderColor =
                    "#191BA9"
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLElement).style.borderColor =
                    "#D1D5DB"
                }}
              >
                {uploading ? (
                  <div style={{ fontSize: 12, color: "#191BA9" }}>
                    Uploading…
                  </div>
                ) : uploaded ? (
                  <>
                    <div style={{ fontSize: 24 }}>✅</div>
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
                    <div style={{ fontSize: 28 }}>📎</div>
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
            style={{ flex: 1, display: "flex", justifyContent: "center" }}
            onClick={onClose}
          >
            Cancel
          </SecondaryBtn>
          <PrimaryBtn
            style={{ flex: 1, display: "flex", justifyContent: "center" }}
            onClick={() => onConfirm(method, refNo)}
            disabled={
              !isCOD &&
              (!refNo.trim() ||
                !uploaded ||
                !phone.trim() ||
                !amountPaid.trim())
            }
          >
            {isCOD ? "Confirm COD Order" : "Submit Payment"}
          </PrimaryBtn>
        </div>
      </div>
    </Modal>
  )
}
