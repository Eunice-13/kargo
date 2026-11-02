import type {
  FulfillmentAnalytics,
  FulfillmentAnalyticsStage as Stage,
  FulfillmentCurrentStatus,
  FulfillmentCurrentStatusStage,
} from "@/types/fulfillmentAnalytics";
import {
  ANALYTICS_STAGES,
  CURRENT_STAGES,
  CURRENT_STAGE_GROUPS,
  bucketCount,
} from "./fulfillmentAnalyticsModel";

const DROP_OFF_STAGES: Stage[] = ["cancelled", "expired"];
const OTHER_STAGE = {
  key: "other" as const,
  label: "Other",
  color: "#64748B",
};
type DisplayStage = Stage | FulfillmentCurrentStatusStage;
type BreakdownView = "reached" | "current";

type Row = {
  key: DisplayStage;
  label: string;
  color: string;
  count: number;
  percent: number;
  review?: boolean;
};
type Group = {
  id: string;
  title: string;
  rows: Row[];
  /** Colour of the rule under the group heading (current status only). */
  line?: string;
  summary?: string;
};

const orders = (n: number) => `${n.toLocaleString()} ${n === 1 ? "order" : "orders"}`;

// Shared bar view for reached-stage and current-status counts.
//  * Reached: payment-confirmed orders only, from the recorded stage history.
//    One order can sit in several stages, so percentages may add above 100%.
//  * Current: every order created in the range, once, in its latest status, so
//    percentages add to 100%. Grouped into Awaiting payment / Fulfillment /
//    Closed without delivery.
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
  const denominator = current
    ? (currentStatus?.cohortSize ?? 0)
    : (data.cohortSize ?? data.uniqueOrders);
  const pct = (count: number) => (denominator ? Math.round((count / denominator) * 100) : 0);

  const allRows: Row[] = current
    ? [
        ...CURRENT_STAGES.map((s) => ({
          key: s.key,
          label: s.label,
          color: s.color,
          review: s.review,
          count: currentStatus?.counts[s.key] ?? 0,
        })),
        {
          ...OTHER_STAGE,
          count: currentStatus?.counts.other ?? 0,
        },
      ].map((row) => ({ ...row, percent: pct(row.count) }))
    : ANALYTICS_STAGES.map((s) => {
        const count = bucketCount(data.stageTotals, s.key);
        return { key: s.key, label: s.label, color: s.color, count, percent: pct(count) };
      });

  const visibleRows = current
    ? allRows.filter((row) => row.key !== "other" || row.count > 0)
    : allRows;
  const peak = Math.max(1, ...visibleRows.map((r) => r.count));
  const stackTotal = Math.max(
    1,
    visibleRows.reduce((sum, row) => sum + row.count, 0),
  );

  let groups: Group[];
  if (current) {
    groups = CURRENT_STAGE_GROUPS.map((g) => {
      const keys = CURRENT_STAGES.filter((s) => s.group === g.id).map((s) => s.key);
      const rows = visibleRows.filter((row) => keys.includes(row.key as never));
      const total = rows.reduce((sum, row) => sum + row.count, 0);
      return {
        id: g.id,
        title: g.title,
        line: g.line,
        rows,
        summary: `${orders(total)} · ${pct(total)}%`,
      };
    });
    const other = visibleRows.filter((row) => row.key === "other");
    if (other.length) groups.push({ id: "other", title: "Other", rows: other, line: "#CBD5E1" });
  } else {
    groups = [
      {
        id: "path",
        title: "Fulfillment path",
        rows: visibleRows.filter((row) => !DROP_OFF_STAGES.includes(row.key as Stage)),
      },
      {
        id: "drop-offs",
        title: "Drop-offs",
        rows: visibleRows.filter((row) => DROP_OFF_STAGES.includes(row.key as Stage)),
      },
    ];
  }

  const select = (stage: DisplayStage) => {
    if (!onOpen) return;
    if (!current && stage !== "other") onFocusStage(stage as Stage);
    onOpen(stage);
  };

  return (
    <div
      className={`fulfillment-breakdown ${current ? "is-current" : "is-reached"}`}
      style={
        current
          ? {
              ["--fb-cols" as string]: groups
                .map((g) => `minmax(0, ${Math.max(1, g.rows.length)}fr)`)
                .join(" "),
            }
          : undefined
      }
    >
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
          style={group.line ? { ["--group-line" as string]: group.line } : undefined}
          aria-label={group.title}
        >
          {current ? (
            <div className="fulfillment-breakdown__group-head">
              <h3 className="fulfillment-breakdown__group-title">{group.title}</h3>
              {group.summary && (
                <p className="fulfillment-breakdown__group-summary">{group.summary}</p>
              )}
            </div>
          ) : (
            <h3 className="fulfillment-breakdown__group-title">{group.title}</h3>
          )}
          <ul
            className="fulfillment-breakdown__list"
            style={{ ["--cols" as string]: group.rows.length }}
          >
            {group.rows.map((r) => {
              const isFocused = !current && r.key === focused;
              return (
                <li key={r.key} className={isFocused ? "is-focused" : undefined}>
                  <button
                    type="button"
                    disabled={!onOpen}
                    style={{
                      ["--chip" as string]: r.color,
                      ...(isFocused
                        ? {
                            background: `color-mix(in srgb, ${r.color} 12%, var(--fa-soft))`,
                            borderColor: `color-mix(in srgb, ${r.color} 55%, var(--fa-border))`,
                          }
                        : {}),
                    }}
                    aria-pressed={isFocused}
                    aria-label={`${current ? "Current status" : "Reached stage"}: ${r.count.toLocaleString()} ${r.label} orders (${r.percent}% ${current ? "of orders" : "reached"})`}
                    onClick={() => select(r.key)}
                  >
                    <span className="fulfillment-breakdown__bar-wrap">
                      <span
                        className="fulfillment-breakdown__bar"
                        style={{
                          background: r.color,
                          ["--fill" as string]: `${(r.count / peak) * 100}%`,
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
                        {current ? `${r.percent}%` : `${r.percent}% reached`}
                      </span>
                      {current && r.review && r.count > 0 && (
                        <span className="fulfillment-breakdown__tag">Review</span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
