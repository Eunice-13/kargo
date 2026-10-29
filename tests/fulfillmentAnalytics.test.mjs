import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
let db;
let next = 200;
const seller = "00000000-0000-0000-0000-000000000001";
const buyer = "00000000-0000-0000-0000-000000000002";
const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const sqlFile = (name) =>
  readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");
const result = async (sql, args = []) => (await db.query(sql, args)).rows[0];
const summary = async (period = "custom", start = "2020-02-01", end = "2020-02-02") =>
  (await result("select admin_fulfillment_analytics($1,$2,$3) as data", [period, start, end])).data;
const detail = async (
  s,
  stage,
  bucket = null,
  offset = 0,
  limit = 25,
  start = "2020-02-01",
  end = "2020-02-02",
) =>
  (
    await result("select admin_fulfillment_orders($1,$2,$3,$4,$5,$6,$7,$8,$9) as data", [
      s.period,
      start,
      end,
      stage,
      bucket,
      s.generatedAt,
      limit,
      offset,
      s.snapshot,
    ])
  ).data;
async function makeOrder(status = "payment_confirmed") {
  const key = id(next++);
  await db.query(
    "insert into orders(id,order_number,seller_id,buyer_id,status) values($1,$2,$3,$4,$5)",
    [key, key, seller, buyer, status],
  );
  return key;
}
const move = (key, stage) => db.query("select set_fulfillment_status($1,$2)", [key, stage]);
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
    insert into orders(id,status,payment_confirmed_at) values('${id(100)}','payment_confirmed','2020-01-31T16:00:00Z');
    insert into orders(id,status,fulfillment_stage) values('${id(101)}','preparing','shipped'),('${id(103)}','preparing','preparing');
    insert into orders(id,status,fulfillment_stage,completed_at) values('${id(102)}','completed','delivered','2020-02-01T16:00:00Z');
    insert into orders(id,status,payment_confirmed_at) values('${id(104)}','cancelled','2020-01-31T15:59:59Z');
    insert into orders(id,status) values('${id(105)}','cancelled');
    insert into notifications(context,dedupe_key,created_at) values
      ('{"order_id":"${id(101)}","fulfillment_stage":"shipped"}','fulfillment_shipped_${id(101)}','2020-02-01T16:00:00Z'),
      ('{"order_id":"${id(101)}","fulfillment_stage":"shipped"}','fulfillment_shipped_${id(101)}','2020-02-01T16:01:00Z'),
      ('{"order_id":"${id(102)}","fulfillment_stage":"delivered"}','fulfillment_completed_${id(102)}','2020-02-01T16:01:00Z');
    insert into admin_audit_log values('${id(105)}','order','cancel_order','{"status":"cancelled"}','2020-02-01T15:59:59Z');`);
  await db.exec(sqlFile("202611040001_forward_only_fulfillment.sql"));
  await db.exec(sqlFile("202611050001_no_cancel_after_payment.sql"));
  const original = (await db.query("select * from orders order by id")).rows;
  await db.exec(sqlFile("202611060001_fulfillment_analytics.sql"));
  await db.exec(sqlFile("202611060003_analytics_expired.sql"));
  assert.deepEqual(
    (await db.query("select * from orders order by id")).rows,
    original,
    "backfill cannot rewrite orders",
  );
});
after(async () => {
  await db?.close();
});

test("historical evidence only, first entry deduplication, no guessed intermediate stages", async () => {
  const events = (
    await db.query("select order_id,stage,source from order_fulfillment_events order by order_id")
  ).rows;
  assert.equal(events.length, 5);
  assert.equal(events.filter((e) => e.order_id === id(101)).length, 1);
  assert.equal(events.find((e) => e.order_id === id(101)).stage, "shipped");
  assert.equal(events.find((e) => e.order_id === id(102)).source, "order_timestamp");
  assert.equal(events.filter((e) => e.order_id === id(103)).length, 0);
  assert.equal(events.find((e) => e.order_id === id(105)).source, "admin_audit");
});

test("Manila boundaries, zero-filled buckets and exact point drill-downs reconcile", async () => {
  const s = await summary();
  assert.equal(s.startAt, "2020-01-31T16:00:00+00:00");
  assert.equal(s.endAt, "2020-02-02T16:00:00+00:00");
  assert.equal(s.totalEntries, 4);
  assert.equal(s.uniqueOrders, 4);
  assert.equal(s.chart.length, 2);
  assert.equal(s.stageTotals.preparing, 0);
  assert.equal(s.chart[0].counts.payment_confirmed, 1);
  assert.equal(s.chart[1].counts.shipped, 1);
  for (const bucket of s.chart)
    for (const [stage, count] of Object.entries(bucket.counts)) {
      const d = await detail(s, stage, bucket.bucketStart);
      assert.equal(d.total, count);
      assert.equal(d.rows.length, count);
    }
  assert.equal(s.historicalCoverage, "partial_evidence_only");
});

test("range presets and adaptive grouping do not depend on session timezone", async () => {
  for (const zone of ["UTC", "America/Los_Angeles"]) {
    await db.exec(`set timezone='${zone}'`);
    for (const [period, start, end, group, days] of [
      ["today", null, null, "hour", 1],
      ["last_7_days", null, null, "day", 7],
      ["last_30_days", null, null, "day", 30],
      ["custom", "2020-02-01", "2020-02-01", "hour", 1],
      ["custom", "2020-01-01", "2020-03-01", "week", 61],
      ["custom", "2019-01-01", "2020-03-01", "month", 426],
      ["all_time", null, null, "month", null],
    ]) {
      const r = await result(
        "select * from fulfillment_analytics_range($1,$2,$3,'2020-03-01T16:30:00Z')",
        [period, start, end],
      );
      assert.equal(r.grouping, group);
      if (days) assert.equal((new Date(r.end_at) - new Date(r.start_at)) / 86400000, days);
      if (period === "today")
        assert.equal(new Date(r.start_at).toISOString(), "2020-03-01T16:00:00.000Z");
    }
  }
  await db.exec("set timezone='UTC'");
  const hourly = await summary("custom", "2020-02-01", "2020-02-01");
  assert.equal(hourly.chart.length, 24);
  assert.equal((await summary("all_time", null, null)).grouping, "month");
  assert.equal((await summary("today", null, null)).chart.length, 24);
  assert.equal((await summary("last_7_days", null, null)).chart.length, 7);
  assert.equal((await summary("last_30_days", null, null)).chart.length, 30);
});

test("partial weekly/monthly buckets and cross-timezone drill-down use identical evidence", async () => {
  for (const [start, end] of [
    ["2020-01-15", "2020-02-28"],
    ["2019-02-15", "2020-02-15"],
  ]) {
    const s = await summary("custom", start, end);
    await db.exec("set timezone='America/Los_Angeles'");
    for (const bucket of s.chart) {
      for (const stage of ["payment_confirmed", "shipped", "delivered", "cancelled"]) {
        assert.equal(
          (await detail(s, stage, bucket.bucketStart, 0, 100, start, end)).total,
          bucket.counts[stage],
        );
      }
    }
    await db.exec("set timezone='UTC'");
  }
});

test("empty evidence returns explicit zero buckets without fabricating order history", async () => {
  await db.exec("begin; delete from order_fulfillment_events");
  try {
    const s = await summary("all_time", null, null);
    assert.equal(s.totalEntries, 0);
    assert.equal(s.uniqueOrders, 0);
    assert.equal(s.chart.length, 1);
    assert.ok(Object.values(s.stageTotals).every((count) => count === 0));
    assert.equal(s.historicalCoverage, "partial_evidence_only");
  } finally {
    await db.exec("rollback");
  }
});

test("future transitions, shared child orders and retries count once without changing rules", async () => {
  const children = await Promise.all([makeOrder(), makeOrder()]);
  await db.query("update orders set group_order_id=$1 where id=any($2::uuid[])", [
    id(150),
    children,
  ]);
  for (const key of children) {
    for (const stage of ["preparing", "shipped", "in_transit", "completed"]) {
      await move(key, stage);
      await move(key, stage);
    }
    await assert.rejects(move(key, "preparing"), /backward|Delivered/);
    await assert.rejects(move(key, "cancelled"), /Invalid|confirmed|Delivered/);
    assert.equal(
      (
        await result("select count(*)::int as n from order_fulfillment_events where order_id=$1", [
          key,
        ])
      ).n,
      5,
    );
  }
  const key = await makeOrder("payment_pending");
  await db.query("update orders set status='cancelled' where id=$1", [key]);
  assert.equal(
    (
      await result(
        "select count(*)::int as n from order_fulfillment_events where order_id=$1 and stage='cancelled'",
        [key],
      )
    ).n,
    1,
  );
  const s = await summary("today", null, null);
  for (const stage of ["payment_confirmed", "preparing", "shipped", "in_transit", "delivered"])
    assert.equal(s.stageTotals[stage], 2);
});

test("reverification and unrelated updates do not duplicate first-entry counts", async () => {
  const key = await makeOrder();
  await db.query("update orders set status='payment_pending' where id=$1", [key]);
  await db.query(
    "update orders set status='payment_confirmed',payment_confirmed_at=now() where id=$1",
    [key],
  );
  await db.query("update orders set tracking_number='TRACK' where id=$1", [key]);
  assert.equal(
    (
      await result("select count(*)::int as n from order_fulfillment_events where order_id=$1", [
        key,
      ])
    ).n,
    1,
  );
});

test("failed and rolled-back transitions leave no event", async () => {
  const key = await makeOrder();
  await assert.rejects(move(key, "completed"), /next fulfillment/);
  await db.exec("begin");
  await move(key, "preparing");
  await db.exec("rollback");
  assert.equal(
    (
      await result(
        "select count(*)::int as n from order_fulfillment_events where order_id=$1 and stage='preparing'",
        [key],
      )
    ).n,
    0,
  );
});

test("pagination and snapshot exclude later entries and reject stale evidence", async () => {
  const s = await summary("today", null, null);
  const first = await detail(s, "payment_confirmed", null, 0, 1, null, null);
  const second = await detail(s, "payment_confirmed", null, 1, 1, null, null);
  assert.notEqual(first.rows[0].order_id, second.rows[0].order_id);
  await makeOrder();
  assert.equal((await detail(s, "payment_confirmed", null, 0, 100, null, null)).total, first.total);
  const historic = await summary();
  // Simulate an older transaction committing evidence after the summary snapshot.
  await db.query(
    "insert into order_fulfillment_events values($1,'preparing','2020-02-01T16:00:00Z','2020-02-01T16:00:00Z','notification')",
    [id(103)],
  );
  await assert.rejects(detail(historic, "preparing"), /Analytics changed/);
});

test("validation and authorization protect all analytics and raw evidence", async () => {
  await assert.rejects(summary("invalid", null, null), /Invalid/);
  await assert.rejects(summary("custom", "2020-02-03", "2020-02-01"), /valid start/);
  await assert.rejects(summary("custom", "2020-02-01", "9999-01-01"), /valid start/);
  await assert.rejects(summary("today", "2020-02-01", null), /only accepted/);
  const s = await summary();
  await assert.rejects(detail(s, "bogus"), /Select a fulfillment stage/);
  await assert.rejects(detail(s, "shipped", "2020-02-01T16:30:00Z"), /Invalid chart bucket/);
  await db.exec("set role authenticated; select set_config('test.admin','no',false)");
  await assert.rejects(summary(), /Admin access required/);
  await assert.rejects(detail(s, "shipped"), /Admin access required/);
  await assert.rejects(db.query("select * from order_fulfillment_events"), /permission denied/);
  await assert.rejects(db.query("delete from order_fulfillment_events"), /permission denied/);
  await db.exec("select set_config('test.admin','yes',false)");
  assert.equal((await summary()).timezone, "Asia/Manila");
  await db.exec("reset role");
});


test("expiry transitions appear in totals and drill-down, incomplete does not", async () => {
  const key = await makeOrder("payment_pending");
  await db.query("update orders set status='expired' where id=$1", [key]);
  await makeOrder("incomplete");
  const s = (await result("select admin_fulfillment_analytics('all_time') as data")).data;
  assert.equal(s.stageTotals.expired, 1);
  assert.equal(s.stageTotals.incomplete, undefined);
  const d = (await result("select admin_fulfillment_orders('all_time',null,null,'expired') as data")).data;
  assert.equal(d.total, s.stageTotals.expired);
  assert.equal(d.rows[0].order_id, key);
});
