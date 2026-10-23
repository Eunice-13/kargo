// Focused synthetic integration checks. Guarded local container + local Auth/REST only.
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { randomUUID, randomBytes } from "node:crypto";
import { localSql, workdir } from "./database.mjs";
import { verifyLocalTarget, readRuntimeEvidence } from "./isolation.mjs";
const target = verifyLocalTarget(
  JSON.parse(fs.readFileSync(path.join(workdir, "target.local.json"))),
  readRuntimeEvidence(workdir),
);
localSql("begin read only;select 1;rollback;", "buyer-address-preflight");
const server = JSON.parse(fs.readFileSync(path.join(workdir, "server-credentials.local.json")));
assert.equal(server.apiUrl, target.apiUrl);
async function http(endpoint, token, method = "GET", body) {
  const r = await fetch(target.apiUrl + endpoint, {
    method,
    headers: {
      apikey: target.anonKey,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "error",
  });
  const raw = await r.text();
  const data = raw ? JSON.parse(raw) : null;
  return { ok: r.ok, status: r.status, data };
}
const accounts = [];
for (let i = 0; i < 4; i++) {
  const email = `formation-${randomUUID()}@kargo.test`,
    password = randomBytes(24).toString("base64url");
  const created = await http("/auth/v1/admin/users", server.serviceRoleKey, "POST", {
    email,
    password,
    email_confirm: true,
  });
  assert(created.ok);
  const signed = await http("/auth/v1/token?grant_type=password", target.anonKey, "POST", {
    email,
    password,
  });
  assert(signed.ok);
  accounts.push({ id: created.data.id, token: signed.data.access_token });
}
const [buyer, leaderA, leaderB, seller] = accounts;
const batches = [randomUUID(), randomUUID()],
  product = randomUUID();
const rpc = (a, n, args) => http("/rest/v1/rpc/" + n, a.token, "POST", args);
const pass = (n) => console.log("PASS " + n);
localSql(
  `begin;update public.user_profiles set can_sell=true where id='${seller.id}';
insert into public.batches(id,seller_id,title,status,starts_on,ends_on,category,reservation_hours,group_orders_enabled)
select id::uuid,'${seller.id}','Formation test','live',current_date,current_date+7,'Food',24,true from unnest(array['${batches[0]}','${batches[1]}']) id;
insert into public.batch_products(id,batch_id,name,base_price,markup,quantity_total) values('${product}','${batches[0]}','Formation item',100,10,20);commit;`,
  "formation-fixtures",
);

try {
  const rpcOk = async (a, n, args) => {
    const r = await rpc(a, n, args);
    assert(r.ok, JSON.stringify(r.data));
    return r.data;
  };
  const start = (a, b) => rpcOk(a, "start_group_order", { p_batch_id: b });
  const [g1, g2] = await Promise.all([start(leaderA, batches[0]), start(leaderB, batches[1])]);
  const join = (a, g) => rpc(a, "join_group_order", { p_referral_code: g.referral_code });
  assert((await join(buyer, g1)).ok);
  assert((await join(buyer, g2)).ok);
  const product2 = randomUUID();
  localSql(
    `begin;insert into public.batch_products(id,batch_id,name,base_price,markup,quantity_total) values('${product2}','${batches[1]}','Formation second',100,10,20);
insert into public.seller_payment_methods(seller_id,method_type,account_name,account_number,is_active) values('${seller.id}','Cash on Meetup','Synthetic','000',true);commit;`,
    "formation-payment-method",
  );
  const commit = (a, g, p) =>
    rpc(a, "set_group_commitment", {
      p_group_order_id: g.id,
      p_batch_product_id: p,
      p_quantity: 2,
    });
  for (const [a, g, p] of [
    [leaderA, g1, product],
    [buyer, g1, product],
    [leaderB, g2, product2],
    [buyer, g2, product2],
  ])
    assert((await commit(a, g, p)).ok);
  pass("joining and commitments before authoritative batch deadline");
  const claimed = (p) =>
    Number(
      localSql(
        `begin read only;select quantity_claimed from public.batch_catalog where product_id='${p}';rollback;`,
        "formation-stock",
      ),
    );
  assert.equal(claimed(product), 4);
  // Deliberately retain the old stored formation timestamp: the batch remains authoritative.
  localSql(
    `begin;update public.batches set starts_on=current_date-2, ends_on=current_date-1 where id='${batches[0]}';commit;`,
    "formation-close-batch",
  );
  assert.equal(claimed(product), 0);
  pass(
    "overdue forming commitments release availability before cleanup, even with stale stored deadline",
  );
  assert(!(await join(leaderB, g1)).ok);
  assert(!(await commit(buyer, g1, product)).ok);
  const checkout = (a, g) =>
    rpc(a, "checkout_group_order", {
      p_group_order_id: g.id,
      p_payment_method: "Cash on Meetup",
      p_pin_lat: null,
      p_pin_lng: null,
      p_pin_url: null,
      p_pin_address: null,
      p_accept_shipping: false,
      p_acknowledged: true,
    });
  assert(!(await checkout(leaderA, g1)).ok);
  assert(!(await rpc(buyer, "leave_group_order", { p_group_order_id: g1.id })).ok);
  assert(
    !(await rpc(leaderA, "remove_group_member", { p_group_order_id: g1.id, p_user_id: buyer.id }))
      .ok,
  );
  assert(!(await rpc(leaderA, "regenerate_group_code", { p_group_order_id: g1.id })).ok);
  pass(
    "joining, commitment changes, leaving/removal, invitations, and checkout rejected after deadline",
  );
  const cleanup = () =>
    http("/rest/v1/rpc/expire_forming_group_orders", server.serviceRoleKey, "POST", {});
  // Hold the exact group lock used by checkout. Cleanup must skip it, not race through it.
  const holder = spawn(
    "/Applications/OrbStack.app/Contents/MacOS/xbin/docker",
    [
      "--config",
      path.join(workdir, "home/.docker"),
      "--host",
      "unix:///Users/jennadee/.orbstack/run/docker.sock",
      "exec",
      "-i",
      "--user",
      "postgres",
      "supabase_db_kargo-local-staging",
      "psql",
      "-X",
      "-U",
      "supabase_admin",
      "-d",
      "postgres",
      "-qAt",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    { stdio: ["pipe", "pipe", "pipe"] },
  );
  await new Promise((resolve, reject) => {
    holder.on("error", reject);
    holder.on("exit", (code) => {
      if (code) reject(Error("Local lock holder failed"));
    });
    holder.stdout.on("data", (chunk) => {
      if (chunk.toString().includes("LOCKED")) resolve();
    });
    holder.stdin.write(
      `begin;select id from public.group_orders where id='${g1.id}' for update;\n\\echo LOCKED\n`,
    );
  });
  try {
    assert((await cleanup()).ok);
    assert.equal(
      localSql(
        `begin read only;select status from public.group_orders where id='${g1.id}';rollback;`,
        "formation-lock-state",
      ),
      "forming",
    );
  } finally {
    await new Promise((resolve, reject) => {
      holder.on("exit", (code) => (code === 0 ? resolve() : reject(Error("Lock release failed"))));
      holder.stdin.end("rollback;\n");
    });
  }
  pass("cleanup skips a concurrently locked group and retries after lock release");
  const [deadCheckout, expired, liveCheckout] = await Promise.all([
    checkout(leaderA, g1),
    cleanup(),
    checkout(leaderB, g2),
  ]);
  assert(!deadCheckout.ok);
  assert(expired.ok, JSON.stringify(expired.data));
  assert(liveCheckout.ok, JSON.stringify(liveCheckout.data));
  assert.equal(liveCheckout.data.status, "payment_pending");
  const state = () =>
    JSON.parse(
      localSql(
        `begin read only;select jsonb_build_object('expired',(select status from public.group_orders where id='${g1.id}'),'history',(select count(*) from public.group_order_commitments where group_order_id='${g1.id}'),'orders',(select count(*) from public.orders where group_order_id='${g1.id}'),'activeMembers',(select count(*) from public.group_order_members where group_order_id='${g1.id}' and group_active));rollback;`,
        "formation-state",
      ),
    );
  assert.deepEqual(state(), { expired: "expired", history: 2, orders: 0, activeMembers: 0 });
  pass(
    "concurrent checkout and expiry: overdue checkout rejected; valid checkout preserved; history retained",
  );
  assert.equal(claimed(product2), 4);
  localSql(
    `begin;update public.batches set starts_on=current_date-2, ends_on=current_date-1 where id='${batches[1]}';commit;`,
    "formation-close-checked-out",
  );
  const checkedSnapshot = () =>
    localSql(
      `begin read only;select jsonb_build_object('group',(select to_jsonb(g) from public.group_orders g where id='${g2.id}'),'orders',(select jsonb_agg(to_jsonb(o) order by id) from public.orders o where group_order_id='${g2.id}'));rollback;`,
      "formation-checkout-snapshot",
    );
  // A standalone reservation must survive formation cleanup unchanged.
  localSql(
    `begin;insert into public.orders(order_number,batch_product_id,buyer_id,seller_id,quantity,unit_base_price,unit_selling_price,reservation_expires_at,reserved_payment_method,shipping_applies)
values('ORD-FORMATION-${randomUUID()}','${product}','${buyer.id}','${seller.id}',1,100,110,now()+interval '24 hours','Cash on Meetup',false);commit;`,
    "formation-standalone",
  );
  const soloSnapshot = () =>
    localSql(
      `begin read only;select to_jsonb(o) from public.orders o where batch_product_id='${product}' and group_order_id is null;rollback;`,
      "formation-solo-snapshot",
    );
  const soloBefore = soloSnapshot();
  const before = checkedSnapshot();
  assert((await cleanup()).ok);
  assert((await cleanup()).ok);
  assert.equal(checkedSnapshot(), before);
  assert.equal(soloSnapshot(), soloBefore);
  assert.equal(claimed(product), 1);
  assert.equal(claimed(product2), 4);
  assert.equal(state().history, 2);
  pass(
    "idempotent cleanup and checked-out payment deadlines/orders/stock remain unchanged after batch expiry",
  );
  const denied = await http("/rest/v1/rpc/expire_forming_group_orders", buyer.token, "POST", {});
  assert(!denied.ok);
  pass("buyers cannot invoke privileged cleanup; standalone reservation remains unchanged");
} finally {
  // Clean only fixtures owned by this run, retaining existing local validation records.
  localSql(
    `begin;update public.group_orders set payment_order_id=null where batch_id in ('${batches[0]}','${batches[1]}');delete from public.orders where batch_product_id in (select id from public.batch_products where batch_id in ('${batches[0]}','${batches[1]}'));delete from public.group_orders where batch_id in ('${batches[0]}','${batches[1]}');delete from public.batch_products where batch_id in ('${batches[0]}','${batches[1]}');delete from public.batches where id in ('${batches[0]}','${batches[1]}');delete from public.seller_payment_methods where seller_id='${seller.id}';commit;`,
    "formation-fixture-cleanup",
  );
  for (const a of accounts)
    assert((await http("/auth/v1/admin/users/" + a.id, server.serviceRoleKey, "DELETE")).ok);
  console.log("Focused formation integration completed; synthetic fixtures cleaned.");
}
