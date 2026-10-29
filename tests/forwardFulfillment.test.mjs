import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { fileURLToPath } from "node:url";

let db, server, canAdvance, Details;
const seller = "00000000-0000-0000-0000-000000000001";
const buyer = "00000000-0000-0000-0000-000000000002";
let sequence = 10;
async function order(status, stage = null, extra = {}) {
  const id = `00000000-0000-0000-0000-${String(sequence++).padStart(12, "0")}`;
  await db.query(
    `insert into orders(id,seller_id,buyer_id,order_number,status,fulfillment_stage,group_order_id,combined_delivery_group_id) values($1::uuid,$2,$3,$1::text,$4,$5,$6,$7)`,
    [id, seller, buyer, status, stage, extra.group ?? null, extra.combined ?? null],
  );
  return id;
}
const move = (id, stage) => db.query("select public.set_fulfillment_status($1,$2)", [id, stage]);
const row = async (id) => (await db.query("select * from orders where id=$1", [id])).rows[0];
before(async () => {
  // Entire database is ephemeral WASM PostgreSQL. No env files, remote URLs, or credentials.
  db = new PGlite();
  await db.exec(`create role authenticated; create role anon; create schema auth;
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
    create function public.can_sell(uuid) returns boolean language sql as $$ select $1='${seller}'::uuid $$;
    create type public.order_status as enum ('payment_pending','payment_submitted','insufficient_payment','payment_confirmed','preparing','completed','cancelled','expired','incomplete');
    create table public.orders(id uuid primary key,seller_id uuid,buyer_id uuid,order_number text,status order_status,fulfillment_stage text,completed_at timestamptz,group_order_id uuid,combined_delivery_group_id uuid,tracking_number text,payment_confirmed_at timestamptz);
    create table public.notifications(recipient_id uuid,category text,message text,target_path text,context jsonb,dedupe_key text);
    create unique index notification_dedupe on notifications(recipient_id,dedupe_key) where dedupe_key is not null;
    select set_config('test.uid','${seller}',false);`);
  const historical = await order("preparing", "shipped");
  const original = await row(historical);
  await db.exec(
    readFileSync(
      new URL("../supabase/migrations/202611040001_forward_only_fulfillment.sql", import.meta.url),
      "utf8",
    ),
  );
  assert.deepEqual(await row(historical), original, "migration must not rewrite existing orders");
  // Layered on top: once payment is confirmed, an order can never be cancelled.
  await db.exec(
    readFileSync(
      new URL("../supabase/migrations/202611050001_no_cancel_after_payment.sql", import.meta.url),
      "utf8",
    ),
  );
  // A privileged application operation still runs the same row trigger.
  await db.exec(`create function public.test_admin_move(p_id uuid, p_stage text)
    returns void language sql security definer as $$
      update public.orders set status='preparing',fulfillment_stage=p_stage where id=p_id
    $$; grant usage on schema public to authenticated;
    grant execute on function public.test_admin_move(uuid,text) to authenticated;`);
  server = await createServer({
    configFile: false,
    envFile: false,
    plugins: [react()],
    resolve: {
      alias: [
        {
          find: /^@\/components\/shared$/,
          replacement: fileURLToPath(new URL("./fixtures/FulfillmentShared.ts", import.meta.url)),
        },
        { find: "@", replacement: fileURLToPath(new URL("../src", import.meta.url)) },
      ],
    },
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  canAdvance = (await server.ssrLoadModule("/src/constants/fulfillmentTransitions.ts"))
    .canAdvanceFulfillment;
  Details = (await server.ssrLoadModule("/src/features/fulfillment/FulfillmentDetails.tsx"))
    .default;
});
after(async () => {
  await server?.close();
  await db?.close();
});

test("board permits only the next stage; confirmed orders cannot be cancelled and terminals cannot reopen", () => {
  const stages = ["Payment Confirmed", "Preparing", "Shipped", "Delivered", "Cancelled"];
  // Cancelled is never reachable from any board stage: every board order is
  // already payment-confirmed, and confirmed orders cannot be cancelled.
  const expected = {
    "Payment Confirmed": ["Payment Confirmed", "Preparing"],
    Preparing: ["Preparing", "Shipped"],
    Shipped: ["Shipped", "Delivered"],
    Delivered: ["Delivered"],
    Cancelled: ["Cancelled"],
  };
  for (const from of stages)
    for (const to of stages)
      assert.equal(canAdvance(from, to), expected[from].includes(to), `${from} -> ${to}`);
});

test("rendered board disables backward and skipped options without changing layout", () => {
  for (const col of ["Payment Confirmed", "Preparing", "Shipped", "Delivered", "Cancelled"]) {
    const html = renderToStaticMarkup(
      createElement(Details, {
        order: { id: "test", col, product: "Product", buyer: "Buyer", qty: 1, amount: 10 },
        onMove: () => {},
        onSaveTracking: () => {},
      }),
    );
    for (const match of html.matchAll(/<option([^>]*)value="([^"]+)"([^>]*)>/g))
      assert.equal(
        (match[1] + match[3]).includes("disabled"),
        !canAdvance(col, match[2]),
        `${col}: ${match[2]}`,
      );
  }
});

test("all forward edges, optional in-transit, retries and notifications", async () => {
  for (const scope of [{}, { group: buyer }, { combined: buyer }]) {
    const id = await order("payment_confirmed", null, scope);
    for (const stage of ["preparing", "shipped", "in_transit", "completed"]) {
      await move(id, stage);
      const first = await row(id);
      await move(id, stage);
      assert.deepEqual(await row(id), first, "retry must not rewrite completion time");
    }
    assert.equal((await row(id)).fulfillment_stage, "delivered");
    assert.equal(
      (
        await db.query(
          "select count(*)::int as n from notifications where context->>'order_id'=$1",
          [id],
        )
      ).rows[0].n,
      4,
    );
  }
  const id = await order("preparing", "shipped");
  await move(id, "completed");
  assert.equal((await row(id)).status, "completed");
});

test("every backward RPC edge and skipped stage is rejected", async () => {
  const states = [
    ["payment_confirmed", null, "payment_confirmed"],
    ["preparing", "preparing", "preparing"],
    ["preparing", "shipped", "shipped"],
    ["preparing", "in_transit", "in_transit"],
    ["completed", "delivered", "completed"],
  ];
  for (let i = 1; i < states.length; i++)
    for (let j = 0; j < i; j++) {
      const id = await order(states[i][0], states[i][1]);
      const before = await row(id);
      await assert.rejects(move(id, states[j][2]), /backward|Delivered/);
      assert.deepEqual(await row(id), before);
    }
  await assert.rejects(move(await order("payment_confirmed"), "shipped"), /next fulfillment/);
  await assert.rejects(
    move(await order("preparing", "preparing"), "completed"),
    /next fulfillment/,
  );
});

test("privileged direct writes and indirect payment-style resets cannot reverse progress", async () => {
  const id = await order("preparing", "shipped");
  await assert.rejects(
    db.query("update orders set status='payment_confirmed',fulfillment_stage=null where id=$1", [
      id,
    ]),
    /backward/,
  );
  await assert.rejects(
    db.query("update orders set status='payment_pending',fulfillment_stage=null where id=$1", [id]),
    /backward/,
  );
  assert.equal((await row(id)).fulfillment_stage, "shipped");
  await db.query("update orders set tracking_number='TRACK' where id=$1", [id]);
  assert.equal((await row(id)).tracking_number, "TRACK");
});

test("admin security-definer operations cannot bypass the row guard", async () => {
  const id = await order("preparing", "shipped");
  await db.exec("set role authenticated");
  try {
    await assert.rejects(
      db.query("select public.test_admin_move($1,'preparing')", [id]),
      /backward/,
    );
  } finally {
    await db.exec("reset role");
  }
  assert.equal((await row(id)).fulfillment_stage, "shipped");
});

test("confirmed orders cannot be cancelled by any path, at any stage", async () => {
  // The board RPC no longer accepts 'cancelled' at all.
  await assert.rejects(move(await order("payment_confirmed"), "cancelled"), /Invalid fulfillment/);

  // Every confirmed/in-fulfillment stage: direct and privileged SQL that tries
  // to cancel/void is rejected by the row trigger. Covers the admin path, which
  // ultimately performs the same UPDATE under the same trigger.
  for (const [status, stage] of [
    ["payment_confirmed", null],
    ["preparing", "preparing"],
    ["preparing", "shipped"],
    ["preparing", "in_transit"],
  ]) {
    for (const terminal of ["cancelled", "incomplete", "expired"]) {
      const id = await order(status, stage);
      const before = await row(id);
      await assert.rejects(
        db.query("update orders set status=$2,fulfillment_stage=null where id=$1", [id, terminal]),
        /confirmed order cannot be cancelled/,
      );
      assert.deepEqual(await row(id), before, "rejected cancellation must not change the row");
    }
  }

  // A confirmed order remains non-cancellable even when identified only by
  // payment_confirmed_at (e.g. a legacy row already advanced to shipped).
  const stamped = await order("preparing", "shipped");
  await db.query("update orders set payment_confirmed_at=now() where id=$1", [stamped]);
  await assert.rejects(
    db.query("update orders set status='cancelled',fulfillment_stage=null where id=$1", [stamped]),
    /confirmed order cannot be cancelled/,
  );

  // A privileged security-definer admin move cannot sneak a cancellation past
  // the trigger either.
  await db.exec(`create or replace function public.test_admin_cancel(p_id uuid)
    returns void language sql security definer as $$
      update public.orders set status='cancelled', fulfillment_stage=null where id=p_id
    $$; grant execute on function public.test_admin_cancel(uuid) to authenticated;`);
  const confirmed = await order("preparing", "shipped");
  await db.exec("set role authenticated");
  try {
    await assert.rejects(
      db.query("select public.test_admin_cancel($1)", [confirmed]),
      /confirmed order cannot be cancelled/,
    );
  } finally {
    await db.exec("reset role");
  }
  assert.equal((await row(confirmed)).status, "preparing");
});

test("delivery cannot be cancelled or have its history erased", async () => {
  const id = await order("preparing", "shipped");
  await move(id, "completed");
  await assert.rejects(
    db.query("update orders set status='cancelled',fulfillment_stage=null where id=$1", [id]),
    /confirmed order cannot be cancelled/,
  );
  await assert.rejects(
    db.query("update orders set completed_at=null where id=$1", [id]),
    /history/,
  );
});

test("unpaid orders can still be cancelled (buyer self-cancel / seller decline are unaffected)", async () => {
  // The no-cancel rule keys on payment confirmation, so pre-payment states
  // remain cancellable exactly as before.
  for (const status of ["payment_pending", "payment_submitted", "insufficient_payment"]) {
    const id = await order(status);
    await db.query("update orders set status='cancelled' where id=$1", [id]);
    assert.equal((await row(id)).status, "cancelled");
  }
});

test("authorization unchanged and payment corrections before preparation still work", async () => {
  const id = await order("payment_confirmed");
  await db.query("select set_config('test.uid',$1,false)", [buyer]);
  await assert.rejects(move(id, "preparing"), /Order not found/);
  await db.query("select set_config('test.uid',$1,false)", [seller]);
  await db.query("update orders set status='payment_pending' where id=$1", [id]);
  await db.query("update orders set status='payment_submitted' where id=$1", [id]);
  await db.query(
    "update orders set status='payment_confirmed',payment_confirmed_at=now() where id=$1",
    [id],
  );
  await move(id, "preparing");
});

test("queued stale requests cannot regress an advanced order", async () => {
  const id = await order("preparing", "preparing");
  // PGlite serializes its single connection; this tests stale requests, not multi-session locking.
  const results = await Promise.allSettled([move(id, "shipped"), move(id, "preparing")]);
  assert.equal(results[0].status, "fulfilled");
  assert.equal(results[1].status, "rejected");
  assert.equal((await row(id)).fulfillment_stage, "shipped");
});
