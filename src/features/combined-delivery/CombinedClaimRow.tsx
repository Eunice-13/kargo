import Avatar from "@/components/shared/Avatar";
import Card from "@/components/shared/Card";
import StatusBadge from "@/components/shared/StatusBadge";
import ProductThumb from "@/components/shared/ProductThumb";
import { recordKeys } from "@/components/shared/useRecordFocus";
import type { CombinedDeliveryRequest } from "@/types/combinedDelivery";
import { displayClaimStatus } from "@/features/claims/claimPaymentState";

/** Compact horizontal card for combined delivery items in the My Claims list */
export default function CombinedClaimRow({
  request,
  seller,
  imageForOrder,
  onDetails,
}: {
  request: CombinedDeliveryRequest;
  seller: string;
  imageForOrder: (id: string) => string | undefined;
  onDetails: () => void;
}) {
  const first = request.members[0];
  const itemCount = request.members.length;
  
  // Determine status from payment state
  const account = request.payment;
  const status = account?.status === "pending_review" ? "Awaiting Verification" : "Pending";
  
  return (
    <Card
      recordKeys={recordKeys({
        combinedGroupId: request.id,
        orderIds: request.members.map((member) => member.order_id),
      })}
    >
      <div className="claims-card__summary flex items-start gap-3">
        <button
          type="button"
          className="buyer-claim-item-preview-trigger"
          aria-label="View combined delivery details"
          onClick={onDetails}
        >
          <ProductThumb
            name="Combined Delivery"
            imageUrl={first ? imageForOrder(first.order_id) : undefined}
          />
        </button>
        <div className="claims-card__info min-w-0 flex-1">
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#111827",
              fontFamily: "'Josefin Sans',sans-serif",
            }}
          >
            <button
              type="button"
              className="buyer-claim-item-preview-name"
              onClick={onDetails}
            >
              Combined Delivery · {itemCount} {itemCount === 1 ? "item" : "items"}
            </button>
          </div>
          <div
            className="claims-card__seller"
            style={{ fontSize: 11, color: "#6B7280", marginTop: 1 }}
          >
            Seller: {seller}
          </div>
        </div>
        <div className="claims-card__status">
          <StatusBadge status={displayClaimStatus(status as any)} />
        </div>
      </div>
      <div
        style={{
          marginTop: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontSize: 14,
            fontWeight: 800,
            color: "#111827",
            fontFamily: "'Josefin Sans',sans-serif",
          }}
        >
          {account?.total
            ? `₱${Number(account.total).toLocaleString()}`
            : "—"}
        </span>
        <button
          type="button"
          onClick={onDetails}
          style={{
            fontSize: 11,
            color: "#246B8F",
            fontWeight: 600,
            background: "none",
            border: "none",
            cursor: "pointer",
            textDecoration: "underline",
            padding: 0,
          }}
        >
          View details
        </button>
      </div>
    </Card>
  );
}
