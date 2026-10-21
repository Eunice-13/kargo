import test from "node:test";
import assert from "node:assert/strict";
import { combinedDeliveryMutationError } from "../src/services/combinedDeliveryErrors.ts";

test("serialization and deadlock failures ask for a fresh whole action and preserve SQLSTATE", () => {
  for (const code of ["40001", "40P01"]) {
    const result = combinedDeliveryMutationError({ code, message: "database conflict" });
    assert.ok(result instanceof Error);
    assert.match(result.message, /Refresh and try the entire action again/);
    assert.equal((result as Error & { code: string }).code, code);
  }
});
test("active identity FK failures explain the restriction for native and PostgREST error shapes", () => {
  for (const kind of ["product", "seller", "order"]) {
    for (const code of ["23503", "23001"])
      for (const failure of [
        { code, constraint: `combined_delivery_batch_pin_${kind}_fk` },
        {
          code,
          message: `update violates foreign key constraint "combined_delivery_batch_pin_${kind}_fk"`,
        },
      ]) {
        const result = combinedDeliveryMutationError(failure);
        assert.ok(result instanceof Error);
        assert.match(result.message, /active combined delivery/);
      }
  }
});
test("unrelated database and authorization errors are preserved unchanged", () => {
  for (const failure of [
    { code: "23503", message: "Another foreign key failed" },
    { code: "42501", message: "Seller access required" },
    { code: "22023", message: "Only reservations from the same Pasabuy batch can be combined." },
  ])
    assert.equal(combinedDeliveryMutationError(failure), failure);
});
