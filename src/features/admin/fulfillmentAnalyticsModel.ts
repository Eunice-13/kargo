import type {
  FulfillmentAnalytics,
  FulfillmentAnalyticsStage as Stage,
} from "@/types/fulfillmentAnalytics";

export const ANALYTICS_STAGES: { key: Stage; label: string; color: string; dash?: string }[] = [
  { key: "payment_confirmed", label: "Payment confirmed", color: "#191BA9", dash: "3 3" },
  { key: "preparing", label: "Preparing", color: "#B4690E" },
  { key: "shipped", label: "Shipped", color: "#2563EB" },
  { key: "in_transit", label: "In transit", color: "#8755C7", dash: "7 3" },
  { key: "delivered", label: "Delivered", color: "#0B8C69" },
  { key: "cancelled", label: "Cancelled", color: "#B42318", dash: "4 3" },
  { key: "incomplete", label: "Incomplete", color: "#64748B", dash: "2 4" },
];
export const PERIODS = [
  ["today", "Today"],
  ["last_7_days", "Last 7 Days"],
  ["last_30_days", "Last 30 Days"],
  ["all_time", "All Time"],
  ["custom", "Custom"],
] as const;
export function manilaToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  return ["year", "month", "day"]
    .map((type) => parts.find((p) => p.type === type)?.value)
    .join("-");
}
export function customRangeError(start: string, end: string, today = manilaToday()) {
  if (!start || !end) return "Choose both a start and an end date.";
  const valid = (value: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value;
  if (!valid(start) || !valid(end)) return "Choose valid calendar dates.";
  if (start > end) return "The start date must be on or before the end date.";
  if (end > today) return "The end date cannot be later than today in Manila.";
  return null;
}
export function analyticsDate(iso: string, grouping?: FulfillmentAnalytics["grouping"]) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    ...(grouping === "hour"
      ? { hour: "numeric", hour12: true }
      : grouping === "month"
        ? { month: "short", year: "2-digit" }
        : { month: "short", day: "numeric" }),
  }).format(new Date(iso));
}
export function analyticsTimestamp(iso: string) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}
// A bucket's count for a stage, safe against a stage key the RPC payload does
// not include (schema/version drift). Returns 0 only for rendering math; it is
// not persisted or shown as evidence. Non-finite values are treated as 0 so SVG
// coordinates can never become NaN.
export function bucketCount(
  counts: Partial<Record<Stage, number>> | undefined,
  stage: Stage,
): number {
  const value = counts?.[stage];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function tickIndices(length: number, limit: number) {
  if (length <= 1) return length ? [0] : [];
  const span = Math.max(1, Math.min(length, limit));
  if (span === 1) return [0];
  return [
    ...new Set(
      Array.from({ length: span }, (_, i) => {
        const idx = Math.round((i * (length - 1)) / (span - 1));
        // Guard against any non-finite result and keep indices in range.
        return Number.isFinite(idx) ? Math.max(0, Math.min(length - 1, idx)) : 0;
      }),
    ),
  ];
}
export function chartScale(data: FulfillmentAnalytics, stages: Stage[]) {
  const peak = data.chart.reduce((max, b) => {
    for (const s of stages) max = Math.max(max, bucketCount(b.counts, s));
    return max;
  }, 0);
  const safePeak = Number.isFinite(peak) ? peak : 0;
  const step = Math.max(1, Math.ceil(safePeak / 4));
  return { max: step * 4, ticks: [0, step, step * 2, step * 3, step * 4] };
}
