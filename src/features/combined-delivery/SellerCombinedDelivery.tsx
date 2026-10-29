import "./combinedDelivery.css";
import DeliveryAvailabilityNotice from "./DeliveryAvailabilityNotice";
import { deliveryFailureMessage, unavailableDeliveryBackend } from "./availability";
import { useCallback, useEffect, useRef, useState } from "react";
import Modal from "@/components/shared/Modal";
import Card from "@/components/shared/Card";
import { recordKeys } from "@/components/shared/useRecordFocus";
import PrimaryBtn from "@/components/shared/PrimaryBtn";
import SecondaryBtn from "@/components/shared/SecondaryBtn";
import PillTrigger from "@/components/shared/PillTrigger";
import { Truck } from "lucide-react";
import {
  loadSellerDeliveryRequests,
  reviewDeliveryRequest,
  recoverCombinedDeliveryRequest,
} from "@/services/combinedDelivery";
import { supabase } from "@/lib/supabase";
import type { SellerDeliveryRequest } from "@/types/combinedDelivery";

const money = (value: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);
const paymentLabels = {
  ready: "Awaiting payment",
  pending_review: "Awaiting verification",
  rejected: "Payment rejected",
  verified: "Payment verified",
  expired: "Payment deadline expired",
  invalidated: "No longer eligible",
};
const labels = {
  pending_approval: "Awaiting review",
  awaiting_shipping_fee: "Approved · shipping fee needed",
  shipping_fee_set: "Shared shipping fee set",
  rejected: "Rejected",
  cancelled: "Cancelled",
  invalidated: "No longer eligible",
  paid: "Payment verified",
};
const failureMessage = (failure: unknown) =>
  failure && typeof failure === "object" && "message" in failure
    ? String(failure.message)
    : "Unable to update this request. Please try again.";

