import { useState } from "react";
import Modal from "@/components/shared/Modal";
import { adminApi } from "@/services";
import type { FulfillmentAnalytics, FulfillmentAnalyticsFilters, FulfillmentAnalyticsStage as Stage } from "@/types/fulfillmentAnalytics";
import { useAdminResource } from "./useAdminResource";
import AdminOrderDetailModal from "./components/AdminOrderDetailModal";
import { ANALYTICS_STAGES, analyticsDate, analyticsTimestamp } from "./fulfillmentAnalyticsModel";

export default function FulfillmentOrdersDialog({ data, filters, stage, bucket, onClose, onRefresh }: {
  data: FulfillmentAnalytics; filters: FulfillmentAnalyticsFilters; stage: Stage; bucket?: string;
  onClose: () => void; onRefresh: () => void;
}) {
  const [offset, setOffset] = useState(0);
  const [orderId, setOrderId] = useState<string | null>(null);
  const label = ANALYTICS_STAGES.find(s => s.key === stage)!.label;
  if (orderId) return <AdminOrderDetailModal orderId={orderId} onClose={() => setOrderId(null)} onChanged={onRefresh} />;
  return <Modal title={`${label} orders`} variant="detail" width={760} onClose={onClose} className="fulfillment-orders-dialog">
    <p className="fulfillment-analytics__muted">{bucket ? analyticsDate(bucket, data.grouping) : "Selected date range"} · Asia/Manila</p>
    <p className="fulfillment-orders__explanation">Orders that entered this stage in the selected period. Their current status may have changed.</p>
    <OrderPage key={`${offset}:${stage}:${bucket ?? "all"}:${data.snapshot}`} {...{ data, filters, stage, bucket, offset, setOffset, setOrderId, onRefresh }} />
  </Modal>;
}
function OrderPage({ data, filters, stage, bucket, offset, setOffset, setOrderId, onRefresh }: {
  data: FulfillmentAnalytics; filters: FulfillmentAnalyticsFilters; stage: Stage; bucket?: string; offset: number;
  setOffset: (value: number) => void; setOrderId: (value: string) => void; onRefresh: () => void;
}) {
  const page = useAdminResource(() => adminApi.fulfillmentOrders(filters, { stage, bucket, generatedAt: data.generatedAt, snapshot: data.snapshot }, 25, offset), []);
  if (page.loading) return <p role="status" className="fulfillment-analytics__notice">Loading contributing orders…</p>;
  if (page.error) return <div role="alert" className="fulfillment-analytics__notice">
    <p>{/Analytics changed/i.test(page.error) ? "The recorded history has changed. Refresh analytics to see matching chart counts and orders." : page.accessDenied ? "Admin access is required to view these orders." : "We couldn’t load these orders. Please try again."}</p>
    <button type="button" onClick={/Analytics changed/i.test(page.error) ? onRefresh : page.refresh}>{/Analytics changed/i.test(page.error) ? "Refresh analytics" : "Try again"}</button>
  </div>;
  if (!page.data) return null;
  return <>
    <p className="fulfillment-orders__count">{page.data.total.toLocaleString()} contributing {page.data.total === 1 ? "order" : "orders"}</p>
    {!page.data.rows.length && <p className="fulfillment-analytics__notice">No recorded orders entered this stage in this period.</p>}
    <ul className="fulfillment-orders__list">{page.data.rows.map(order => <li key={order.order_id}>
      <button type="button" onClick={() => setOrderId(order.order_id)} aria-label={`Open order ${order.order_number || order.order_id}`}>
        <span><strong>{order.order_number || order.order_id}</strong><small>Entered {analyticsTimestamp(order.occurred_at)}</small></span>
        <span><span className="fulfillment-orders__status">{(order.current_fulfillment_stage || order.current_status).replace(/_/g, " ")}</span><small>{order.source === "transition" ? "Recorded transition" : "Recovered history"} →</small></span>
      </button>
    </li>)}</ul>
    {page.data.total > 25 && <nav className="fulfillment-orders__pagination" aria-label="Contributing orders pages">
      <button type="button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 25))}>Previous</button>
      <span>{offset + 1}–{Math.min(offset + 25, page.data.total)} of {page.data.total}</span>
      <button type="button" disabled={offset + 25 >= page.data.total} onClick={() => setOffset(offset + 25)}>Next</button>
    </nav>}
  </>;
}
