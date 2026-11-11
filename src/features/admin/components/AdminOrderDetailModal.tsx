import { useEffect, useState } from "react";
import { Check, MapPin } from "lucide-react";
import { Modal, Avatar, CardSkeleton, ProductThumb } from "@/components/shared";
import { adminApi } from "@/services";
import { ORDER_STATUS_LABELS, toneForStatus } from "@/constants/admin";

import { useAdminResource } from "../useAdminResource";
import useIsDesktop from "../useIsDesktop";
import type { AdminOrderDetail } from "../adminTypes";
import AdminBadge from "./AdminBadge";
import AdminActionButton from "./AdminActionButton";
import AdminConfirmModal from "./AdminConfirmModal";
import { AdminEmptyText, AdminModalSection } from "./AdminFacts";

const peso = (n: number) => `₱${Math.round(n).toLocaleString()}`;
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "—");

// How much more the buyer still owes on an order that came up short.
function amountOwed(data: AdminOrderDetail): number | null {
  if (data.status !== "insufficient_payment") return null;
  const paid = data.amountPaid ?? 0;
  return Math.max(0, (data.amountDue ?? data.amount) - paid);
}

// Shows the buyer's uploaded receipt via a short-lived signed URL. Used for
// payments still under review so an admin can see the proof the buyer sent.
function PaymentReceipt({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setState("loading");
    adminApi
      .receiptUrl(path)
      .then((u) => {
        if (!active) return;
        setUrl(u);
        setState(u ? "ready" : "error");
      })
      .catch(() => active && setState("error"));
    return () => {
      active = false;
    };
  }, [path, attempt]);

  if (state === "loading") return <CardSkeleton />;
  if (state === "error" || !url) {
    return (
      <p className="admin-receipt-error">
        Receipt unavailable.{" "}
        <button
          type="button"
          className="admin-inline-link"
          onClick={() => setAttempt((n) => n + 1)}
        >
          Retry
        </button>
      </p>
    );
  }
  // Buyers can upload a PDF as well as an image; an <img> can't render a PDF.
  if (/\.pdf$/i.test(path)) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="admin-receipt admin-receipt--pdf"
        aria-label="Open payment receipt PDF in a new tab"
      >
        <span>Open PDF receipt</span>
      </a>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="admin-receipt"
      aria-label="Open payment receipt in a new tab"
    >
      <img src={url} alt="Payment receipt" />
      <span>Open full receipt</span>
    </a>
  );
}

const statusLabel = (status: string) =>
  ORDER_STATUS_LABELS[status] ?? status.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
