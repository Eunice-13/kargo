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
    create table admin_audit_log(target_id text,target_type text,action text,after_state jsonb,created_at timestamptz);`);
  await db.exec(sqlFile("202611040001_forward_only_fulfillment.sql"));
  await db.exec(sqlFile("202611050001_no_cancel_after_payment.sql"));
  await db.exec(sqlFile("202611060001_fulfillment_analytics.sql"));
  await db.exec(sqlFile("202611060003_analytics_expired.sql"));
  await db.exec(sqlFile("202611090004_fulfillment_analytics_cohort.sql"));
  await db.exec(sqlFile("202611090006_fulfillment_analytics_current_status.sql"));
  await db.exec(sqlFile("202611090007_fulfillment_analytics_current_status_orders.sql"));
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

test("uses the payment-confirmed cohort, excludes pre-capture history, and implies earlier stages", async () => {
  const summary = (
    await row("select admin_fulfillment_analytics('custom','2020-02-01','2020-02-03') as data")
  ).data;
  assert.equal(summary.cohortSize, 3);
  assert.equal(summary.uniqueOrders, 3);
  assert.equal(summary.excludedOrders, 1);
  assert.equal(summary.stageTotals.payment_confirmed, 3);
  assert.equal(summary.stageTotals.preparing, 2);
  assert.equal(summary.stageTotals.shipped, 1);
  assert.equal(summary.stageTotals.delivered, 1);
  assert.equal(summary.stageTotals.cancelled, 1);
  assert.ok(summary.stageTotals.delivered <= summary.stageTotals.shipped);
  assert.ok(summary.stageTotals.shipped <= summary.stageTotals.preparing);
  assert.ok(summary.stageTotals.preparing <= summary.stageTotals.payment_confirmed);
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

test("current-status cohort size matches reached-stage cohort across every range", async () => {
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
    assert.equal(current.cohortSize, reached.cohortSize ?? reached.uniqueOrders, period);
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
  assert.equal(current.cohortSize, 6);
  assert.equal(current.counts.cancelled, 1);
  assert.equal(current.counts.delivered, 1);
  assert.equal(current.counts.shipped, 2);
  assert.equal(current.counts.payment_confirmed, 1);
  assert.equal(current.counts.other, 1);
  assert.equal(
    Object.values(current.counts).reduce((sum, value) => sum + value, 0),
    6,
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
