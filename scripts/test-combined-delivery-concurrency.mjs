// Native PostgreSQL multi-session preflight audit. No production connection URL
// is accepted. Requires the temporary cluster described in the audit report.
// Every scenario uses its own disposable database and independent connections.
// Rejected transactions must have the expected SQLSTATE and preserve invariants.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const paymentAudit = process.argv.includes("--payments");
const fullSchema = process.argv.includes("--full-schema");
const currentPhase4 = process.argv.includes("--current-phase-4");
if (currentPhase4 && (!fullSchema || paymentAudit))
  throw Error("Current Phase 4 foundation races require --full-schema without --payments");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nativeRoot = path.resolve(process.env.KARGO_NATIVE_PG_ROOT ?? "/private/tmp/kargo-native-pg");
assert.ok(
  nativeRoot.startsWith("/private/tmp/kargo-native-pg"),
  "Requires an isolated kargo-native-pg directory under /private/tmp",
);
const { default: pg } = await import(
  pathToFileURL(path.join(nativeRoot, "node_modules/pg/lib/index.js")).href
);
let cfg = { host: path.join(nativeRoot, "socket"), port: 55439, user: "kargo_test" };
if (fullSchema) {
  const { localSql, workdir } = await import("./local-staging/database.mjs");
  localSql(
    "reset role; alter database kargo_fullschema_template owner to postgres; set role postgres;",
    "full-schema-template-owner",
  );
  const { readFileSync } = await import("node:fs");
  const { verifyLocalTarget, readRuntimeEvidence } = await import("./local-staging/isolation.mjs");
  const target = verifyLocalTarget(
    JSON.parse(readFileSync(path.join(workdir, "target.local.json"))),
    readRuntimeEvidence(workdir),
  );
  const u = new URL(target.databaseUrl);
  cfg = {
    host: u.hostname,
    port: Number(u.port),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
  };
}
const admin = new pg.Client({ ...cfg, database: "postgres" });
await admin.connect();
if (!fullSchema)
  assert.equal(
    (await admin.query("select current_setting('data_directory') as dir")).rows[0].dir,
    path.join(nativeRoot, "cluster"),
  );
else
  assert.equal(
    (
      await admin.query(
        "select shobj_description(oid,'pg_database') as comment from pg_database where datname='kargo_fullschema_template'",
      )
    ).rows[0]?.comment,
    "KARGO synthetic full-schema concurrency template; local-only",
  );
const prefix = `kargo_audit_${Date.now()}`;
const template = prefix + "_base";
let databases = [];
let failures = [];
const buyer = "61000000-0000-0000-0000-000000000001",
  seller = "61000000-0000-0000-0000-000000000002";
const order1 = "65000000-0000-0000-0000-000000000001",
  order2 = "65000000-0000-0000-0000-000000000002";
const request = `select (public.request_combined_delivery(array['${order1}'::uuid,'${order2}'::uuid],14.6,121,'Unit 1, Test address',true)).id`;
const move =
  "update public.batch_products set batch_id='62000000-0000-0000-0000-000000000002' where id='63000000-0000-0000-0000-000000000002'";
