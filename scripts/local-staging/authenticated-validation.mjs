// Real Auth, REST and Storage integration. Local inspected endpoints only; no env files.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomUUID, randomBytes } from "node:crypto";
import { localSql, workdir, root } from "./database.mjs";
import { verifyLocalTarget, readRuntimeEvidence, runtimeEnv } from "./isolation.mjs";
localSql("begin read only;select 1;rollback;", "authenticated-preflight");
const target = verifyLocalTarget(
  JSON.parse(readFileSync(path.join(workdir, "target.local.json"))),
  readRuntimeEvidence(workdir),
);
const server = JSON.parse(readFileSync(path.join(workdir, "server-credentials.local.json")));
assert.equal(
  server.serviceRoleKey,
  runtimeEnv(readRuntimeEvidence(workdir), "edge_runtime").SUPABASE_SERVICE_ROLE_KEY,
);
assert.equal(server.apiUrl, target.apiUrl);
assert.equal(server.projectId, target.projectId);
const run = randomUUID(),
  results = [];
async function http(endpoint, token, method = "GET", body, extra = {}) {
  assert.ok(
    endpoint.startsWith("/auth/v1/") ||
      endpoint.startsWith("/rest/v1/") ||
      endpoint.startsWith("/storage/v1/"),
  );
  const response = await fetch(target.apiUrl + endpoint, {
    method,
    headers: {
      apikey: target.anonKey,
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...extra,
    },
    body: body instanceof Uint8Array ? body : body ? JSON.stringify(body) : undefined,
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
  const raw = await response.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    data = raw;
  }
  if (!response.ok)
    throw Error(`${method} ${endpoint}: ${response.status} ${JSON.stringify(data)}`);
  return data;
}
const accounts = [];
for (const role of ["buyer", "seller", "outsider", "other-seller"]) {
  const password = randomBytes(24).toString("base64url");
  const email = `local-${role}-${run}@kargo.test`;
  const created = await http("/auth/v1/admin/users", server.serviceRoleKey, "POST", {
    email,
    password,
    email_confirm: true,
  });
  const auth = await http("/auth/v1/token?grant_type=password", target.anonKey, "POST", {
    email,
    password,
  });
  assert.equal(auth.user.id, created.id);
  accounts.push({ id: created.id, token: auth.access_token, role });
}
writeFileSync(
  path.join(workdir, `authenticated-${run}.private.json`),
  JSON.stringify({ run, accounts }),
  { mode: 0o600 },
);
const [buyer, seller, outsider] = accounts;
const map = new Map(
  accounts.map((a, i) => [`61000000-0000-0000-0000-${String(i + 1).padStart(12, "0")}`, a.id]),
);
const fixture = readFileSync(
  path.join(root, "supabase/tests/combined_delivery_payments.sql"),
  "utf8",
);
let setup = fixture.slice(
  fixture.indexOf("update public.user_profiles"),
  fixture.indexOf("insert into public.delivery_destinations"),
);
setup = setup.replace(/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/g, (id) => {
  if (!map.has(id)) map.set(id, randomUUID());
  return map.get(id);
});
localSql(
  `begin;${setup}insert into public.seller_payment_methods(seller_id,method_type) values('${seller.id}','GCash');commit;`,
  "authenticated-fixtures",
);
const product = (n) => map.get(`63000000-0000-0000-0000-${String(n).padStart(12, "0")}`);
async function rpc(account, name, args) {
  return http("/rest/v1/rpc/" + name, account.token, "POST", args);
}
function pass(name) {
  results.push(name);
  console.log("PASS", name);
}
async function reject(fn, pattern) {
  try {
    await fn();
  } catch (e) {
    assert.match(e.message, pattern);
    return;
  }
  throw Error("Expected rejection");
}
const claim = async (n, actor = buyer) =>
  rpc(actor, "claim_batch_product_with_address", {
    p_batch_product_id: product(n),
    p_quantity: 1,
    p_payment_method: "GCash",
    p_pin_lat: 14.6,
    p_pin_lng: 121,
    p_pin_url: null,
    p_accept_shipping: true,
    p_pin_address: "Unit 1, Synthetic test address",
  });
const orders = [await claim(1), await claim(2)];
assert.ok(orders.every((o) => o.id));
pass("real buyer claims two products");
for (const account of [buyer, seller]) {
  const batches = await http(
    `/rest/v1/batches?id=eq.${map.get("62000000-0000-0000-0000-000000000001")}&select=id`,
    account.token,
  );
  assert.equal(batches.length, 1);
}
pass("buyer and seller batch loading");
const group = await rpc(buyer, "request_combined_delivery", {
  p_order_ids: orders.map((o) => o.id),
  p_lat: 14.6,
  p_lng: 121,
  p_address: "Unit 1, Synthetic test address",
  p_confirm_destination: true,
});
await reject(
  () => rpc(outsider, "review_combined_delivery", { p_group_id: group.id, p_action: "approve" }),
  /seller|unavailable|access/i,
);
await rpc(seller, "review_combined_delivery", { p_group_id: group.id, p_action: "approve" });
await rpc(seller, "review_combined_delivery", {
  p_group_id: group.id,
  p_action: "set_shipping_fee",
  p_shipping_fee: 125.5,
});
const accountsReady = await http(
  `/rest/v1/combined_delivery_payment_accounts?group_id=eq.${group.id}&select=*`,
  buyer.token,
);
assert.equal(Number(accountsReady[0].total), 1075.5);
const resumed = await http(
  `/rest/v1/orders?id=in.(${orders.map((o) => o.id).join(",")})&select=deadline_paused_at,reservation_expires_at`,
  buyer.token,
);
assert.ok(
  resumed.every(
    (o) =>
      o.deadline_paused_at === null &&
      Date.parse(o.reservation_expires_at) === Date.parse(accountsReady[0].deadline),
  ),
);
assert.ok(Date.parse(accountsReady[0].deadline) > Date.now());
pass("seller approval, shared shipping and authoritative total");
const proof = `${buyer.id}/${run}.png`;
// Synthetic 1x1 PNG; no external file or customer proof.
await http(
  "/storage/v1/object/payment-receipts/" + proof,
  buyer.token,
  "POST",
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
    "base64",
  ),
  { "Content-Type": "image/png" },
);
const submit = (ref) =>
  rpc(buyer, "submit_combined_delivery_payment", {
    p_group_id: group.id,
    p_method_type: "GCash",
    p_amount: 1075.5,
    p_reference_number: ref,
    p_receipt_path: proof,
  });
