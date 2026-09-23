import { Modal, PrimaryBtn, SecondaryBtn } from "@/components/shared"
import QrUploadField from "./QrUploadField"
import { isCashMethod } from "./buyerPaymentMethods"

type AddPaymentMethodModalProps = {
  pmType: string
  setPmType: (v: string) => void
  pmName: string
  setPmName: (v: string) => void
  pmNum: string
  setPmNum: (v: string) => void
  pmQr: File | null
  setPmQr: (v: File | null) => void
  pmLoading: boolean
  addPayMethod: () => void
  setShowAddPM: (v: boolean) => void
}

export default function AddPaymentMethodModal({
  pmType,
  setPmType,
  pmName,
  setPmName,
  pmNum,
  setPmNum,
  pmQr,
  setPmQr,
  pmLoading,
  addPayMethod,
  setShowAddPM,
}: AddPaymentMethodModalProps) {
  // Cash methods (Meetup / Delivery) are label-only — no name/number/QR needed.
  const isCash = isCashMethod(pmType)
  return (
    <Modal
      title="Add Payment Method"
      onClose={() => setShowAddPM(false)}
      width={420}
    >
      <div className="space-y-4">
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
            Method Type
          </label>
          <select
            value={pmType}
            onChange={(e) => setPmType(e.target.value)}
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
            {["GCash", "Maya", "Bank Transfer", "Cash on Meetup", "Cash on Delivery"].map(
              (t) => (
                <option key={t}>{t}</option>
              ),
            )}
          </select>
        </div>
        {isCash ? (
          <div
            style={{
              fontSize: 12,
              color: "#6B7280",
              background: "#F9FAFB",
              border: "1px solid #E5E7EB",
              borderRadius: 8,
              padding: "10px 12px",
              lineHeight: 1.5,
            }}
          >
            No account details needed. Buyers who pick Cash on Meetup will
            coordinate the handoff with you directly.
          </div>
        ) : (
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
                Account Name
              </label>
              <input
                value={pmName}
                onChange={(e) => setPmName(e.target.value)}
                placeholder="Full name on account"
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
                {pmType === "Bank Transfer" ? "Account Number" : "Mobile Number"}
              </label>
              <input
                value={pmNum}
                onChange={(e) => setPmNum(e.target.value)}
                placeholder={
                  pmType === "Bank Transfer"
                    ? "e.g. 1234-5678-9012"
                    : "e.g. 09XX-XXX-XXXX"
                }
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
                }}
                className="placeholder:text-gray-400"
              />
            </div>
            <QrUploadField file={pmQr} setFile={setPmQr} />
          </>
        )}
        <div className="flex gap-3 pt-1">
          <SecondaryBtn
            style={{ flex: 1, display: "flex", justifyContent: "center" }}
            onClick={() => setShowAddPM(false)}
          >
            Cancel
          </SecondaryBtn>
          <PrimaryBtn
            style={{ flex: 1, display: "flex", justifyContent: "center" }}
            onClick={addPayMethod}
            loading={pmLoading}
            disabled={!isCash && (!pmName.trim() || !pmNum.trim())}
          >
            Add Method
          </PrimaryBtn>
        </div>
      </div>
    </Modal>
  )
}
