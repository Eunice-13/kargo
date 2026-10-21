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
for (let n = 0; n < 2; n++) {
  const email = `addresses-${randomUUID()}@kargo.test`,
    password = randomBytes(24).toString("base64url");
  const user = await http("/auth/v1/admin/users", server.serviceRoleKey, "POST", {
    email,
    password,
    email_confirm: true,
  });
  assert(user.ok);
  const session = await http("/auth/v1/token?grant_type=password", target.anonKey, "POST", {
    email,
    password,
  });
  assert(session.ok);
  accounts.push({ id: user.data.id, token: session.data.access_token });
}
const [buyer, other] = accounts;
const rpc = (actor, name, args) => http("/rest/v1/rpc/" + name, actor.token, "POST", args);
const save = (actor, id, label = "Home", def = false) =>
  rpc(actor, "save_buyer_address", {
    p_id: id,
    p_label: label,
    p_address_text: "Unit 1, Synthetic address",
    p_pin_lat: 14.6,
    p_pin_lng: 121,
    p_is_default: def,
  });
const rows = async (actor) => {
  const r = await http("/rest/v1/buyer_addresses?select=*", actor.token);
  assert(r.ok);
  return r.data;
};
const initial = await rows(buyer);
assert.equal(initial.length, 0);
const before = localSql(
  "begin read only;select md5(coalesce(string_agg(to_jsonb(o)::text,'' order by id),'')) from public.orders o;rollback;",
  "addresses-reservations-before",
);
const concurrent = await Promise.all([
  save(buyer, null),
  save(buyer, null, "Work"),
  save(buyer, null, "Third"),
]);
assert.equal(concurrent.filter((r) => r.ok).length, 2);
assert.equal(concurrent.filter((r) => !r.ok).length, 1);
let saved = await rows(buyer);
assert.equal(saved.length, 2);
assert.equal(saved.filter((a) => a.is_default).length, 1);
const first = saved.find((a) => a.is_default),
  second = saved.find((a) => !a.is_default);
assert.equal((await rows(other)).length, 0);
assert(!(await save(other, first.id, "Stolen")).ok);
assert(!(await rpc(other, "delete_buyer_address", { p_id: first.id })).ok);
assert(!(await rpc(other, "set_default_buyer_address", { p_id: first.id })).ok);
const direct = await http("/rest/v1/buyer_addresses", buyer.token, "POST", {
  buyer_id: buyer.id,
  slot: 1,
  label: "Bypass",
  address_text: "Address",
  pin_lat: 0,
  pin_lng: 0,
});
assert(!direct.ok);
assert((await save(buyer, first.id, "Edited Home")).ok);
assert((await rpc(buyer, "set_default_buyer_address", { p_id: second.id })).ok);
saved = await rows(buyer);
assert(saved.find((a) => a.id === second.id).is_default);
assert((await rpc(buyer, "delete_buyer_address", { p_id: second.id })).ok);
saved = await rows(buyer);
assert.equal(saved.length, 1);
assert(saved[0].is_default);
for (const change of [
  { p_pin_lat: 91 },
  { p_pin_lng: 181 },
  { p_address_text: " " },
  { p_label: " " },
  { p_pin_lat: null },
]) {
  const r = await rpc(buyer, "save_buyer_address", {
    p_id: saved[0].id,
    p_label: "Home",
    p_address_text: "Address",
    p_pin_lat: 14.6,
    p_pin_lng: 121,
    p_is_default: true,
    ...change,
  });
  assert(!r.ok);
}
assert((await rpc(buyer, "delete_buyer_address", { p_id: saved[0].id })).ok);
assert.equal((await rows(buyer)).length, 0);
assert((await save(buyer, null, "New first")).ok);
assert((await rows(buyer))[0].is_default);
const anonymous = await http("/rest/v1/rpc/save_buyer_address", target.anonKey, "POST", {
  p_id: null,
  p_label: "No",
  p_address_text: "No",
  p_pin_lat: 0,
  p_pin_lng: 0,
});
assert(!anonymous.ok);
const after = localSql(
  "begin read only;select md5(coalesce(string_agg(to_jsonb(o)::text,'' order by id),'')) from public.orders o;rollback;",
  "addresses-reservations-after",
);
assert.equal(after, before);
// Remove only the dedicated synthetic fixtures created by this run.
for (const a of accounts) {
  const r = await http("/auth/v1/admin/users/" + a.id, server.serviceRoleKey, "DELETE");
  assert(r.ok);
}
console.log(
  "PASS: empty accounts, concurrent two-address limit, first/default switching/deletion, edit, invalid input, ownership/RLS, direct-write and anonymous denial, unchanged reservation snapshots. Synthetic fixtures cleaned up.",
);
