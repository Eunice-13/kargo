import test from "node:test";
import assert from "node:assert/strict";

import {
  bucketCount,
  chartScale,
  customRangeError,
  tickIndices,
} from "../src/features/admin/fulfillmentAnalyticsModel.ts";
import type { FulfillmentAnalytics } from "../src/types/fulfillmentAnalytics.ts";

const TODAY = "2026-10-29";

test("customRangeError requires both dates", () => {
  assert.match(customRangeError("", "2026-10-01", TODAY) ?? "", /both a start and an end/i);
  assert.match(customRangeError("2026-10-01", "", TODAY) ?? "", /both a start and an end/i);
});

test("customRangeError rejects a start after the end", () => {
  assert.match(
    customRangeError("2026-10-29", "2026-10-01", TODAY) ?? "",
    /start date must be on or before the end date/i,
  );
});

test("customRangeError rejects an end later than today in Manila", () => {
  assert.match(
    customRangeError("2026-10-01", "2026-11-30", TODAY) ?? "",
    /cannot be later than today/i,
  );
});

test("customRangeError rejects malformed dates", () => {
  assert.match(customRangeError("10/01/2026", "2026-10-29", TODAY) ?? "", /valid calendar dates/i);
  assert.match(customRangeError("2026-13-01", "2026-10-29", TODAY) ?? "", /valid calendar dates/i);
});

test("customRangeError accepts a valid range including a same-day range", () => {
  assert.equal(customRangeError("2026-10-01", "2026-10-29", TODAY), null);
  assert.equal(customRangeError("2026-10-29", "2026-10-29", TODAY), null);
});

test("tickIndices always includes the first and last bucket and never exceeds the limit", () => {
  for (const [length, limit] of [
    [30, 8],
    [30, 4],
    [7, 8],
    [1, 8],
    [0, 8],
    [2, 4],
  ] as const) {
    const ticks = tickIndices(length, limit);
    if (length === 0) {
      assert.deepEqual(ticks, []);
      continue;
    }
    assert.ok(ticks.length <= limit, `len=${length} limit=${limit} -> ${ticks.length} ticks`);
    assert.equal(ticks[0], 0, "first bucket is always a tick");
    assert.equal(ticks[ticks.length - 1], length - 1, "last bucket is always a tick");
    // Strictly increasing and in-range.
    for (let i = 1; i < ticks.length; i++) assert.ok(ticks[i] > ticks[i - 1]);
    assert.ok(ticks.every((t) => t >= 0 && t < length));
  }
});

function fakeData(perBucketDelivered: number[]): FulfillmentAnalytics {
  return {
    period: "last_30_days",
    timezone: "Asia/Manila",
    startAt: "",
    endAt: "",
    grouping: "day",
    generatedAt: "",
    snapshot: "",
    captureStartedAt: "",
    historicalCoverage: "partial_evidence_only",
    countingRule: "first_recorded_entry_per_order_per_stage",
    totalEntries: 0,
    uniqueOrders: 0,
    stageTotals: {
      payment_confirmed: 0,
      preparing: 0,
      shipped: 0,
      in_transit: 0,
      delivered: 0,
      cancelled: 0,
      incomplete: 0,
    },
    chart: perBucketDelivered.map((d) => ({
      bucketStart: "2026-10-01T00:00:00+08:00",
      bucketEnd: "2026-10-02T00:00:00+08:00",
      counts: {
        payment_confirmed: 0,
        preparing: 0,
        shipped: 0,
        in_transit: 0,
        delivered: d,
        cancelled: 0,
        incomplete: 0,
      },
    })),
  };
}

test("chartScale produces a non-zero, 4-step axis that covers the peak", () => {
  const scale = chartScale(fakeData([0, 3, 7, 2]), ["delivered"]);
  assert.equal(scale.ticks.length, 5);
  assert.equal(scale.ticks[0], 0);
  assert.ok(scale.max >= 7, "max must cover the peak value");
  assert.equal(scale.ticks[4], scale.max);
  // Evenly spaced ticks.
  const step = scale.max / 4;
  assert.deepEqual(scale.ticks, [0, step, step * 2, step * 3, step * 4]);
});

test("chartScale never collapses to a zero axis when all counts are zero", () => {
  const scale = chartScale(fakeData([0, 0, 0]), ["delivered"]);
  assert.ok(scale.max >= 4, "empty data still yields a usable axis");
  assert.equal(scale.ticks[0], 0);
});

// ─── Root-cause regressions: RPC payload / stage-definition mismatch ──────────

test("bucketCount returns 0 for a stage key the payload omits (no crash, no NaN)", () => {
  // Simulates a deployed RPC whose counts object lacks a stage the frontend knows.
  const counts = { delivered: 5 } as Record<string, number>;
  assert.equal(bucketCount(counts as never, "delivered"), 5);
  assert.equal(bucketCount(counts as never, "in_transit"), 0);
  assert.equal(bucketCount(counts as never, "incomplete"), 0);
});

test("bucketCount coerces non-finite / undefined values to 0", () => {
  assert.equal(bucketCount(undefined, "delivered"), 0);
  assert.equal(bucketCount({ delivered: NaN } as never, "delivered"), 0);
  assert.equal(bucketCount({ delivered: undefined } as never, "delivered"), 0);
  assert.equal(bucketCount({} as never, "delivered"), 0);
});

test("chartScale never yields NaN even when buckets omit the requested stage", () => {
  const data = {
    chart: [
      { bucketStart: "a", bucketEnd: "b", counts: { delivered: 3 } },
      { bucketStart: "c", bucketEnd: "d", counts: {} }, // missing every key
      { bucketStart: "e", bucketEnd: "f", counts: { delivered: 9 } },
    ],
  } as unknown as FulfillmentAnalytics;
  const scale = chartScale(data, ["delivered", "shipped", "incomplete"]);
  assert.ok(Number.isFinite(scale.max), "max must be finite");
  assert.ok(scale.max >= 9, "max covers the real peak");
  assert.ok(
    scale.ticks.every((t) => Number.isFinite(t)),
    "all ticks finite",
  );
});

test("tickIndices never produces NaN or duplicate indices across sizes", () => {
  for (let length = 0; length <= 40; length++) {
    for (const limit of [1, 4, 8]) {
      const ticks = tickIndices(length, limit);
      assert.ok(
        ticks.every((t) => Number.isInteger(t) && !Number.isNaN(t)),
        `len=${length} limit=${limit}`,
      );
      assert.equal(
        new Set(ticks).size,
        ticks.length,
        `no duplicate keys len=${length} limit=${limit}`,
      );
      assert.ok(
        ticks.every((t) => t >= 0 && (length === 0 || t < length)),
        `in range len=${length}`,
      );
    }
  }
});

test("a y-coordinate helper built on chartScale stays finite for missing counts", () => {
  // Mirrors the chart's y(): value/scale.max with NaN-safety.
  const scale = chartScale(
    {
      chart: [{ bucketStart: "a", bucketEnd: "b", counts: { delivered: 4 } }],
    } as unknown as FulfillmentAnalytics,
    ["delivered", "shipped"],
  );
  const bottom = 263,
    top = 20;
  const y = (value: number) => {
    const v = Number.isFinite(value) ? value : 0;
    const max = scale.max > 0 ? scale.max : 1;
    return bottom - (v / max) * (bottom - top);
  };
  for (const v of [
    0,
    4,
    NaN,
    undefined as unknown as number,
    bucketCount({} as never, "shipped"),
  ]) {
    assert.ok(Number.isFinite(y(v)), `y(${v}) must be finite`);
  }
});
