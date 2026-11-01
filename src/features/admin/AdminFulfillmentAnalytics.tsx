import { useEffect, useRef, useState } from "react";
import { BarChart3, ChevronDown, LineChart, RefreshCw } from "lucide-react";
import { adminApi } from "@/services";
import type {
  FulfillmentAnalyticsFilters,
  FulfillmentAnalyticsStage as Stage,
  FulfillmentCurrentStatus,
} from "@/types/fulfillmentAnalytics";
import { useAdminResource } from "./useAdminResource";
import {
  ANALYTICS_STAGES,
  PERIODS,
  analyticsTimestamp,
  bucketCount,
  customRangeError,
  manilaToday,
  type FulfillmentAnalyticsView,
} from "./fulfillmentAnalyticsModel";
import FulfillmentTrendChart from "./FulfillmentTrendChart";
import FulfillmentBreakdown from "./FulfillmentBreakdown";
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
  // On mobile the date range collapses behind a summary toggle to save space.
  const [periodsOpen, setPeriodsOpen] = useState(false);
  // Custom date ranges open in a compact popover instead of taking a full row.
  const [customOpen, setCustomOpen] = useState(false);
  const periodFieldRef = useRef<HTMLDivElement>(null);
  const activePeriodLabel = PERIODS.find(([key]) => key === period)?.[1] ?? "Range";

  useEffect(() => {
    if (!customOpen) return;
    const dismiss = (event: PointerEvent) => {
      if (!periodFieldRef.current?.contains(event.target as Node)) setCustomOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [customOpen]);
  return (
    <section className="fulfillment-analytics" aria-labelledby="fulfillment-analytics-title">
      <header className="fulfillment-analytics__header">
        <div>
          <h2 id="fulfillment-analytics-title">Order Fulfillment</h2>
          <p>
            All sellers ·{" "}
            {loadedAt ? `last loaded ${analyticsTimestamp(loadedAt)}` : "Payment-confirmed cohort"}
            <span className="fulfillment-analytics__timezone"> · Manila time</span>
          </p>
        </div>
        <div className="fulfillment-analytics__controls">
          <div ref={periodFieldRef} className="fulfillment-analytics__period-field">
            <button
              type="button"
              className="fulfillment-analytics__disclosure"
              aria-expanded={periodsOpen}
              aria-controls="fulfillment-period-options"
              onClick={() => setPeriodsOpen((o) => !o)}
            >
              <span>
                <span className="fulfillment-analytics__disclosure-label">Range</span>
                {activePeriodLabel}
              </span>
              <ChevronDown size={16} aria-hidden="true" />
            </button>
            <div
              id="fulfillment-period-options"
              className="fulfillment-analytics__periods"
              role="group"
              aria-label="Analytics date range"
              data-open={periodsOpen}
            >
              {PERIODS.map(([key, label]) => (
                <button
                  type="button"
                  key={key}
                  aria-pressed={period === key}
                  onClick={() => {
                    setValidation(null);
                    setPeriodsOpen(false);
                    if (key === "custom") {
                      setPeriod("custom");
                      setCustomOpen((open) => !open);
                      return;
                    }
                    setCustomOpen(false);
                    setPeriod(key);
                    setFilters({ period: key });
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            {customOpen && (
              <form
                className="fulfillment-analytics__custom"
                onSubmit={(event) => {
                  event.preventDefault();
                  const problem = customRangeError(start, end);
                  setValidation(problem);
                  if (!problem) {
                    setPeriod("custom");
                    setFilters({ period: "custom", start, end });
                    setCustomOpen(false);
                  }
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
              </form>
            )}
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
  const currentResource = useAdminResource(
    () => adminApi.fulfillmentCurrentStatus(filters),
    [],
    refreshKey,
  );
  // YouTube-style: every stage line is always drawn, but the selected
  // (`focused`) stage is pulled to the front and emphasised while the rest
  // stay visible but dimmed in the back. Selecting a chip only changes which
  // line is highlighted — it never hides the others.
  const [focused, setFocused] = useState<Stage>("delivered");
  // Three ways to view the same cohort: trend, reached-stage funnel, or current status.
  const [view, setView] = useState<FulfillmentAnalyticsView>("current");
  // On mobile the stage chips collapse behind a summary toggle to save space.
  const [stagesOpen, setStagesOpen] = useState(false);
  const visible: Stage[] = ANALYTICS_STAGES.map((s) => s.key);
  const [point, setPoint] = useState<{ stage: Stage; bucket?: string } | null>(null);
  useEffect(() => {
    const active = view === "current" ? currentResource : resource;
    if (!active.loading && !active.error && active.data) onLoaded(active.data.generatedAt);
  }, [
    view,
    resource.loading,
    resource.error,
    resource.data,
    currentResource.loading,
    currentResource.error,
    currentResource.data,
    onLoaded,
  ]);
  useEffect(() => {
    setPoint(null);
  }, [view]);
  useEffect(() => {
    setPoint(null);
  }, [refreshKey]);
  const activeResource = view === "current" ? currentResource : resource;
  if (activeResource.loading || resource.loading)
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
  if (activeResource.error)
    return (
      <div
        role="alert"
        className="fulfillment-analytics__notice fulfillment-analytics__notice--error"
      >
        <h3>Fulfillment analytics unavailable</h3>
        <p>
          {activeResource.accessDenied
            ? "Admin access is required to view fulfillment analytics."
            : /demo mode/i.test(activeResource.error)
              ? "Recorded fulfillment history isn’t available in demo mode."
              : /function|schema cache|does not exist/i.test(activeResource.error)
                ? "Fulfillment analytics hasn’t been enabled in this environment yet."
                : "We couldn’t load fulfillment history. Your last successful load time is shown above."}
        </p>
        <button type="button" onClick={activeResource.refresh}>
          Try again
        </button>
      </div>
    );
  const data = resource.data;
  const currentData = currentResource.data;
  if (!data || (view === "current" && !currentData)) return null;
  const cohortSize =
    view === "current" ? currentData!.cohortSize : (data.cohortSize ?? data.uniqueOrders);
  const deliveryCount =
    view === "current" ? currentData!.counts.delivered : bucketCount(data.stageTotals, "delivered");
  const deliveryPercent = cohortSize ? Math.round((deliveryCount / cohortSize) * 100) : null;
  return (
    <>
      <div className="fulfillment-analytics__summary">
        <div>
          <strong>{cohortSize.toLocaleString()}</strong>
          <span>orders in cohort</span>
        </div>
        <div>
          <strong>{deliveryPercent === null ? "—" : `${deliveryPercent}%`}</strong>
          <span>reached delivery</span>
        </div>
      </div>
      <p className="fulfillment-analytics__definition">
        {filters.period === "custom"
          ? `${filters.start} – ${filters.end}`
          : PERIODS.find(([key]) => key === filters.period)?.[1]}{" "}
        · Grouped by {data.grouping === "hour" ? "hour" : data.grouping} (Manila time).{" "}
        {view === "current"
          ? "Where orders are right now. Each order is counted once, in its latest stage. Orders without payment confirmation are not included."
          : "Orders that reached each stage are counted. An order can appear in several stages, so percentages add up to more than 100%."}{" "}
        {(data.excludedOrders ?? 0).toLocaleString()} orders excluded by the recorded-history
        boundary.
      </p>
      <div className="fulfillment-analytics__stage-row">
        <div className="fulfillment-analytics__stage-field">
          <button
            type="button"
            className="fulfillment-analytics__disclosure"
            aria-expanded={stagesOpen}
            aria-controls="fulfillment-stage-options"
            onClick={() => setStagesOpen((o) => !o)}
          >
            <span>
              <span className="fulfillment-analytics__disclosure-label">Stage</span>
              <span
                className="fulfillment-stage-dot"
                style={{ background: ANALYTICS_STAGES.find((s) => s.key === focused)?.color }}
              />
              {ANALYTICS_STAGES.find((s) => s.key === focused)?.label}
            </span>
            <ChevronDown size={16} aria-hidden="true" />
          </button>
          <div
            id="fulfillment-stage-options"
            className="fulfillment-analytics__stages"
            role="radiogroup"
            aria-label="Highlight a fulfillment stage"
            data-open={stagesOpen}
          >
            {ANALYTICS_STAGES.map((stage) => (
              <button
                type="button"
                key={stage.key}
                role="radio"
                aria-checked={focused === stage.key}
                aria-pressed={focused === stage.key}
                style={{ ["--chip" as string]: stage.color }}
                onClick={() => {
                  setFocused(stage.key);
                  setStagesOpen(false);
                }}
              >
                <span className="fulfillment-stage-dot" style={{ background: stage.color }} />
                <span>{stage.label}</span>
                <strong>
                  {view === "current"
                    ? Number(
                        currentData!.counts[
                          stage.key as keyof FulfillmentCurrentStatus["counts"]
                        ] ?? 0,
                      ).toLocaleString()
                    : bucketCount(data.stageTotals, stage.key).toLocaleString()}
                </strong>
              </button>
            ))}
            {view === "current" && (currentData!.counts.other ?? 0) > 0 && (
              <button type="button" disabled aria-label="Other current-status orders">
                <span className="fulfillment-stage-dot" style={{ background: "#64748B" }} />
                <span>Other</span>
                <strong>{currentData!.counts.other.toLocaleString()}</strong>
              </button>
            )}
          </div>
        </div>
        <div className="fulfillment-analytics__focus-actions">
          <div
            className="fulfillment-analytics__view-toggle"
            role="radiogroup"
            aria-label="Analytics view"
          >
            <button
              type="button"
              role="radio"
              aria-checked={view === "trend"}
              aria-pressed={view === "trend"}
              onClick={() => setView("trend")}
            >
              <LineChart size={15} aria-hidden="true" />
              Trend
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={view === "reached"}
              aria-pressed={view === "reached"}
              onClick={() => setView("reached")}
            >
              <BarChart3 size={15} aria-hidden="true" />
              Reached stage
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={view === "current"}
              aria-pressed={view === "current"}
              onClick={() => setView("current")}
            >
              Current status
            </button>
          </div>
          <button type="button" onClick={() => setPoint({ stage: focused })}>
            View orders →
          </button>
        </div>
      </div>
      {!data.totalEntries && (
        <p
          className="fulfillment-analytics__notice fulfillment-analytics__notice--empty"
          role="status"
        >
          No cohort orders are available in this range. Try another date range.
        </p>
      )}
      {view === "trend" ? (
        <FulfillmentTrendChart
          key={data.generatedAt}
          data={data}
          visible={visible}
          focused={focused}
          onFocusStage={setFocused}
          onOpen={(stage, bucket) => setPoint({ stage, bucket })}
        />
      ) : (
        <FulfillmentBreakdown
          data={data}
          view={view}
          currentStatus={currentData ?? undefined}
          focused={focused}
          onFocusStage={setFocused}
          onOpen={view === "reached" ? (stage) => setPoint({ stage }) : undefined}
        />
      )}
      <p className="fulfillment-analytics__coverage">
        Analytics uses the earliest available recorded fulfillment history. Recording began{" "}
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
