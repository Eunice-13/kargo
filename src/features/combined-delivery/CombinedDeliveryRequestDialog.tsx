import "./combinedDelivery.css";
import { useRef, useState } from "react";
import { MapPin, MessageSquare, XCircle } from "lucide-react";
import type {
  CombinedDeliveryRequest,
  CombinedDeliveryRequestCandidate,
  CombinedDeliveryRequestInput,
} from "@/types/combinedDelivery";
import Modal from "@/components/shared/Modal";
import PrimaryBtn from "@/components/shared/PrimaryBtn";
import SecondaryBtn from "@/components/shared/SecondaryBtn";
import ProductThumb from "@/components/shared/ProductThumb";
import { requestSelectionEligibility } from "./requestEligibility";

const money = (value: number) =>
  `₱${value.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export default function CombinedDeliveryRequestDialog({
  buyerId,
  options,
  existing,
  busy,
  actionsDisabled = false,
  onSubmit,
  onCancelRequest,
  onRecoverRequest,
  onClose,
  imageForOrder,
}: {
  buyerId: string;
  options: CombinedDeliveryRequestCandidate[][];
  existing?: CombinedDeliveryRequest;
  busy: boolean;
  actionsDisabled?: boolean;
  onSubmit: (input: CombinedDeliveryRequestInput) => Promise<boolean>;
  onCancelRequest: (id: string) => Promise<boolean>;
  onRecoverRequest?: (id: string) => Promise<boolean>;
  onClose: () => void;
  imageForOrder: (id: string) => string | undefined;
}) {
  const [contextIndex, setContextIndex] = useState(0);
  const context = options[contextIndex] ?? [];
  const [selection, setSelection] = useState(
    () => new Set((options[0] ?? []).map((order) => order.id)),
  );
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const selected = context.filter((order) => selection.has(order.id));
  const eligibility = requestSelectionEligibility(selected, buyerId);
  const first = selected[0] ?? context[0];
  const subtotal = existing
    ? existing.members.reduce((sum, member) => sum + Math.round(member.item_subtotal * 100), 0) /
      100
    : selected.reduce((sum, order) => sum + Math.round(order.itemSubtotal * 100), 0) / 100;
  const address = existing?.destination.address_text ?? first?.addressText;
  const lat = existing?.destination.pin_lat ?? first?.pinLat;
  const lng = existing?.destination.pin_lng ?? first?.pinLng;
  async function perform(action: () => Promise<boolean>) {
    if (submitting.current || busy || actionsDisabled) return;
    submitting.current = true;
    setError("");
    try {
      if (await action()) onClose();
    } catch (failure) {
      setError(
        failure &&
          typeof failure === "object" &&
          "message" in failure &&
          typeof failure.message === "string"
          ? failure.message
          : "Unable to update this request. Please try again.",
      );
    } finally {
      submitting.current = false;
    }
  }
  return (
    <Modal
      title={existing ? "Combined delivery request" : "Request combined delivery"}
      variant="confirm"
      width={520}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="combined-delivery-dialog cdd space-y-4 text-sm text-[var(--kargo-ink-soft)]">
        {!existing && (
          <p className="cdd__intro">
            Request one delivery for these items. The seller will review your request and set the
            combined shipping fee.
          </p>
        )}
        {!existing && options.length > 1 && (
          <label className="cdd__field">
            <span className="cdd__field-label">Seller, batch and destination</span>
            <select
              className="min-h-11 w-full rounded-lg border border-[var(--kargo-line)] bg-[var(--kargo-surface)] px-2 text-xs"
              value={contextIndex}
              disabled={busy}
              onChange={(event) => {
                const next = Number(event.target.value);
                setContextIndex(next);
                setSelection(new Set(options[next].map((order) => order.id)));
                setConfirmed(false);
                setError("");
              }}
            >
              {options.map((orders, index) => (
                <option key={orders[0].id} value={index}>
                  {orders[0].sellerName} · {orders[0].batchName} · {orders[0].addressText}
                </option>
              ))}
            </select>
          </label>
        )}
        {first && !existing && (
          <div className="cdd__identity">
            <p className="cdd__identity-seller">{first.sellerName}</p>
            <p className="cdd__identity-meta">
              Batch: {first.batchName} · {first.paymentMethod}
            </p>
          </div>
        )}
        {existing?.status === "rejected" ? (
          <section aria-label="Combined delivery rejected" className="space-y-3">
            <div className="cdd__status cdd__status--rejected">
              <XCircle
                size={18}
                className="cdd__status-icon text-red-700"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="cdd__status-title">Combined delivery rejected</p>
                <p className="cdd__status-note cdd__status-note--muted">
                  Your reservations will remain separate.
                </p>
                {existing.decision_reason?.trim() && (
                  <div className="cdd__message">
                    <h3 className="cdd__message-head">
                      <MessageSquare size={13} className="shrink-0" aria-hidden="true" />
                      Seller&apos;s message
                    </h3>
                    <p className="cdd__message-body">{existing.decision_reason}</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : (
          existing && (
            <div className="cdd__status">
              <div className="min-w-0">
                <p className="cdd__status-title">
                  {existing.status === "pending_approval"
                    ? "Combined delivery requested — waiting for the seller to review."
                    : existing.status === "awaiting_shipping_fee"
                      ? "Combined delivery approved — waiting for the shared shipping fee."
                      : existing.status === "shipping_fee_set"
                        ? "The shared shipping fee is set. View your combined payment and deadline in Pending Payments."
                        : "This combined delivery request is no longer active."}
                </p>
                {existing.decision_reason && (
                  <p className="cdd__status-note">{existing.decision_reason}</p>
                )}
              </div>
            </div>
          )
        )}
        <div>
          <p className="cdd__section-label">
            {existing ? "Items in this request" : "Items to combine"}
            {!existing && (
              <span className="cdd__section-hint">
                {selected.length} of {context.length} selected
              </span>
            )}
          </p>
          <ul className="cdd__items">
            {existing
              ? existing.members.map((member) => (
                  <li key={member.order_id} className="cdd__item">
                    <ProductThumb
                      name={member.order?.batch_products?.name ?? "Reserved product"}
                      imageUrl={imageForOrder(member.order_id)}
                    />
                    <div className="cdd__item-body">
                      <p className="cdd__item-name">
                        {member.order?.batch_products?.name ?? "Reserved product"}
                      </p>
                      <p className="cdd__item-qty">Qty: {member.order?.quantity ?? "—"}</p>
                    </div>
                    <span className="cdd__item-price">{money(member.item_subtotal)}</span>
                  </li>
                ))
              : context.map((order) => (
                  <li key={order.id}>
                    <label
                      className={`cdd__item${selection.has(order.id) ? " is-selected" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={selection.has(order.id)}
                        disabled={busy}
                        onChange={(event) => {
                          setSelection((current) => {
                            const next = new Set(current);
                            if (event.target.checked) next.add(order.id);
                            else next.delete(order.id);
                            return next;
                          });
                          setConfirmed(false);
                        }}
                        className="cdd__item-check"
                      />
                      <ProductThumb name={order.product} imageUrl={imageForOrder(order.id)} />
                      <div className="cdd__item-body">
                        <p className="cdd__item-name">{order.product}</p>
                        <p className="cdd__item-qty">Qty: {order.qty}</p>
                      </div>
                      <span className="cdd__item-price">{money(order.itemSubtotal)}</span>
                    </label>
                  </li>
                ))}
          </ul>
        </div>
        <div className="cdd__destination">
          <MapPin size={16} className="cdd__destination-icon" aria-hidden="true" />
          <div className="cdd__destination-body">
            <p className="cdd__destination-label">Delivery destination</p>
            <p className="cdd__destination-address">{address}</p>
            <p className="cdd__destination-pin">
              Pin: {lat}, {lng}
            </p>
          </div>
        </div>
        {!existing && (
          <label className={`cdd__confirm${confirmed ? " is-checked" : ""}`}>
            <input
              type="checkbox"
              checked={confirmed}
              disabled={busy}
              onChange={(event) => setConfirmed(event.target.checked)}
              className="cdd__confirm-check"
            />
            <span className="cdd__confirm-text">
              I confirm these selected reservations use this same saved pin and full delivery
              address, including unit or building details.
            </span>
          </label>
        )}
        <dl className="cdd__summary">
          <div className="cdd__summary-row">
            <dt>Items subtotal</dt>
            <dd>{money(subtotal)}</dd>
          </div>
          <div className="cdd__summary-row">
            <dt>Shipping fee</dt>
            <dd
              className={existing?.shipping_fee != null ? undefined : "is-pending"}
            >
              {existing?.shipping_fee != null
                ? money(existing.shipping_fee)
                : existing?.status === "awaiting_shipping_fee"
                  ? "Pending shared fee"
                  : "Pending seller review"}
            </dd>
          </div>
          {existing?.shipping_fee != null && (
            <div className="cdd__summary-row cdd__summary-row--total">
              <dt>
                {existing.status === "invalidated" ? "Previous combined total" : "Group total"}
              </dt>
              <dd>
                {money(
                  (Math.round(subtotal * 100) + Math.round(existing.shipping_fee * 100)) / 100,
                )}
              </dd>
            </div>
          )}
        </dl>
        {!existing && !eligibility.eligible && (
          <p className="cdd__notice">
            {eligibility.feedback[0] ?? "Select at least two eligible reservations."}
          </p>
        )}
        {error && (
          <p role="alert" className="cdd__error">
            {error}
          </p>
        )}
        {existing &&
          ["awaiting_shipping_fee", "shipping_fee_set"].includes(existing.status) &&
          existing.payment?.status !== "pending_review" &&
          onRecoverRequest && (
            <p className="cdd__notice">
              If this request is no longer eligible, check eligibility to return its reservations to
              individual shipping. Valid approved requests stay unchanged.
            </p>
          )}
        {existing?.status === "invalidated" && (
          <p className="cdd__notice">
            This request is no longer payable. Any previous shared fee is historical and is not
            applied to individual reservations. Shipping or location-correction pauses remain until
            the seller resolves them.
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          {existing &&
            ["awaiting_shipping_fee", "shipping_fee_set"].includes(existing.status) &&
            existing.payment?.status !== "pending_review" &&
            onRecoverRequest && (
              <SecondaryBtn
                disabled={busy || actionsDisabled}
                onClick={() => void perform(() => onRecoverRequest(existing.id))}
              >
                {busy ? "Checking…" : "Check eligibility and recover"}
              </SecondaryBtn>
            )}
          {existing?.status === "pending_approval" && (
            <SecondaryBtn
              disabled={busy || actionsDisabled}
              onClick={() => void perform(() => onCancelRequest(existing.id))}
            >
              {busy ? "Cancelling…" : "Cancel request"}
            </SecondaryBtn>
          )}
          <SecondaryBtn disabled={busy} onClick={onClose}>
            {existing ? "Close" : "Cancel"}
          </SecondaryBtn>
          {!existing && (
            <PrimaryBtn
              disabled={busy || actionsDisabled || !confirmed || !eligibility.eligible}
              loading={busy}
              onClick={() => {
                if (
                  !first ||
                  first.pinLat === null ||
                  first.pinLng === null ||
                  !first.addressText ||
                  !confirmed ||
                  !eligibility.eligible
                )
                  return;
                void perform(() =>
                  onSubmit({
                    orderIds: selected.map((order) => order.id),
                    destination: {
                      lat: first.pinLat!,
                      lng: first.pinLng!,
                      address: first.addressText!,
                    },
                    confirmDestination: confirmed,
                  }),
                );
              }}
            >
              Confirm Request
            </PrimaryBtn>
          )}
        </div>
      </div>
    </Modal>
  );
}
