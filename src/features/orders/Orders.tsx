import { useState } from "react"

import type { OrderRow, SharedState } from "@/types"
import { CREAM } from "@/constants/theme"
import {
  Avatar,
  Card,
  ContactModal,
  InsufficientPaymentNotice,
  SecondaryBtn,
  SH,
  StatusBadge,
  recordKeys,
  useRecordFocus,
} from "@/components/shared"
import {
  claimShortfall,
  displayClaimStatus,
} from "@/features/claims/claimPaymentState"
import {
  FulfillmentBoard,
  FulfillmentLiveRegion,
  useFulfillmentBoard,
} from "@/features/fulfillment"

import OrderDetailsModal from "./OrderDetailsModal"

export default function Orders({
  orders,
  claims,
  role,
  fulfillment,
  setFulfillment,
  payHistory,
}: SharedState) {
  const board = useFulfillmentBoard(setFulfillment)
  const [contactOrder, setContact] = useState<OrderRow | null>(null)
  const [trackOrder, setTrackOrder] = useState<OrderRow | null>(null)
  // The seller board starts with columns collapsed on small screens, so a
  // deep-linked order asks the board to open its column.
  const [focusOrderId, setFocusOrderId] = useState<string | undefined>()
  useRecordFocus("Orders", (target) => setFocusOrderId(target.orderId))

  if (role === "Seller") {
    const insufficientOrders = claims.filter(
      (claim) => claim.status === "Insufficient Payment",
    )

    return (
      <div className="seller-page-shell seller-fulfillment-page orders-page orders-page--seller">
        <SH title="Fulfillment Board" />
        <p className="orders-board-intro">
          Track all orders across fulfillment stages.
        </p>
        {insufficientOrders.length > 0 && (
          <Card className="orders-payment-issues">
            <SH title="Payment issues" />
            <div className="space-y-2">
              {insufficientOrders.map((claim) => (
                <div
                  key={claim.id}
                  className="flex flex-wrap items-center justify-between gap-2 text-[12px]"
                >
                  <span style={{ color: "#374151" }}>
                    {claim.product} · {claim.buyer || claim.seller}
                  </span>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={displayClaimStatus(claim.status)} />
                    <InsufficientPaymentNotice shortfall={claimShortfall(claim)} status={claim.status} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
        <FulfillmentBoard
          fulfillment={fulfillment}
          role="seller"
          board={board}
          expanded
          focusOrderId={focusOrderId}
        />
        <FulfillmentLiveRegion text={board.announcement} />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-5 orders-page orders-page--buyer">
      {orders.map((order) => {
        const claim = claims.find((candidate) =>
          order.dbId
            ? String(candidate.id) === String(order.dbId)
            : String(candidate.id) === String(order.id),
        )

        return (
        <Card
          key={order.id}
          className="buyer-order-card"
          recordKeys={recordKeys({ orderId: order.dbId })}
        >
          <div className="flex items-start justify-between mb-4 buyer-order-card__head">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="buyer-order-card__product">{order.product}</span>
                <span
                  style={{ background: CREAM }}
                  className="buyer-order-card__number"
                >
                  {order.id}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Avatar name={order.seller} size={18} />
                <span className="buyer-order-card__seller">
                  {order.seller}
                  {order.batch ? ` · ${order.batch}` : ""}
                </span>
              </div>
              {claim && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusBadge status={displayClaimStatus(claim.status)} />
                  <InsufficientPaymentNotice shortfall={claimShortfall(claim)} status={claim.status} />
                </div>
              )}
            </div>
            <div className="buyer-order-card__amount">
              ₱{order.amount.toLocaleString()}
            </div>
          </div>

          <div className="flex items-center justify-end">
            <div className="flex items-center gap-2">
              <SecondaryBtn onClick={() => setTrackOrder(order)}>
                Track order
              </SecondaryBtn>
              <SecondaryBtn onClick={() => setContact(order)}>
                Contact Seller
              </SecondaryBtn>
            </div>
          </div>
        </Card>
        )
      })}
      {contactOrder && (
        <ContactModal
          name={contactOrder.seller}
          context={contactOrder.product}
          contactUrl={contactOrder.sellerFb}
          onClose={() => setContact(null)}
        />
      )}
      {trackOrder && (
        <OrderDetailsModal
          order={
            orders.find((order) => order.id === trackOrder.id) ?? trackOrder
          }
          payHistory={payHistory}
          onClose={() => setTrackOrder(null)}
        />
      )}
    </div>
  )
}
