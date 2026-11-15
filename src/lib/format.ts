/**
 * One money formatter for the whole client. Two decimals, always, with the
 * peso sign — a missing or invalid amount renders as ₱0.00 rather than a dash
 * so every surface has the same floor.
 */
export function formatMoney(value: number | string | null | undefined): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "₱0.00";
  return `₱${amount.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
