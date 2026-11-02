import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const read = (name) => readFileSync(new URL(`../supabase/${name}`, import.meta.url), "utf8");
const historical = (name) => read(`migrations (to update profile database name)/${name}.sql`);
let db, legacy;
before(async () => {
  // Ephemeral WASM PostgreSQL only: no environment, credentials, HTTP, or live DB.
  db = new PGlite();
  await db.exec(`create role authenticated; create role anon; create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table public.user_profiles(id uuid primary key references auth.users(id),
      display_name text not null default '', can_sell boolean not null default false,
      account_status text not null default 'active');`);
  const foundation = read("migrations/202611010001_admin_foundation.sql");
  await db.exec(foundation.match(/create or replace function public.can_sell\([\s\S]*?\$\$;/)[0]);
  const initial = historical("202609200001_initial_kargo_schema");
  // Run the actual table DDL and seller RLS, not a weakened imitation of them.
  await db.exec(initial.match(/create type public.batch_status[^;]+;/)[0]);
  for (const table of ["batches", "batch_products"]) {
    await db.exec(
      initial
        .match(new RegExp(`create table public.${table} \\([\\s\\S]*?\\n\\);`))[0]
        .replaceAll("references public.profiles", "references public.user_profiles"),
    );
    await db.exec(`alter table public.${table} enable row level security`);
  }
  await db.exec(initial.match(/create unique index batch_products_batch_name_uidx[^;]+;/)[0]);
  await db.exec(
    historical("202610190001_batch_media_uploads").split("insert into storage.buckets")[0],
  );
  await db.exec(
    historical("202610190002_batch_group_orders").split(
      "create table if not exists public.group_orders",
    )[0],
  );
  await db.exec("alter table public.batches add column gallery_paths text[] not null default '{}'");
  await db.exec(historical("202609250001_per_user_limit").split("drop view if exists")[0]);
  await db.exec(
    historical("202610010004_waitlist_limits_and_cleanup").split("drop view if exists")[0],
  );
  await db.exec(
    historical("202610010005_zero_waitlist_limit").split("create or replace function")[0],
  );
  for (const policy of initial.matchAll(/create policy (?:batches_|products_)[\s\S]*?;/g)) {
    await db.exec(policy[0]);
  }
  await db.exec(`grant usage on schema public,auth to authenticated;
    grant select,insert,update,delete on public.batches,public.batch_products to authenticated;
    insert into auth.users values ('71000000-0000-0000-0000-000000000099');
    insert into user_profiles(id,can_sell) values ('71000000-0000-0000-0000-000000000099',true);
    insert into batches(id,seller_id,title,starts_on,ends_on,category)
      values ('72000000-0000-0000-0000-000000000099','71000000-0000-0000-0000-000000000099','Legacy',current_date,current_date,'Food');
    insert into batch_products(id,batch_id,name,base_price,quantity_total)
      values ('73000000-0000-0000-0000-000000000099','72000000-0000-0000-0000-000000000099','Legacy',1,1);`);
  legacy = await db.query(
    "select to_jsonb(b) as batch,to_jsonb(p) as product from batches b join batch_products p on p.batch_id=b.id",
  );
  await db.exec(read("migrations/202611070002_required_batch_images.sql"));
});
after(async () => await db?.close());

test("migration preserves legacy rows exactly and leaves CHECKs unvalidated", async () => {
  assert.deepEqual(
    await db.query(
      "select to_jsonb(b) as batch,to_jsonb(p) as product from batches b join batch_products p on p.batch_id=b.id",
    ),
    legacy,
  );
  const checks = await db.query(
    "select convalidated from pg_constraint where conname in ('batches_cover_path_required','batch_products_image_path_required')",
  );
  assert.equal(checks.rows.length, 2);
  assert.ok(checks.rows.every((c) => c.convalidated === false));
});
test("SQL regression covers direct writes, RPC atomicity, execution grants, and ownership", async () => {
  await db.exec(read("tests/required_batch_images.sql"));
});
test("legacy imageless rows remain readable but any update requires a real path", async () => {
  await assert.rejects(
    db.exec("update batches set title='Changed' where title='Legacy'"),
    (e) => e.code === "23514",
  );
  await assert.rejects(
    db.exec("update batch_products set name='Changed' where name='Legacy'"),
    (e) => e.code === "23514",
  );
  await db.exec(`begin;
    update batches set cover_path='seller/legacy/real-cover.png' where title='Legacy';
    update batch_products set image_path='seller/legacy/real-product.png' where name='Legacy';
    update batches set title='Now editable' where title='Legacy';
    update batch_products set name='Now editable' where name='Legacy'; rollback;`);
});

test("admin migration adds imagePath without changing existing detail JSON or admin permissions", async () => {
  await db.exec("begin");
  try {
    const initial = historical("202609200001_initial_kargo_schema");
    // Only referenced support columns are needed; batch/product DDL is the
    // actual schema above, and authorization uses the actual current functions.
    await db.exec(initial.match(/create type public.order_status[\s\S]*?;/)[0]);
    await db.exec(initial.match(/create type public.waitlist_status[^;]+;/)[0]);
    await db.exec(`create table public.orders(batch_product_id uuid,quantity integer,total_amount numeric,status public.order_status);
      create table public.waitlist_entries(batch_product_id uuid,status public.waitlist_status);
      create table public.admin_audit_log(id uuid,actor_name text,action text,reason text,created_at timestamptz,target_type text,target_id text);
      create table public.admin_members(user_id uuid,accepted_at timestamptz,revoked_at timestamptz);
      alter table public.batches add column moderation_status text not null default 'visible',add column moderation_reason text;
      insert into public.admin_members(user_id,accepted_at) values('71000000-0000-0000-0000-000000000099',now());
      select set_config('request.jwt.claim.sub','71000000-0000-0000-0000-000000000099',true);`);
    const membership = read("migrations/202611030001_admin_invite_acceptance.sql");
    await db.exec(membership.match(/create or replace function public.is_admin\([\s\S]*?\$\$;/)[0]);
    const users = read("migrations/202611010002_admin_users_dashboard.sql");
    await db.exec(
      users.match(
        /create or replace function public.admin_assert\([\s\S]*?revoke all on function public.admin_assert\(\)[^;]+;/,
      )[0],
    );
    const batches = read("migrations/202611010003_admin_batches_transactions.sql");
    await db.exec(
      batches.match(
        /create or replace function public.admin_get_batch\([\s\S]*?grant execute on function public.admin_get_batch\(uuid\) to authenticated;/,
      )[0],
    );
    const detail = async () =>
      (
        await db.query(
          "select public.admin_get_batch('72000000-0000-0000-0000-000000000099') as detail",
        )
      ).rows[0].detail;
    const original = await detail();
    assert.equal(Object.hasOwn(original.products[0], "imagePath"), false);
    await db.exec(read("migrations/202611070003_admin_batch_product_images.sql"));
    assert.deepEqual(await detail(), {
      ...original,
      products: original.products.map((p) => ({ ...p, imagePath: null })),
    });
    await db.exec(read("tests/admin_batch_product_images.sql"));
  } finally {
    await db.exec("rollback");
  }
});
