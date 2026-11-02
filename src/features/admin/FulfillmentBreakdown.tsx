import type {
  FulfillmentAnalytics,
  FulfillmentAnalyticsStage as Stage,
  FulfillmentCurrentStatus,
} from "@/types/fulfillmentAnalytics";
import { ANALYTICS_STAGES, bucketCount } from "./fulfillmentAnalyticsModel";

const DROP_OFF_STAGES: Stage[] = ["cancelled", "expired"];
const OTHER_STAGE = {
  key: "other" as const,
  label: "Other",
  color: "#64748B",
};
type DisplayStage = Stage | "other";
type BreakdownView = "reached" | "current";

// Shared bar view for reached-stage and current-status counts. Reached uses
// stageTotals and percentages may add above 100%; current uses one status per
// order and percentages sum to 100%. Current-status bars have no drill-down
// until the orders RPC can support current-state membership safely.
export default function FulfillmentBreakdown({
  data,
  view,
  currentStatus,
  focused,
  onFocusStage,
  onOpen,
}: {
  data: FulfillmentAnalytics;
  view: BreakdownView;
  currentStatus?: FulfillmentCurrentStatus;
  focused: Stage;
  onFocusStage: (stage: Stage) => void;
  onOpen?: (stage: DisplayStage) => void;
}) {
  const current = view === "current";
  const stages: Array<{ key: DisplayStage; label: string; color: string }> = current
    ? [...ANALYTICS_STAGES, OTHER_STAGE]
    : ANALYTICS_STAGES;
  const denominator = current
    ? (currentStatus?.cohortSize ?? 0)
    : (data.cohortSize ?? data.uniqueOrders);
  const rows = stages.map((s) => {
    const count = current
      ? (currentStatus?.counts[s.key as keyof FulfillmentCurrentStatus["counts"]] ?? 0)
      : bucketCount(data.stageTotals, s.key as Stage);
    return {
      ...s,
      count,
      percent: denominator ? Math.round((count / denominator) * 100) : 0,
    };
  });
  const visibleRows = current ? rows.filter((row) => row.key !== "other" || row.count > 0) : rows;
  const peak = Math.max(1, ...visibleRows.map((r) => r.count));
  const stackTotal = Math.max(
    1,
    visibleRows.reduce((sum, row) => sum + row.count, 0),
  );
  const pathRows = visibleRows.filter(
    (row) => !DROP_OFF_STAGES.includes(row.key as Stage) && row.key !== "other",
  );
  const dropOffRows = visibleRows.filter((row) => DROP_OFF_STAGES.includes(row.key as Stage));
  const otherRows = visibleRows.filter((row) => row.key === "other");
  const groups = [
    { id: "path", title: "Fulfillment path", rows: pathRows },
    { id: "drop-offs", title: "Drop-offs", rows: dropOffRows },
    ...(otherRows.length ? [{ id: "other", title: "Other", rows: otherRows }] : []),
  ];

  const select = (stage: DisplayStage) => {
    if (!onOpen) return;
    if (stage !== "other") onFocusStage(stage);
    onOpen(stage);
  };

  return (
    <div className={`fulfillment-breakdown ${current ? "is-current" : "is-reached"}`}>
      {visibleRows.length > 0 && (
        <div className="fulfillment-breakdown__stack" aria-label="Fulfillment proportions">
          {visibleRows
            .filter((row) => row.key !== "other")
            .map((row) => (
              <span
                key={row.key}
                className="fulfillment-breakdown__segment"
                style={{ background: row.color, flexGrow: row.count / stackTotal }}
                title={`${row.label}: ${row.count}`}
              />
            ))}
        </div>
      )}
      {groups.map((group) => (
        <section
          key={group.id}
          className={`fulfillment-breakdown__group is-${group.id}`}
          aria-label={group.title}
        >
          <h3 className="fulfillment-breakdown__group-title">{group.title}</h3>
          <ul
            className="fulfillment-breakdown__list"
            style={{ ["--cols" as string]: group.rows.length }}
          >
            {group.rows.map((r) => (
              <li key={r.key} className={r.key === focused ? "is-focused" : undefined}>
                <button
                  type="button"
                  disabled={!onOpen}
                  style={{
                    ["--chip" as string]: r.color,
                    ...(r.key === focused
                      ? {
                          background: `color-mix(in srgb, ${r.color} 12%, var(--fa-soft))`,
                          borderColor: `color-mix(in srgb, ${r.color} 55%, var(--fa-border))`,
                        }
                      : {}),
                  }}
                  aria-pressed={r.key === focused}
                  aria-label={`${current ? "Current status" : "Reached stage"}: ${r.count.toLocaleString()} ${r.label} orders (${r.percent}% ${current ? "of orders" : "reached"})`}
                  onClick={() => select(r.key)}
                >
                  <span className="fulfillment-breakdown__bar-wrap">
                    <span
                      className="fulfillment-breakdown__bar"
                      style={{
                        background: r.color,
                        ["--fill" as string]: `${current ? r.percent : (r.count / peak) * 100}%`,
                      }}
                    >
                      <span className="fulfillment-breakdown__bar-count">
                        {r.count.toLocaleString()}
                      </span>
                    </span>
                  </span>
                  <span className="fulfillment-breakdown__meta">
                    <span className="fulfillment-stage-dot" style={{ background: r.color }} />
                    <span className="fulfillment-breakdown__label">{r.label}</span>
                    <strong className="fulfillment-breakdown__count">
                      {r.count.toLocaleString()}
                    </strong>
                    <span className="fulfillment-breakdown__percent">
                      {r.percent}% {current ? "of orders" : "reached"}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
