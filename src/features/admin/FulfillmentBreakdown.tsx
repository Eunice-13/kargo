import type {
  FulfillmentAnalytics,
  FulfillmentAnalyticsStage as Stage,
} from "@/types/fulfillmentAnalytics";
import { ANALYTICS_STAGES, bucketCount } from "./fulfillmentAnalyticsModel";

// Alternate "breakdown" view of the same analytics data: a stacked share bar
// plus a per-stage bar/row display. Uses the exact same stage definitions,
// labels, colours and KPI math as the rest of the card (share =
// stageTotals[stage] / uniqueOrders). Desktop shows vertical bars; mobile shows
// progress rows — switched purely in CSS. Clicking a stage opens its orders.
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
  const peak = Math.max(1, ...rows.map((r) => r.count));
  const segmentTotal = Math.max(
    1,
    rows.reduce((sum, r) => sum + r.count, 0),
  );

  const select = (s: Stage) => {
    onFocusStage(s);
    onOpen(s);
  };

  return (
    <div className="fulfillment-breakdown">
      {/* Stacked share bar across stages. */}
      <div
        className="fulfillment-breakdown__stack"
        role="img"
        aria-label={`Fulfillment share: ${rows.map((r) => `${r.label} ${r.percent}%`).join(", ")}`}
      >
        {rows
          .filter((r) => r.count > 0)
          .map((r) => (
            <span
              key={r.key}
              className="fulfillment-breakdown__segment"
              style={{ background: r.color, flexGrow: r.count / segmentTotal }}
              title={`${r.label}: ${r.count.toLocaleString()}`}
            />
          ))}
      </div>

      {/* Desktop: vertical bars. Mobile: progress rows (CSS swaps the layout). */}
      <ul className="fulfillment-breakdown__list">
        {rows.map((r) => (
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
                <span className="fulfillment-stage-dot" style={{ background: r.color }} />
                <span className="fulfillment-breakdown__label">{r.label}</span>
                <strong className="fulfillment-breakdown__count">{r.count.toLocaleString()}</strong>
                <span className="fulfillment-breakdown__percent">{r.percent}%</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
