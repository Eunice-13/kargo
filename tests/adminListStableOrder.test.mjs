import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import test, { after, before } from "node:test";

let db;
const sql = (name) => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");
const def = async (fn) =>
  (await db.query("select pg_get_functiondef($1::regproc) as src", [`public.${fn}`])).rows[0].src;

before(async () => {
  db = new PGlite();
  // Minimal schema the list RPCs touch, plus admin_assert stub.
  await db.exec(`
    create schema if not exists auth;
    create function auth.uid() returns uuid language sql as $$ select '00000000-0000-0000-0000-000000000001'::uuid $$;
    create function public.admin_assert() returns void language sql as $$ select $$;
    create type public.order_status as enum ('payment_pending','payment_submitted','insufficient_payment','payment_confirmed','preparing','completed','cancelled','expired','incomplete');
    create type public.batch_status as enum ('draft','live','locked','closed');
    create type public.batch_moderation as enum ('visible','flagged','hidden');
    create type public.payment_status as enum ('pending_review','verified','rejected');
    create table public.user_profiles(id uuid primary key, display_name text);
    create table public.batches(id uuid primary key, title text, status public.batch_status, category text, moderation_status public.batch_moderation, moderation_reason text, cover_path text, starts_on date, ends_on date, created_at timestamptz, seller_id uuid);
    create table public.batch_products(id uuid primary key, batch_id uuid, name text, quantity_total int);
    create table public.orders(id uuid primary key, order_number text, batch_product_id uuid, buyer_id uuid, seller_id uuid, total_amount numeric, status public.order_status, tracking_number text, payment_confirmed_at timestamptz, created_at timestamptz);
    create table public.payments(id uuid primary key, order_id uuid, method_type text, amount numeric, reference_number text, status public.payment_status, submitted_at timestamptz, reviewed_by uuid);
    create table public.admin_audit_log(id uuid primary key, actor_name text, action text, target_type text, target_label text, reason text, before_state jsonb, after_state jsonb, created_at timestamptz);
    create table public.combined_delivery_groups(id uuid primary key, buyer_id uuid, seller_id uuid, shipping_fee numeric, status text, created_at timestamptz);
    create table public.combined_delivery_members(id uuid primary key, group_id uuid, order_id uuid, released_at timestamptz);
  `);
  // Minimal standalone versions of the five list RPCs, each with the SAME paged
  // ORDER BY text the live functions use. The migration rewrites by that text, so
  // this faithfully exercises it without the unrelated batch_catalog view.
  await db.exec(`
    create function public.admin_list_batches(p_search text default null,p_status text default 'all',p_moderation text default 'all',p_category text default 'all',p_limit int default 25,p_offset int default 0)
    returns jsonb language plpgsql stable security definer set search_path='' as $fn$
    declare v_rows jsonb; begin perform public.admin_assert();
      select coalesce(jsonb_agg(row_to_json(r) order by r."createdAt" desc),'[]'::jsonb) into v_rows
      from (select b.id, b.created_at as "createdAt" from public.batches b
            order by b.created_at desc offset greatest(p_offset,0) limit least(greatest(p_limit,1),100)) r;
      return jsonb_build_object('rows',v_rows,'total',(select count(*) from public.batches),'nextOffset',p_offset+p_limit); end $fn$;

    create function public.admin_list_orders(p_search text default null,p_status text default 'all',p_days int default 30,p_limit int default 25,p_offset int default 0)
    returns jsonb language plpgsql stable security definer set search_path='' as $fn$
    declare v_rows jsonb; begin perform public.admin_assert();
      select coalesce(jsonb_agg(row_to_json(r) order by r."createdAt" desc),'[]'::jsonb) into v_rows
      from (select o.id, o.created_at as "createdAt" from public.orders o
            order by o.created_at desc offset greatest(p_offset,0) limit least(greatest(p_limit,1),100)) r;
      return jsonb_build_object('rows',v_rows,'total',0,'nextOffset',p_offset+p_limit); end $fn$;

    create function public.admin_list_payments(p_search text default null,p_status text default 'all',p_days int default 30,p_limit int default 25,p_offset int default 0)
    returns jsonb language plpgsql stable security definer set search_path='' as $fn$
    declare v_rows jsonb; begin perform public.admin_assert();
      select coalesce(jsonb_agg(row_to_json(r) order by r."submittedAt" desc),'[]'::jsonb) into v_rows
      from (select pay.id, pay.submitted_at as "submittedAt" from public.payments pay
            order by pay.submitted_at desc offset greatest(p_offset,0) limit least(greatest(p_limit,1),100)) r;
      return jsonb_build_object('rows',v_rows,'total',0,'nextOffset',p_offset+p_limit); end $fn$;

    create function public.admin_list_audit(p_search text default null,p_action text default 'all',p_days int default 30,p_limit int default 25,p_offset int default 0)
    returns jsonb language plpgsql stable security definer set search_path='' as $fn$
    declare v_rows jsonb; begin perform public.admin_assert();
      select coalesce(jsonb_agg(row_to_json(r) order by r."createdAt" desc),'[]'::jsonb) into v_rows
      from (select a.id, a.created_at as "createdAt" from public.admin_audit_log a
            order by a.created_at desc offset greatest(p_offset,0) limit least(greatest(p_limit,1),100)) r;
      return jsonb_build_object('rows',v_rows,'total',0,'nextOffset',p_offset+p_limit); end $fn$;

    create function public.admin_list_combined_payments(p_search text default null,p_status text default 'all',p_limit int default 25,p_offset int default 0)
    returns jsonb language plpgsql stable security definer set search_path='' as $fn$
    declare v_rows jsonb; begin perform public.admin_assert();
      select coalesce(jsonb_agg(row_to_json(r) order by r."createdAt" desc),'[]'::jsonb) into v_rows
      from (select g.id, g.created_at as "createdAt" from public.combined_delivery_groups g
            order by g.created_at desc offset greatest(p_offset,0) limit least(greatest(p_limit,1),100)) r;
      return jsonb_build_object('rows',v_rows,'total',0,'nextOffset',p_offset+p_limit); end $fn$;
  `);
});
after(async () => db?.close());

