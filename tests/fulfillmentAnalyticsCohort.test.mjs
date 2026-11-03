import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import test, { after, before } from "node:test";

let db;
const seller = "00000000-0000-0000-0000-000000000001";
const buyer = "00000000-0000-0000-0000-000000000002";
const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const currentStatus = async (period = "custom", start = "2020-02-01", end = "2020-02-03") =>
  (await row("select admin_fulfillment_current_status($1,$2,$3) as data", [period, start, end]))
    .data;
const sqlFile = (name) =>
  readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");
const row = async (sql, args = []) => (await db.query(sql, args)).rows[0];

before(async () => {
  db = new PGlite();
  await db.exec(`create role authenticated; create role anon; create schema auth;
    grant usage on schema public to authenticated,anon;
    create function auth.uid() returns uuid language sql as $$select '${seller}'::uuid$$;
    create function can_sell(uuid) returns boolean language sql as $$select $1='${seller}'::uuid$$;
    create function admin_assert() returns void language plpgsql as $$begin
      if current_setting('test.admin',true) is distinct from 'yes' then raise exception 'Admin access required' using errcode='42501'; end if;
    end$$;
    select set_config('test.admin','yes',false);
    create type order_status as enum ('payment_pending','payment_submitted','insufficient_payment','payment_confirmed','preparing','completed','cancelled','expired','incomplete');
    create table orders(id uuid primary key,order_number text,seller_id uuid,buyer_id uuid,status order_status,fulfillment_stage text,payment_confirmed_at timestamptz,completed_at timestamptz,created_at timestamptz default now(),updated_at timestamptz default now(),tracking_number text,group_order_id uuid);
    create table notifications(recipient_id uuid,category text,message text,target_path text,context jsonb,dedupe_key text,created_at timestamptz default now());
    create unique index notif_dedupe on notifications(recipient_id,dedupe_key) where dedupe_key is not null;
    create table admin_audit_log(target_id text,target_type text,action text,after_state jsonb,created_at timestamptz);
    create table payments(id uuid primary key default gen_random_uuid(),order_id uuid,submitted_at timestamptz default now(),reviewed_at timestamptz);`);
  await db.exec(sqlFile("202611040001_forward_only_fulfillment.sql"));
  await db.exec(sqlFile("202611050001_no_cancel_after_payment.sql"));
  await db.exec(sqlFile("202611060001_fulfillment_analytics.sql"));
  await db.exec(sqlFile("202611060003_analytics_expired.sql"));
  await db.exec(sqlFile("202611090004_fulfillment_analytics_cohort.sql"));
  await db.exec(sqlFile("202611090006_fulfillment_analytics_current_status.sql"));
  await db.exec(sqlFile("202611090007_fulfillment_analytics_current_status_orders.sql"));
  await db.exec(sqlFile("202611090008_fulfillment_analytics_current_status_chart.sql"));
  await db.exec(sqlFile("202611100001_fulfillment_analytics_created_window.sql"));
  await db.exec(sqlFile("202611100002_fulfillment_current_status_all_orders.sql"));
  await db.exec(sqlFile("202611100003_fulfillment_reached_all_orders.sql"));
  // The cohort window is now chosen by orders.created_at, so give every test order a
  // created_at inside the 2020-02-01..2020-02-03 range used below.
  await db.exec("alter table orders alter column created_at set default '2020-02-01T01:00:00Z'");
  await db.query(
    "update fulfillment_analytics_metadata set capture_started_at='2020-02-01T00:00:00+08:00' where singleton",
  );

  await db.query(
    "insert into orders(id,order_number,seller_id,buyer_id,status,payment_confirmed_at,completed_at) values ($1,$2,$3,$4,$5,$6,$7),($8,$9,$3,$4,$10,$11,$12),($13,$14,$3,$4,$5,$15,$16),($17,$18,$3,$4,$5,$19,$20)",
    [
      id(1),
      id(1),
      seller,
      buyer,
      "payment_confirmed",
      "2020-02-01T02:00:00Z",
      null,
      id(2),
      id(2),
      "completed",
      "2020-02-01T03:00:00Z",
      "2020-02-02T03:00:00Z",
      id(3),
      id(3),
      "2020-02-01T04:00:00Z",
      null,
      id(4),
      id(4),
      "2020-02-01T05:00:00Z",
      null,
    ],
  );
  await db.query(
    "update order_fulfillment_events set occurred_at=case order_id when $1::uuid then '2020-02-01T02:00:00Z'::timestamptz when $2::uuid then '2020-02-01T03:00:00Z'::timestamptz when $3::uuid then '2020-02-01T04:00:00Z'::timestamptz when $4::uuid then '2020-02-01T05:00:00Z'::timestamptz else occurred_at end where stage='payment_confirmed'",
    [id(1), id(2), id(3), id(4)],
  );
  await db.query(
    "insert into order_fulfillment_events(order_id,stage,occurred_at,source) values ($1,'payment_confirmed','2020-02-01T02:00:00Z','order_timestamp'),($2,'payment_confirmed','2020-02-01T03:00:00Z','order_timestamp'),($3,'payment_confirmed','2020-02-01T04:00:00Z','order_timestamp'),($4,'payment_confirmed','2020-02-01T05:00:00Z','order_timestamp') on conflict do nothing",
    [id(1), id(2), id(3), id(4)],
  );
  await db.query(
    "insert into order_fulfillment_events(order_id,stage,occurred_at,source) values ($1,'preparing','2020-01-31T10:00:00Z','transition'),($2,'delivered','2020-02-02T03:00:00Z','order_timestamp'),($3,'preparing','2020-02-01T05:00:00Z','transition'),($4,'cancelled','2020-02-02T06:00:00Z','transition') on conflict do nothing",
    [id(3), id(2), id(1), id(4)],
  );
});
after(async () => db?.close());

