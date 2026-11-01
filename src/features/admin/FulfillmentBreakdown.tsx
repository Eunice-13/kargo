import type {
  FulfillmentAnalytics,
  FulfillmentAnalyticsStage as Stage,
} from "@/types/fulfillmentAnalytics";
import { ANALYTICS_STAGES, bucketCount } from "./fulfillmentAnalyticsModel";

// Stages where an order left the happy path. They are charted apart from the
// fulfillment path so a drop-off is never read as progress.
const DROP_OFF_STAGES: Stage[] = ["cancelled", "expired"];

// Alternate "breakdown" view of the same analytics data: one bar per stage,
// grouped into the fulfillment path and the drop-offs. Each stage has one job
// per surface: the filter chips above filter and carry the counts, and the bars
// show the count on top with the stage name and share underneath, so there is no
// separate legend. Uses the exact same stage definitions, labels, colours and KPI
// math as the rest of the card (share = stageTotals[stage] / uniqueOrders).
// Desktop shows vertical bars; mobile shows progress rows, switched purely in
// CSS. Clicking a stage opens its orders.
export default function FulfillmentBreakdown({
  data,
  focused,
  onFocusStage,
  onOpen,
}: {
  data: FulfillmentAnalytics;
  focused: Stage;
  onFocusStage: (stage: Stage) => void;
  onOpen: (stage: Stage) => void;
}) {
  const rows = ANALYTICS_STAGES.map((s) => {
    // Safe against a stage key the RPC payload omits (schema/version drift).
    const count = bucketCount(data.stageTotals, s.key);
    return {
      ...s,
      count,
      // Same math as the KPI row: share of unique orders in view.
      percent: data.uniqueOrders ? Math.round((count / data.uniqueOrders) * 100) : 0,
    };
  });
  // One scale across both groups so bar heights stay comparable.
  const peak = Math.max(1, ...rows.map((r) => r.count));

  const groups = [
    {
      id: "path",
      title: "Fulfillment path",
      rows: rows.filter((r) => !DROP_OFF_STAGES.includes(r.key)),
    },
    {
      id: "drop-offs",
      title: "Drop-offs",
      rows: rows.filter((r) => DROP_OFF_STAGES.includes(r.key)),
    },
  ];

  const select = (s: Stage) => {
    onFocusStage(s);
    onOpen(s);
  };

  return (
    <div className="fulfillment-breakdown">
      {groups.map((group) => (
        <section
          key={group.id}
          className={`fulfillment-breakdown__group is-${group.id}`}
          aria-label={group.title}
        >
          <h3 className="fulfillment-breakdown__group-title">{group.title}</h3>
          {/* Desktop: vertical bars. Mobile: progress rows (CSS swaps the layout). */}
          <ul
            className="fulfillment-breakdown__list"
            style={{ ["--cols" as string]: group.rows.length }}
          >
            {group.rows.map((r) => (
              <li key={r.key} className={r.key === focused ? "is-focused" : undefined}>
                <button
                  type="button"
                  style={{ ["--chip" as string]: r.color }}
                  aria-pressed={r.key === focused}
                  onClick={() => select(r.key)}
                  aria-label={`View ${r.count.toLocaleString()} ${r.label} orders (${r.percent}% of orders in view)`}
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
                    <span className="fulfillment-breakdown__label">{r.label}</span>
                    <strong className="fulfillment-breakdown__count">
                      {r.count.toLocaleString()}
                    </strong>
                    <span className="fulfillment-breakdown__percent">{r.percent}%</span>
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
