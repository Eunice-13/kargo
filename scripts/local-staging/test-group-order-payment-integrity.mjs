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
  const email = `group-p1-${randomUUID()}@kargo.test`,
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

const [leader, member, outsider, seller] = accounts;
const batches = [];
const rpc = (a, n, args) => http("/rest/v1/rpc/" + n, a.token, "POST", args);
const ok = async (a, n, args) => {
  const r = await rpc(a, n, args);
  assert(r.ok, JSON.stringify(r.data));
  return r.data;
};
const expire = (g) =>
  http("/rest/v1/rpc/expire_group_order_payment", server.serviceRoleKey, "POST", {
    p_group_id: g.id,
  });
const pass = (n) => console.log("PASS " + n);
const groupRow = (g) =>
  JSON.parse(
    localSql(
      `begin read only;select to_jsonb(g) from public.group_orders g where id='${g.id}';rollback;`,
      "p1-group",
    ),
  );
const children = (g) =>
  JSON.parse(
    localSql(
      `begin read only;select jsonb_agg(to_jsonb(o) order by id) from public.orders o where group_order_id='${g.id}';rollback;`,
      "p1-children",
    ),
  );
const snapshot = (g) =>
  localSql(
    `begin read only;select jsonb_build_object('group',(select to_jsonb(g) from public.group_orders g where id='${g.id}'),'orders',(select jsonb_agg(to_jsonb(o) order by id) from public.orders o where group_order_id='${g.id}'),'payments',(select jsonb_agg(to_jsonb(p) order by id) from public.payments p where order_id in(select id from public.orders where group_order_id='${g.id}')),'notifications',(select jsonb_agg(to_jsonb(n) order by id) from public.notifications n where context->>'group_order_id'='${g.id}'),'waitlists',(select jsonb_agg(to_jsonb(w) order by id) from public.waitlist_entries w where batch_product_id in(select batch_product_id from public.orders where group_order_id='${g.id}')));rollback;`,
    "p1-snapshot",
  );
async function makeGroup(delivery = false) {
  const batch = randomUUID(),
    products = [randomUUID(), randomUUID()];
  batches.push(batch);
  localSql(
    `begin;insert into public.batches(id,seller_id,title,status,starts_on,ends_on,category,reservation_hours,group_orders_enabled) values('${batch}','${seller.id}','P1 synthetic','live',current_date,current_date+7,'Food',24,true);
 insert into public.batch_products(id,batch_id,name,base_price,markup,quantity_total) values('${products[0]}','${batch}','P1 item A',100,0,20),('${products[1]}','${batch}','P1 item B',100,0,20);commit;`,
    "p1-fixtures",
  );
  const g = await ok(leader, "start_group_order", { p_batch_id: batch });
  await ok(member, "join_group_order", { p_referral_code: g.referral_code });
  for (const [a, p, q] of [
    [leader, products[0], 2],
    [member, products[1], 3],
  ])
    await ok(a, "set_group_commitment", {
      p_group_order_id: g.id,
      p_batch_product_id: p,
      p_quantity: q,
    });
  await ok(leader, "checkout_group_order", {
    p_group_order_id: g.id,
    p_payment_method: delivery ? "GCash" : "Cash on Meetup",
    p_pin_lat: delivery ? 14.6 : null,
    p_pin_lng: delivery ? 121 : null,
    p_pin_url: null,
    p_pin_address: delivery ? "Synthetic test address" : null,
    p_accept_shipping: delivery,
    p_acknowledged: true,
  });
  return { ...g, products, batch, method: delivery ? "GCash" : "Cash on Meetup" };
}
const submit = (g) =>
  rpc(leader, "submit_group_order_payment", {
    p_group_order_id: g.id,
    p_method_type: g.method,
    p_amount: 500,
    p_reference_number: randomUUID(),
    p_receipt_path: leader.id + "/synthetic-proof.png",
    p_payer_account_name: "Synthetic",
    p_payer_phone: null,
    p_buyer_contact_url: null,
  });
const review = (g, p, decision = "verified", a = seller, hours = null) =>
  rpc(a, "review_group_order_payment", {
    p_payment_id: p,
    p_decision: decision,
    p_reason: decision === "rejected" ? "Synthetic rejection" : null,
    p_deadline_hours: hours,
  });
const age = (g) =>
  localSql(
    `begin;update public.group_orders set payment_deadline=clock_timestamp()-interval '1 hour' where id='${g.id}';update public.orders set reservation_expires_at=clock_timestamp()-interval '1 hour' where group_order_id='${g.id}';commit;`,
    "p1-age",
  );