test("reached stage covers every order created in the range and counts every stage reached", async () => {
  const summary = (
    await row("select admin_fulfillment_analytics('custom','2020-02-01','2020-02-03') as data")
  ).data;
  assert.equal(summary.cohortSize, 4);
  assert.equal(summary.uniqueOrders, 4);
  assert.equal(summary.excludedOrders, 0);
  // Every order starts as payment_pending; paid orders also reached payment_submitted.
  assert.equal(summary.stageTotals.payment_pending, 4);
  assert.equal(summary.stageTotals.payment_submitted, 4);
  assert.equal(summary.stageTotals.insufficient_payment, 0);
  assert.equal(summary.stageTotals.payment_confirmed, 4);
  // Earlier stages are implied by later ones (history of one order spans many stages).
  assert.equal(summary.stageTotals.preparing, 3);
  assert.equal(summary.stageTotals.shipped, 1);
  assert.equal(summary.stageTotals.delivered, 1);
  assert.equal(summary.stageTotals.cancelled, 1);
  assert.equal(summary.stageTotals.expired, 0);
  const t = summary.stageTotals;
  assert.ok(t.delivered <= t.shipped && t.shipped <= t.preparing);
  assert.ok(t.preparing <= t.payment_confirmed && t.payment_confirmed <= t.payment_submitted);
  assert.ok(t.payment_submitted <= t.payment_pending);
});

test("drill-down uses reached-stage cohort rows", async () => {
  const summary = (
    await row("select admin_fulfillment_analytics('custom','2020-02-01','2020-02-03') as data")
  ).data;
  const detail = (
    await row(
      "select admin_fulfillment_orders('custom','2020-02-01','2020-02-03','shipped',null,$1,25,0,$2) as data",
      [summary.generatedAt, summary.snapshot],
    )
  ).data;
  assert.equal(detail.total, summary.stageTotals.shipped);
  assert.equal(detail.rows.length, 1);
  assert.equal(detail.rows[0].order_id, id(2));
});

