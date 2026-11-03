import type {
  FulfillmentAnalytics,
  FulfillmentAnalyticsStage as Stage,
  FulfillmentCurrentStatus,
  FulfillmentCurrentStatusStage,
} from "@/types/fulfillmentAnalytics";
import { CURRENT_STAGES, CURRENT_STAGE_GROUPS, bucketCount } from "./fulfillmentAnalyticsModel";

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
  /** Colour of the rule under the group heading. */
  line?: string;
  /** "13 orders · 28%". Only meaningful when each order is counted once. */
  summary?: string;
};

const orders = (n: number) => `${n.toLocaleString()} ${n === 1 ? "order" : "orders"}`;

// One bar layout for both views: Awaiting payment / Fulfillment / Closed without delivery.
//  * Current: every order created in the range, counted once in its latest status, so
//    percentages add to 100% and each group can show its own order total.
//  * Reached: the same orders, but an order counts in every stage it has ever reached, so
//    percentages can add to more than 100% and groups have no single total.
export default function FulfillmentBreakdown({
  data,
  view,
  currentStatus,
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

  const allRows: Row[] = [
    ...CURRENT_STAGES.map((s) => ({
      key: s.key as DisplayStage,
      label: s.label,
      color: s.color,
      review: s.review,
      count: current
        ? (currentStatus?.counts[s.key] ?? 0)
        : bucketCount(data.stageTotals, s.key as Stage),
    })),
    // Safety net for any status the stage list does not know; only exists in Current status.
    ...(current
      ? [{ ...OTHER_STAGE, key: "other" as DisplayStage, count: currentStatus?.counts.other ?? 0 }]
      : []),
  ].map((row) => ({ ...row, percent: pct(row.count) }));

  const visibleRows = allRows.filter((row) => row.key !== "other" || row.count > 0);
  const peak = Math.max(1, ...visibleRows.map((r) => r.count));
  const stackTotal = Math.max(
    1,
    visibleRows.reduce((sum, row) => sum + row.count, 0),
  );

  const groups: Group[] = CURRENT_STAGE_GROUPS.map((g) => {
    const keys = CURRENT_STAGES.filter((s) => s.group === g.id).map((s) => s.key as DisplayStage);
    const rows = visibleRows.filter((row) => keys.includes(row.key));
    const total = rows.reduce((sum, row) => sum + row.count, 0);
    return {
      id: g.id,
      title: g.title,
      line: g.line,
      rows,
      summary: current ? `${orders(total)} · ${pct(total)}%` : undefined,
    };
  });
  const other = visibleRows.filter((row) => row.key === "other");
  if (other.length) groups.push({ id: "other", title: "Other", rows: other, line: "#CBD5E1" });

  const select = (stage: DisplayStage) => {
    if (!onOpen) return;
    if (!current && stage !== "other") onFocusStage(stage as Stage);
    onOpen(stage);
  };

  return (
    <div
      className={`fulfillment-breakdown is-grouped is-${view}`}
      style={{
        ["--fb-cols" as string]: groups
          .map((g) => `minmax(0, ${Math.max(1, g.rows.length)}fr)`)
          .join(" "),
      }}
    >
      {current && visibleRows.length > 0 && (
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
          <div className="fulfillment-breakdown__group-head">
            <h3 className="fulfillment-breakdown__group-title">{group.title}</h3>
            {group.summary && (
              <p className="fulfillment-breakdown__group-summary">{group.summary}</p>
            )}
          </div>
          <ul
            className="fulfillment-breakdown__list"
            style={{ ["--cols" as string]: group.rows.length }}
          >
            {group.rows.map((r) => (
              <li key={r.key}>
                <button
                  type="button"
                  disabled={!onOpen}
                  style={{ ["--chip" as string]: r.color }}
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
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
