import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveGroupMembership,
  membershipError,
  GroupMembershipConflict,
} from "../src/services/groupMembership.ts";
const row = (id: string, status: string, created_at = "2026-01-01") => ({
  group_order_id: id,
  group_orders: { status, created_at },
});
test("active membership wins over historical confirmed groups regardless of row order", () => {
  for (const rows of [
    [row("old", "payment_confirmed"), row("current", "forming")],
    [row("current", "forming"), row("old", "payment_confirmed")],
  ])
    assert.equal(resolveGroupMembership(rows)?.group_order_id, "current");
});
test("multiple active memberships fail closed rather than choosing a group", () =>
  assert.throws(
    () => resolveGroupMembership([row("a", "forming"), row("b", "payment_pending")]),
    /Conflicting/,
  ));
test("history selection is newest first with deterministic ID tie break", () =>
  assert.equal(
    resolveGroupMembership([
      row("old", "payment_confirmed"),
      row("z", "payment_confirmed", "2026-02-01"),
      row("a", "payment_confirmed", "2026-02-01"),
    ])?.group_order_id,
    "a",
  ));
test("unrelated and terminal memberships do not resolve as current", () =>
  assert.equal(resolveGroupMembership([row("a", "cancelled"), row("b", "expired")]), undefined));
test("friendly conflict gives leave guidance only for a confirmed forming group", () => {
  const a = membershipError({
    message: "GROUP_MEMBERSHIP_CONFLICT",
    details: '{"can_leave":true}',
  });
  assert(a instanceof GroupMembershipConflict);
  assert(a.canLeave);
  for (const details of ["{}", '{"can_leave":false}', "bad"]) {
    const b = membershipError({ message: "GROUP_MEMBERSHIP_CONFLICT", details });
    assert(b instanceof GroupMembershipConflict);
    assert(!b.canLeave);
  }
  const other = { message: "Network failed" };
  assert.equal(membershipError(other), other);
});