test("current status and reached stage start from the same orders created in the range", async () => {
  const ranges = [
    ["today", null, null],
    ["last_7_days", null, null],
    ["last_30_days", null, null],
    ["all_time", null, null],
    ["custom", "2020-02-01", "2020-02-03"],
  ];
  for (const [period, start, end] of ranges) {
    const reached = (
      await row("select admin_fulfillment_analytics($1,$2,$3) as data", [period, start, end])
    ).data;
    const current = await currentStatus(period, start, end);
    const created = Number(
      (
        await row(
          `select count(*) as n from orders o
             cross join fulfillment_analytics_range($1,$2,$3,statement_timestamp()) r
            where o.created_at >= r.start_at and o.created_at < r.end_at`,
          [period, start, end],
        )
      ).n,
    );
    assert.equal(current.cohortSize, created, period);
    assert.equal(
      Object.values(current.counts).reduce((sum, value) => sum + value, 0),
      created,
      `${period}: each order counted once`,
    );
    assert.equal(reached.cohortSize, current.cohortSize, `${period}: same cohort`);
  }
});

test("current status counts each cohort order once and folds current in_transit into shipped", async () => {
  await db.query("update orders set status='preparing' where id=$1", [id(4)]);
  await db.query("update orders set fulfillment_stage='preparing' where id=$1", [id(4)]);
  await db.query("update orders set fulfillment_stage='shipped' where id=$1", [id(4)]);
  const extra = id(6);
  await db.query(
    "insert into orders(id,order_number,seller_id,buyer_id,status,fulfillment_stage,payment_confirmed_at) values($1::uuid,$1::text,$2::uuid,$3::uuid,'preparing','in_transit','2020-02-01T06:00:00Z')",
    [extra, seller, buyer],
  );
  await db.query(
    "insert into order_fulfillment_events(order_id,stage,occurred_at,source) values($1,'payment_confirmed','2020-02-01T06:00:00Z','order_timestamp') on conflict do nothing",
    [extra],
  );
  await db.query(
    "insert into order_fulfillment_events(order_id,stage,occurred_at,source) values($1,'shipped','2020-02-01T07:00:00Z','transition') on conflict do nothing",
    [id(1)],
  );

  const cancelled = id(7);
  await db.query(
    "insert into orders(id,order_number,seller_id,buyer_id,status,payment_confirmed_at) values($1::uuid,$1::text,$2::uuid,$3::uuid,'cancelled','2020-02-01T07:00:00Z')",
    [cancelled, seller, buyer],
  );
  await db.query(
    "insert into order_fulfillment_events(order_id,stage,occurred_at,source) values($1,'payment_confirmed','2020-02-01T07:00:00Z','order_timestamp'),($1,'preparing','2020-02-01T08:00:00Z','transition'),($1,'shipped','2020-02-01T09:00:00Z','transition'),($1,'cancelled','2020-02-01T10:00:00Z','transition') on conflict do nothing",
    [cancelled],
  );

  const other = id(8);
  await db.query(
    "insert into orders(id,order_number,seller_id,buyer_id,status,payment_confirmed_at) values($1::uuid,$1::text,$2::uuid,$3::uuid,'payment_pending','2020-02-01T08:00:00Z')",
    [other, seller, buyer],
  );
  await db.query(
    "insert into order_fulfillment_events(order_id,stage,occurred_at,source) values($1,'payment_confirmed','2020-02-01T08:00:00Z','order_timestamp') on conflict do nothing",
    [other],
  );

  const current = await currentStatus();
  // Every order created in the range, paid or not, once, in its latest status.
  assert.equal(current.cohortSize, 7);
  assert.equal(current.counts.cancelled, 1);
  assert.equal(current.counts.delivered, 1);
  assert.equal(current.counts.shipped, 2);
  assert.equal(current.counts.payment_confirmed, 2);
  assert.equal(current.counts.payment_pending, 1);
  assert.equal(current.counts.other, 0);
  assert.equal(
    Object.values(current.counts).reduce((sum, value) => sum + value, 0),
    7,
  );

  const currentShipped = (
    await row(
      "select admin_fulfillment_current_status_orders('custom','2020-02-01','2020-02-03','shipped',25,0) as data",
    )
  ).data;
  assert.equal(currentShipped.total, 2);
  assert.deepEqual(currentShipped.rows.map((item) => item.order_id).sort(), [id(4), id(6)].sort());

  const reached = (
    await row("select admin_fulfillment_analytics('custom','2020-02-01','2020-02-03') as data")
  ).data;
  assert.ok(reached.stageTotals.preparing >= current.counts.preparing);
});