let payment = (await submit("AUTH-" + run)).payment;
assert.ok(payment.id);
pass("real Storage upload and combined proof submission");
await reject(() => submit("DUP-" + run), /not payable/);
assert.equal(
  (await http(`/rest/v1/payments?id=eq.${payment.id}&select=id`, outsider.token)).length,
  0,
);
pass("duplicate prevention and unrelated-account RLS");
await rpc(seller, "review_combined_delivery_payment", {
  p_payment_id: payment.id,
  p_decision: "rejected",
  p_reason: "Synthetic retry test",
  p_deadline_hours: 12,
});
payment = (await submit("RETRY-" + run)).payment;
await reject(
  () =>
    rpc(outsider, "review_combined_delivery_payment", {
      p_payment_id: payment.id,
      p_decision: "verified",
    }),
  /seller|unavailable|access/i,
);
await rpc(seller, "review_combined_delivery_payment", {
  p_payment_id: payment.id,
  p_decision: "verified",
});
const rows = await http(
  `/rest/v1/orders?id=in.(${orders.map((o) => o.id).join(",")})&select=id,status,shipping_fee`,
  buyer.token,
);
assert.equal(rows.length, 2);
assert.ok(rows.every((o) => o.status === "payment_confirmed" && o.shipping_fee === null));
assert.equal(
  (
    await http(
      `/rest/v1/combined_delivery_payment_reservations?payment_id=eq.${payment.id}&select=order_id`,
      buyer.token,
    )
  ).length,
  2,
);
pass("rejection, retry, seller verification and atomic member statuses");
for (const account of [buyer, seller]) {
  const notices = await http(
    `/rest/v1/notifications?recipient_id=eq.${account.id}&select=dedupe_key`,
    account.token,
  );
  const keys = notices.map((n) => n.dedupe_key).filter((k) => k?.startsWith("combined_payment_"));
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(keys.some((k) => k.startsWith("combined_payment_submitted_")));
  for (const event of account === buyer
    ? ["ready", "submitted", "rejected", "verified"]
    : ["submitted"])
    assert.ok(
      keys.some((k) => k.startsWith(`combined_payment_${event}_`)),
      `Missing ${event} notification`,
    );
}
pass("participant notifications and deduplication");

