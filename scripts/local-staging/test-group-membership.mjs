// Focused synthetic integration checks. Guarded local container + local Auth/REST only.
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
  const email = `membership-${randomUUID()}@kargo.test`,
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
select id::uuid,'${seller.id}','Membership test','live',current_date,current_date+7,'Food',24,true from unnest(array['${batches[0]}','${batches[1]}']) id;
insert into public.batch_products(id,batch_id,name,base_price,markup,quantity_total) values('${product}','${batches[0]}','Membership item',100,10,20);commit;`,
  "membership-fixtures",
);
const started = await Promise.all(
  [
    [leaderA, batches[0]],
    [leaderB, batches[0]],
    [leaderA, batches[1]],
  ].map(async ([a, b]) => {
    const r = await rpc(a, "start_group_order", { p_batch_id: b });
    assert(r.ok, JSON.stringify(r.data));
    return r.data;
  }),
);
const [g1, g2, g3] = started;
const join = (g) => rpc(buyer, "join_group_order", { p_referral_code: g.referral_code });
assert((await join(g1)).ok);
pass("first join");
assert(
  (
    await rpc(buyer, "set_group_commitment", {
      p_group_order_id: g1.id,
      p_batch_product_id: product,
      p_quantity: 2,
    })
  ).ok,
);
const snapshot = () =>
  localSql(
    `begin read only;select jsonb_build_object('commitments',(select md5(coalesce(string_agg(to_jsonb(c)::text,'' order by id),'')) from public.group_order_commitments c),'orders',(select md5(coalesce(string_agg(to_jsonb(o)::text,'' order by id),'')) from public.orders o),'inventory',(select quantity_claimed from public.batch_catalog where product_id='${product}'));rollback;`,
    "membership-preservation",
  );
const before = snapshot();
const rejected = await join(g2);
assert(!rejected.ok);
assert.equal(rejected.data.message, "GROUP_MEMBERSHIP_CONFLICT");
assert.equal(snapshot(), before);
pass("second same-batch join rejected without commitment/inventory changes");
assert((await rpc(buyer, "leave_group_order", { p_group_order_id: g1.id })).ok);
assert((await join(g2)).ok);
assert((await join(g3)).ok);
pass("rejoin after leave and different-batch participation");
assert((await rpc(buyer, "leave_group_order", { p_group_order_id: g2.id })).ok);
const concurrent = await Promise.all([join(g1), join(g2)]);
assert.equal(concurrent.filter((r) => r.ok).length, 1);
assert.equal(concurrent.filter((r) => !r.ok).length, 1);
pass("concurrent different-code same-batch joins allow exactly one");
const winner = concurrent[0].ok ? g1 : g2,
  loser = concurrent[0].ok ? g2 : g1;
localSql(
  `begin;do $$ begin begin insert into public.group_order_members(group_order_id,user_id,role,batch_id,group_active) values('${loser.id}','${buyer.id}','member','${batches[1]}',false);exception when unique_violation then return;end;raise exception 'Unique membership constraint was bypassed';end $$;rollback;`,
  "membership-direct-bypass",
);
pass("forged membership batch/activity cannot bypass the unique index");
assert((await join(winner)).ok);
pass("same-group repeated invitation is idempotent");
localSql(
  `begin;update public.group_orders set status='payment_submitted' where id='${winner.id}';commit;`,
  "membership-nonleave-state",
);
const locked = await join(loser);
assert(!locked.ok);
assert.equal(JSON.parse(locked.data.details).can_leave, false);
pass("non-leavable group conflict does not suggest leaving");
localSql(
  `begin;update public.group_orders set status='payment_confirmed' where id='${winner.id}';commit;`,
  "membership-terminal-state",
);
assert((await join(loser)).ok);
pass("terminal groups release active-membership slot");
// Remove only this run's synthetic groups and batches; no reservations created.
localSql(
  `begin;delete from public.group_orders where batch_id in ('${batches[0]}','${batches[1]}');delete from public.batch_products where id='${product}';delete from public.batches where id in ('${batches[0]}','${batches[1]}');commit;`,
  "membership-fixture-cleanup",
);
for (const a of accounts)
  assert((await http("/auth/v1/admin/users/" + a.id, server.serviceRoleKey, "DELETE")).ok);
console.log("Focused local membership integration completed; synthetic fixtures cleaned.");
