import { useEffect, useRef, useState } from "react";
import type { FulfillmentAnalytics, FulfillmentAnalyticsStage as Stage } from "@/types/fulfillmentAnalytics";
import { ANALYTICS_STAGES, analyticsDate, chartScale, tickIndices } from "./fulfillmentAnalyticsModel";

export default function FulfillmentTrendChart({ data, visible, focused, onFocusStage, onOpen }: {
  data: FulfillmentAnalytics; visible: Stage[]; focused: Stage;
  onFocusStage: (stage: Stage) => void;
  onOpen: (stage: Stage, bucket: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const [selected, setSelected] = useState(Math.max(0, data.chart.length - 1));
  const pointer = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  useEffect(() => {
    if (!host.current) return;
    const observer = new ResizeObserver(entries => setWidth(Math.max(240, entries[0].contentRect.width)));
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  const height = width < 600 ? 254 : 300;
  const left = 38, right = width - 14, top = 20, bottom = height - 37;
  const n = data.chart.length;
  const x = (i: number) => n < 2 ? (left + right) / 2 : left + (right - left) * i / (n - 1);
  const scale = chartScale(data, visible);
  const y = (value: number) => bottom - value / scale.max * (bottom - top);
  const index = Math.min(selected, Math.max(0, n - 1));
  const bucket = data.chart[index];
  const selectAt = (clientX: number, svg: SVGSVGElement) => {
    if (!n) return 0;
    const bounds = svg.getBoundingClientRect();
    const pos = (clientX - bounds.left) / bounds.width * width;
    const next = Math.max(0, Math.min(n - 1, Math.round((pos - left) / (right - left) * (n - 1))));
    setSelected(next);
    return next;
  };
  const series = ANALYTICS_STAGES.filter(s => visible.includes(s.key));
  return <div ref={host} className="fulfillment-trend">
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height}
      className="fulfillment-trend__plot" role="slider" tabIndex={n && visible.length ? 0 : -1}
      aria-label="Fulfillment timeline. Use arrow keys to inspect, Enter to view orders for the focused stage."
      aria-valuemin={0} aria-valuemax={Math.max(0, n - 1)} aria-valuenow={index}
      aria-valuetext={bucket ? `${analyticsDate(bucket.bucketStart, data.grouping)}; ${series.map(s => `${s.label}: ${bucket.counts[s.key]}`).join(", ")}` : "No buckets"}
      onKeyDown={event => {
        if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
          event.preventDefault();
          setSelected(event.key === "Home" ? 0 : event.key === "End" ? n - 1 : Math.max(0, Math.min(n - 1, index + (event.key === "ArrowRight" ? 1 : -1))));
        }
        if (event.key === "Enter" && bucket && visible.includes(focused)) onOpen(focused, bucket.bucketStart);
      }}
      onPointerDown={event => { pointer.current = { x: event.clientX, y: event.clientY, moved: false }; selectAt(event.clientX, event.currentTarget); }}
      onPointerMove={event => {
        if (pointer.current && Math.hypot(event.clientX - pointer.current.x, event.clientY - pointer.current.y) > 8) pointer.current.moved = true;
        if (event.pointerType === "mouse" || pointer.current) selectAt(event.clientX, event.currentTarget);
      }}
      onPointerUp={event => {
        const tapped = pointer.current && !pointer.current.moved;
        pointer.current = null;
        const at = selectAt(event.clientX, event.currentTarget);
        if (tapped && visible.includes(focused) && data.chart[at]) onOpen(focused, data.chart[at].bucketStart);
      }}
      onPointerCancel={() => { pointer.current = null; }}
      onPointerLeave={() => { pointer.current = null; }}>
      {scale.ticks.map(tick => <g key={tick} aria-hidden="true">
        <line x1={left} x2={right} y1={y(tick)} y2={y(tick)} className="fulfillment-trend__grid" />
        <text x={left - 10} y={y(tick) + 4} textAnchor="end">{new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(tick)}</text>
      </g>)}
      {series.map(s => {
        const points = data.chart.map((b, i) => `${x(i)},${y(b.counts[s.key])}`).join(" ");
        return <g key={s.key} aria-hidden="true">
          {s.key === focused && n > 1 && <polygon points={`${x(0)},${bottom} ${points} ${x(n - 1)},${bottom}`} fill={s.color} opacity=".07" />}
          <polyline points={points} fill="none" stroke={s.color} strokeWidth={s.key === focused ? 3 : 1.8} strokeDasharray={s.dash} strokeLinejoin="round" />
          {bucket && <circle cx={x(index)} cy={y(bucket.counts[s.key])} r={s.key === focused ? 4.5 : 3} fill={s.color} stroke="var(--kargo-surface, #fff)" strokeWidth="1.5" />}
        </g>;
      })}
      {bucket && <line x1={x(index)} x2={x(index)} y1={top} y2={bottom} stroke="var(--kargo-muted, #64748B)" strokeDasharray="4 5" opacity=".5" aria-hidden="true" />}
      {tickIndices(n, width < 600 ? 4 : 8).map(i => <text key={i} x={x(i)} y={height - 10}
        textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} aria-hidden="true">{analyticsDate(data.chart[i].bucketStart, data.grouping)}</text>)}
    </svg>
    {!visible.length && <p className="fulfillment-analytics__notice">Select a stage to show its trend.</p>}
    {bucket && visible.length > 0 && <div className="fulfillment-trend__readout">
      <div className="fulfillment-trend__readout-heading"><strong>{analyticsDate(bucket.bucketStart, data.grouping)}</strong><span>{data.grouping === "week" ? "Week beginning · " : ""}Manila time</span></div>
      <div className="fulfillment-trend__values">{series.map(s => <button type="button" key={s.key}
        onClick={() => { onFocusStage(s.key); onOpen(s.key, bucket.bucketStart); }}
        aria-label={`View ${bucket.counts[s.key]} ${s.label} orders for ${analyticsDate(bucket.bucketStart, data.grouping)}`}>
        <span className="fulfillment-stage-dot" style={{ background: s.color }} /><span>{s.label}</span><strong>{bucket.counts[s.key].toLocaleString()}</strong>
      </button>)}</div>
    </div>}
    <p className="fulfillment-trend__hint">Hover or drag to inspect · tap a count to view orders. Arrow keys and Enter work too.</p>
    <details className="fulfillment-trend__data"><summary>View accessible chart data</summary>
      <ul>{data.chart.map(b => <li key={b.bucketStart}><strong>{analyticsDate(b.bucketStart, data.grouping)}</strong>
        <div>{series.map(s => <button key={s.key} type="button" onClick={() => onOpen(s.key, b.bucketStart)}>{s.label}: {b.counts[s.key]}</button>)}</div>
      </li>)}</ul>
    </details>
  </div>;
}