async function raceLocked(g, actions) {
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
      `begin;select id from public.group_orders where id='${g.id}' for update;\n\\echo LOCKED\n`,
    );
  });
  const tasks = actions.map((action) => action());
  try {
    let waiting = 0;
    for (let i = 0; i < 10 && waiting < 2; i++) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      waiting = Number(
        localSql(
          `begin read only;select count(*) from pg_stat_activity where pid<>pg_backend_pid() and wait_event_type='Lock' and (query ilike '%review_group_order_payment%' or query ilike '%expire_group_order_payment%');rollback;`,
          "p1-race-lock-evidence",
        ),
      );
    }
    assert(waiting >= 2, "Both HTTP operations must be blocked concurrently on the parent lock");
  } finally {
    await new Promise((resolve, reject) => {
      holder.on("exit", (code) => (code === 0 ? resolve() : reject(Error("Lock release failed"))));
      holder.stdin.end("rollback;\n");
    });
  }
  return await Promise.all(tasks);
}
try {
  localSql(
    `begin;update public.user_profiles set can_sell=true where id='${seller.id}';insert into public.seller_payment_methods(seller_id,method_type,account_name,account_number,is_active) values('${seller.id}','Cash on Meetup','Synthetic','000',true),('${seller.id}','GCash','Synthetic','000',true);commit;`,
    "p1-seller",
  );
  const shipping = await makeGroup(true);
  assert(
    children(shipping).every(
      (o) => o.deadline_paused_at && o.shipping_state === "waiting_for_seller",
    ),
  );
  localSql(
    `begin;update public.orders set reservation_expires_at=clock_timestamp()-interval '1 hour' where group_order_id='${shipping.id}';commit;`,
    "p1-delayed-shipping",
  );
  assert.equal((await expire(shipping)).data, false);
  const waiting = JSON.parse(
    localSql(
      `begin;select public.sweep_standalone_delivery_expirations();select jsonb_agg(status::text) from public.orders where group_order_id='${shipping.id}';rollback;`,
      "p1-standalone-group-exclusion",
    )
      .split("\n")
      .filter(Boolean)
      .at(-1),
  );
  assert(waiting.every((s) => s === "payment_pending"));
  await ok(seller, "set_group_order_shipping_fee", { p_group_order_id: shipping.id, p_fee: 50 });
  const shipped = children(shipping),
    sg = groupRow(shipping);
  assert(
    shipped.every(
      (o) =>
        !o.deadline_paused_at &&
        o.shipping_state === "fee_set" &&
        Date.parse(o.reservation_expires_at) === Date.parse(sg.payment_deadline),
    ),
  );
  assert.equal(
    shipped.reduce((s, o) => s + Number(o.shipping_fee ?? 0), 0),
    50,
  );
  pass(
    "all products paused during delayed shipping; assignment synchronizes deadlines and charges shipping once",
  );
  await ok(leader, "request_order_extension", {
    p_order_id: sg.payment_order_id,
    p_hours: 2,
    p_reason: "Synthetic group extension",
  });
  await ok(seller, "decide_order_extension", { p_order_id: sg.payment_order_id, p_approve: true });
  const extended = groupRow(shipping);
  assert.equal(
    Date.parse(extended.payment_deadline),
    Date.parse(sg.payment_deadline) + 2 * 3600000,
  );
  assert(
    children(shipping).every(
      (o) => Date.parse(o.reservation_expires_at) === Date.parse(extended.payment_deadline),
    ),
  );
  pass("existing extension decisions synchronize the parent deadline and all product deadlines");
  const beforeCancel = snapshot(shipping);
  for (const o of shipped) assert(!(await rpc(leader, "cancel_order", { p_order_id: o.id })).ok);
  assert.equal(snapshot(shipping), beforeCancel);
  pass(
    "individual group cancellation rejected without order, inventory, payment, notification or waitlist changes",
  );
  const expired = await makeGroup();
  age(expired);
  const ex = await expire(expired);
  assert(ex.ok);
  assert.equal(ex.data, true);
  assert.equal(groupRow(expired).status, "expired");
  assert(children(expired).every((o) => o.status === "expired"));
  assert.equal(
    Number(
      localSql(
        `begin read only;select sum(quantity_claimed) from public.batch_catalog where batch_id='${expired.batch}';rollback;`,
        "p1-stock",
      ),
    ),
    0,
  );
  const expiredSnapshot = snapshot(expired);
  assert.equal((await expire(expired)).data, false);
  assert.equal(snapshot(expired), expiredSnapshot);
  assert.equal(
    Number(
      localSql(
        `begin read only;select count(*) from public.group_order_commitments where group_order_id='${expired.id}';rollback;`,
        "p1-history",
      ),
    ),
    2,
  );
  pass("multi-product expiration is atomic and idempotent, frees stock, retains commitments");
  const paid = await makeGroup();
  const proof = await submit(paid);
  assert(proof.ok && proof.data.accepted, JSON.stringify(proof.data));
  assert(!(await review(paid, proof.data.payment.id, "verified", outsider)).ok);
  // Existing policy: proof submitted before cutoff remains reviewable after cutoff.
  localSql(
    `begin;update public.payments set submitted_at=clock_timestamp()-interval '2 hours' where id='${proof.data.payment.id}';update public.group_orders set payment_deadline=clock_timestamp()-interval '1 hour' where id='${paid.id}';update public.orders set reservation_expires_at=clock_timestamp()-interval '1 hour' where group_order_id='${paid.id}';commit;`,
    "p1-submitted-clock",
  );
  const [reviewed, racedExpiry] = await raceLocked(paid, [
    () => review(paid, proof.data.payment.id),
    () => expire(paid),
  ]);
  assert(reviewed.ok, JSON.stringify(reviewed.data));
  assert(racedExpiry.ok);
  assert.equal(racedExpiry.data, false);
  assert.equal(groupRow(paid).status, "payment_confirmed");
  assert(children(paid).every((o) => o.status === "payment_confirmed"));
  const verifiedSnapshot = snapshot(paid);
  assert((await review(paid, proof.data.payment.id)).ok);
  assert.equal(snapshot(paid), verifiedSnapshot);
  assert(!(await review(paid, proof.data.payment.id, "rejected", seller, 2)).ok);
  assert(
    !(
      await rpc(seller, "review_order_payment", {
        p_payment_id: proof.data.payment.id,
        p_decision: "verified",
        p_reason: null,
        p_deadline_hours: null,
      })
    ).ok,
  );
  pass(
    "concurrent review/expiration preserves timely proof; unauthorized, conflicting and generic reviews rejected; identical review has no side effects",
  );
  const retry = await makeGroup();
  const first = await submit(retry);
  assert(first.ok && first.data.accepted);
  assert((await review(retry, first.data.payment.id, "rejected", seller, 2)).ok);
  const rejected = groupRow(retry),
    rejectedSnapshot = snapshot(retry);
  assert(
    children(retry).every(
      (o) =>
        o.status === "payment_pending" &&
        Date.parse(o.reservation_expires_at) === Date.parse(rejected.payment_deadline),
    ),
  );
  assert((await review(retry, first.data.payment.id, "rejected", seller, 2)).ok);
  assert.equal(snapshot(retry), rejectedSnapshot);
  assert(!(await review(retry, first.data.payment.id, "rejected", seller, 3)).ok);
  const second = await submit(retry);
  assert(second.ok && second.data.accepted, JSON.stringify(second.data));
  assert(!(await review(retry, first.data.payment.id)).ok);
  assert((await review(retry, second.data.payment.id)).ok);
  pass(
    "rejection deadlines synchronized; retry works; duplicate rejection idempotent; stale proof cannot overwrite latest decision",
  );
  const late = await makeGroup();
  const lateProof = await submit(late);
  assert(lateProof.ok && lateProof.data.accepted);
  assert((await review(late, lateProof.data.payment.id, "rejected", seller, 2)).ok);
  age(late);
  const race = await raceLocked(late, [
    () => review(late, lateProof.data.payment.id),
    () => expire(late),
  ]);
  assert(!race[0].ok);
  assert(race[1].ok && race[1].data === true);
  assert(children(late).every((o) => o.status === "expired"));
  const lateSnapshot = snapshot(late);
  assert(!(await review(late, lateProof.data.payment.id)).ok);
  assert.equal(snapshot(late), lateSnapshot);
  pass("expiration versus stale verification cannot revive expired inventory");
  const partial = await makeGroup();
  const partialSubmission = await rpc(leader, "submit_group_order_payment", {
    p_group_order_id: partial.id,
    p_method_type: partial.method,
    p_amount: 100,
    p_reference_number: randomUUID(),
    p_receipt_path: leader.id + "/synthetic-partial.png",
    p_payer_account_name: "Synthetic",
    p_payer_phone: null,
    p_buyer_contact_url: null,
  });
  assert(partialSubmission.ok && partialSubmission.data.accepted);
  assert((await review(partial, partialSubmission.data.payment.id)).ok);
  assert.equal(groupRow(partial).status, "payment_pending");
  assert(children(partial).every((o) => o.status === "insufficient_payment"));
  age(partial);
  assert.equal((await expire(partial)).data, true);
  assert(children(partial).every((o) => o.status === "expired"));
  assert.equal(
    localSql(
      `begin read only;select status::text from public.payments where id='${partialSubmission.data.payment.id}';rollback;`,
      "p1-partial-history",
    ),
    "verified",
  );
  pass(
    "partial payment retains existing deadline policy and payment history while group expiration remains atomic",
  );
  const cancelled = await makeGroup();
  const cancelledProof = await submit(cancelled);
  assert(cancelledProof.ok && cancelledProof.data.accepted);
  localSql(
    `begin;update public.group_orders set status='cancelled' where id='${cancelled.id}';update public.orders set status='cancelled' where group_order_id='${cancelled.id}';commit;`,
    "p1-cancelled-fixture",
  );
  const cancelledSnapshot = snapshot(cancelled);
  assert(!(await review(cancelled, cancelledProof.data.payment.id)).ok);
  assert.equal(snapshot(cancelled), cancelledSnapshot);
  pass("cancelled groups cannot be verified");
  // Standalone regression uses a rollback transaction so unrelated local rows cannot be swept permanently.
  const solo = JSON.parse(
    localSql(
      `begin;
 insert into public.orders(order_number,batch_product_id,buyer_id,seller_id,quantity,unit_base_price,unit_selling_price,reservation_expires_at,reserved_payment_method,shipping_applies) values('P1-SOLO-${randomUUID()}','${shipping.products[0]}','${outsider.id}','${seller.id}',1,100,100,now()+interval '1 hour','Cash on Meetup',false);
 select set_config('request.jwt.claim.sub','${outsider.id}',true);
 select public.request_order_extension(id,2,'Synthetic standalone extension') from public.orders where batch_product_id='${shipping.products[0]}' and buyer_id='${outsider.id}';
 select set_config('request.jwt.claim.sub','${seller.id}',true);
 select public.decide_order_extension(id,true) from public.orders where batch_product_id='${shipping.products[0]}' and buyer_id='${outsider.id}';
 select set_config('request.jwt.claim.sub','${outsider.id}',true);
 select public.cancel_order(id) from public.orders where batch_product_id='${shipping.products[0]}' and buyer_id='${outsider.id}';
 insert into public.orders(order_number,batch_product_id,buyer_id,seller_id,quantity,unit_base_price,unit_selling_price,reservation_expires_at,reserved_payment_method,shipping_applies) values('P1-EXPIRE-${randomUUID()}','${shipping.products[1]}','${outsider.id}','${seller.id}',1,100,100,now()-interval '1 hour','Cash on Meetup',false);
 select public.sweep_standalone_delivery_expirations();
 select jsonb_agg(status::text order by batch_product_id) from public.orders where buyer_id='${outsider.id}' and batch_product_id in ('${shipping.products[0]}','${shipping.products[1]}');rollback;`,
      "p1-standalone-regression",
    )
      .split("\n")
      .filter(Boolean)
      .at(-1),
  );
  assert.deepEqual(solo.sort(), ["cancelled", "expired"]);
  pass("standalone cancellation and expiration remain functional");
} finally {
  if (batches.length) {
    const ids = batches.map((x) => "'" + x + "'").join(",");
    localSql(
      `begin;update public.group_orders set payment_order_id=null where batch_id in (${ids});delete from public.payments where order_id in(select o.id from public.orders o join public.batch_products bp on bp.id=o.batch_product_id where bp.batch_id in (${ids}));delete from public.orders where batch_product_id in(select id from public.batch_products where batch_id in (${ids}));delete from public.group_orders where batch_id in (${ids});delete from public.batch_products where batch_id in (${ids});delete from public.batches where id in (${ids});delete from public.seller_payment_methods where seller_id='${seller.id}';commit;`,
      "p1-fixture-cleanup",
    );
  }
  for (const a of accounts)
    assert((await http("/auth/v1/admin/users/" + a.id, server.serviceRoleKey, "DELETE")).ok);
}
console.log("Focused P1 integration complete; synthetic fixtures cleaned.");
