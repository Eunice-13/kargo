// A shortfall is never a status of its own: the claim stays Pending and this
// tag carries the amount still owed. Shared by every buyer/seller surface.
export default function InsufficientPaymentNotice({
  shortfall,
  compact = false,
  table = false,
  wrap = false,
}: {
  shortfall?: number | null;
  compact?: boolean;
  table?: boolean;
  wrap?: boolean;
}) {
  if (shortfall == null || !(shortfall > 0)) return null;
  const label = `Insufficient · ₱${shortfall.toLocaleString()} short`;
  return (
    <span
      data-insufficient-payment
      title={table ? label : undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        marginTop: table ? "var(--insufficient-payment-margin-top, 2px)" : compact ? 2 : 4,
        background: "#FFF7ED",
        border: "1px solid #FCD34D",
        color: "#92400E",
        borderRadius: 999,
        padding: table
          ? "var(--insufficient-payment-padding, 0 6px)"
          : compact
            ? "0 6px"
            : "1px 8px",
        fontSize: table ? "var(--insufficient-payment-font-size, 10px)" : compact ? 10 : 11,
        fontWeight: 600,
        whiteSpace: wrap ? "normal" : "nowrap",
      }}
    >
      {label}
    </span>
  );
}