for (const account of [buyer, seller]) {
  const catalog = await http(
    `/rest/v1/batch_catalog?batch_id=eq.${map.get("62000000-0000-0000-0000-000000000001")}&select=batch_id,batch_claimed`,
    account.token,
  );
  assert.equal(catalog.length, 2);
  assert.equal(Number(catalog[0].batch_claimed), 2);
}
assert.equal(Number(await rpc(buyer, "available_stock", { p_product_id: product(1) })), 19);
pass("application batch catalog and inventory allocations");
await reject(
  () => rpc(buyer, "cancel_combined_delivery_request", { p_group_id: group.id }),
  /cannot|only|pending|unavailable/i,
);
const single = await claim(3);
await rpc(seller, "set_order_shipping_fee", { p_order_id: single.id, p_fee: 50 });
const standalone = await rpc(buyer, "submit_order_payment", {
  p_order_id: single.id,
  p_method_type: "GCash",
  p_amount: 450,
  p_reference_number: "SINGLE-" + run,
  p_receipt_path: proof,
});
assert.equal(standalone.accepted, true);
await rpc(seller, "review_order_payment", {
  p_payment_id: standalone.payment.id,
  p_decision: "verified",
  p_reason: null,
  p_deadline_hours: null,
});
assert.equal(
  (await http(`/rest/v1/orders?id=eq.${single.id}&select=status`, buyer.token))[0].status,
  "payment_confirmed",
);
pass("real authenticated standalone shipping, proof and verification");
// Separate synthetic buyers preserve the real per-buyer request cooldown.
for (const action of ["reject", "cancel", "different-batch"]) {
  const password = randomBytes(24).toString("base64url"),
    email = `local-${action}-${run}@kargo.test`;
  const created = await http("/auth/v1/admin/users", server.serviceRoleKey, "POST", {
    email,
    password,
    email_confirm: true,
  });
  const auth = await http("/auth/v1/token?grant_type=password", target.anonKey, "POST", {
    email,
    password,
  });
  const actor = { id: created.id, token: auth.access_token, role: action };
  accounts.push(actor);
  const pending = [await claim(1, actor), await claim(action === "different-batch" ? 3 : 2, actor)];
  const args = {
    p_order_ids: pending.map((o) => o.id),
    p_lat: 14.6,
    p_lng: 121,
    p_address: "Unit 1, Synthetic test address",
    p_confirm_destination: true,
  };
  if (action === "different-batch") {
    await reject(() => rpc(actor, "request_combined_delivery", args), /batch|eligible|same/i);
    continue;
  }
  const g = await rpc(actor, "request_combined_delivery", args);
  if (action === "reject")
    await rpc(seller, "review_combined_delivery", {
      p_group_id: g.id,
      p_action: "reject",
      p_reason: "Synthetic rejection",
    });
  else await rpc(actor, "cancel_combined_delivery_request", { p_group_id: g.id });
  const state = (
    await http(`/rest/v1/combined_delivery_groups?id=eq.${g.id}&select=status`, actor.token)
  )[0].status;
  assert.equal(state, action === "reject" ? "rejected" : "cancelled");
}
pass("request rejection, cancellation restrictions and strict same-batch validation");
writeFileSync(
  path.join(workdir, "authenticated-validation.local.json"),
  JSON.stringify(
    {
      run,
      passed: results,
      syntheticAccountIds: accounts.map((a) => a.id),
      groupId: group.id,
      orders: orders.map((o) => o.id),
    },
    null,
    2,
  ),
  { mode: 0o600 },
);
console.log("Synthetic accounts/data retained locally for inspection; no production access.");