async function connect(db) {
  let c = new pg.Client({ ...cfg, database: db });
  await c.connect();
  await c.query("set statement_timeout='8s';set lock_timeout='6s'");
  return c;
}
async function begin(c, actor) {
  await c.query("begin");
  await c.query("set local role authenticated");
  await c.query("select set_config('request.jwt.claim.sub',$1,true)", [actor]);
}
async function call(c, actor, sql, params = []) {
  await begin(c, actor);
  try {
    let r = await c.query(sql, params);
    await c.query("commit");
    return r;
  } catch (e) {
    await c.query("rollback");
    throw e;
  }
}
async function blocked(observer, waiting, blocker) {
  const deadline = Date.now() + 2500;
  while (Date.now() < deadline) {
    const r = (
      await observer.query("select $1::int=any(pg_blocking_pids($2::int)) as blocked", [
        blocker.processID,
        waiting.processID,
      ])
    ).rows[0];
    if (r.blocked) return;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw Error("Expected real inter-session blocking did not occur");
}
function outcome(p) {
  return p.then(
    (value) => ({ value }),
    (error) => ({ error }),
  );
}
function assertIdentityConflict(error, identity) {
  assert.ok(error, "Conflicting identity update was accepted");
  if (error.code === "40001") return;
  if (error.code === "23503" || error.code === "23001") {
    assert.equal(error.constraint, `combined_delivery_batch_pin_${identity}_fk`);
    return;
  }
  assert.equal(error.code, "22023", "Unexpected failure must not pass a race test");
  assert.match(error.message, /active combined delivery/);
}
async function assertAborted(c) {
  const r = await outcome(c.query("select 1"));
  assert.equal(r.error?.code, "25P02", "Rejected transaction must be aborted");
}
async function assertPins(c) {
  const r = await c.query(`select count(*)::int as invalid from public.combined_delivery_members m
    join public.orders o on o.id=m.order_id join public.combined_delivery_groups g on g.id=m.group_id
    join public.batch_products bp on bp.id=o.batch_product_id
    left join public.combined_delivery_batch_pins p on p.group_id=m.group_id and p.order_id=m.order_id
    where (m.released_at is null and (p.order_id is null or p.product_id<>o.batch_product_id or p.batch_id<>g.batch_id or p.seller_id<>g.seller_id or p.order_revision<>o.combined_delivery_revision or bp.batch_id<>g.batch_id))
      or (m.released_at is not null and p.order_id is not null)`);
  assert.equal(r.rows[0].invalid, 0, "No active membership may drift or lose its identity pin");
}
async function migration(c, filename) {
  return c.query(
    await readFile(
      path.join(root, "supabase/migrations (to update profile database name)", filename),
      "utf8",
    ),
  );
}
async function rollbackIntegrity(c) {
  return c.query(
    await readFile(
      path.join(root, "supabase/rollbacks/202610210004_combined_delivery_batch_integrity.sql"),
      "utf8",
    ),
  );
}
async function approved(c, fee = false) {
  let g = (await call(c, buyer, request)).rows[0].id;
  await call(c, seller, "select public.review_combined_delivery($1,'approve')", [g]);
  if (fee)
    await call(
      c,
      seller,
      "select public.review_combined_delivery($1,'set_shipping_fee',null,125.50)",
      [g],
    );
  return g;
}
async function stale(c, hasPins = true) {
  await c.query(
    `begin;${hasPins ? "delete from public.combined_delivery_batch_pins where product_id='63000000-0000-0000-0000-000000000002';" : ""}alter table public.batch_products disable trigger batch_products_active_delivery_identity;${move};alter table public.batch_products enable trigger batch_products_active_delivery_identity;commit`,
  );
}
try {
  for (const role of ["anon", "authenticated", "service_role"])
    await admin.query(
      `do $$ begin if not exists(select 1 from pg_roles where rolname='${role}') then create role ${role}${role === "service_role" ? " bypassrls" : ""};end if;end $$;`,
    );
  await admin.query(
    `create database ${template}${fullSchema ? " template kargo_fullschema_template" : ""}`,
  );
  databases.push(template);
  let base = await connect(template);
  try {
    if (fullSchema) {
      // Reset only the disposable clone; the running application DB is never truncated.
      await base.query(
        `do $$ declare targets text; begin select string_agg(format('%I.%I',schemaname,tablename),',') into targets from pg_tables where schemaname='public'; execute 'truncate table '||targets||', auth.users cascade'; end $$;`,
      );
      if (!paymentAudit && !currentPhase4)
        await base.query(
          await readFile(
            `${root}/supabase/rollbacks/202610210005_combined_delivery_payments.sql`,
            "utf8",
          ),
        );
    } else {
      let fixture = await readFile(
        `${root}/supabase/tests/fixtures/combined_delivery_minimal_schema.sql`,
        "utf8",
      );
      fixture = fixture.replace(/^create role .*;$/gm, "");
      await base.query(fixture);
      const dir = `${root}/supabase/migrations (to update profile database name)`;
      for (const file of [
        "202610200002_combined_delivery_foundations.sql",
        "202610210001_combined_delivery_buyer_requests.sql",
        "202610210002_combined_delivery_seller_review.sql",
        "202610210003_combined_delivery_recovery.sql",
        "202610210004_combined_delivery_batch_integrity.sql",
      ])
        await base.query(await readFile(`${dir}/${file}`, "utf8"));
      if (paymentAudit) {
        await base.query(
          await readFile(
            `${root}/supabase/tests/fixtures/combined_delivery_payment_schema.sql`,
            "utf8",
          ),
        );
        const shippingSource = await readFile(
          `${dir}/202610180001_tracking_and_buyer_shipping.sql`,
          "utf8",
        );
        for (const [filename, name] of [
          ["202609260002_waitlist_offers_rpcs.sql", "available_stock"],
          ["202609260002_waitlist_offers_rpcs.sql", "place_order_for_buyer"],
          ["202610010008_waitlist_claim_priority.sql", "offer_to_next_waitlist"],
          ["202610180001_tracking_and_buyer_shipping.sql", "sweep_expirations"],
          ["202610180001_tracking_and_buyer_shipping.sql", "submit_order_payment"],
        ]) {
          const source = await readFile(`${dir}/${filename}`, "utf8");
          const start = source.indexOf(`create or replace function public.${name}(`);
          const end = source.indexOf("$$;", source.indexOf("as $$", start)) + 3;
          assert.ok(start >= 0 && end > start);
          await base.query(source.slice(start, end));
        }
        // review_order_payment is CREATE (not CREATE OR REPLACE) in this migration.
        const review = shippingSource.slice(
          shippingSource.indexOf("create function public.review_order_payment("),
          shippingSource.indexOf("revoke all on function public.submit_order_payment("),
        );
        await base.query(review);
        await base.query(
          "revoke all on function public.submit_order_payment(uuid,text,numeric,text,text,text,text,text), public.review_order_payment(uuid,public.payment_status,text,numeric) from public; grant execute on function public.submit_order_payment(uuid,text,numeric,text,text,text,text,text), public.review_order_payment(uuid,public.payment_status,text,numeric) to authenticated",
        );
        await base.query(
          await readFile(`${dir}/202610210005_combined_delivery_payments.sql`, "utf8"),
        );
        await base.query(
          await readFile(`${dir}/202610230001_combined_payment_method_compatibility.sql`, "utf8"),
        );
      }
      let shipping = await readFile(`${dir}/202610180001_tracking_and_buyer_shipping.sql`, "utf8");
      await base.query(
        shipping.slice(
          shipping.indexOf("create or replace function public.set_order_shipping_fee("),
          shipping.indexOf("create or replace function public.request_location_correction("),
        ),
      );
      await base.query(
        "revoke all on function public.set_order_shipping_fee(uuid,numeric) from public;grant execute on function public.set_order_shipping_fee(uuid,numeric) to authenticated",
      );
      await base.query(
        `alter table public.batch_products enable row level security; create policy products_update_seller on public.batch_products for update to authenticated using(exists(select 1 from public.batches b where b.id=batch_id and b.seller_id=auth.uid()) and public.can_sell());create policy products_select_visible on public.batch_products for select to authenticated using(exists(select 1 from public.batches b where b.id=batch_id and (b.status<>'draft' or b.seller_id=auth.uid())));grant select on public.batches to authenticated;grant select,update on public.batch_products to authenticated;`,
      );
    }
  } finally {
    await base.end();
  }
  const data = (
    await readFile(`${root}/supabase/tests/combined_delivery_buyer_requests.sql`, "utf8")
  ).split("-- Existing independent reservations")[0];
  async function scenario(name, fn) {
    if (currentPhase4 && /^(migration pins|migration rejects|rollback refuses)/.test(name)) {
      console.log("PHASE-SPECIFIC (tested in foundation mode):", name);
      return;
    }
    const db = prefix + "_" + databases.length;
    await admin.query(`create database ${db} template ${template}`);
    databases.push(db);
    let c = await connect(db),
      a = await connect(db),
      b = await connect(db);
    try {
      await c.query(data);
      await c.query("commit");
      if (paymentAudit || currentPhase4)
        await c.query(
          `insert into public.seller_payment_methods(seller_id,method_type) values('${seller}','GCash');insert into storage.objects(bucket_id,name) values('payment-receipts','${buyer}/proof.jpg')`,
        );
      await fn({ c, a, b });
      await assertPins(c);
      console.log("PASS", name);
    } catch (error) {
      failures.push({ name, message: error.message });
      console.error("FAIL", name, error.message);
    } finally {
      await Promise.allSettled([a.query("rollback"), b.query("rollback")]);
      await Promise.all([a.end(), b.end(), c.end()]);
    }
  }
  if (!paymentAudit) {
    await scenario("concurrent duplicate requests serialize to one group", async ({ c, a, b }) => {
      await begin(a, buyer);
      let id = (await a.query(request)).rows[0].id;
      await begin(b, buyer);
      let pending = outcome(b.query(request));
      await blocked(c, b, a);
      await a.query("commit");
      let r = await pending;
      assert.ifError(r.error);
      assert.equal(r.value.rows[0].id, id);
      await b.query("commit");
      assert.equal(
        (await c.query("select count(*)::int as n from public.combined_delivery_groups")).rows[0].n,
        1,
      );
    });
    await scenario("conflicting shared fees cannot overwrite each other", async ({ c, a, b }) => {
      let g = await approved(c);
      await begin(a, seller);
      await a.query("select public.review_combined_delivery($1,'set_shipping_fee',null,125.50)", [
        g,
      ]);
      await begin(b, seller);
      let pending = outcome(
        b.query("select public.review_combined_delivery($1,'set_shipping_fee',null,150)", [g]),
      );
      await blocked(c, b, a);
      await a.query("commit");
      let r = await pending;
      assert.match(r.error?.message ?? "", /Approve the request before assigning/);
      await b.query("rollback");
      assert.equal(
        Number(
          (
            await c.query("select shipping_fee from public.combined_delivery_groups where id=$1", [
              g,
            ])
          ).rows[0].shipping_fee,
        ),
        125.5,
      );
    });
    await scenario(
      "recovery wins against shipping fee assignment atomically",
      async ({ c, a, b }) => {
        let g = await approved(c);
        await stale(c);
        await begin(a, buyer);
        await a.query("select public.invalidate_combined_delivery_request($1)", [g]);
        await begin(b, seller);
        let pending = outcome(
          b.query("select public.review_combined_delivery($1,'set_shipping_fee',null,125.50)", [g]),
        );
        await blocked(c, b, a);
        await a.query("commit");
        let r = await pending;
        assert.equal(r.error?.code, "22023");
        assert.match(r.error.message, /Approve the request before assigning/);
        await b.query("rollback");
        assert.equal(
          (
            await c.query(
              "select count(*)::int as n from public.combined_delivery_members where released_at is null",
            )
          ).rows[0].n,
          0,
        );
      },
    );
    await scenario(
      "valid fee assignment survives competing invalidation attempt",
      async ({ c, a, b }) => {
        let g = await approved(c);
        await begin(a, seller);
        await a.query("select public.review_combined_delivery($1,'set_shipping_fee',null,125.50)", [
          g,
        ]);
        await begin(b, buyer);
        let pending = outcome(
          b.query("select public.invalidate_combined_delivery_request($1)", [g]),
        );
        await blocked(c, b, a);
        await a.query("commit");
        let r = await pending;
        assert.match(r.error?.message ?? "", /still eligible/);
        await b.query("rollback");
        assert.equal(
          (await c.query("select status from public.combined_delivery_groups where id=$1", [g]))
            .rows[0].status,
          "shipping_fee_set",
        );
      },
    );
    await scenario(
      "simultaneous buyer and seller recovery release memberships once",
      async ({ c, a, b }) => {
        let g = await approved(c);
        await stale(c);
        await begin(a, buyer);
        await a.query("select public.invalidate_combined_delivery_request($1)", [g]);
        await begin(b, seller);
        let pending = outcome(
          b.query("select public.invalidate_combined_delivery_request($1)", [g]),
        );
        await blocked(c, b, a);
        await a.query("commit");
        let r = await pending;
        assert.ifError(r.error);
        await b.query("commit");
        assert.equal(
          (
            await c.query(
              "select count(*)::int as n from public.combined_delivery_events where event_type='invalidated'",
            )
          ).rows[0].n,
          1,
        );
        assert.equal(
          (
            await c.query(
              "select count(*)::int as n from public.notifications where dedupe_key like 'combined_delivery_invalidated_%'",
            )
          ).rows[0].n,
          2,
        );
      },
    );
    await scenario("request creation blocks conflicting product move", async ({ c, a, b }) => {
      await begin(a, buyer);
      await a.query(request);
      await begin(b, seller);
      let pending = outcome(b.query(move));
      await blocked(c, b, a);
      await a.query("commit");
      let r = await pending;
      assert.match(r.error?.message ?? "", /active combined delivery/);
      await b.query("rollback");
      assert.equal(
        (
          await c.query(
            "select count(distinct bp.batch_id)::int as n from public.combined_delivery_members m join public.orders o on o.id=m.order_id join public.batch_products bp on bp.id=o.batch_product_id where m.released_at is null",
          )
        ).rows[0].n,
        1,
      );
    });
    await scenario(
      "product move wins: waiting request rejects different batches",
      async ({ c, a, b }) => {
        await begin(a, seller);
        await a.query(move);
        await begin(b, buyer);
        let pending = outcome(b.query(request));
        await blocked(c, b, a);
        await a.query("commit");
        let r = await pending;
        assert.match(r.error?.message ?? "", /same Pasabuy batch/);
        await b.query("rollback");
        assert.equal(
          (await c.query("select count(*)::int as n from public.combined_delivery_groups")).rows[0]
            .n,
          0,
        );
      },
    );
    await scenario(
      "request creation blocks individual shipping assignment",
      async ({ c, a, b }) => {
        await begin(a, buyer);
        await a.query(request);
        await begin(b, seller);
        let pending = outcome(b.query("select public.set_order_shipping_fee($1,50)", [order1]));
        await blocked(c, b, a);
        await a.query("commit");
        let r = await pending;
        assert.match(r.error?.message ?? "", /awaiting combined delivery review/);
        await b.query("rollback");
        assert.equal(
          (await c.query("select shipping_fee from public.orders where id=$1", [order1])).rows[0]
            .shipping_fee,
          null,
        );
      },
    );
    await scenario(
      "individual fee wins: request rejects finalized shipping",
      async ({ c, a, b }) => {
        await begin(a, seller);
        await a.query("select public.set_order_shipping_fee($1,50)", [order1]);
        await begin(b, buyer);
        let pending = outcome(b.query(request));
        await blocked(c, b, a);
        await a.query("commit");
        let r = await pending;
        assert.equal(r.error?.code, "22023");
        assert.match(r.error.message, /no longer eligible/);
        await b.query("rollback");
        assert.equal(
          (await c.query("select count(*)::int as n from public.combined_delivery_members")).rows[0]
            .n,
          0,
        );
      },
    );
    await scenario(
      "repeatable-read batch mutation cannot bypass active group guard",
      async ({ c, a, b }) => {
        await b.query("begin isolation level repeatable read");
        await b.query("set local role authenticated");
        await b.query("select set_config('request.jwt.claim.sub',$1,true)", [seller]);
        await b.query("select count(*) from public.combined_delivery_members");
        await b.query(
          "update public.batch_products set name='must roll back' where id='63000000-0000-0000-0000-000000000003'",
        );
        await begin(a, buyer);
        await a.query(request);
        let pending = outcome(b.query(move));
        await blocked(c, b, a);
        await a.query("commit");
        let r = await pending;
        assertIdentityConflict(r.error, "product");
        if (r.error) {
          await assertAborted(b);
          console.log("Batch mutation safely rejected:", r.error.message);
          await b.query("rollback");
        } else {
          await b.query("commit");
        }
        const state = (
          await c.query(
            "select g.status,count(distinct bp.batch_id)::int as actual_batches,count(*)::int as active_members from public.combined_delivery_groups g join public.combined_delivery_members m on m.group_id=g.id and m.released_at is null join public.orders o on o.id=m.order_id join public.batch_products bp on bp.id=o.batch_product_id group by g.status",
          )
        ).rows;
        assert.equal(
          (
            await c.query(
              "select name from public.batch_products where id='63000000-0000-0000-0000-000000000003'",
            )
          ).rows[0].name,
          "Other batch item",
        );
        assert.equal(state.length, 1);
        assert.equal(state[0].active_members, 2);
        console.log("Snapshot race final state:", JSON.stringify(state));
        assert.ok(
          state.every((row) => row.actual_batches === 1),
          "Critical: REPEATABLE READ batch update left an active cross-batch combined delivery",
        );
      },
    );
    await scenario(
      "old snapshot cannot mutate an approved fee-assigned group",
      async ({ c, a, b }) => {
        await b.query("begin isolation level repeatable read");
        await b.query("set local role authenticated");
        await b.query("select set_config('request.jwt.claim.sub',$1,true)", [seller]);
        await b.query("select count(*) from public.combined_delivery_members");
        await b.query(
          "update public.batch_products set name='must roll back' where id='63000000-0000-0000-0000-000000000003'",
        );
        const group = await approved(c, true);
        const r = await outcome(b.query(move));
        assertIdentityConflict(r.error, "product");
        if (r.error) {
          await assertAborted(b);
          await b.query("rollback");
        } else await b.query("commit");
        const state = (
          await c.query(
            "select g.status,g.shipping_fee,count(distinct bp.batch_id)::int as actual_batches,count(*)::int as active_members,count(*) filter(where o.deadline_paused_at is not null)::int as paused_members from public.combined_delivery_groups g join public.combined_delivery_members m on m.group_id=g.id and m.released_at is null join public.orders o on o.id=m.order_id join public.batch_products bp on bp.id=o.batch_product_id where g.id=$1 group by g.status,g.shipping_fee",
            [group],
          )
        ).rows;
        assert.equal(
          (
            await c.query(
              "select name from public.batch_products where id='63000000-0000-0000-0000-000000000003'",
            )
          ).rows[0].name,
          "Other batch item",
        );
        assert.equal(state.length, 1);
        assert.equal(state[0].status, "shipping_fee_set");
        assert.equal(Number(state[0].shipping_fee), 125.5);
        assert.equal(state[0].active_members, 2);
        console.log("Approved snapshot race final state:", JSON.stringify(state));
        assert.ok(
          state.every((row) => row.actual_batches === 1),
          "Critical: an approved fee-assigned group became cross-batch through a stale transaction snapshot",
        );
      },
    );

    for (const isolation of ["repeatable read", "serializable"]) {
      await scenario(
        `${isolation}: approved membership blocks an older snapshot mutation`,
        async ({ c, a, b }) => {
          await b.query(`begin isolation level ${isolation}`);
          await b.query("set local role authenticated");
          await b.query("select set_config('request.jwt.claim.sub',$1,true)", [seller]);
          await b.query("select count(*) from public.combined_delivery_members");
          const g = await approved(c, true);
          const r = await outcome(b.query(move));
          assertIdentityConflict(r.error, "product");
          await assertAborted(b);
          await b.query("rollback");
          const row = (
            await c.query(
              "select status,shipping_fee from public.combined_delivery_groups where id=$1",
              [g],
            )
          ).rows[0];
          assert.equal(row.status, "shipping_fee_set");
          assert.equal(Number(row.shipping_fee), 125.5);
        },
      );
      await scenario(
        `${isolation}: changed product rejects old request and fresh retry revalidates`,
        async ({ c, a, b }) => {
          await b.query(`begin isolation level ${isolation}`);
          await b.query("set local role authenticated");
          await b.query("select set_config('request.jwt.claim.sub',$1,true)", [buyer]);
          await b.query("select count(*) from public.combined_delivery_members");
          await begin(a, seller);
          await a.query(move);
          const pending = outcome(b.query(request));
          await blocked(c, b, a);
          await a.query("commit");
          const r = await pending;
          assert.equal(r.error?.code, "40001");
          await assertAborted(b);
          await b.query("rollback");
          await assert.rejects(
            call(b, buyer, request),
            (e) => e.code === "22023" && /same Pasabuy batch/.test(e.message),
          );
          assert.equal(
            (await c.query("select count(*)::int n from public.combined_delivery_groups")).rows[0]
              .n,
            0,
          );
          // A fresh operation can succeed once the underlying context is valid again.
          await call(
            c,
            seller,
            "update public.batch_products set batch_id='62000000-0000-0000-0000-000000000001' where id='63000000-0000-0000-0000-000000000002'",
          );
          await call(b, buyer, request);
        },
      );
      await scenario(
        `${isolation}: product move cannot race approval or fee assignment`,
        async ({ c, a, b }) => {
          const g = (await call(c, buyer, request)).rows[0].id;
          await b.query(`begin isolation level ${isolation}`);
          await b.query("set local role authenticated");
          await b.query("select set_config('request.jwt.claim.sub',$1,true)", [seller]);
          await b.query("select count(*) from public.combined_delivery_members");
          await begin(a, seller);
          await a.query("select public.review_combined_delivery($1,'approve')", [g]);
          await a.query(
            "select public.review_combined_delivery($1,'set_shipping_fee',null,125.50)",
            [g],
          );
          const pending = outcome(b.query(move));
          await blocked(c, b, a);
          await a.query("commit");
          const r = await pending;
          assertIdentityConflict(r.error, "product");
          await assertAborted(b);
          await b.query("rollback");
          assert.equal(
            (await c.query("select status from public.combined_delivery_groups where id=$1", [g]))
              .rows[0].status,
            "shipping_fee_set",
          );
        },
      );
    }
    await scenario(
      "old snapshot cannot transfer the pinned batch to another seller",
      async ({ c, a, b }) => {
        // Owner-level maintenance represents a privileged backend transfer. No new
        // authenticated batch-transfer grant or policy is introduced by this test.
        await b.query("begin isolation level repeatable read");
        await b.query("select count(*) from public.combined_delivery_members");
        await approved(c, true);
        const r = await outcome(
          b.query(
            "update public.batches set seller_id='61000000-0000-0000-0000-000000000004' where id='62000000-0000-0000-0000-000000000001'",
          ),
        );
        assertIdentityConflict(r.error, "seller");
        await assertAborted(b);
        await b.query("rollback");
        assert.equal(
          (
            await c.query(
              "select seller_id from public.batches where id='62000000-0000-0000-0000-000000000001'",
            )
          ).rows[0].seller_id,
          seller,
        );
      },
    );
    await scenario(
      "rollback of recovery restores identity pins before a waiting product update",
      async ({ c, a, b }) => {
        const g = await approved(c, true);
        await c.query(
          `begin;alter table public.combined_delivery_groups disable trigger combined_delivery_groups_guard;update public.combined_delivery_groups set payment_method='Maya' where id='${g}';alter table public.combined_delivery_groups enable trigger combined_delivery_groups_guard;commit`,
        );
        await begin(a, buyer);
        await a.query("select public.invalidate_combined_delivery_request($1)", [g]);
        await begin(b, seller);
        const pending = outcome(b.query(move));
        await blocked(c, b, a);
        await a.query("rollback");
        const r = await pending;
        assertIdentityConflict(r.error, "product");
        await b.query("rollback");
        await assertPins(c);
        assert.equal(
          (await c.query("select count(*)::int n from public.combined_delivery_batch_pins")).rows[0]
            .n,
          2,
        );
        await call(c, buyer, "select public.invalidate_combined_delivery_request($1)", [g]);
        await call(b, seller, move);
        assert.equal(
          (await c.query("select count(*)::int n from public.combined_delivery_batch_pins")).rows[0]
            .n,
          0,
        );
      },
    );
    await scenario(
      "old snapshot after release retries in a fresh transaction",
      async ({ c, a, b }) => {
        const g = await approved(c);
        await b.query("begin isolation level repeatable read");
        await b.query("set local role authenticated");
        await b.query("select set_config('request.jwt.claim.sub',$1,true)", [seller]);
        await b.query("select count(*) from public.combined_delivery_members");
        await c.query(
          `begin;alter table public.combined_delivery_groups disable trigger combined_delivery_groups_guard;update public.combined_delivery_groups set payment_method='Maya' where id='${g}';alter table public.combined_delivery_groups enable trigger combined_delivery_groups_guard;commit`,
        );
        await call(a, buyer, "select public.invalidate_combined_delivery_request($1)", [g]);
        const r = await outcome(b.query(move));
        assertIdentityConflict(r.error, "product");
        await assertAborted(b);
        await b.query("rollback");
        await call(b, seller, move);
      },
    );
    await scenario(
      "different buyers can concurrently pin the same products without lock upgrades",
      async ({ c, a, b }) => {
        const otherBuyer = "61000000-0000-0000-0000-000000000003";
        await c.query(`insert into public.delivery_destinations(id,buyer_id,pin_lat,pin_lng,address_text) values('64000000-0000-0000-0000-000000000003','${otherBuyer}',14.6,121,'Unit 1, Test address');
      insert into public.orders(id,order_number,batch_product_id,buyer_id,seller_id,quantity,unit_base_price,unit_selling_price,reservation_expires_at,reserved_payment_method,shipping_applies,buyer_accepted_shipping_fee,shipping_state,delivery_pin_lat,delivery_pin_lng,delivery_pin_address,deadline_paused_at,delivery_destination_id)
      select ('65000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'OTHER-'||n,case when n=4 then '63000000-0000-0000-0000-000000000001'::uuid else '63000000-0000-0000-0000-000000000002'::uuid end,'${otherBuyer}','${seller}',1,350,400,now()-interval '1 day','GCash',true,true,'waiting_for_seller',14.6,121,'Unit 1, Test address',now()-interval '2 days','64000000-0000-0000-0000-000000000003' from generate_series(4,5)n`);
        await begin(a, buyer);
        await a.query(request);
        await begin(b, otherBuyer);
        await b.query(
          "select public.request_combined_delivery(array['65000000-0000-0000-0000-000000000004'::uuid,'65000000-0000-0000-0000-000000000005'::uuid],14.6,121,'Unit 1, Test address',true)",
        );
        // This returns BEFORE A commits: neither shared identity pin forces a row-write upgrade.
        await b.query("commit");
        await a.query("commit");
        assert.equal(
          (await c.query("select count(*)::int n from public.combined_delivery_groups")).rows[0].n,
          2,
        );
        assert.equal(
          (await c.query("select count(*)::int n from public.combined_delivery_batch_pins")).rows[0]
            .n,
          4,
        );
      },
    );
    await scenario(
      "migration pins existing approved groups without changing history",
      async ({ c }) => {
        await rollbackIntegrity(c);
        const g = await approved(c, true);
        const before = (
          await c.query(
            "select to_jsonb(o)-'combined_delivery_revision' as data from public.orders o order by id",
          )
        ).rows;
        await migration(c, "202610210004_combined_delivery_batch_integrity.sql");
        assert.equal(
          (await c.query("select count(*)::int n from public.combined_delivery_batch_pins")).rows[0]
            .n,
          2,
        );
        assert.deepEqual(
          (
            await c.query(
              "select to_jsonb(o)-'combined_delivery_revision' as data from public.orders o order by id",
            )
          ).rows,
          before,
        );
        assert.equal(
          Number(
            (
              await c.query(
                "select shipping_fee from public.combined_delivery_groups where id=$1",
                [g],
              )
            ).rows[0].shipping_fee,
          ),
          125.5,
        );
      },
    );
    await scenario(
      "migration rejects stale legacy data; recovery permits a clean retry",
      async ({ c }) => {
        await rollbackIntegrity(c);
        const g = await approved(c, true);
        await stale(c, false);
        const before = (
          await c.query(
            "select to_jsonb(o)-'combined_delivery_revision' as data from public.orders o order by id",
          )
        ).rows;
        await assert.rejects(
          migration(c, "202610210004_combined_delivery_batch_integrity.sql"),
          (e) => e.code === "22023" && /same Pasabuy batch/.test(e.message),
        );
        await c.query("rollback");
        assert.equal(
          (await c.query("select to_regclass('public.combined_delivery_batch_pins') as pins"))
            .rows[0].pins,
          null,
        );
        await call(c, buyer, "select public.invalidate_combined_delivery_request($1)", [g]);
        await migration(c, "202610210004_combined_delivery_batch_integrity.sql");
        assert.deepEqual(
          (
            await c.query(
              "select to_jsonb(o)-'combined_delivery_revision' as data from public.orders o order by id",
            )
          ).rows,
          before,
        );
      },
    );
    await scenario(
      "rollback refuses active requests and succeeds after atomic release",
      async ({ c }) => {
        const g = await approved(c, true);
        await assert.rejects(
          rollbackIntegrity(c),
          (e) => e.code === "22023" && /while delivery requests are active/.test(e.message),
        );
        await c.query("rollback");
        await assertPins(c);
        await c.query(
          "update public.user_profiles set can_sell=false where id='61000000-0000-0000-0000-000000000002'",
        );
        await call(c, buyer, "select public.invalidate_combined_delivery_request($1)", [g]);
        await rollbackIntegrity(c);
        await migration(c, "202610210004_combined_delivery_batch_integrity.sql");
        assert.equal(
          Number(
            (
              await c.query(
                "select shipping_fee from public.combined_delivery_groups where id=$1",
                [g],
              )
            ).rows[0].shipping_fee,
          ),
          125.5,
        );
      },
    );

    for (const isolation of ["repeatable read", "serializable"]) {
      await scenario(
        `${isolation}: older buyer locator update cannot bypass reservation freeze`,
        async ({ c, a, b }) => {
          // Match existing production column-level shipping grants and buyer policy.
          await c.query(`grant update(delivery_pin_lat,delivery_pin_lng,delivery_pin_address) on public.orders to authenticated;
        create policy fixture_buyer_shipping_update on public.orders for update to authenticated
        using(buyer_id=auth.uid() and public.is_active(auth.uid()) and shipping_applies and status='payment_pending' and deadline_paused_at is not null and shipping_state in ('waiting_for_seller','correction_requested'))
        with check(buyer_id=auth.uid() and shipping_applies and status='payment_pending' and deadline_paused_at is not null and shipping_state in ('waiting_for_seller','correction_requested'))`);
          await b.query(`begin isolation level ${isolation}`);
          await b.query("set local role authenticated");
          await b.query("select set_config('request.jwt.claim.sub',$1,true)", [buyer]);
          await b.query("select count(*) from public.combined_delivery_members");
          await begin(a, buyer);
          await a.query(request);
          const pending = outcome(
            b.query("update public.orders set delivery_pin_address='Different unit' where id=$1", [
              order1,
            ]),
          );
          await blocked(c, b, a);
          await a.query("commit");
          const r = await pending;
          assertIdentityConflict(r.error, "order");
          await assertAborted(b);
          await b.query("rollback");
          assert.equal(
            (await c.query("select delivery_pin_address from public.orders where id=$1", [order1]))
              .rows[0].delivery_pin_address,
            "Unit 1, Test address",
          );
        },
      );
    }
    await scenario(
      "old backend snapshot cannot reassign a grouped reservation to another product",
      async ({ c, a, b }) => {
        // A privileged backend may update product links; the database still enforces
        // the invariant. Authenticated callers receive no new reassignment privilege.
        await b.query("begin isolation level repeatable read");
        await b.query("select count(*) from public.combined_delivery_members");
        await approved(c, true);
        const r = await outcome(
          b.query(
            "update public.orders set batch_product_id='63000000-0000-0000-0000-000000000003' where id=$1",
            [order1],
          ),
        );
        assertIdentityConflict(r.error, "order");
        await assertAborted(b);
        await b.query("rollback");
        assert.equal(
          (await c.query("select batch_product_id from public.orders where id=$1", [order1]))
            .rows[0].batch_product_id,
          "63000000-0000-0000-0000-000000000001",
        );
      },
    );
  } else {
    const submit =
      "select public.submit_combined_delivery_payment($1,'GCash',1075.50,$2,'" +
      buyer +
      "/proof.jpg') as result";
    const verify = "select public.review_combined_delivery_payment($1,'verified')";
    const recover = "select public.invalidate_combined_delivery_request($1)";
    const paymentId = (response) => response.rows[0].result.payment.id;
    await scenario(
      "combined: simultaneous submissions create one proof and one set of links",
      async ({ c, a, b }) => {
        const g = await approved(c, true);
        await begin(a, buyer);
        const first = paymentId(await a.query(submit, [g, "FIRST"]));
        await begin(b, buyer);
        const pending = outcome(b.query(submit, [g, "SECOND"]));
        await blocked(c, b, a);
        await a.query("commit");
        const second = await pending;
        assert.equal(second.error?.code, "22023");
        assert.match(second.error.message, /not payable/);
        await assertAborted(b);
        await b.query("rollback");
        assert.equal((await c.query("select count(*)::int n from public.payments")).rows[0].n, 1);
        assert.equal(
          (
            await c.query(
              "select count(*)::int n from public.combined_delivery_payment_reservations where payment_id=$1",
              [first],
            )
          ).rows[0].n,
          2,
        );
        assert.equal(
          (
            await c.query("select count(*)::int n from public.notifications where dedupe_key=$1", [
              "combined_payment_submitted_" + first,
            ])
          ).rows[0].n,
          2,
        );
      },
    );
    for (const isolation of ["read committed", "repeatable read", "serializable"]) {
      await scenario(
        `combined: ${isolation} submission wins against invalidation`,
        async ({ c, a, b }) => {
          const g = await approved(c, true);
          await b.query("begin isolation level " + isolation);
          await b.query("set local role authenticated");
          await b.query("select set_config('request.jwt.claim.sub',$1,true)", [buyer]);
          await b.query("select count(*) from public.payments");
          await begin(a, buyer);
          await a.query(submit, [g, "SUBMIT"]);
          const pending = outcome(b.query(recover, [g]));
          await blocked(c, b, a);
          await a.query("commit");
          const r = await pending;
          assert.ok(r.error);
          assert.ok(["22023", "40001"].includes(r.error.code));
          if (r.error.code === "22023") assert.match(r.error.message, /cannot be invalidated/);
          await assertAborted(b);
          await b.query("rollback");
          assert.equal(
            (
              await c.query(
                "select count(*)::int n from public.orders where status='payment_submitted'",
              )
            ).rows[0].n,
            2,
          );
        },
      );
      await scenario(
        `combined: ${isolation} verification and invalidation cannot partially commit`,
        async ({ c, a, b }) => {
          const g = await approved(c, true);
          const pay = paymentId(await call(c, buyer, submit, [g, "PROOF"]));
          await begin(a, seller);
          await a.query(verify, [pay]);
          await b.query("begin isolation level " + isolation);
          await b.query("set local role authenticated");
          await b.query("select set_config('request.jwt.claim.sub',$1,true)", [buyer]);
          const pending = outcome(b.query(recover, [g]));
          await blocked(c, b, a);
          await a.query("commit");
          const r = await pending;
          assert.ok(r.error);
          assert.ok(["22023", "40001"].includes(r.error.code));
          await b.query("rollback");
          assert.equal(
            (
              await c.query(
                "select count(*)::int n from public.orders where status='payment_confirmed'",
              )
            ).rows[0].n,
            2,
          );
          assert.equal(
            (await c.query("select status from public.combined_delivery_groups where id=$1", [g]))
              .rows[0].status,
            "paid",
          );
        },
      );
    }
    await scenario(
      "combined: failed invalidation first cannot prevent valid verification",
      async ({ c, a, b }) => {
        const g = await approved(c, true);
        const pay = paymentId(await call(c, buyer, submit, [g, "PROOF"]));
        await begin(a, buyer);
        const failed = await outcome(a.query(recover, [g]));
        assert.equal(failed.error?.code, "22023");
        await assertAborted(a);
        await begin(b, seller); // A statement error aborts A and immediately releases its locks; B must progress without waiting for an explicit rollback.
        assert.ifError((await outcome(b.query(verify, [pay]))).error);
        await b.query("commit");
        await a.query("rollback");
      },
    );
    await scenario(
      "combined: concurrent verification and rejection decide once",
      async ({ c, a, b }) => {
        const g = await approved(c, true);
        const pay = paymentId(await call(c, buyer, submit, [g, "PROOF"]));
        await begin(a, seller);
        await a.query(verify, [pay]);
        await begin(b, seller);
        const pending = outcome(
          b.query("select public.review_combined_delivery_payment($1,'rejected','Unreadable',12)", [
            pay,
          ]),
        );
        await blocked(c, b, a);
        await a.query("commit");
        const r = await pending;
        assert.equal(r.error?.code, "22023");
        assert.match(r.error.message, /already been reviewed/);
        await b.query("rollback");
        assert.equal(
          (
            await c.query("select count(*)::int n from public.notifications where dedupe_key=$1", [
              "combined_payment_verified_" + pay,
            ])
          ).rows[0].n,
          1,
        );
      },
    );
    await scenario(
      "combined: proof rollback restores payable state before waiting submission",
      async ({ c, a, b }) => {
        const g = await approved(c, true);
        await begin(a, buyer);
        await a.query(submit, [g, "ROLLED-BACK"]);
        await begin(b, buyer);
        const pending = outcome(b.query(submit, [g, "COMMITTED"]));
        await blocked(c, b, a);
        await a.query("rollback");
        assert.ifError((await pending).error);
        await b.query("commit");
        assert.equal(
          (await c.query("select reference_number from public.payments")).rows[0].reference_number,
          "COMMITTED",
        );
      },
    );
    await scenario(
      "combined: submission prevents a competing expiration sweep",
      async ({ c, a, b }) => {
        const g = await approved(c, true);
        await begin(a, buyer);
        await a.query(submit, [g, "PROOF"]);
        // Sweeper uses try-advisory locking and must skip a group under payment submission.
        await b.query("select public.sweep_expirations()");
        await a.query("commit");
        assert.equal(
          (
            await c.query(
              "select count(*)::int n from public.orders where status='payment_submitted'",
            )
          ).rows[0].n,
          2,
        );
      },
    );
    await scenario(
      "combined: expiration commits before submission and blocks payment",
      async ({ c, a, b }) => {
        const g = await approved(c, true);
        await c.query(
          "begin;insert into public.combined_delivery_payment_context values(txid_current(),'" +
            g +
            "');select public.transition_combined_payment_orders('" +
            g +
            "','payment_pending',now()-interval '1 second');delete from public.combined_delivery_payment_context;update public.combined_delivery_payment_accounts set deadline=now()-interval '1 second' where group_id='" +
            g +
            "';commit",
        );
        await a.query("begin");
        await a.query("select public.sweep_expirations()");
        await begin(b, buyer);
        const pending = outcome(b.query(submit, [g, "TOO-LATE"]));
        await blocked(c, b, a);
        await a.query("commit");
        const r = await pending;
        assert.equal(r.error?.code, "22023");
        assert.match(r.error.message, /not payable/);
        await b.query("rollback");
        assert.equal(
          (await c.query("select count(*)::int n from public.orders where status='expired'"))
            .rows[0].n,
          2,
        );
        assert.equal((await c.query("select count(*)::int n from public.payments")).rows[0].n, 0);
      },
    );
    for (const isolation of ["repeatable read", "serializable"]) {
      await scenario(
        `combined: ${isolation} identity pins survive activation and submission`,
        async ({ c, a, b }) => {
          await b.query("begin isolation level " + isolation);
          await b.query("select count(*) from public.combined_delivery_members");
          const g = await approved(c, true);
          await call(c, buyer, submit, [g, "PROOF"]);
          const r = await outcome(b.query(move));
          assertIdentityConflict(r.error, "product");
          await assertAborted(b);
          await b.query("rollback");
          assert.equal(
            (
              await c.query(
                "select shipping_fee from public.combined_delivery_groups where id=$1",
                [g],
              )
            ).rows[0].shipping_fee,
            "125.50",
          );
        },
      );
    }
    await scenario(
      "combined: standalone payment path cannot insert a grouped proof",
      async ({ c, a, b }) => {
        const g = await approved(c, true);
        const r = await call(c, buyer, "select public.submit_order_payment($1,'GCash',550)", [
          order1,
        ]);
        assert.equal(r.rows[0].submit_order_payment.accepted, false);
        assert.equal((await c.query("select count(*)::int n from public.payments")).rows[0].n, 0);
      },
    );
    await scenario(
      "combined: migration activates existing assigned fees and refuses destructive rollback",
      async ({ c, a, b }) => {
        await c.query(
          await readFile(
            `${root}/supabase/rollbacks/202610210005_combined_delivery_payments.sql`,
            "utf8",
          ),
        );
        const g = await approved(c, true);
        const before = (
          await c.query("select shipping_fee from public.combined_delivery_groups where id=$1", [g])
        ).rows[0];
        await migration(c, "202610210005_combined_delivery_payments.sql");
        await migration(c, "202610230001_combined_payment_method_compatibility.sql");
        const account = (
          await c.query(
            "select * from public.combined_delivery_payment_accounts where group_id=$1",
            [g],
          )
        ).rows[0];
        assert.equal(account.shipping_fee, before.shipping_fee);
        assert.equal(account.total, "1075.50");
        assert.equal(account.status, "ready");
        assert.equal(
          (
            await c.query(
              "select count(*)::int n from public.orders where deadline_paused_at is null and id in(select order_id from public.combined_delivery_members where group_id=$1)",
              [g],
            )
          ).rows[0].n,
          2,
        );
        const rollback = await outcome(
          c.query(
            await readFile(
              `${root}/supabase/rollbacks/202610210005_combined_delivery_payments.sql`,
              "utf8",
            ),
          ),
        );
        assert.equal(rollback.error?.code, "22023");
        assert.match(rollback.error.message, /Cannot roll back/);
        await c.query("rollback");
        assert.equal(
          (
            await c.query(
              "select total from public.combined_delivery_payment_accounts where group_id=$1",
              [g],
            )
          ).rows[0].total,
          "1075.50",
        );
      },
    );
  }
  if (failures.length) {
    console.error(JSON.stringify({ failed: failures }, null, 2));
    process.exitCode = 1;
  }
} finally {
  for (const db of databases.reverse())
    await admin.query(`drop database if exists ${db} with (force)`);
  await admin.end();
}
