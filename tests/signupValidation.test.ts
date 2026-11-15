import test from "node:test";
import assert from "node:assert/strict";

import { formatMoney } from "../src/lib/format.ts";
import { normalizeUsername, validateUsername } from "../src/lib/username.ts";

test("formatMoney always renders two decimals with a peso sign", () => {
  assert.equal(formatMoney(0), "₱0.00");
  assert.equal(formatMoney("950"), "₱950.00");
  assert.equal(formatMoney(1234.5), "₱1,234.50");
  assert.equal(formatMoney(1234.567), "₱1,234.57");
});

test("formatMoney never renders blank, NaN, or a dash", () => {
  assert.equal(formatMoney(null), "₱0.00");
  assert.equal(formatMoney(undefined), "₱0.00");
  assert.equal(formatMoney("abc"), "₱0.00");
  assert.equal(formatMoney(""), "₱0.00");
});

test("usernames are normalised to lowercase", () => {
  assert.equal(normalizeUsername("  JuanDC "), "juandc");
});

test("username rules accept a normal handle", () => {
  assert.equal(validateUsername("juandc"), null);
  assert.equal(validateUsername("maria.cruz_01"), null);
});

test("username rules reject short, malformed, and reserved handles", () => {
  assert.ok(validateUsername("ab"));
  assert.ok(validateUsername("1juan"));
  assert.ok(validateUsername("juan..cruz"));
  assert.ok(validateUsername("juan."));
  assert.ok(validateUsername("juan cruz"));
  assert.ok(validateUsername("admin"));
  assert.ok(validateUsername("KARGO"));
});
