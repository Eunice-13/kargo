import type { ClaimRow } from "@/types"
import {
  LocationPinPicker,
  Modal,
  PrimaryBtn,
  SecondaryBtn,
} from "@/components/shared"

export default function RequestLocationCorrectionModal({
  claim,
  onConfirm,
  onClose,
}: {
  claim: ClaimRow
  onConfirm: () => void | Promise<void>
  onClose: () => void
}) {
  return (
    <Modal title="Request location correction" onClose={onClose} width={500}>
      <div className="space-y-4">
        <p className="text-sm leading-6 text-gray-600">
          Ask {claim.buyer || "the buyer"} to update the delivery pin. The
          reservation timer remains paused until you confirm the corrected pin
          by setting the shipping fee.
        </p>
        <LocationPinPicker
          readOnly
          value={{
            lat: claim.deliveryPinLat,
            lng: claim.deliveryPinLng,
            url: claim.deliveryPinUrl,
            address: claim.deliveryPinAddress,
          }}
        />
        <div className="flex justify-end gap-3">
          <SecondaryBtn onClick={onClose}>Cancel</SecondaryBtn>
          <PrimaryBtn onClick={onConfirm}>Send correction request</PrimaryBtn>
        </div>
      </div>
    </Modal>
  )
}
