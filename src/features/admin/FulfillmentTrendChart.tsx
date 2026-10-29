import { useEffect, useRef, useState } from "react";
import type {
  FulfillmentAnalytics,
  FulfillmentAnalyticsStage as Stage,
} from "@/types/fulfillmentAnalytics";
import {
  ANALYTICS_STAGES,
  analyticsDate,
  chartScale,
  tickIndices,
} from "./fulfillmentAnalyticsModel";

export default function FulfillmentTrendChart({
  data,
  visible,
  focused,
  onFocusStage,
  onOpen,
}: {
  data: FulfillmentAnalytics;
  visible: Stage[];
  focused: Stage;
  onFocusStage: (stage: Stage) => void;
  onOpen: (stage: Stage, bucket: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const [selected, setSelected] = useState(Math.max(0, data.chart.length - 1));
  // The day tooltip is a transient hover affordance (YouTube-style): it only
  // shows while the user is hovering/scrubbing the chart or navigating by
  // keyboard, and hides as soon as the pointer leaves.
  const [active, setActive] = useState(false);
  const pointer = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  useEffect(() => {
    if (!host.current) return;
    const observer = new ResizeObserver((entries) =>
      setWidth(Math.max(240, entries[0].contentRect.width)),
    );
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  const height = width < 600 ? 254 : 300;
  const left = 38,
    right = width - 14,
    top = 20,
    bottom = height - 37;
  const n = data.chart.length;
  const x = (i: number) => (n < 2 ? (left + right) / 2 : left + ((right - left) * i) / (n - 1));
  const scale = chartScale(data, visible);
  const y = (value: number) => bottom - (value / scale.max) * (bottom - top);
  const index = Math.min(selected, Math.max(0, n - 1));
  const bucket = data.chart[index];
  const selectAt = (clientX: number, svg: SVGSVGElement) => {
    if (!n) return 0;
    const bounds = svg.getBoundingClientRect();
    const pos = ((clientX - bounds.left) / bounds.width) * width;
    const next = Math.max(
      0,
      Math.min(n - 1, Math.round(((pos - left) / (right - left)) * (n - 1))),
    );
    setSelected(next);
    return next;
  };
  const series = ANALYTICS_STAGES.filter((s) => visible.includes(s.key));
  // Draw order: non-focused lines first, the focused line last so it paints on
  // top (YouTube-style highlight). Readout/aria keep the stable `series` order.
  const renderSeries = [...series].sort(
    (a, b) => Number(a.key === focused) - Number(b.key === focused),
  );
  return (
    <div ref={host} className="fulfillment-trend">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        className="fulfillment-trend__plot"
        role="slider"
        tabIndex={n && visible.length ? 0 : -1}
        aria-label="Fulfillment timeline. Use arrow keys to inspect, Enter to view orders for the focused stage."
        aria-valuemin={0}
        aria-valuemax={Math.max(0, n - 1)}
        aria-valuenow={index}
        aria-valuetext={
          bucket
            ? `${analyticsDate(bucket.bucketStart, data.grouping)}; ${series.map((s) => `${s.label}: ${bucket.counts[s.key]}`).join(", ")}`
            : "No buckets"
        }
        onKeyDown={(event) => {
          if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
            event.preventDefault();
            setActive(true);
            setSelected(
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? n - 1
                  : Math.max(0, Math.min(n - 1, index + (event.key === "ArrowRight" ? 1 : -1))),
            );
          }
          if (event.key === "Enter" && bucket && visible.includes(focused))
            onOpen(focused, bucket.bucketStart);
        }}
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") setActive(true);
        }}
        onPointerDown={(event) => {
          pointer.current = { x: event.clientX, y: event.clientY, moved: false };
          setActive(true);
          selectAt(event.clientX, event.currentTarget);
        }}
        onPointerMove={(event) => {
          if (
            pointer.current &&
            Math.hypot(event.clientX - pointer.current.x, event.clientY - pointer.current.y) > 8
          )
            pointer.current.moved = true;
          if (event.pointerType === "mouse" || pointer.current) {
            setActive(true);
            selectAt(event.clientX, event.currentTarget);
          }
        }}
        onPointerUp={(event) => {
          const tapped = pointer.current && !pointer.current.moved;
          pointer.current = null;
          const at = selectAt(event.clientX, event.currentTarget);
          if (tapped && visible.includes(focused) && data.chart[at])
            onOpen(focused, data.chart[at].bucketStart);
        }}
        onPointerCancel={() => {
          pointer.current = null;
          setActive(false);
        }}
        onPointerLeave={() => {
          pointer.current = null;
          setActive(false);
        }}
        onBlur={() => setActive(false)}
      >
        {scale.ticks.map((tick) => (
          <g key={tick} aria-hidden="true">
            <line
              x1={left}
              x2={right}
              y1={y(tick)}
              y2={y(tick)}
              className="fulfillment-trend__grid"
            />
            <text x={left - 10} y={y(tick) + 4} textAnchor="end">
              {new Intl.NumberFormat("en", {
                notation: "compact",
                maximumFractionDigits: 1,
              }).format(tick)}
            </text>
          </g>
        ))}
        {renderSeries.map((s) => {
          const points = data.chart.map((b, i) => `${x(i)},${y(b.counts[s.key])}`).join(" ");
          const isFocused = s.key === focused;
          return (
            <g key={s.key} aria-hidden="true" opacity={isFocused ? 1 : 0.28}>
              {isFocused && n > 1 && (
                <polygon
                  points={`${x(0)},${bottom} ${points} ${x(n - 1)},${bottom}`}
                  fill={s.color}
                  opacity=".1"
                />
              )}
              <polyline
                points={points}
                fill="none"
                stroke={s.color}
                strokeWidth={isFocused ? 3 : 1.5}
                strokeDasharray={s.dash}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {active && bucket && (
                <circle
                  cx={x(index)}
                  cy={y(bucket.counts[s.key])}
                  r={isFocused ? 5 : 2.5}
                  fill={s.color}
                  stroke="var(--kargo-surface, #fff)"
                  strokeWidth={isFocused ? 2 : 1.5}
                />
              )}
            </g>
          );
        })}
        {active && bucket && (
          <line
            x1={x(index)}
            x2={x(index)}
            y1={top}
            y2={bottom}
            stroke="var(--kargo-border-strong, #d7deea)"
            strokeDasharray="3 4"
            opacity=".9"
            aria-hidden="true"
          />
        )}
        {tickIndices(n, width < 600 ? 4 : 8).map((i) => (
          <text
            key={i}
            x={x(i)}
            y={height - 10}
            textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
            aria-hidden="true"
          >
            {analyticsDate(data.chart[i].bucketStart, data.grouping)}
          </text>
        ))}
      </svg>
      {!visible.length && (
        <p
          className="fulfillment-analytics__notice fulfillment-analytics__notice--empty"
          role="status"
        >
          Select a stage above to show its trend.
        </p>
      )}
      {active && bucket && visible.length > 0 && (
        <div
          className="fulfillment-trend__tooltip"
          // Float next to the selected point. Anchor by the point's horizontal
          // position (as a % of plot width); flip to the left half near the
          // right edge so the card never spills off the chart.
          data-side={x(index) > width * 0.58 ? "left" : "right"}
          style={{ left: `${(x(index) / width) * 100}%` }}
          role="status"
        >
          <div className="fulfillment-trend__tooltip-heading">
            {analyticsDate(bucket.bucketStart, data.grouping)}
          </div>
          <ul className="fulfillment-trend__tooltip-rows">
            {series.map((s) => (
              <li key={s.key}>
                <span className="fulfillment-stage-dot" style={{ background: s.color }} />
                <span className="fulfillment-trend__tooltip-label">{s.label}</span>
                <strong>{bucket.counts[s.key].toLocaleString()}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="fulfillment-trend__hint">
        Hover a day to see its breakdown. Use the stage chips above and “View orders” to open
        orders. Arrow keys and Enter work too.
      </p>
    </div>
  );
}
