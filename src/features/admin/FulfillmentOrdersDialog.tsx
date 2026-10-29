import { useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useDialogA11y } from "@/components/shared/Modal";
import { adminApi } from "@/services";
import type {
  FulfillmentAnalytics,
  FulfillmentAnalyticsFilters,
  FulfillmentAnalyticsStage as Stage,
} from "@/types/fulfillmentAnalytics";
import { useAdminResource } from "./useAdminResource";
import AdminOrderDetailModal from "./components/AdminOrderDetailModal";
import { ANALYTICS_STAGES, analyticsDate, analyticsTimestamp } from "./fulfillmentAnalyticsModel";

// Right-side drawer on desktop, bottom sheet on mobile (CSS-driven). Presentation
// only — the RPCs, snapshot handling, pagination and order drill-through are
// unchanged from the previous modal implementation.
export default function FulfillmentOrdersDialog({
  data,
  filters,
  stage,
  bucket,
  onClose,
  onRefresh,
}: {
  data: FulfillmentAnalytics;
  filters: FulfillmentAnalyticsFilters;
  stage: Stage;
  bucket?: string;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [offset, setOffset] = useState(0);
  const [orderId, setOrderId] = useState<string | null>(null);
  const dialogRef = useDialogA11y(onClose);
  const label = ANALYTICS_STAGES.find((s) => s.key === stage)!.label;
  const color = ANALYTICS_STAGES.find((s) => s.key === stage)!.color;

  if (orderId)
    return (
      <AdminOrderDetailModal
        orderId={orderId}
        onClose={() => setOrderId(null)}
        onChanged={onRefresh}
      />
    );

  return createPortal(
    <div
      className="fulfillment-orders-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${label} orders`}
        tabIndex={-1}
        className="fulfillment-orders-drawer"
      >
        <span className="fulfillment-orders-drawer__grabber" aria-hidden="true" />
        <div className="fulfillment-orders-drawer__header">
          <h2 className="fulfillment-orders-drawer__title">
            <span className="fulfillment-stage-dot" style={{ background: color }} />
            {label} orders
          </h2>
          <button
            type="button"
            className="fulfillment-orders-drawer__close"
            aria-label="Close orders"
            onClick={onClose}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="fulfillment-orders-drawer__body">
          <p className="fulfillment-analytics__muted">
            {bucket ? analyticsDate(bucket, data.grouping) : "Selected date range"} · Asia/Manila
          </p>
          <p className="fulfillment-orders__explanation">
            Orders that entered this stage in the selected period. Their current status may have
            changed.
          </p>
          <OrderPage
            key={`${offset}:${stage}:${bucket ?? "all"}:${data.snapshot}`}
            {...{ data, filters, stage, bucket, offset, setOffset, setOrderId, onRefresh }}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}

function OrderPage({
  data,
  filters,
  stage,
  bucket,
  offset,
  setOffset,
  setOrderId,
  onRefresh,
}: {
  data: FulfillmentAnalytics;
  filters: FulfillmentAnalyticsFilters;
  stage: Stage;
  bucket?: string;
  offset: number;
  setOffset: (value: number) => void;
  setOrderId: (value: string) => void;
  onRefresh: () => void;
}) {
  const page = useAdminResource(
    () =>
      adminApi.fulfillmentOrders(
        filters,
        { stage, bucket, generatedAt: data.generatedAt, snapshot: data.snapshot },
        25,
        offset,
      ),
    [],
  );
  if (page.loading)
    return (
      <p role="status" className="fulfillment-analytics__notice">
        Loading contributing orders…
      </p>
    );
  if (page.error)
    return (
      <div
        role="alert"
        className="fulfillment-analytics__notice fulfillment-analytics__notice--error"
      >
        <p>
          {/Analytics changed/i.test(page.error)
            ? "The recorded history has changed. Refresh analytics to see matching chart counts and orders."
            : page.accessDenied
              ? "Admin access is required to view these orders."
              : "We couldn’t load these orders. Please try again."}
        </p>
        <button
          type="button"
          onClick={/Analytics changed/i.test(page.error) ? onRefresh : page.refresh}
        >
          {/Analytics changed/i.test(page.error) ? "Refresh analytics" : "Try again"}
        </button>
      </div>
    );
  if (!page.data) return null;
  return (
    <>
      <p className="fulfillment-orders__count">
        {page.data.total.toLocaleString()} contributing {page.data.total === 1 ? "order" : "orders"}
      </p>
      {!page.data.rows.length && (
        <p className="fulfillment-analytics__notice">
          No recorded orders entered this stage in this period.
        </p>
      )}
      <ul className="fulfillment-orders__list">
        {page.data.rows.map((order) => (
          <li key={order.order_id}>
            <button
              type="button"
              onClick={() => setOrderId(order.order_id)}
              aria-label={`Open order ${order.order_number || order.order_id}`}
            >
              <span>
                <strong>{order.order_number || order.order_id}</strong>
                <small>Entered {analyticsTimestamp(order.occurred_at)}</small>
              </span>
              <span>
                <span className="fulfillment-orders__status">
                  {(order.current_fulfillment_stage || order.current_status).replace(/_/g, " ")}
                </span>
                <small>
                  {order.source === "transition" ? "Recorded transition" : "Recovered history"} →
                </small>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {page.data.total > 25 && (
        <nav className="fulfillment-orders__pagination" aria-label="Contributing orders pages">
          <button
            type="button"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - 25))}
          >
            Previous
          </button>
          <span>
            {offset + 1}–{Math.min(offset + 25, page.data.total)} of {page.data.total}
          </span>
          <button
            type="button"
            disabled={offset + 25 >= page.data.total}
            onClick={() => setOffset(offset + 25)}
          >
            Next
          </button>
        </nav>
      )}
    </>
  );
}
