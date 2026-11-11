import type React from "react";
import { useState } from "react";
import { CreditCard, Check, X, ExternalLink, Image as ImageIcon, Printer } from "lucide-react";
import { INDIGO, CREAM } from "@/constants/theme";
import { Modal, Avatar, SecondaryBtn } from "@/components/shared";
import type { VerifyItem } from "./verifyTypes";
import { confirmPaymentCopy } from "./confirmPaymentWarning";
import { printPaymentInvoice } from "./paymentInvoice";
import { kargoApi } from "@/services";

function ReceiptFileIcon({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M11 21H8a2 2 0 0 1-2-2V9l5-6h5a2 2 0 0 1 2 2v3" />
      <path d="M6 9h3a2 2 0 0 0 2-2V3" />
      <path d="M9 14h2" />
      <path d="M9 17h2" />
      <path d="M20 10v7a3 3 0 0 1-6 0V9.5a1.75 1.75 0 0 1 3.5 0V16" />
    </svg>
  );
}

export default function ReviewSubmissionModal({
  reviewTarget,
  setReviewTarget,
  setVerifyItems,
  setRejectTarget,
  setRejectReason,
  setRejectCustom,
  onNotifyBuyer,
  onMarkPaid,
  sellerName = "My Shop",
}: {
  reviewTarget: VerifyItem;
  sellerName?: string;
  setReviewTarget: (v: VerifyItem | null) => void;
  setVerifyItems: React.Dispatch<React.SetStateAction<VerifyItem[]>>;
  setRejectTarget: (v: VerifyItem | null) => void;
  setRejectReason: (v: string) => void;
  setRejectCustom: (v: string) => void;
  onNotifyBuyer: (item: VerifyItem) => void | Promise<void>;
  onMarkPaid: (item: VerifyItem) => void;
}) {
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [notifying, setNotifying] = useState(false);
  // Gate every "Confirm Payment"/"Mark Paid" action behind one confirmation
  // popup. All seller payment types (individual, group, combined-delivery,
  // partial) funnel through this component, so a single popup here covers them
  // without duplicating one per type.
  const [confirming, setConfirming] = useState(false);

  const openReceipt = async () => {
    if (!reviewTarget.receiptPath) {
      setReceiptError("No receipt file was attached to this payment.");
      return;
    }
    setReceiptLoading(true);
    setReceiptError(null);
    try {
      setReceiptUrl(await kargoApi.paymentReceiptUrl(reviewTarget.receiptPath));
      setShowReceipt(true);
    } catch (error) {
      setReceiptError(error instanceof Error ? error.message : "Unable to open the receipt.");
    } finally {
      setReceiptLoading(false);
    }
  };
  const amountPaid = reviewTarget.amountPaid != null ? Number(reviewTarget.amountPaid) : null;
  const isShort = amountPaid != null && amountPaid < reviewTarget.amount;
  const buyerNotified = Boolean(reviewTarget.buyerNotified);
  const isCashOnMeetup = reviewTarget.method === "Cash on Meetup";
  const notifyBuyer = async () => {
    setNotifying(true);
    try {
      await onNotifyBuyer(reviewTarget);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to notify the buyer.");
    } finally {
      setNotifying(false);
    }
  };
  return (
    <>
      <Modal
        title="Payment Submission Details"
        onClose={() => setReviewTarget(null)}
        width={520}
        showTitleIcon={false}
        className="payment-submission-detail-modal"
      >
        <div className="space-y-4">
          {/* Buyer + product header */}
          <div
            style={{
              display: "flex",
              gap: 14,
              alignItems: "center",
              background: CREAM,
              borderRadius: 10,
              padding: "12px 14px",
            }}
          >
            <Avatar name={reviewTarget.buyer} size={40} />
            <div className="flex-1">
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#111827",
                  fontFamily: "'Josefin Sans',sans-serif",
                }}
              >
                {reviewTarget.buyer}
              </div>
              <div style={{ fontSize: 12, color: "#6B7280", marginTop: 1 }}>
                {reviewTarget.product}
              </div>
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: INDIGO,
                fontFamily: "'Josefin Sans',sans-serif",
              }}
            >
              ₱{reviewTarget.amount.toLocaleString()}
            </div>
          </div>

          {/* Submitted details grid */}
          <div
            style={{
              border: "1px solid #E5E7EB",
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                background: CREAM,
                padding: "8px 14px",
                borderBottom: "1px solid #E5E7EB",
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#374151",
                  letterSpacing: 0.6,
                }}
              >
                BUYER SUBMISSION
              </span>
            </div>
            {(
              [
                ["Reference ID", reviewTarget.ref],
                ["Account Name", reviewTarget.acctName],
                ["Date Submitted", reviewTarget.date],
                ["Phone Number", reviewTarget.phone || "—"],
                ...(reviewTarget.rejectionDeadline
                  ? [
                      [
                        "Resubmission Deadline",
                        new Date(reviewTarget.rejectionDeadline).toLocaleString(),
                      ] as [string, string],
                    ]
                  : []),
                ...(isCashOnMeetup
                  ? []
                  : [
                      [
                        "Amount Paid",
                        reviewTarget.amountPaid
                          ? `₱${Number(reviewTarget.amountPaid).toLocaleString()}`
                          : "—",
                      ] as [string, string],
                    ]),
              ] as [string, string][]
            ).map(([k, v], idx) => (
              <div key={k}>
                {idx === 0 && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 14px",
                      borderBottom: "1px solid #F3F4F6",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        color: "#9CA3AF",
                        fontWeight: 500,
                      }}
                    >
                      Payment Method
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#111827",
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      <CreditCard size={13} aria-hidden="true" />
                      {reviewTarget.method}
                    </span>
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 14px",
                    borderBottom: "1px solid #F3F4F6",
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      color: "#9CA3AF",
                      fontWeight: 500,
                    }}
                  >
                    {k}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#111827",
                      fontFamily: k === "Reference ID" ? "monospace" : "inherit",
                    }}
                  >
                    {v}
                  </span>
                </div>
              </div>
            ))}
            {/* Contact link row */}
            <div
              className="payment-review-detail-row"
              style={{
                borderBottom: "1px solid #F3F4F6",
              }}
            >
              <span style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 500 }}>Contact Link</span>
              {reviewTarget.contact ? (
                <a
                  href={reviewTarget.contact}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="payment-review-action-button"
                >
                  <ExternalLink size={14} aria-hidden="true" /> Open Facebook profile
                </a>
              ) : (
                <span style={{ fontSize: 12, color: "#9CA3AF" }}>—</span>
              )}
            </div>
            {/* Receipt row */}
            <div
              className="payment-review-detail-row payment-review-receipt-row"
              style={{
                borderBottom: "1px solid #F3F4F6",
              }}
            >
              <span className="payment-review-receipt-label" style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 500 }}>Receipt File</span>
              <button
                type="button"
                className="payment-review-action-button"
                onClick={reviewTarget.receiptPath ? openReceipt : undefined}
                aria-label="View receipt"
                title="View receipt"
                aria-expanded={showReceipt}
                disabled={receiptLoading || !reviewTarget.receiptPath}
              >
                <ReceiptFileIcon size={14} />
                {receiptLoading ? "Opening…" : reviewTarget.receiptPath ? "View" : "No receipt"}
              </button>
            </div>
            {receiptError && (
              <div
                className="payment-review-reminder"
                style={{
                  padding: "8px 14px",
                  background: "#FEF2F2",
                  color: "#B91C1C",
                  fontSize: 11,
                }}
              >
                {receiptError}
              </div>
            )}
            {showReceipt && !receiptUrl && (
              <div
                className="fi"
                style={{
                  marginTop: 10,
                  border: "1px dashed #C7CCE5",
                  borderRadius: 8,
                  background: "#F7F8FF",
                  padding: "22px 14px",
                  textAlign: "center",
                  color: "#6B7280",
                }}
              >
                <ImageIcon
                  size={30}
                  aria-hidden="true"
                  style={{ color: INDIGO, display: "inline-block" }}
                />
                <div style={{ fontSize: 12, marginTop: 8, color: "#374151" }}>
                  {reviewTarget.receipt}
                </div>
                <div style={{ fontSize: 11, marginTop: 3 }}>
                  Receipt preview — buyer-submitted proof of payment.
                </div>
              </div>
            )}
          </div>

          {/* Seller's own records reminder */}
          <div
            style={{
              background: "#EEF0FF",
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 12,
              color: "#374151",
            }}
          >
            Check the reference ID and payment details against your configured{" "}
            <strong>{reviewTarget.method}</strong> account before deciding.
          </div>

          {(() => {
            const btnBase: React.CSSProperties = {
              fontSize: 12,
              fontWeight: 600,
              padding: "5px 12px",
              borderRadius: 6,
              border: "1px solid",
              cursor: "pointer",
              whiteSpace: "nowrap" as const,
            };
            return (
              <div className="kargo-modal-actions">
                {reviewTarget.status === "Verified" && (
                  <button
                    onClick={() => printPaymentInvoice(reviewTarget, sellerName)}
                    style={{
                      ...btnBase,
                      justifyContent: "center",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      background: INDIGO,
                      color: "#fff",
                      borderColor: INDIGO,
                    }}
                  >
                    <Printer size={13} aria-hidden="true" /> Print Invoice
                  </button>
                )}
                {reviewTarget.status === "Pending" && (
                  <>
                    {isShort && (
                      <>
                        {buyerNotified ? (
                          <span
                            style={{
                              ...btnBase,
                              color: "#0B7A59",
                              background: "#D4F5EA",
                              borderColor: "#6EE7B7",
                              textAlign: "center",
                            }}
                          >
                            Buyer Notified
                          </span>
                        ) : (
                          <button
                            onClick={() => onNotifyBuyer(reviewTarget)}
                            style={{
                              ...btnBase,
                              background: "#FEF3C7",
                              color: "#92400E",
                              borderColor: "#FCD34D",
                            }}
                          >
                            Notify Buyer
                          </button>
                        )}
                        <button
                          onClick={() => setConfirming(true)}
                          style={{
                            ...btnBase,
                            background: INDIGO,
                            color: "#fff",
                            borderColor: INDIGO,
                          }}
                        >
                          Mark Paid
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => setConfirming(true)}
                      style={{
                        ...btnBase,
                        justifyContent: "center",
                        display: "flex",
                        background: INDIGO,
                        color: "#fff",
                        borderColor: INDIGO,
                      }}
                    >
                      <Check size={13} aria-hidden="true" /> Confirm Payment
                    </button>
                    <button
                      onClick={() => {
                        setRejectTarget(reviewTarget);
                        setReviewTarget(null);
                        setRejectReason("");
                        setRejectCustom("");
                      }}
                      style={{
                        ...btnBase,
                        justifyContent: "center",
                        display: "flex",
                        background: "#fff",
                        color: "#EF4444",
                        borderColor: "#EF4444",
                      }}
                    >
                      <X size={13} aria-hidden="true" /> Reject
                    </button>
                  </>
                )}
                {reviewTarget.status === "Rejected" &&
                  reviewTarget.rejectionDeadline &&
                  (buyerNotified ? (
                    <span
                      style={{
                        ...btnBase,
                        color: "#0B7A59",
                        background: "#D4F5EA",
                        borderColor: "#6EE7B7",
                        textAlign: "center",
                      }}
                    >
                      Buyer Notified
                    </span>
                  ) : (
                    <button
                      disabled={notifying}
                      onClick={notifyBuyer}
                      style={{
                        ...btnBase,
                        background: "#FEF3C7",
                        color: "#92400E",
                        borderColor: "#FCD34D",
                        opacity: notifying ? 0.65 : 1,
                      }}
                    >
                      {notifying ? "Notifying…" : "Notify Buyer to Resubmit"}
                    </button>
                  ))}
              </div>
            );
          })()}
        </div>
      </Modal>
      {confirming &&
        (() => {
          const copy = confirmPaymentCopy(reviewTarget);
          return (
            <Modal
              title={copy.title}
              variant="confirm"
              onClose={() => setConfirming(false)}
              width={460}
            >
              <div className="space-y-4">
                <p style={{ fontSize: 13, color: "#374151", margin: 0 }}>{copy.message}</p>
                {copy.warning && (
                  <div
                    style={{
                      background: copy.locksOrder ? "#FEF2F2" : "#FFF7ED",
                      border: `1px solid ${copy.locksOrder ? "#FCA5A5" : "#FCD34D"}`,
                      borderRadius: 8,
                      padding: "10px 14px",
                      fontSize: 12,
                      color: copy.locksOrder ? "#991B1B" : "#92400E",
                    }}
                    role="alert"
                  >
                    {copy.warning}
                  </div>
                )}
                <div className="kargo-modal-actions">
                  <SecondaryBtn onClick={() => setConfirming(false)}>Go Back</SecondaryBtn>
                  <button
                    onClick={() => {
                      setConfirming(false);
                      onMarkPaid(reviewTarget);
                    }}
                    style={{
                      background: INDIGO,
                      color: "#fff",
                      border: "none",
                      borderRadius: 7,
                      padding: "8px 16px",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "'Josefin Sans',sans-serif",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Check size={14} aria-hidden="true" /> {copy.confirmLabel}
                  </button>
                </div>
              </div>
            </Modal>
          );
        })()}
      {showReceipt && receiptUrl && (
        <Modal
          title="Receipt Preview"
          onClose={() => setShowReceipt(false)}
          width={760}
          topOffset={0}
        >
          <div style={{ textAlign: "center" }}>
            {reviewTarget.receipt.toLowerCase().endsWith(".pdf") ? (
              <iframe
                title="Payment receipt"
                src={receiptUrl}
                style={{ width: "100%", height: "70dvh", border: 0 }}
              />
            ) : (
              <img
                src={receiptUrl}
                alt="Buyer-submitted payment receipt"
                style={{
                  display: "block",
                  maxWidth: "100%",
                  maxHeight: "72dvh",
                  margin: "0 auto",
                  objectFit: "contain",
                  borderRadius: 8,
                }}
              />
            )}
            <a
              href={receiptUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                marginTop: 12,
                color: INDIGO,
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              <ExternalLink size={13} aria-hidden="true" /> Open in new tab
            </a>
          </div>
        </Modal>
      )}
    </>
  );
}