export function SellerDeliveryDialog({
  request,
  onClose,
  onUpdated,
  actionsDisabled = false,
  onBackendUnavailable,
}: {
  request: SellerDeliveryRequest;
  onClose: () => void;
  onUpdated: (request: SellerDeliveryRequest) => void;
  actionsDisabled?: boolean;
  onBackendUnavailable?: (failure: unknown) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const [fee, setFee] = useState("");
  const inFlight = useRef(false);
  const subtotal =
    request.members.reduce((sum, item) => sum + Math.round(item.item_subtotal * 100), 0) / 100;
  async function act(action: "approve" | "reject" | "set_shipping_fee" | "recover") {
    if (inFlight.current || actionsDisabled) return;
    if (
      action === "set_shipping_fee" &&
      (!/^\d+(\.\d{1,2})?$/.test(fee) || Number(fee) > 9999999999.99)
    ) {
      setError("Enter a valid shipping fee with at most two decimal places.");
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const updated =
        action === "recover"
          ? await recoverCombinedDeliveryRequest(request.id)
          : await reviewDeliveryRequest(
              request.id,
              action,
              reason,
              action === "set_shipping_fee" ? Number(fee) : undefined,
            );
      onUpdated({ ...request, ...updated });
    } catch (failure) {
      if (unavailableDeliveryBackend(failure)) onBackendUnavailable?.(failure);
      setError(
        unavailableDeliveryBackend(failure)
          ? deliveryFailureMessage(failure)
          : failureMessage(failure),
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Combined delivery request"
      variant="confirm"
      width={560}
      onClose={() => {
        if (!inFlight.current) onClose();
      }}
    >
      <div className="combined-delivery-dialog space-y-4 text-sm text-[var(--kargo-ink-soft)]">
        <div>
          <p className="font-semibold break-words">{request.buyerName || "Buyer"}</p>
          <p className="text-xs break-words text-[var(--kargo-muted)]">
            {request.batchName} · {request.payment_method}
          </p>
          <p className="mt-1 text-xs font-semibold">
            {request.payment ? paymentLabels[request.payment.status] : labels[request.status]}
          </p>
        </div>
        <ul className="divide-y divide-[var(--kargo-line)]">
          {request.members.map((member) => (
            <li key={member.order_id} className="flex min-w-0 justify-between gap-3 py-2 text-xs">
              <div className="min-w-0">
                <p className="break-words font-semibold">
                  {member.order?.batch_products?.name || "Reserved product"}
                </p>
                <p>Qty: {member.order?.quantity ?? "—"}</p>
              </div>
              <span className="shrink-0 tabular-nums">{money(member.item_subtotal)}</span>
            </li>
          ))}
        </ul>
        <div className="text-xs">
          <p className="font-semibold">Confirmed delivery destination</p>
          <p className="break-words">{request.destination.address_text}</p>
          <p className="text-[var(--kargo-muted)]">
            Pin: {request.destination.pin_lat}, {request.destination.pin_lng}
          </p>
        </div>
        <dl className="space-y-1 border-t border-[var(--kargo-line)] pt-3 text-xs">
          <div className="flex justify-between gap-3">
            <dt>Items subtotal</dt>
            <dd>{money(subtotal)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>Shared shipping fee</dt>
            <dd>{request.shipping_fee === null ? "Not assigned" : money(request.shipping_fee)}</dd>
          </div>
          {request.shipping_fee !== null && (
            <div className="flex justify-between gap-3 font-semibold">
              <dt>
                {request.status === "invalidated" ? "Previous combined total" : "Group total"}
              </dt>
              <dd>
                {money((Math.round(subtotal * 100) + Math.round(request.shipping_fee * 100)) / 100)}
              </dd>
            </div>
          )}
        </dl>
        {request.status === "pending_approval" && (
          <label className="block text-xs font-semibold">
            Rejection reason (optional)
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              disabled={busy}
              className="mt-1 w-full rounded-lg border border-[var(--kargo-line)] bg-[var(--kargo-surface)] p-2 font-normal focus-visible:outline-2 focus-visible:outline-[var(--kargo-focus)]"
            />
          </label>
        )}
        {request.status === "awaiting_shipping_fee" && (
          <label className="block text-xs font-semibold">
            One shared shipping fee (PHP)
            <input
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              inputMode="decimal"
              disabled={busy}
              placeholder="0.00"
              className="mt-1 min-h-11 w-full rounded-lg border border-[var(--kargo-line)] bg-[var(--kargo-surface)] px-3 focus-visible:outline-2 focus-visible:outline-[var(--kargo-focus)]"
            />
            <span className="mt-1 block font-normal text-[var(--kargo-muted)]">
              Saved once for this delivery group, never added to each reservation.
            </span>
          </label>
        )}
        {request.status === "shipping_fee_set" && (
          <p className="text-xs text-[var(--kargo-muted)]">
            {request.payment
              ? "Combined payment is available in the buyer’s Pending Payments. Submitted proofs can be reviewed in Payments."
              : "The shared fee is saved. Payment availability is being refreshed."}
          </p>
        )}
        {["awaiting_shipping_fee", "shipping_fee_set"].includes(request.status) &&
          request.payment?.status !== "pending_review" && (
            <p className="text-xs text-[var(--kargo-muted)]">
              If this request is no longer eligible, check eligibility to return its reservations to
              individual shipping. Valid approved requests stay unchanged.
            </p>
          )}
        {request.status === "invalidated" && (
          <p className="text-xs text-[var(--kargo-muted)]">
            Reservations have returned to individual shipping. Any previous shared fee is historical
            and is not charged to individual reservations.
          </p>
        )}
        {request.decision_reason && (
          <p className="break-words text-xs">{request.decision_reason}</p>
        )}
        {error && (
          <p role="alert" className="text-xs text-red-700">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          {["awaiting_shipping_fee", "shipping_fee_set"].includes(request.status) &&
            request.payment?.status !== "pending_review" && (
              <SecondaryBtn disabled={busy || actionsDisabled} onClick={() => void act("recover")}>
                {busy ? "Checking…" : "Check eligibility and recover"}
              </SecondaryBtn>
            )}
          <SecondaryBtn disabled={busy} onClick={onClose}>
            Close
          </SecondaryBtn>
          {request.status === "pending_approval" && (
            <>
              <SecondaryBtn disabled={busy || actionsDisabled} onClick={() => void act("reject")}>
                Reject request
              </SecondaryBtn>
              <PrimaryBtn
                disabled={busy || actionsDisabled}
                loading={busy}
                onClick={() => void act("approve")}
              >
                Approve request
              </PrimaryBtn>
            </>
          )}
          {request.status === "awaiting_shipping_fee" && (
            <PrimaryBtn
              disabled={busy || actionsDisabled || !fee}
              loading={busy}
              onClick={() => void act("set_shipping_fee")}
            >
              Save shared fee
            </PrimaryBtn>
          )}
        </div>
      </div>
    </Modal>
  );
}

// The seller's combined delivery requests, behind a "Combined Delivery" pill in
// the page heading (the same control as the buyer's "My Group Orders"). The
// request cards live in a modal so the page itself stays about orders.
export default function SellerCombinedDelivery({
  sellerId,
  onRecovered,
  focusRequestId,
  onFocusHandled,
}: {
  sellerId: string | undefined;
  onRecovered?: () => Promise<void>;
  // A notification points at one request: open the list so its card is on
  // screen and can be highlighted.
  focusRequestId?: string | null;
  onFocusHandled?: () => void;
}) {
  const [requests, setRequests] = useState<SellerDeliveryRequest[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<SellerDeliveryRequest>();
  const [error, setError] = useState("");
  const [unavailable, setUnavailable] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const [loading, setLoading] = useState(true);
  const sequence = useRef(0);
  const reload = useCallback(async () => {
    if (!sellerId) return;
    const token = ++sequence.current;
    setLoading(true);
    try {
      const data = await loadSellerDeliveryRequests();
      if (token === sequence.current) {
        setRequests(data);
        setUnavailable(false);
        setError("");
        setSelected((current) =>
          current ? data.find((item) => item.id === current.id) : undefined,
        );
      }
    } catch (failure) {
      if (token === sequence.current) {
        setUnavailable(unavailableDeliveryBackend(failure));
        setError(deliveryFailureMessage(failure));
        setRequests([]);
        setSelected(undefined);
      }
    } finally {
      if (token === sequence.current) setLoading(false);
    }
  }, [sellerId]);
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    void reload();
    const focus = () => void reload();
    window.addEventListener("focus", focus);
    return () => {
      sequence.current++;
      window.removeEventListener("focus", focus);
    };
  }, [reload]);
  // A notification asks for a specific request: show the list.
  useEffect(() => {
    if (!focusRequestId) return;
    setOpen(true);
    void reload();
    onFocusHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequestId, reload]);
  // Requests waiting on the seller (approve or reject, or set the shared fee)
  // come first, and are what the pill counts.
  const needsAction = (request: SellerDeliveryRequest) =>
    ["pending_approval", "awaiting_shipping_fee"].includes(request.status);
  const ordered = [...requests].sort(
    (a, b) => Number(needsAction(b)) - Number(needsAction(a)),
  );
  const actionCount = requests.filter(needsAction).length;
  const hasContent = requests.length > 0 || Boolean(error);
  if (!sellerId || !supabase || (!hasContent && !open)) return null;
  return (
    <>
      {hasContent && (
        <PillTrigger
          icon={Truck}
          label="Combined Delivery"
          count={actionCount}
          loading={loading}
          ariaLabel={`Combined delivery requests${actionCount ? `, ${actionCount} need your action` : ""}`}
          onClick={() => {
            setOpen(true);
            void reload();
          }}
        />
      )}
      {open && !selected && (
        <Modal
          title="Combined delivery requests"
          variant="detail"
          width={640}
          onClose={() => setOpen(false)}
        >
          <div aria-busy={loading} className="combined-delivery-requests space-y-2">
            {refreshError && (
              <p role="status" className="text-xs text-[var(--kargo-muted)]">
                {refreshError}
              </p>
            )}
            {loading && !requests.length && (
              <p role="status" className="text-xs text-[var(--kargo-muted)]">
                Loading requests…
              </p>
            )}
            {error && (
              <DeliveryAvailabilityNotice
                error={error}
                unavailable={unavailable}
                loading={loading}
                onRetry={() => void reload()}
              />
            )}
            {!loading && !error && !requests.length && (
              <p className="text-sm text-[var(--kargo-muted)]">No combined delivery requests.</p>
            )}
            {ordered.map((request) => (
              <Card
                key={request.id}
                recordKeys={recordKeys({
                  combinedGroupId: request.id,
                  orderIds: request.members.map((member) => member.order_id),
                })}
                className="flex min-w-0 flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {request.buyerName || "Buyer"} · {request.members.length} reservations
                  </p>
                  <p className="truncate text-xs text-[var(--kargo-muted)]">
                    {request.batchName} · {request.payment_method}
                  </p>
                  <p className="mt-1 text-xs">
                    {request.payment ? paymentLabels[request.payment.status] : labels[request.status]}
                  </p>
                </div>
                <SecondaryBtn
                  disabled={loading || Boolean(error)}
                  onClick={() => {
                    setSelected(request);
                    void reload();
                  }}
                >
                  {needsAction(request) ? "Review request" : "View details"}
                </SecondaryBtn>
              </Card>
            ))}
          </div>
        </Modal>
      )}
      {selected && !error && (
        <SellerDeliveryDialog
          key={selected.id}
          request={selected}
          actionsDisabled={loading}
          onBackendUnavailable={(failure) => {
            setUnavailable(true);
            setRequests([]);
            setSelected(undefined);
            setError(deliveryFailureMessage(failure));
          }}
          onClose={() => setSelected(undefined)}
          onUpdated={(updated) => {
            setSelected(updated);
            if (updated.status === "invalidated" && onRecovered) {
              void onRecovered()
                .then(() => setRefreshError(""))
                .catch(() =>
                  setRefreshError(
                    "The request was recovered. Reload the page to refresh reservation details.",
                  ),
                );
            }
            setRequests((items) => items.map((item) => (item.id === updated.id ? updated : item)));
            void reload();
          }}
        />
      )}
    </>
  );
}