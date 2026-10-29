import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { adminApi } from "@/services";
import type {
  FulfillmentAnalyticsFilters,
  FulfillmentAnalyticsStage as Stage,
} from "@/types/fulfillmentAnalytics";
import { useAdminResource } from "./useAdminResource";
import {
  ANALYTICS_STAGES,
  PERIODS,
  analyticsTimestamp,
  customRangeError,
  manilaToday,
} from "./fulfillmentAnalyticsModel";
import FulfillmentTrendChart from "./FulfillmentTrendChart";
import FulfillmentOrdersDialog from "./FulfillmentOrdersDialog";
import "./fulfillmentAnalytics.css";

export default function AdminFulfillmentAnalytics({ refreshKey = 0 }: { refreshKey?: number }) {
  const [filters, setFilters] = useState<FulfillmentAnalyticsFilters>({ period: "last_30_days" });
  const [period, setPeriod] = useState("last_30_days");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState(manilaToday);
  const [validation, setValidation] = useState<string | null>(null);
  const [manual, setManual] = useState(0);
  const [loadedAt, setLoadedAt] = useState<string | null>(null);
  return (
    <section className="fulfillment-analytics" aria-labelledby="fulfillment-analytics-title">
      <header className="fulfillment-analytics__header">
        <div>
          <h2 id="fulfillment-analytics-title">Order Fulfillment</h2>
          <p>
            All sellers ·{" "}
            {loadedAt ? `last loaded ${analyticsTimestamp(loadedAt)}` : "Recorded stage entries"}
            <span className="fulfillment-analytics__timezone"> · Manila time</span>
          </p>
        </div>
        <div className="fulfillment-analytics__controls">
          <div
            className="fulfillment-analytics__periods"
            role="group"
            aria-label="Analytics date range"
          >
            {PERIODS.map(([key, label]) => (
              <button
                type="button"
                key={key}
                aria-pressed={period === key}
                onClick={() => {
                  setPeriod(key);
                  setValidation(null);
                  if (key !== "custom") setFilters({ period: key });
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="fulfillment-analytics__refresh"
            aria-label="Refresh fulfillment analytics"
            onClick={() => setManual((n) => n + 1)}
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </header>
      {period === "custom" && (
        <form
          className="fulfillment-analytics__custom"
          onSubmit={(event) => {
            event.preventDefault();
            const problem = customRangeError(start, end);
            setValidation(problem);
            if (!problem) setFilters({ period: "custom", start, end });
          }}
        >
          <label>
            Start date
            <input
              type="date"
              value={start}
              max={manilaToday()}
              onChange={(e) => setStart(e.target.value)}
              aria-invalid={!!validation}
            />
          </label>
          <label>
            End date
            <input
              type="date"
              value={end}
              max={manilaToday()}
              min={start || undefined}
              onChange={(e) => setEnd(e.target.value)}
              aria-invalid={!!validation}
            />
          </label>
          <button type="submit">Apply range</button>
          {validation && <p role="alert">{validation}</p>}
          {!validation &&
            (filters.period !== "custom" || filters.start !== start || filters.end !== end) && (
              <p>
                Choose dates and apply to update the chart. The last applied range remains below.
              </p>
            )}
        </form>
      )}
      <AnalyticsResults
        key={JSON.stringify(filters)}
        filters={filters}
        refreshKey={refreshKey + manual}
        onLoaded={setLoadedAt}
      />
    </section>
  );
}
function AnalyticsResults({
  filters,
  refreshKey,
  onLoaded,
}: {
  filters: FulfillmentAnalyticsFilters;
  refreshKey: number;
  onLoaded: (iso: string) => void;
}) {
  const resource = useAdminResource(() => adminApi.fulfillmentAnalytics(filters), [], refreshKey);
  // YouTube-style: every stage line is always drawn, but the selected
  // (`focused`) stage is pulled to the front and emphasised while the rest
  // stay visible but dimmed in the back. Selecting a chip only changes which
  // line is highlighted — it never hides the others.
  const [focused, setFocused] = useState<Stage>("delivered");
  const visible: Stage[] = ANALYTICS_STAGES.map((s) => s.key);
  const [point, setPoint] = useState<{ stage: Stage; bucket?: string } | null>(null);
  useEffect(() => {
    if (!resource.loading && !resource.error && resource.data) onLoaded(resource.data.generatedAt);
  }, [resource.loading, resource.error, resource.data, onLoaded]);
  useEffect(() => {
    setPoint(null);
  }, [refreshKey]);
  if (resource.loading)
    return (
      <>
        <div role="status" className="fulfillment-analytics__loading">
          <span />
          Loading fulfillment history…
        </div>
        <div className="fulfillment-analytics__skeleton" aria-hidden="true">
          <div className="fulfillment-analytics__skeleton-kpis" />
          <div className="fulfillment-analytics__skeleton-chart" />
        </div>
      </>
    );
  if (resource.error)
    return (
      <div
        role="alert"
        className="fulfillment-analytics__notice fulfillment-analytics__notice--error"
      >
        <h3>Fulfillment analytics unavailable</h3>
        <p>
          {resource.accessDenied
            ? "Admin access is required to view fulfillment analytics."
            : /demo mode/i.test(resource.error)
              ? "Recorded fulfillment history isn’t available in demo mode."
              : /function|schema cache|does not exist/i.test(resource.error)
                ? "Fulfillment analytics hasn’t been enabled in this environment yet."
                : "We couldn’t load fulfillment history. Your last successful load time is shown above."}
        </p>
        <button type="button" onClick={resource.refresh}>
          Try again
        </button>
      </div>
    );
  const data = resource.data;
  if (!data) return null;
  const deliveryPercent = data.uniqueOrders
    ? Math.round((data.stageTotals.delivered / data.uniqueOrders) * 100)
    : null;
  return (
    <>
      <div className="fulfillment-analytics__summary">
        <div>
          <strong>{data.uniqueOrders.toLocaleString()}</strong>
          <span>orders in view</span>
        </div>
        <div>
          <strong>{deliveryPercent === null ? "—" : `${deliveryPercent}%`}</strong>
          <span>reached delivery</span>
        </div>
        <div>
          <strong>{data.totalEntries.toLocaleString()}</strong>
          <span>stage entries</span>
        </div>
      </div>
      <p className="fulfillment-analytics__definition">
        {filters.period === "custom"
          ? `${filters.start} – ${filters.end}`
          : PERIODS.find(([key]) => key === filters.period)?.[1]}{" "}
        ·{" "}
        {data.grouping === "hour"
          ? "Hourly"
          : data.grouping === "day"
            ? "Daily"
            : data.grouping === "week"
              ? "Weekly"
              : "Monthly"}{" "}
        entries. An order can enter more than one stage.
      </p>
      <div
        className="fulfillment-analytics__stages"
        role="radiogroup"
        aria-label="Highlight a fulfillment stage"
      >
        {ANALYTICS_STAGES.map((stage) => (
          <button
            type="button"
            key={stage.key}
            role="radio"
            aria-checked={focused === stage.key}
            aria-pressed={focused === stage.key}
            style={{ ["--chip" as string]: stage.color }}
            onClick={() => setFocused(stage.key)}
          >
            <span className="fulfillment-stage-dot" style={{ background: stage.color }} />
            <span>{stage.label}</span>
            <strong>{data.stageTotals[stage.key].toLocaleString()}</strong>
          </button>
        ))}
      </div>
      <div className="fulfillment-analytics__focus">
        <span className="fulfillment-analytics__focus-label">
          Highlighting <strong>{ANALYTICS_STAGES.find((s) => s.key === focused)?.label}</strong>
        </span>
        <button type="button" onClick={() => setPoint({ stage: focused })}>
          View orders →
        </button>
      </div>
      {!data.totalEntries && (
        <p
          className="fulfillment-analytics__notice fulfillment-analytics__notice--empty"
          role="status"
        >
          No recorded stage entries in this range. Try another date range.
        </p>
      )}
      <FulfillmentTrendChart
        key={data.generatedAt}
        data={data}
        visible={visible}
        focused={focused}
        onFocusStage={setFocused}
        onOpen={(stage, bucket) => setPoint({ stage, bucket })}
      />
      <p className="fulfillment-analytics__coverage">
        Historical coverage is partial. Only evidenced stage entries are counted; missing history is
        not treated as a known zero. Continuous recording began{" "}
        {analyticsTimestamp(data.captureStartedAt)}.
      </p>
      {point && (
        <FulfillmentOrdersDialog
          key={`${point.stage}:${point.bucket ?? "all"}`}
          data={data}
          filters={filters}
          {...point}
          onClose={() => setPoint(null)}
          onRefresh={() => {
            setPoint(null);
            resource.refresh();
          }}
        />
      )}
    </>
  );
}