test("tiebreaker migration adds the primary key to each list's paged ORDER BY", async () => {
  const expected = {
    admin_list_batches: ["order by b.created_at desc, b.id desc"],
    admin_list_orders: ["order by o.created_at desc, o.id desc"],
    admin_list_payments: ["order by pay.submitted_at desc, pay.id desc"],
    admin_list_audit: ["order by a.created_at desc, a.id desc"],
    admin_list_combined_payments: ["order by g.created_at desc, g.id desc"],
  };
  // Before: plain timestamp-only paged ORDER BY (no id tiebreaker).
  for (const fn of Object.keys(expected)) {
    assert.ok(!(await def(fn)).includes(expected[fn][0]), `${fn} should start without the tiebreaker`);
  }

  await db.exec(sql("202611100005_admin_list_stable_order.sql"));

  for (const [fn, [clause]] of Object.entries(expected)) {
    const src = await def(fn);
    assert.ok(src.includes(clause), `${fn} paged ORDER BY must gain the id tiebreaker`);
    // The jsonb_agg output ordering (aggregate alias "r"/"createdAt") stays as-is.
    assert.ok(/order by r\."?(createdAt|submittedAt)"? desc\)/.test(src), `${fn} output order unchanged`);
  }

  // Re-running must not double the tiebreaker.
  await db.exec(sql("202611100005_admin_list_stable_order.sql"));
  assert.ok(!(await def("admin_list_batches")).includes("b.id desc, b.id desc"));

  // The functions still run and page correctly with real ties.
  const rows = Array.from({ length: 4 }, (_, i) => `('${"00000000-0000-0000-0000-00000000000" + (i + 1)}'::uuid, 'B${i}', 'live', 'Food', 'visible', null, null, null, null, '2020-01-01T00:00:00Z'::timestamptz, '00000000-0000-0000-0000-0000000000a1'::uuid)`).join(",");
  await db.query("insert into public.user_profiles values ('00000000-0000-0000-0000-0000000000a1','Seller')");
  await db.query(`insert into public.batches(id,title,status,category,moderation_status,moderation_reason,cover_path,starts_on,ends_on,created_at,seller_id) values ${rows}`);
  const page1 = (await db.query("select public.admin_list_batches(null,'all','all','all',2,0) as d")).rows[0].d;
  const page2 = (await db.query("select public.admin_list_batches(null,'all','all','all',2,2) as d")).rows[0].d;
  const ids = [...page1.rows, ...page2.rows].map((r) => r.id);
  assert.equal(new Set(ids).size, 4, "all four tied rows are returned once across two pages");
});
