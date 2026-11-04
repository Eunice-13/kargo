import type { ClaimRow } from "@/types";
import Modal from "@/components/shared/Modal";
import SecondaryBtn from "@/components/shared/SecondaryBtn";
import { productImageUrl } from "@/components/shared/ProductThumb";

export default function CombinedDeliveryDetailsModal({
  items,
  imageForClaim,
  onClose,
}: {
  items: ClaimRow[];
  imageForClaim: (claim: ClaimRow) => string | undefined;
  onClose: () => void;
}) {
  return (
    <Modal title="Combined delivery details" variant="detail" width={560} onClose={onClose}>
      <p className="mb-4 text-sm text-[var(--kargo-muted)]">
        Items sharing this delivery. Quantities are shown for each reservation.
      </p>
      <ul className="grid gap-3" aria-label="Items in this combined delivery">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-start gap-4 rounded-xl border border-[var(--kargo-line)] p-3 text-left"
          >
            <img
              src={productImageUrl(item.product, 240, imageForClaim(item))}
              alt={item.product}
              className="h-20 w-20 shrink-0 rounded-lg bg-gray-100 object-cover"
            />
            <div className="min-w-0 text-sm">
              <p className="break-words font-semibold text-[var(--kargo-ink)]">{item.product}</p>
              <p className="mt-1 text-[var(--kargo-ink-soft)]">Qty: {item.qty}</p>
              <p className="mt-1 break-words text-xs text-[var(--kargo-muted)]">{item.batch}</p>
            </div>
          </li>
        ))}
      </ul>
      {!items.length && (
        <p role="status" className="text-sm text-[var(--kargo-muted)]">
          Item details are unavailable. Refresh the page to try again.
        </p>
      )}
      <div className="mt-5 flex justify-end">
        <SecondaryBtn onClick={onClose}>Close</SecondaryBtn>
      </div>
    </Modal>
  );
}