test("reports current versus reached cancellation and expiry reconciliation", async () => {
  const reached = (
    await row("select admin_fulfillment_analytics('custom','2020-02-01','2020-02-03') as data")
  ).data;
  const current = await currentStatus();
  const rows = (
    await db.query(`
      with cohort as (
        select * from public.fulfillment_analytics_current_cohort(
          'custom','2020-02-01','2020-02-03',statement_timestamp()
        )
      )
      select
        c.order_id,
        case public.fulfillment_analytics_stage(o.status::text,o.fulfillment_stage)
          when 'in_transit' then 'shipped'
          else coalesce(public.fulfillment_analytics_stage(o.status::text,o.fulfillment_stage),'other')
        end as current_stage,
        exists(
          select 1 from public.order_fulfillment_events e
          where e.order_id=c.order_id and e.stage='cancelled'
        ) as reached_cancelled,
        exists(
          select 1 from public.order_fulfillment_events e
          where e.order_id=c.order_id and e.stage='expired'
        ) as reached_expired
      from cohort c
      join public.orders o on o.id=c.order_id
    `)
  ).rows;
  const gaps = rows
    .filter(
      (row) =>
        (row.current_stage === "cancelled" && !row.reached_cancelled) ||
        (row.current_stage === "expired" && !row.reached_expired),
    )
    .map((row) => ({ orderId: row.order_id, currentStage: row.current_stage }));
  const report = {
    cancelled: {
      current: current.counts.cancelled,
      reached: reached.stageTotals.cancelled,
      missingEventOrderIds: gaps.filter((row) => row.currentStage === "cancelled"),
    },
    expired: {
      current: current.counts.expired,
      reached: reached.stageTotals.expired,
      missingEventOrderIds: gaps.filter((row) => row.currentStage === "expired"),
    },
  };
  console.log("Current versus reached exit reconciliation:", JSON.stringify(report));
  assert.equal(
    report.cancelled.current,
    rows.filter((row) => row.current_stage === "cancelled").length,
  );
  assert.equal(
    report.expired.current,
    rows.filter((row) => row.current_stage === "expired").length,
  );
});

test("cohort window follows orders.created_at for both views, paid or not", async () => {
  const range = ["custom", "2020-02-01", "2020-02-03"];
  const summary = async () =>
    (await row("select admin_fulfillment_analytics($1,$2,$3) as data", range)).data;
  const before = await summary();
  const currentBefore = await currentStatus(...range);
  const createdEarlyPaidInRange = id(20);
  const createdInRangePaidLater = id(21);
  const createdInRangeUnpaid = id(22);
  await db.query(
    `insert into orders(id,order_number,seller_id,buyer_id,status,payment_confirmed_at,created_at) values
      ($1::uuid,$1::text,$4::uuid,$5::uuid,'payment_confirmed','2020-02-01T06:00:00Z','2020-01-15T00:00:00Z'),
      ($2::uuid,$2::text,$4::uuid,$5::uuid,'payment_confirmed','2020-03-01T06:00:00Z','2020-02-02T00:00:00Z'),
      ($3::uuid,$3::text,$4::uuid,$5::uuid,'payment_pending',null,'2020-02-02T00:00:00Z')`,
    [createdEarlyPaidInRange, createdInRangePaidLater, createdInRangeUnpaid, seller, buyer],
  );
  await db.query(
    `update order_fulfillment_events
        set occurred_at = case order_id when $1::uuid then '2020-02-01T06:00:00Z'::timestamptz
                                        else '2020-03-01T06:00:00Z'::timestamptz end
      where order_id in ($1::uuid,$2::uuid) and stage='payment_confirmed'`,
    [createdEarlyPaidInRange, createdInRangePaidLater],
  );

  // Created in range = the late-paid order and the unpaid one; the one created earlier is out.
  const after = await summary();
  assert.equal(after.cohortSize, before.cohortSize + 2);
  const detail = async (stage) =>
    (
      await row("select admin_fulfillment_orders($1,$2,$3,$4,null,null,100,0,null) as data", [
        ...range,
        stage,
      ])
    ).data.rows.map((item) => item.order_id);
  const pending = await detail("payment_pending");
  assert.ok(pending.includes(createdInRangePaidLater) && pending.includes(createdInRangeUnpaid));
  assert.ok(!pending.includes(createdEarlyPaidInRange));
  const confirmed = await detail("payment_confirmed");
  assert.ok(confirmed.includes(createdInRangePaidLater));
  assert.ok(!confirmed.includes(createdInRangeUnpaid));
  assert.ok(!confirmed.includes(createdEarlyPaidInRange));

  const current = await currentStatus(...range);
  assert.equal(current.cohortSize, currentBefore.cohortSize + 2);
  assert.equal(current.cohortSize, after.cohortSize);
  assert.equal(current.counts.payment_pending, currentBefore.counts.payment_pending + 1);
  assert.equal(
    Object.values(current.counts).reduce((sum, value) => sum + value, 0),
    current.cohortSize,
  );
});

