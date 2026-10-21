import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import { loadPaymentCompatibleRows } from "../src/services/paymentReadCompatibility.ts";

function fixture(responses: Array<{ status: number; body: unknown }>) {
  const requests: URL[] = [];
  const client = createClient("https://kargo.test", "test-public-key", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: async (input) => {
        requests.push(new URL(String(input)));
        const next = responses.shift();
        assert.ok(next, "Unexpected additional request");
        return new Response(JSON.stringify(next.body), {
          status: next.status,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  });
  return { client, requests };
}
for (const view of ["orders", "submissions"] as const) {
  test(`${view}: unavailable Phase 4 relationship retains existing standalone records`, async () => {
    const rows = [{ id: "existing-record", payments: [] }];
    const { client, requests } = fixture([
      {
        status: 400,
        body: {
          code: "PGRST200",
          message:
            "Could not find a relationship between 'payments' and 'combined_delivery_payment_reservations' in the schema cache",
        },
      },
      { status: 200, body: rows },
    ]);
    const result = await loadPaymentCompatibleRows(client, view);
    assert.equal(result.error, null);
    assert.deepEqual(result.data, rows);
    assert.equal(requests.length, 2);
    assert.match(requests[0].searchParams.get("select")!, /combined_delivery_payment_reservations/);
    assert.doesNotMatch(requests[1].searchParams.get("select")!, /combined_delivery/);
    assert.equal(
      requests[1].searchParams.get("order"),
      `${view === "orders" ? "created_at" : "submitted_at"}.desc`,
    );
  });
  test(`${view}: migrated schema retains all combined payment metadata without fallback`, async () => {
    const rows = [
      { id: "proof", combined_delivery_group_id: "group", combined: [{ order_id: "member" }] },
    ];
    const { client, requests } = fixture([{ status: 200, body: rows }]);
    const result = await loadPaymentCompatibleRows(client, view);
    assert.deepEqual(result.data, rows);
    assert.equal(requests.length, 1);
  });
}
test("missing Phase 4 column also retries the pre-Phase-4 projection", async () => {
  const { client } = fixture([
    {
      status: 400,
      body: { code: "42703", message: "column payments.combined_delivery_group_id does not exist" },
    },
    { status: 200, body: [] },
  ]);
  assert.equal((await loadPaymentCompatibleRows(client, "orders")).error, null);
});
for (const error of [
  { code: "42501", message: "permission denied for table orders" },
  { code: "PGRST200", message: "Could not find a relationship between orders and batch_products" },
  { code: "42703", message: "column payments.amount does not exist" },
  { code: "PGRST201", message: "ambiguous combined_delivery_payment_reservations relationship" },
]) {
  test(`does not suppress unrelated or authorization failure ${error.code}: ${error.message}`, async () => {
    const { client, requests } = fixture([{ status: 400, body: error }]);
    const result = await loadPaymentCompatibleRows(client, "orders");
    assert.equal(result.error?.code, error.code);
    assert.equal(requests.length, 1);
  });
}
test("a failed fallback is propagated rather than converted into an empty result", async () => {
  const { client } = fixture([
    {
      status: 400,
      body: {
        code: "PGRST200",
        message: "Missing combined_delivery_payment_reservations relationship",
      },
    },
    { status: 403, body: { code: "42501", message: "permission denied" } },
  ]);
  assert.equal((await loadPaymentCompatibleRows(client, "orders")).error?.code, "42501");
});
