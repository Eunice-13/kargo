import test from "node:test";
import assert from "node:assert/strict";

import {
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
      expired: 0,
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
        expired: 0,
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
