import test from "node:test";
import assert from "node:assert/strict";
import {
  batchFormationDeadline,
  formationExpired,
  formatFormationDeadline,
} from "../src/services/groupFormation.ts";

test("batch end is 23:59:59 Philippine time, independent of browser timezone", () => {
  assert.equal(batchFormationDeadline("2026-10-23"), "2026-10-23T15:59:59.000Z");
  assert.match(formatFormationDeadline(batchFormationDeadline("2026-10-23")), /11:59:59 PM/);
  assert.match(formatFormationDeadline(batchFormationDeadline("2026-10-23")), /Asia\/Manila/);
  assert.throws(() => batchFormationDeadline("not a date"));
});
test("formation controls close exactly at the deadline", () => {
  const deadline = batchFormationDeadline("2026-10-23"),
    time = Date.parse(deadline);
  assert.equal(formationExpired("forming", deadline, time - 1), false);
  assert.equal(formationExpired("forming", deadline, time), true);
  assert.equal(formationExpired("forming", deadline, time + 1), true);
});
test("formation expiry never applies to checked-out or terminal states", () => {
  for (const status of [
    "waiting_for_seller",
    "payment_pending",
    "payment_submitted",
    "payment_confirmed",
    "expired",
    "cancelled",
  ])
    assert.equal(formationExpired(status, "2020-01-01T00:00:00Z"), false);
});
