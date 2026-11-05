import { Layers, MapPin } from "lucide-react";

import { Modal, Avatar, CardSkeleton } from "@/components/shared";
import { adminApi } from "@/services";
import { toneForStatus } from "@/constants/admin";

import { useAdminResource } from "../useAdminResource";
import useIsDesktop from "../useIsDesktop";
import AdminBadge from "./AdminBadge";
import { AdminEmptyText } from "./AdminFacts";

const peso = (n: number) => `₱${Math.round(n).toLocaleString()}`;
const statusLabel = (s: string) => s.replace(/_/g, " ");

// Read-only detail for one combined-delivery group. Mirrors the seller's
// combined view, but admin-gated so it can open any group.
export default function AdminCombinedPaymentModal({
  groupId,
  onClose,
}: {
  groupId: string;
  onClose: () => void;
}) {
  const { data, loading, error, refresh } = useAdminResource(
    () => adminApi.getCombinedPayment(groupId),
    [groupId],
  );
  const isDesktop = useIsDesktop();

  const membersSubtotal = data?.members.reduce((sum, m) => sum + m.item_subtotal, 0) ?? 0;
  const shipping = data?.payment?.shipping_fee ?? data?.shipping_fee ?? null;
  const total = data?.payment?.total ?? membersSubtotal + (shipping ?? 0);

  return (
    <Modal
      title={isDesktop && data ? `Group ${data.id.slice(0, 8)}` : "Combined payment"}
      titleAside={
        isDesktop && data ? (
          <AdminBadge tone={toneForStatus(data.status)} label={statusLabel(data.status)} />
        ) : undefined
      }
      showTitleIcon={false}
      variant="detail"
      width={isDesktop ? 920 : 640}
      className="admin-modal admin-record-modal admin-combined-modal"
      overlayClassName="admin-modal-overlay admin-record-modal-overlay"
      onClose={onClose}
    >
      {loading && <CardSkeleton />}
      {!loading && error && (
        <p role="alert" className="admin-form-error">
          {error}
        </p>
      )}
      {!loading && data && data.available === false && (
        <AdminEmptyText>Combined delivery is not enabled in this environment.</AdminEmptyText>
      )}
      {!loading && data && data.available !== false && (
        <div className="admin-combined">
          <div className="admin-combined__col">
            <section className="admin-order__card">
              <div className="admin-combined__head">
                <span className="admin-combined__icon" aria-hidden="true">
                  <Layers size={22} />
                </span>
                <div>
                  <strong>{data.batchName ?? "Combined delivery"}</strong>
                  <span>
                    {data.members.length} order{data.members.length === 1 ? "" : "s"} combined
                  </span>
                </div>
              </div>
              <ul className="admin-combined__members">
                {data.members.map((m) => (
                  <li key={m.order_id}>
                    <div>
                      <strong>{m.product}</strong>
                      <span>
                        {m.order_number} · Qty {m.quantity}
                      </span>
                    </div>
                    <AdminBadge tone={toneForStatus(m.status)} label={statusLabel(m.status)} />
                    <strong>{peso(m.item_subtotal)}</strong>
                  </li>
                ))}
              </ul>
              <dl className="admin-combined__totals">
                <div>
                  <dt>Items subtotal</dt>
                  <dd>{peso(data.payment?.items_subtotal ?? membersSubtotal)}</dd>
                </div>
                <div>
                  <dt>Shipping fee</dt>
                  <dd>{shipping == null ? "Not assigned" : peso(shipping)}</dd>
                </div>
                <div className="admin-combined__grand">
                  <dt>Total</dt>
                  <dd>{peso(total)}</dd>
                </div>
              </dl>
            </section>
          </div>

          <div className="admin-combined__col">
            <section className="admin-order__card">
              <div className="admin-order__person">
                <Avatar name={data.buyerName ?? ""} size={40} />
                <div>
                  <small>Buyer</small>
                  <strong>{data.buyerName ?? "—"}</strong>
                </div>
              </div>
              <div className="admin-order__person">
                <Avatar name={data.sellerName ?? ""} size={40} />
                <div>
                  <small>Seller</small>
                  <strong>{data.sellerName ?? "—"}</strong>
                </div>
              </div>
              <div className="admin-order__deliver">
                <small>Deliver to</small>
                <p>
                  <MapPin size={15} aria-hidden="true" />
                  {data.destination?.address_text ?? "—"}
                </p>
              </div>
            </section>

            {data.payment && (
              <section className="admin-order__card">
                <div className="admin-order__head">
                  <p className="admin-order__eyebrow">Shared payment</p>
                  <AdminBadge
                    tone={toneForStatus(data.payment.status)}
                    label={statusLabel(data.payment.status)}
                  />
                </div>
                <div className="admin-order__total">
                  <span>Amount due</span>
                  <strong>{peso(data.payment.total)}</strong>
                </div>
              </section>
            )}
          </div>
        </div>
      )}
      {!loading && error && (
        <button type="button" className="admin-combined__retry" onClick={refresh}>
          Try again
        </button>
      )}
    </Modal>
  );
}