const shortStamp = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";
const placedStamp = (iso: string) => {
  const d = new Date(iso);
  const day = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${day} · ${time}`;
};
const PAYMENT_HINT: Record<string, string> = {
  payment_pending: "Waiting for payment",
  payment_submitted: "Awaiting review",
  insufficient_payment: "Insufficient payment",
  cancelled: "Cancelled",
  expired: "Expired",
};

// Desktop: progress and payments on the left, product and people on the right.
function DesktopBody({ data }: { data: AdminOrderDetail }) {
  const closed = data.status === "cancelled" || data.status === "expired";
  const recorded = [true, data.paymentConfirmedAt != null, data.completedAt != null];
  // A finished later step implies the earlier ones happened, even if their time was never stored.
  const done = recorded.map((_, i) => recorded.slice(i).some(Boolean));
  const steps = [
    { label: "Created", done: done[0], sub: shortStamp(data.createdAt) },
    {
      label: "Payment confirmed",
      done: done[1],
      sub: data.paymentConfirmedAt
        ? shortStamp(data.paymentConfirmedAt)
        : done[1]
          ? "—"
          : (PAYMENT_HINT[data.status] ?? "—"),
    },
    { label: "Completed", done: done[2], sub: shortStamp(data.completedAt) },
  ];
  // The first unfinished step is the one the order is waiting on (none once it is closed).
  const currentIndex = closed ? -1 : steps.findIndex((step) => !step.done);
  const count = data.payments.length;
  const owed = amountOwed(data);

  return (
    <div className="admin-order">
      <div className="admin-order__col">
        <section className="admin-order__card">
          <p className="admin-order__eyebrow">Progress</p>
          <ol className="admin-order__steps">
            {steps.map((step, i) => {
              const state = step.done ? "done" : i === currentIndex ? "current" : "upcoming";
              return (
                <li key={step.label} className={`is-${state}`}>
                  <span className="admin-order__dot" aria-hidden="true">
                    {step.done && <Check size={13} strokeWidth={3} />}
                  </span>
                  <strong>{step.label}</strong>
                  <small>{step.sub}</small>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="admin-order__card">
          <div className="admin-order__head">
            <p className="admin-order__eyebrow">Payments</p>
            <span>
              {count} submission{count === 1 ? "" : "s"}
            </span>
          </div>
          {owed != null && (
            <div className="admin-order__owed">
              <span>Amount still owed</span>
              <strong>{peso(owed)}</strong>
              <small>
                {peso(data.amountPaid ?? 0)} paid of {peso(data.amountDue ?? data.amount)}
              </small>
            </div>
          )}
          {count === 0 ? (
            <div className="admin-order__empty">
              <strong>No payment submitted yet</strong>
              <p>The buyer hasn’t uploaded proof of payment.</p>
            </div>
          ) : (
            <ul className="admin-order__payments">
              {data.payments.map((p) => (
                <li key={p.id} className="admin-order__payment">
                  <div className="admin-order__payment-row">
                    <div>
                      <strong>{p.method}</strong>
                      <span>{p.referenceNumber ?? "no reference"}</span>
                    </div>
                    <AdminBadge
                      tone={toneForStatus(p.status)}
                      label={p.status.replace(/_/g, " ")}
                    />
                    <strong>{peso(p.amount)}</strong>
                  </div>
                  {p.status === "pending_review" && p.receiptPath && (
                    <PaymentReceipt path={p.receiptPath} />
                  )}
                  {p.status === "pending_review" && !p.receiptPath && (
                    <p className="admin-receipt-error">No receipt uploaded.</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="admin-order__col">
        <section className="admin-order__card">
          <div className="admin-order__product">
            <span className="admin-order__thumb">
              <ProductThumb name={data.product} />
            </span>
            <div>
              <strong>{data.product}</strong>
              <span>Qty {data.quantity}</span>
            </div>
          </div>
          <div className="admin-order__total">
            <span>Total</span>
            <strong>{peso(data.amount)}</strong>
          </div>
        </section>

        <section className="admin-order__card">
          <div className="admin-order__person">
            <Avatar name={data.buyer} size={40} />
            <div>
              <small>Buyer</small>
              <strong>{data.buyer || "—"}</strong>
            </div>
          </div>
          <div className="admin-order__person">
            <Avatar name={data.seller} size={40} />
            <div>
              <small>Seller</small>
              <strong>{data.seller || "—"}</strong>
            </div>
          </div>
          <div className="admin-order__deliver">
            <small>Deliver to</small>
            <p>{data.deliveryAddress ?? "—"}</p>
            <div>
              <span>
                <small>Tracking</small>
                <strong>{data.trackingNumber ?? "—"}</strong>
              </span>
              <span>
                <small>ETA</small>
                <strong>{data.eta ? shortStamp(data.eta) : "—"}</strong>
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function AdminOrderDetailModal({
  orderId,
  onClose,
  onChanged,
}: {
  orderId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { data, loading, error, refresh } = useAdminResource(
    () => adminApi.getOrder(orderId),
    [orderId],
  );
  const [confirming, setConfirming] = useState(false);
  const isDesktop = useIsDesktop();

  // Once payment is confirmed, no one — including admins — may cancel the order,
  // regardless of fulfillment stage. paymentConfirmedAt is the stage-independent
  // signal (set at confirmation, never cleared). Already-cancelled orders and
  // terminal states remain non-cancellable too.
  const paymentConfirmed =
    data != null &&
    (data.paymentConfirmedAt != null ||
      ["payment_confirmed", "preparing", "completed"].includes(data.status));
  // Expired orders are final, so they can never be cancelled either.
  const isFinal = data != null && data.status === "expired";
  const canCancel =
    data != null &&
    data.status !== "completed" &&
    data.status !== "cancelled" &&
    !isFinal &&
    !paymentConfirmed;
  const statusTone = data ? toneForStatus(data.status) : "info";

  return (
    <>
      <Modal
        title={isDesktop && data ? `Order ${data.orderNumber}` : "Order details"}
        titleAside={
          isDesktop && data ? (
            <AdminBadge tone={statusTone} label={statusLabel(data.status)} />
          ) : undefined
        }
        headerAside={
          isDesktop && data ? (
            <span className="admin-order__placed">Placed {placedStamp(data.createdAt)}</span>
          ) : undefined
        }
        showTitleIcon={false}
        variant="detail"
        width={isDesktop ? 980 : 640}
        className="admin-modal admin-record-modal admin-order-modal"
        overlayClassName="admin-modal-overlay admin-record-modal-overlay"
        onClose={onClose}
        footer={
          !loading && data ? (
            <div className="admin-modal-footer">
              {canCancel ? (
                <AdminActionButton action="cancelOrder" onClick={() => setConfirming(true)}>
                  Cancel order
                </AdminActionButton>
              ) : (
                <p className="admin-footer-note">
                  {data.status === "cancelled"
                    ? "This order is already cancelled."
                    : data.status === "completed"
                      ? "Completed orders cannot be cancelled."
                      : isFinal
                        ? "Expired orders cannot be cancelled."
                        : "Confirmed orders cannot be cancelled. Payment has already been verified."}
                </p>
              )}
            </div>
          ) : undefined
        }
      >
        {loading && <CardSkeleton />}
        {!loading && error && (
          <p role="alert" className="admin-form-error">
            {error}
          </p>
        )}
        {!loading && data && isDesktop && <DesktopBody data={data} />}
        {!loading && data && !isDesktop && (
          <div className="space-y-5">
            <div className="admin-detail-hero admin-order-hero">
              <span className="admin-order-hero__thumb">
                <ProductThumb name={data.product} />
              </span>
              <div className="admin-detail-hero__identity">
                <h2>{data.product}</h2>
                <p>
                  {data.orderNumber} · Qty {data.quantity}
                </p>
                <div className="admin-detail-hero__badges">
                  <AdminBadge tone={statusTone} label={data.status.replace(/_/g, " ")} />
                </div>
              </div>
              <strong className="admin-order-hero__amount">{peso(data.amount)}</strong>
            </div>

            <div className="admin-order-parties">
              <div>
                <Avatar name={data.buyer} size={36} />
                <span>
                  <small>Buyer</small>
                  <strong>{data.buyer || "—"}</strong>
                </span>
              </div>
              <div>
                <Avatar name={data.seller} size={36} />
                <span>
                  <small>Seller</small>
                  <strong>{data.seller || "—"}</strong>
                </span>
              </div>
            </div>

            <AdminModalSection title="Timeline">
              <ul className="admin-order-timeline">
                {(
                  [
                    ["Created", data.createdAt],
                    ["Payment confirmed", data.paymentConfirmedAt],
                    ["Completed", data.completedAt],
                  ] as const
                ).map(([label, at]) => (
                  <li key={label} className={at ? "is-done" : undefined}>
                    <span className="admin-order-timeline__box" aria-hidden="true" />
                    <span className="admin-order-timeline__label">{label}</span>
                    <span className="admin-order-timeline__value">{fmt(at)}</span>
                  </li>
                ))}
              </ul>
            </AdminModalSection>

            <AdminModalSection title="Delivery">
              <div className="admin-order-delivery">
                <div>
                  <span>Tracking</span>
                  <strong>{data.trackingNumber ?? "—"}</strong>
                </div>
                <div>
                  <span>ETA</span>
                  <strong>{fmt(data.eta)}</strong>
                </div>
              </div>
              <p className="admin-order-address">
                <MapPin size={16} aria-hidden="true" />
                <span>{data.deliveryAddress ?? "—"}</span>
              </p>
            </AdminModalSection>

            <AdminModalSection
              title="Payments"
              hint={`${data.payments.length} submission${data.payments.length === 1 ? "" : "s"}`}
            >
              {(() => {
                const owed = amountOwed(data);
                return owed != null ? (
                  <div className="admin-order__owed">
                    <span>Amount still owed</span>
                    <strong>{peso(owed)}</strong>
                    <small>
                      {peso(data.amountPaid ?? 0)} paid of {peso(data.amountDue ?? data.amount)}
                    </small>
                  </div>
                ) : null;
              })()}
              {data.payments.length === 0 ? (
                <AdminEmptyText>No payment submissions yet.</AdminEmptyText>
              ) : (
                <ul className="admin-order-payments">
                  {data.payments.map((p) => (
                    <li key={p.id}>
                      <div className="admin-order-payments__head">
                        <strong>{p.method}</strong>
                        <strong>{peso(p.amount)}</strong>
                      </div>
                      <div className="admin-order-payments__meta">
                        <AdminBadge
                          tone={toneForStatus(p.status)}
                          label={p.status.replace(/_/g, " ")}
                        />
                        <span>· {p.referenceNumber ?? "no reference"}</span>
                      </div>
                      {p.status === "pending_review" && p.receiptPath && (
                        <PaymentReceipt path={p.receiptPath} />
                      )}
                      {p.status === "pending_review" && !p.receiptPath && (
                        <p className="admin-receipt-error">No receipt uploaded.</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </AdminModalSection>
          </div>
        )}
      </Modal>

      {confirming && data && (
        <AdminConfirmModal
          title="Cancel order"
          consequence="This cancels the order and notifies both parties. Any money already sent is refunded outside KARGO. Orders in an active combined payment must be handled through the combined record."
          confirmLabel="Cancel order"
          confirmWord={data.orderNumber}
          action="cancelOrder"
          onConfirm={async (reason) => {
            await adminApi.cancelOrder(orderId, reason);
            setConfirming(false);
            refresh();
            onChanged();
          }}
          onClose={() => setConfirming(false)}
        />
      )}
    </>
  );
}
