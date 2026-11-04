// A shortfall is never a status of its own: the claim stays Pending and this
// tag carries the amount still owed. Shared by every buyer/seller surface.
export default function InsufficientPaymentNotice({
  shortfall,
  compact = false,
}: {
  shortfall?: number | null;
  compact?: boolean;
}) {
  if (shortfall == null || !(shortfall > 0)) return null;
  return (
    <span
      data-insufficient-payment
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        marginTop: compact ? 2 : 4,
        background: "#FFF7ED",
        border: "1px solid #FCD34D",
        color: "#92400E",
        borderRadius: 999,
        padding: compact ? "0 6px" : "1px 8px",
        fontSize: compact ? 10 : 11,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      Insufficient · ₱{shortfall.toLocaleString()} short
    </span>
  );
}
