import { useEffect, useRef, useState } from "react";
import { BarChart3, ChevronDown, LineChart, RefreshCw } from "lucide-react";
import { adminApi } from "@/services";
import type {
  FulfillmentAnalyticsFilters,
  FulfillmentAnalyticsStage as Stage,
  FulfillmentCurrentStatus,
  FulfillmentCurrentStatusStage,
} from "@/types/fulfillmentAnalytics";
import { useAdminResource } from "./useAdminResource";
import {
  ANALYTICS_STAGES,
  PERIODS,
  analyticsTimestamp,
  bucketCount,
  customRangeError,
  manilaToday,
  type FulfillmentChartMode,
  type FulfillmentCountingMode,
} from "./fulfillmentAnalyticsModel";
import FulfillmentTrendChart from "./FulfillmentTrendChart";
import FulfillmentBreakdown from "./FulfillmentBreakdown";
import FulfillmentOrdersDialog from "./FulfillmentOrdersDialog";
import "./fulfillmentAnalytics.css";

type AnalyticsPointStage = Stage | FulfillmentCurrentStatusStage;

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
  const [countingMode, setCountingMode] = useState<FulfillmentCountingMode>("current");
  const [chartMode, setChartMode] = useState<FulfillmentChartMode>("bars");
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
            All sellers · {loadedAt ? `Loaded ${analyticsTimestamp(loadedAt)}` : "Loading"}
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
        countingMode={countingMode}
        setCountingMode={setCountingMode}
        chartMode={chartMode}
        setChartMode={setChartMode}
      />
    </section>
  );
}
function AnalyticsResults({
  filters,
  refreshKey,
  onLoaded,
  countingMode,
  setCountingMode,
  chartMode,
  setChartMode,
}: {
  filters: FulfillmentAnalyticsFilters;
  refreshKey: number;
  onLoaded: (iso: string) => void;
  countingMode: FulfillmentCountingMode;
  setCountingMode: (mode: FulfillmentCountingMode) => void;
  chartMode: FulfillmentChartMode;
  setChartMode: (mode: FulfillmentChartMode) => void;
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
  // On mobile the stage chips collapse behind a summary toggle to save space.
  const [stagesOpen, setStagesOpen] = useState(false);
  const [visible, setVisible] = useState<Stage[]>(() => ANALYTICS_STAGES.map((s) => s.key));
  const [point, setPoint] = useState<{
    stage: AnalyticsPointStage;
    bucket?: string;
    mode?: "reached" | "current";
  } | null>(null);
  useEffect(() => {
    const active = countingMode === "current" ? currentResource : resource;
    if (!active.loading && !active.error && active.data) onLoaded(active.data.generatedAt);
  }, [
    countingMode,
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
  }, [countingMode, chartMode]);
  useEffect(() => {
    setPoint(null);
  }, [refreshKey]);
  const activeResource = countingMode === "current" ? currentResource : resource;
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
  if (!data || (countingMode === "current" && !currentData)) return null;
  const cohortSize =
    countingMode === "current" ? currentData!.cohortSize : (data.cohortSize ?? data.uniqueOrders);
  const deliveryCount =
    countingMode === "current"
      ? currentData!.counts.delivered
      : bucketCount(data.stageTotals, "delivered");
  const deliveryPercent = cohortSize ? Math.round((deliveryCount / cohortSize) * 100) : null;
  const trendData =
    countingMode === "current"
      ? {
          ...data,
          grouping: currentData!.grouping,
          generatedAt: currentData!.generatedAt,
          cohortSize: currentData!.cohortSize,
          uniqueOrders: currentData!.cohortSize,
          stageTotals: currentData!.counts as unknown as typeof data.stageTotals,
          chart: currentData!.chart as unknown as typeof data.chart,
        }
      : data;
  const chartTitle =
    chartMode === "trend"
      ? "Orders per day"
      : countingMode === "current"
        ? "Where orders are right now"
        : "Orders that reached each stage";
  return (
    <>
      <div className="fulfillment-analytics__content-grid">
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
        <div className="fulfillment-analytics__main-column">
          <p className="fulfillment-analytics__definition">
            {filters.period === "custom"
              ? `${filters.start} – ${filters.end}`
              : PERIODS.find(([key]) => key === filters.period)?.[1]}{" "}
            · Grouped by {data.grouping === "hour" ? "hour" : data.grouping} (Manila time).{" "}
            {countingMode === "current"
              ? "Where orders are right now. Each order is counted once, in its latest stage. Orders without payment confirmation are not included."
              : "Orders that reached each stage are counted. An order can appear in several stages, so percentages add up to more than 100%."}{" "}
            {(data.excludedOrders ?? 0).toLocaleString()} orders excluded by the recorded-history
            boundary.
          </p>
          <div className="fulfillment-analytics__chart-header-row">
            {chartMode === "bars" ? (
              <div
                className={`fulfillment-analytics__stage-field ${chartMode === "bars" ? "is-status" : "is-chips"}`}
              >
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
                        {countingMode === "current"
                          ? Number(
                              currentData!.counts[
                                stage.key as keyof FulfillmentCurrentStatus["counts"]
                              ] ?? 0,
                            ).toLocaleString()
                          : bucketCount(data.stageTotals, stage.key).toLocaleString()}
                      </strong>
                    </button>
                  ))}
                  {countingMode === "current" && (currentData!.counts.other ?? 0) > 0 && (
                    <button type="button" disabled aria-label="Other current-status orders">
                      <span className="fulfillment-stage-dot" style={{ background: "#64748B" }} />
                      <span>Other</span>
                      <strong>{currentData!.counts.other.toLocaleString()}</strong>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div
                className="fulfillment-analytics__trend-chips"
                role="list"
                aria-label="Trend stages"
              >
                {ANALYTICS_STAGES.map((stage) => {
                  const isVisible = visible.includes(stage.key);
                  const count =
                    countingMode === "current"
                      ? Number(
                          currentData!.counts[
                            stage.key as keyof FulfillmentCurrentStatus["counts"]
                          ] ?? 0,
                        )
                      : bucketCount(data.stageTotals, stage.key);
                  return (
                    <button
                      type="button"
                      key={stage.key}
                      className={`${isVisible ? "is-visible" : ""}${stage.key === "cancelled" ? " is-cancelled" : ""}`}
                      style={{ ["--chip" as string]: stage.color }}
                      aria-pressed={isVisible}
                      onClick={() =>
                        setVisible((current) =>
                          isVisible
                            ? current.filter((key) => key !== stage.key)
                            : [...current, stage.key],
                        )
                      }
                    >
                      <span className="fulfillment-stage-dot" style={{ background: stage.color }} />
                      <span>{stage.label}</span>
                      <strong>{count.toLocaleString()}</strong>
                    </button>
                  );
                })}
              </div>
            )}
            <h3 className="fulfillment-analytics__chart-title">{chartTitle}</h3>
            <div className="fulfillment-analytics__focus-actions">
              <div
                className="fulfillment-analytics__counting-toggle"
                role="radiogroup"
                aria-label="Order counting mode"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={countingMode === "current"}
                  aria-pressed={countingMode === "current"}
                  onClick={() => {
                    setCountingMode("current");
                    setChartMode("bars");
                  }}
                >
                  Current status
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={countingMode === "reached"}
                  aria-pressed={countingMode === "reached"}
                  onClick={() => setCountingMode("reached")}
                >
                  Reached stage
                </button>
              </div>
              {countingMode === "reached" && (
                <div
                  className="fulfillment-analytics__chart-toggle"
                  role="radiogroup"
                  aria-label="Chart view"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-label="Stage bars"
                    aria-checked={chartMode === "bars"}
                    aria-pressed={chartMode === "bars"}
                    onClick={() => setChartMode("bars")}
                  >
                    <BarChart3 size={18} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-label="Trend chart"
                    aria-checked={chartMode === "trend"}
                    aria-pressed={chartMode === "trend"}
                    onClick={() => setChartMode("trend")}
                  >
                    <LineChart size={18} aria-hidden="true" />
                  </button>
                </div>
              )}
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
          {chartMode === "trend" ? (
            cohortSize < 5 ? (
              <p
                className="fulfillment-analytics__notice fulfillment-analytics__notice--empty"
                role="status"
              >
                Not enough orders to show a trend yet.
              </p>
            ) : (
              <FulfillmentTrendChart
                key={`${trendData.generatedAt}:${countingMode}`}
                data={trendData}
                visible={visible}
                focused={focused}
                onFocusStage={setFocused}
                onOpen={(stage, bucket) => setPoint({ stage, bucket, mode: countingMode })}
              />
            )
          ) : (
            <FulfillmentBreakdown
              data={data}
              view={countingMode}
              currentStatus={currentData ?? undefined}
              focused={focused}
              onFocusStage={setFocused}
              onOpen={(stage) => setPoint({ stage, mode: countingMode })}
            />
          )}
        </div>
      </div>
      <footer className="fulfillment-analytics__footer">
        <p>
          {chartMode === "trend"
            ? `Orders per day, grouped by ${data.grouping} (Manila time).`
            : countingMode === "current"
              ? `Each order counted once, in its latest stage · Recording began ${analyticsTimestamp(data.captureStartedAt)}`
              : `An order counts in every stage it has reached · Recording began ${analyticsTimestamp(data.captureStartedAt)}`}
        </p>
        <button type="button" onClick={() => setPoint({ stage: focused, mode: countingMode })}>
          View {ANALYTICS_STAGES.find((stage) => stage.key === focused)?.label ?? "stage"} orders →
        </button>
      </footer>
      {point && (
        <FulfillmentOrdersDialog
          key={`${point.stage}:${point.bucket ?? "all"}`}
          data={data}
          filters={filters}
          {...point}
          mode={point.mode ?? "reached"}
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
