// Phase-3.1 regression audit. Disposable PostgreSQL fixture; never live data.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (!process.env.KARGO_PGLITE_MODULE)
  throw new Error("Set KARGO_PGLITE_MODULE to the temporary PGlite module used by the SQL runner.");
const { PGlite } = await import(pathToFileURL(path.resolve(process.env.KARGO_PGLITE_MODULE)).href);
const db = new PGlite();
const buyer = "61000000-0000-0000-0000-000000000001";
const seller = "61000000-0000-0000-0000-000000000002";
const moveProduct =
  "update public.batch_products set batch_id='62000000-0000-0000-0000-000000000002' where id='63000000-0000-0000-0000-000000000002'";
async function actor(id) {
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [id]);
}
async function expectRejected(sql, expected) {
  await db.exec("savepoint rejected_operation");
  let failure;
  try {
    await db.exec(sql);
  } catch (error) {
    failure = error;
  }
  await db.exec("rollback to savepoint rejected_operation; release savepoint rejected_operation");
  assert.ok(failure, "Unsafe operation was accepted");
  assert.match(failure.message, expected);
}
try {
  for (const file of [
    "supabase/tests/fixtures/combined_delivery_minimal_schema.sql",
    "supabase/migrations (to update profile database name)/202610200002_combined_delivery_foundations.sql",
    "supabase/migrations (to update profile database name)/202610210001_combined_delivery_buyer_requests.sql",
    "supabase/migrations (to update profile database name)/202610210002_combined_delivery_seller_review.sql",
    "supabase/migrations (to update profile database name)/202610210003_combined_delivery_recovery.sql",
    "supabase/migrations (to update profile database name)/202610210004_combined_delivery_batch_integrity.sql",
  ])
    await db.exec(await readFile(path.join(root, file), "utf8"));
  const fixture = (
    await readFile(path.join(root, "supabase/tests/combined_delivery_buyer_requests.sql"), "utf8")
  ).split("-- Existing independent reservations")[0];
  await db.exec(fixture);
  // Mirror the actual existing seller product policy; do not grant a bypass.
  await db.exec(`
    alter table public.batch_products enable row level security;
    create policy products_update_seller on public.batch_products for update to authenticated
      using (exists(select 1 from public.batches b where b.id=batch_id and b.seller_id=auth.uid()) and public.can_sell());
    create policy products_select_visible on public.batch_products for select to authenticated
      using (exists(select 1 from public.batches b where b.id=batch_id and (b.status<>'draft' or b.seller_id=auth.uid())));
    grant select on public.batches to authenticated;
    grant select,update on public.batch_products to authenticated;
  `);
  for (const action of [
    "seller_reject",
    "buyer_cancel",
    "buyer_recover",
    "seller_recover_fee_assigned",
  ]) {
    await db.exec("savepoint scenario");
    await actor(buyer);
    const group = (
      await db.query(
        `select (public.request_combined_delivery(array['65000000-0000-0000-0000-000000000001'::uuid,'65000000-0000-0000-0000-000000000002'::uuid],14.6,121,'Unit 1, Test address',true)).id`,
      )
    ).rows[0].id;
    await actor(seller);
    await db.query("select public.review_combined_delivery($1,'approve')", [group]);
    const feeAssigned = action === "seller_recover_fee_assigned";
    if (feeAssigned)
      await db.query("select public.review_combined_delivery($1,'set_shipping_fee',null,125.50)", [
        group,
      ]);
    const before = (await db.query("select * from public.orders order by id")).rows;
    await db.exec("set local role authenticated");
    await expectRejected(moveProduct, /This product belongs to an active combined delivery/);
    await db.exec("reset role");
    await expectRejected(
      `select public.invalidate_combined_delivery_request('${group}')`,
      /This request is still eligible/,
    );
    // Simulate data that became stale BEFORE the preventive migration existed.
    await db.exec(
      `delete from public.combined_delivery_batch_pins where product_id='63000000-0000-0000-0000-000000000002'; alter table public.batch_products disable trigger batch_products_active_delivery_identity; ${moveProduct}; alter table public.batch_products enable trigger batch_products_active_delivery_identity`,
    );
    await expectRejected(
      `select public.review_combined_delivery('${group}','set_shipping_fee',null,125.50)`,
      /Only reservations from the same Pasabuy batch/,
    );
    await actor(action.startsWith("buyer") ? buyer : seller);
    // Exercise real authenticated execution rather than only definer calls from
    // the database owner. No group/membership UPDATE grant is added.
    await db.exec("set local role authenticated");
    if (action === "seller_reject")
      await db.query("select public.review_combined_delivery($1,'reject','Batch changed')", [
        group,
      ]);
    else if (action === "buyer_cancel")
      await db.query("select public.cancel_combined_delivery_request($1)", [group]);
    else await db.query("select public.invalidate_combined_delivery_request($1)", [group]);
    await db.query("select public.invalidate_combined_delivery_request($1)", [group]);
    await db.exec("reset role");
    const state = (
      await db.query("select * from public.combined_delivery_groups where id=$1", [group])
    ).rows[0];
    assert.equal(state.status, "invalidated");
    assert.match(state.decision_reason, /same Pasabuy batch/);
    if (feeAssigned) assert.equal(Number(state.shipping_fee), 125.5);
    assert.equal(
      (
        await db.query(
          "select count(*)::integer as count from public.combined_delivery_members where group_id=$1 and released_at is null",
          [group],
        )
      ).rows[0].count,
      0,
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::integer as count from public.combined_delivery_events where group_id=$1 and event_type='invalidated'",
          [group],
        )
      ).rows[0].count,
      1,
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::integer as count from public.notifications where dedupe_key=$1",
          [`combined_delivery_invalidated_${group}`],
        )
      ).rows[0].count,
      2,
    );
    assert.deepEqual(
      (await db.query("select * from public.orders order by id")).rows,
      before,
      "Valid shipping pauses, original budgets and inventory allocations must survive recovery",
    );
    console.log(
      `PASS ${action}: mutation prevented; legacy group recovered once; standalone shipping/time budgets preserved`,
    );
    await db.exec("rollback to savepoint scenario; release savepoint scenario");
  }
  await db.exec("rollback");
  console.log(
    "PASS: the previous Phase-4 preflight recovery blocker is resolved in the fixture. This audit covers the Phase 3 foundation; run the Phase 4 payment suites separately.",
  );
} finally {
  await db.close();
}
