import { Modal, PrimaryBtn, SecondaryBtn } from "@/components/shared"
import type { PayMethod } from "./paymentMethodTypes"
import QrUploadField from "./QrUploadField"
import { isCashMethod } from "./buyerPaymentMethods"

type EditPaymentMethodModalProps = {
  editTarget: PayMethod
  editName: string
  setEditName: (v: string) => void
  editNum: string
  setEditNum: (v: string) => void
  editQr?: File | null
  setEditQr?: (v: File | null) => void
  pmLoading: boolean
  saveEdit: () => void
  onClose: () => void
}

export default function EditPaymentMethodModal({
  editTarget,
  editName,
  setEditName,
  editNum,
  setEditNum,
  editQr,
  setEditQr,
  pmLoading,
  saveEdit,
  onClose,
}: EditPaymentMethodModalProps) {
  const isBank = editTarget.name.toLowerCase().includes("bank")
  const isCash = isCashMethod(editTarget.name)
  return (
    <Modal title="Edit Payment Method" onClose={onClose} width={420}>
      <div className="space-y-4">
        <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.5 }}>
          Update the details for <strong>{editTarget.name}</strong>. Changes
          apply to future orders — buyers will see the new details at checkout.
          {editTarget.verified && (
            <>
              {" "}
              Editing the account will reset it to unverified until you confirm
              ownership again.
            </>
          )}
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
            Account Name
          </label>
          <input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
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
            {isBank ? "Account Number" : "Mobile Number"}
          </label>
          <input
            value={editNum}
            onChange={(e) => setEditNum(e.target.value)}
            placeholder={
              isBank ? "e.g. 1234-5678-9012" : "e.g. 09XX-XXX-XXXX"
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
        {!isCash && setEditQr && (
          <QrUploadField
            file={editQr ?? null}
            setFile={setEditQr}
            currentUrl={editTarget.qrUrl}
          />
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
            onClick={saveEdit}
            loading={pmLoading}
            disabled={!editName.trim() || !editNum.trim()}
          >
            Save Changes
          </PrimaryBtn>
        </div>
      </div>
    </Modal>
  )
}
