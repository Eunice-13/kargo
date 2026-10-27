import { useEffect, useState } from "react";

import { Modal, PrimaryBtn, SecondaryBtn, CardSkeleton } from "@/components/shared";
import { adminApi } from "@/services";
import { toneForStatus } from "@/constants/admin";

import { useAdminResource } from "../useAdminResource";
import AdminBadge from "./AdminBadge";
import AdminConfirmModal from "./AdminConfirmModal";
import { AdminFact, AdminFactGrid, AdminModalSection } from "./AdminFacts";

const peso = (n: number) => `₱${Math.round(n).toLocaleString()}`;
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "—");

export default function AdminPaymentDetailModal({
  paymentId,
  onClose,
  onChanged,
}: {
  paymentId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { data, loading, error, refresh } = useAdminResource(
    () => adminApi.getPayment(paymentId),
    [paymentId],
  );
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [receiptState, setReceiptState] = useState<"idle" | "loading" | "error">("idle");
  const [receiptAttempt, setReceiptAttempt] = useState(0);
  const [pending, setPending] = useState<"verified" | "rejected" | null>(null);

  // Fetch a short-lived signed URL only when there is a receipt path.
  useEffect(() => {
    let active = true;
    if (!data?.receiptPath) return;
    setReceiptState("loading");
    adminApi
      .receiptUrl(data.receiptPath)
      .then((url) => {
        if (!active) return;
        setReceiptUrl(url);
        setReceiptState(url ? "idle" : "error");
      })
      .catch(() => active && setReceiptState("error"));
    return () => {
      active = false;
    };
  }, [data?.receiptPath, receiptAttempt]);

  const alreadyVerified = data?.status === "verified";
  const alreadyRejected = data?.status === "rejected";

  return (
    <>
      <Modal
        title={`Payment · ${data?.orderNumber ?? ""}`}
        variant="detail"
        width={640}
        className="admin-modal"
        overlayClassName="admin-modal-overlay"
        onClose={onClose}
      >
        {loading && <CardSkeleton />}
        {!loading && error && (
          <p role="alert" className="admin-form-error">
            {error}
          </p>
        )}
        {!loading && data && (
          <div className="space-y-5">
            <div className="admin-detail-hero">
              <div className="admin-detail-hero__identity">
                <h2 className="admin-amount">{peso(data.amount)}</h2>
                <p>{data.orderNumber ? `Order ${data.orderNumber}` : "Payment submission"}</p>
              </div>
              <div className="admin-detail-hero__badges">
                <AdminBadge
                  tone={toneForStatus(data.status)}
                  label={data.status.replace(/_/g, " ")}
                />
              </div>
            </div>

            {data.receiptPath && (
              <AdminModalSection title="Receipt" hint="Opens a short-lived private link">
                {receiptState === "loading" && <CardSkeleton />}
                {receiptState === "error" && (
                  <p className="admin-receipt-error">
                    Receipt unavailable.{" "}
                    <button
                      type="button"
                      onClick={() => setReceiptAttempt((n) => n + 1)}
                      className="admin-inline-link"
                    >
                      Retry
                    </button>
                  </p>
                )}
                {receiptState === "idle" && receiptUrl && (
                  <a
                    href={receiptUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="admin-receipt"
                    aria-label="Open payment receipt in a new tab"
                  >
                    <img src={receiptUrl} alt="Payment receipt" />
                    <span>Open full receipt</span>
                  </a>
                )}
              </AdminModalSection>
            )}

            <AdminModalSection title="Submission">
              <AdminFactGrid>
                <AdminFact label="Buyer" value={data.buyer} />
                <AdminFact label="Seller" value={data.seller} />
                <AdminFact label="Method" value={data.method} />
                <AdminFact label="Reference" value={data.referenceNumber ?? "—"} />
                <AdminFact label="Payer" value={data.payerName ?? "—"} />
                <AdminFact label="Submitted" value={fmt(data.submittedAt)} />
                <AdminFact label="Reviewed" value={fmt(data.reviewedAt)} />
                <AdminFact label="Reviewed by" value={data.reviewedBy ?? "—"} />
              </AdminFactGrid>
            </AdminModalSection>

            {data.rejectionReason && (
              <div className="admin-callout admin-callout--danger">
                <p>
                  <strong>Rejection reason.</strong> {data.rejectionReason}
                </p>
              </div>
            )}

            <p className="admin-footer-note">
              Override only when the seller cannot act. This changes the order&apos;s paid state and
              notifies both parties.
            </p>

            <div className="admin-modal-footer">
              <PrimaryBtn
                disabled={alreadyVerified}
                onClick={() => setPending("verified")}
                style={alreadyVerified ? undefined : { background: "#0B7A59" }}
              >
                Verify payment
              </PrimaryBtn>
              <SecondaryBtn
                disabled={alreadyRejected}
                style={{ borderColor: "#FECACA", background: "#FEF2F2", color: "#B91C1C" }}
                onClick={() => setPending("rejected")}
              >
                Reject payment
              </SecondaryBtn>
            </div>
          </div>
        )}
      </Modal>

      {pending && data && (
        <AdminConfirmModal
          title={pending === "verified" ? "Verify payment" : "Reject payment"}
          consequence={
            pending === "verified"
              ? "Marks the payment verified and moves the order to payment confirmed. Both parties are notified."
              : "Marks the payment rejected. Both parties are notified."
          }
          confirmLabel={pending === "verified" ? "Verify" : "Reject"}
          confirmWord={data.referenceNumber ?? undefined}
          tone={pending === "verified" ? "default" : "danger"}
          onConfirm={async (reason) => {
            await adminApi.reviewPayment(paymentId, pending, reason);
            setPending(null);
            refresh();
            onChanged();
          }}
          onClose={() => setPending(null)}
        />
      )}
    </>
  );
}