test("current status buckets unpaid and closed orders: awaiting payment, expired, cancelled", async () => {
  const range = ["custom", "2020-02-01", "2020-02-03"];
  const before = await currentStatus(...range);
  const submitted = id(30);
  const insufficient = id(31);
  const expiredUnpaid = id(32);
  const cancelledUnpaid = id(33);
  const incomplete = id(34);
  await db.query(
    `insert into orders(id,order_number,seller_id,buyer_id,status,created_at) values
      ($1::uuid,$1::text,$6::uuid,$7::uuid,'payment_submitted','2020-02-02T02:00:00Z'),
      ($2::uuid,$2::text,$6::uuid,$7::uuid,'insufficient_payment','2020-02-02T03:00:00Z'),
      ($3::uuid,$3::text,$6::uuid,$7::uuid,'expired','2020-02-02T04:00:00Z'),
      ($4::uuid,$4::text,$6::uuid,$7::uuid,'cancelled','2020-02-02T05:00:00Z'),
      ($5::uuid,$5::text,$6::uuid,$7::uuid,'incomplete','2020-02-02T06:00:00Z')`,
    [submitted, insufficient, expiredUnpaid, cancelledUnpaid, incomplete, seller, buyer],
  );
  const after = await currentStatus(...range);
  assert.equal(after.cohortSize, before.cohortSize + 5);
  assert.equal(after.counts.payment_submitted, before.counts.payment_submitted + 1);
  assert.equal(after.counts.insufficient_payment, before.counts.insufficient_payment + 1);
  assert.equal(after.counts.expired, before.counts.expired + 1);
  assert.equal(after.counts.cancelled, before.counts.cancelled + 1);
  assert.equal(after.counts.other, before.counts.other + 1);
  assert.equal(
    Object.values(after.counts).reduce((sum, value) => sum + value, 0),
    after.cohortSize,
  );

  const drill = async (stage) =>
    (
      await row("select admin_fulfillment_current_status_orders($1,$2,$3,$4,100,0) as data", [
        ...range,
        stage,
      ])
    ).data;
  const expired = await drill("expired");
  assert.equal(expired.total, after.counts.expired);
  assert.ok(expired.rows.some((item) => item.order_id === expiredUnpaid));
  assert.equal(
    expired.rows.find((item) => item.order_id === expiredUnpaid).occurred_at.slice(0, 10),
    "2020-02-02",
  );
  const awaiting = await drill("payment_submitted");
  assert.equal(awaiting.total, after.counts.payment_submitted);
  await assert.rejects(drill("awaiting_payment"), /Select a current order status/);
});

