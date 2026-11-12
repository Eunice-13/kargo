import type {
  FulfillmentAnalytics,
  FulfillmentAnalyticsStage as Stage,
  FulfillmentCurrentStatusStage,
} from "@/types/fulfillmentAnalytics";

export type FulfillmentAnalyticsView = "trend" | "reached" | "current";
export type FulfillmentCountingMode = "current" | "reached";
export type FulfillmentChartMode = "bars" | "trend";

// Stages shared by Current status and Reached stage: orders awaiting payment, in
// fulfillment, or closed without delivery. Both views start from every order created in
// the range; they differ only in whether an order counts once (current) or in every
// stage it has reached (reached).
export type CurrentStageGroupId = "awaiting" | "fulfillment" | "closed";
export const CURRENT_STAGE_GROUPS: { id: CurrentStageGroupId; title: string; line: string }[] = [
  { id: "awaiting", title: "Awaiting payment", line: "#E8A317" },
  { id: "fulfillment", title: "Fulfillment", line: "#A5B4FC" },
  { id: "closed", title: "Closed without delivery", line: "#FCA5A5" },
];
export const CURRENT_STAGES: {
  key: FulfillmentCurrentStatusStage;
  label: string;
  color: string;
  group: CurrentStageGroupId;
  /** Needs an admin to look at it (payment proof to verify or fix). */
  review?: boolean;
}[] = [
  { key: "payment_pending", label: "Payment pending", color: "#F0C94A", group: "awaiting" },
  {
    key: "payment_submitted",
    label: "Payment submitted",
    color: "#E8A317",
    group: "awaiting",
    review: true,
  },
  {
    key: "insufficient_payment",
    label: "Insufficient payment",
    color: "#B45309",
    group: "awaiting",
    review: true,
  },
  { key: "payment_confirmed", label: "Payment confirmed", color: "#0EA5E9", group: "fulfillment" },
  { key: "preparing", label: "Preparing", color: "#3B82F6", group: "fulfillment" },
  { key: "shipped", label: "Shipped", color: "#1D4ED8", group: "fulfillment" },
  { key: "delivered", label: "Completed", color: "#0B8C69", group: "fulfillment" },
  { key: "expired", label: "Expired", color: "#64748B", group: "closed" },
  { key: "cancelled", label: "Cancelled", color: "#DC2626", group: "closed" },
];
export const AWAITING_PAYMENT_KEYS: FulfillmentCurrentStatusStage[] = [
  "payment_pending",
  "payment_submitted",
  "insufficient_payment",
];

// Reached stage and the trend chart use the same stages, labels and colours as Current
// status, so one order reads the same everywhere. Only the line style is trend-specific.
const STAGE_DASH: Partial<Record<Stage, string>> = {
  payment_pending: "2 3",
  insufficient_payment: "5 3",
  payment_confirmed: "3 3",
  cancelled: "4 3",
  expired: "2 4",
};
export const ANALYTICS_STAGES: { key: Stage; label: string; color: string; dash?: string }[] =
  CURRENT_STAGES.map((s) => ({
    key: s.key as Stage,
    label: s.label,
    color: s.color,
    dash: STAGE_DASH[s.key as Stage],
  }));
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
