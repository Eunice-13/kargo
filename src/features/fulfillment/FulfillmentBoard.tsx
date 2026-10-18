import { useState } from "react"
import { ExternalLink, PackageOpen } from "lucide-react"

import type { FulfillmentOrder } from "@/types"
import {
  BUYER_COLUMNS,
  SELLER_COLUMNS,
  STAGE_COLORS,
} from "@/constants/fulfillment"
import {
  Avatar,
  CardSkeleton,
  EmptyState,
  SecondaryBtn,
  StageChip,
  StageProgress,
  SummaryBlock,
  safeTrackingUrl,
} from "@/components/shared"

import FulfillmentDetails from "./FulfillmentDetails"
import type { useFulfillmentBoard } from "./useFulfillmentBoard"

type BoardController = ReturnType<typeof useFulfillmentBoard>

export default function FulfillmentBoard({
  fulfillment,
  role,
  board,
  expanded = false,
  loading = false,
  onExpand,
  onOpenProfile,
  onViewOrder,
}: {
  fulfillment: FulfillmentOrder[]
  role: "seller" | "buyer"
  board: BoardController
  expanded?: boolean
  loading?: boolean
  onExpand?: () => void
  onOpenProfile?: (order: FulfillmentOrder) => void
  onViewOrder?: (order: FulfillmentOrder) => void
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const columns = role === "seller" ? SELLER_COLUMNS : BUYER_COLUMNS
  const scopedOrders = fulfillment.filter((order) => order.perspective === role)

  if (loading) {
    return (
      <div className="fulfillment-board is-loading" aria-label="Loading fulfillment board">
        {columns.map((column) => (
          <div className="fulfillment-board__column" key={column}>
            <div className="fulfillment-board__column-head">
              <span>{column}</span>
            </div>
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ))}
      </div>
    )
  }

  if (scopedOrders.length === 0) {
    return (
      <div>
        <EmptyState
          icon={PackageOpen}
          title="No fulfillment orders yet"
          message={
            role === "buyer"
              ? "Your paid and reserved orders will appear here as sellers prepare and ship them."
              : "Paid orders will appear here when they are ready for fulfillment."
          }
        />
      </div>
    )
  }

  return (
    <>
      <div className={`fulfillment-board${expanded ? " is-expanded" : ""}`}>
        {columns.map((column) => {
          const columnOrders = scopedOrders.filter((order) => order.col === column)
          const visibleOrders = expanded ? columnOrders : columnOrders.slice(0, 3)
          return (
            <section className="fulfillment-board__column" key={column}>
              <header
                className="fulfillment-board__column-head"
                style={{ background: STAGE_COLORS[column].background }}
              >
                <span style={{ color: STAGE_COLORS[column].foreground }}>
                  {column}
                </span>
                <span>{columnOrders.length}</span>
                <button
                  type="button"
                  className="fulfillment-board__collapse"
                  aria-label={`${collapsed[column] ? "Expand" : "Collapse"} ${column}`}
                  aria-expanded={!collapsed[column]}
                  onClick={() =>
                    setCollapsed((current) => ({
                      ...current,
                      [column]: !current[column],
                    }))
                  }
                />
              </header>
              <div
                className="fulfillment-board__cards"
                data-collapsed={collapsed[column] ? "true" : undefined}
              >
                {visibleOrders.map((order) => {
                  const isOpen = board.expandedId === order.id
                  const trackingUrl = safeTrackingUrl(order.trackingUrl)
                  return (
                    <article className="fulfillment-board__card" key={order.id}>
                      <button
                        type="button"
                        className="fulfillment-board__card-trigger"
                        onClick={() => board.toggle(order.id)}
                        aria-expanded={isOpen}
                        aria-label={`${isOpen ? "Collapse" : "Expand"} ${order.product}`}
                      >
                        <div className="fulfillment-board__identity">
                          <Avatar
                            name={role === "seller" ? order.buyer : order.seller || "Seller"}
                            size={22}
                          />
                          <span>
                            {role === "seller" ? order.buyer : order.seller || "Seller"}
                          </span>
                        </div>
                        <strong>{order.product}</strong>
                        <div className="fulfillment-board__meta">
                          <span>×{order.qty}</span>
                          <b>₱{order.amount.toLocaleString()}</b>
                        </div>
                        <StageChip stage={order.col} />
                        {role === "buyer" && (
                          <StageProgress
                            stages={BUYER_COLUMNS}
                            current={order.col}
                            compact
                          />
                        )}
                      </button>
                      {role === "seller" && onOpenProfile && (
                        <button
                          type="button"
                          className="fulfillment-board__profile-link"
                          onClick={() => onOpenProfile(order)}
                        >
                          View buyer profile
                        </button>
                      )}
                      {isOpen && role === "seller" && (
                        <FulfillmentDetails
                          order={order}
                          onMove={board.move}
                          onSaveTracking={board.saveTracking}
                        />
                      )}
                      {isOpen && role === "buyer" && (
                        <div className="fulfillment-board__buyer-details">
                          <SummaryBlock
                            title={order.product}
                            product={order.product}
                            details={[
                              `${order.seller || "Seller"} · ×${order.qty}`,
                              `₱${order.amount.toLocaleString()}`,
                            ]}
                          />
                          <StageProgress stages={BUYER_COLUMNS} current={order.col} />
                          {(order.courierCompany || order.trackingNumber || order.eta) && (
                            <dl className="fulfillment-board__tracking">
                              {order.courierCompany && (
                                <div><dt>Courier</dt><dd>{order.courierCompany}</dd></div>
                              )}
                              {order.trackingNumber && (
                                <div><dt>Tracking number</dt><dd>{order.trackingNumber}</dd></div>
                              )}
                              {order.eta && (
                                <div><dt>Estimated arrival</dt><dd>{new Date(order.eta).toLocaleString()}</dd></div>
                              )}
                            </dl>
                          )}
                          <div className="fulfillment-board__actions">
                            {trackingUrl && (
                              <a href={trackingUrl} target="_blank" rel="noreferrer">
                                Track shipment <ExternalLink size={13} aria-hidden="true" />
                              </a>
                            )}
                            {onViewOrder && (
                              <SecondaryBtn onClick={() => onViewOrder(order)}>
                                View Order
                              </SecondaryBtn>
                            )}
                          </div>
                        </div>
                      )}
                    </article>
                  )
                })}
                {columnOrders.length === 0 && (
                  <span className="fulfillment-board__column-empty">No orders</span>
                )}
                {!expanded && columnOrders.length > 3 && onExpand && (
                  <button
                    type="button"
                    className="fulfillment-board__more"
                    onClick={onExpand}
                  >
                    +{columnOrders.length - 3} more
                  </button>
                )}
              </div>
            </section>
          )
        })}
      </div>
    </>
  )
}