test("reached stage counts awaiting-payment stages; an order sits in many stages, current status in one", async () => {
  const range = ["custom", "2020-02-01", "2020-02-03"];
  const reached = (await row("select admin_fulfillment_analytics($1,$2,$3) as data", range)).data;
  const current = await currentStatus(...range);
  const t = reached.stageTotals;
  // Never fewer orders reached a stage than are in it right now.
  assert.ok(t.payment_pending >= current.counts.payment_pending);
  assert.ok(t.payment_submitted >= current.counts.payment_submitted);
  assert.ok(t.insufficient_payment >= current.counts.insufficient_payment);
  assert.ok(t.payment_confirmed >= current.counts.payment_confirmed);
  assert.ok(t.preparing >= current.counts.preparing);
  assert.ok(t.shipped >= current.counts.shipped);
  assert.ok(t.delivered >= current.counts.delivered);
  assert.ok(t.expired >= current.counts.expired, "expired orders reached expired");
  assert.ok(t.cancelled >= current.counts.cancelled, "cancelled orders reached cancelled");
  // Reached adds up to more than the number of orders; current adds up to exactly that.
  const reachedSum = Object.values(t).reduce((sum, value) => sum + value, 0);
  assert.ok(reachedSum > reached.cohortSize);
  assert.equal(
    Object.values(current.counts).reduce((sum, value) => sum + value, 0),
    current.cohortSize,
  );
  // An unpaid order that only expired has reached payment_pending and expired, nothing in between.
  const expiredIds = (
    await row(
      "select admin_fulfillment_orders($1,$2,$3,'expired',null,null,100,0,null) as data",
      range,
    )
  ).data.rows.map((item) => item.order_id);
  assert.ok(expiredIds.includes(id(32)));
  const submittedIds = (
    await row(
      "select admin_fulfillment_orders($1,$2,$3,'payment_submitted',null,null,100,0,null) as data",
      range,
    )
  ).data.rows.map((item) => item.order_id);
  assert.ok(submittedIds.includes(id(30)), "payment_submitted order reached payment_submitted");
  assert.ok(submittedIds.includes(id(31)), "insufficient payment implies a submission");
  assert.ok(!submittedIds.includes(id(32)), "an order that only expired never submitted payment");
});

test("awaiting-payment stages are recorded as they happen and backfilled from evidence", async () => {
  const stageTimes = async (orderId) =>
    Object.fromEntries(
      (
        await db.query(
          "select stage,occurred_at,source from order_fulfillment_events where order_id=$1 order by stage",
          [orderId],
        )
      ).rows.map((item) => [item.stage, item]),
    );

  // Going forward the orders trigger records each awaiting-payment stage once.
  const live = id(40);
  await db.query(
    "insert into orders(id,order_number,seller_id,buyer_id,status,created_at) values ($1::uuid,$1::text,$2::uuid,$3::uuid,'payment_pending','2020-02-02T07:00:00Z')",
    [live, seller, buyer],
  );
  assert.ok((await stageTimes(live)).payment_pending, "payment_pending recorded on insert");
  await db.query("update orders set status='payment_submitted' where id=$1", [live]);
  await db.query("update orders set status='insufficient_payment' where id=$1", [live]);
  await db.query("update orders set status='payment_submitted' where id=$1", [live]);
  const recorded = await stageTimes(live);
  assert.ok(recorded.payment_submitted && recorded.insufficient_payment);
  assert.equal(recorded.payment_submitted.source, "transition");

  // Existing orders are backfilled from their own timestamps and payment records only.
  const old = id(41);
  await db.query(
    "insert into orders(id,order_number,seller_id,buyer_id,status,created_at) values ($1::uuid,$1::text,$2::uuid,$3::uuid,'payment_submitted','2020-02-02T08:00:00Z')",
    [old, seller, buyer],
  );
  await db.query(
    "insert into payments(order_id,submitted_at,reviewed_at) values ($1,'2020-02-02T09:30:00Z',null)",
    [old],
  );
  await db.query("delete from order_fulfillment_events where order_id=$1", [old]);
  await db.exec(sqlFile("202611100003_fulfillment_reached_all_orders.sql"));
  const backfilled = await stageTimes(old);
  assert.equal(
    new Date(backfilled.payment_pending.occurred_at).toISOString(),
    "2020-02-02T08:00:00.000Z",
  );
  assert.equal(
    new Date(backfilled.payment_submitted.occurred_at).toISOString(),
    "2020-02-02T09:30:00.000Z",
  );
  assert.equal(backfilled.insufficient_payment, undefined, "no evidence, so no insufficient stage");

  // Re-running does not duplicate or change anything.
  const count = async () =>
    Number((await row("select count(*) as n from order_fulfillment_events")).n);
  const n = await count();
  await db.exec(sqlFile("202611100003_fulfillment_reached_all_orders.sql"));
  assert.equal(await count(), n);
});
