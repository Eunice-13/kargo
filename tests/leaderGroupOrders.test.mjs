import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
let server,
  state,
  loadLedGroupOrders,
  loadGroupOrder,
  List,
  Section,
  sortLeaderGroups,
  groupCanManage;
const fixture = (name) => fileURLToPath(new URL("./fixtures/" + name, import.meta.url));
before(async () => {
  server = await createServer({
    configFile: false,
    envFile: false,
    plugins: [react()],
    resolve: {
      alias: [
        { find: /^@\/lib\/supabase$/, replacement: fixture("LeaderGroupClient.ts") },
        { find: /^@\/components\/shared$/, replacement: fixture("GroupOrderShared.ts") },
        { find: /^@\/components\/shared\/Modal$/, replacement: fixture("RenderModal.tsx") },
        { find: /^@\/features\/batches$/, replacement: fixture("GroupOrderFeature.ts") },
        { find: "@", replacement: fileURLToPath(new URL("../src", import.meta.url)) },
      ],
    },
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  ({ state } = await server.ssrLoadModule("/tests/fixtures/LeaderGroupClient.ts"));
  ({ loadLedGroupOrders } = await server.ssrLoadModule("/src/services/leaderGroupOrders.ts"));
  ({ loadGroupOrder } = await server.ssrLoadModule("/src/services/kargoApi.ts"));
  ({ GroupOrderList: List, default: Section } = await server.ssrLoadModule(
    "/src/features/dashboard/MyGroupOrders.tsx",
  ));
  ({ sortLeaderGroups, groupCanManage } = await server.ssrLoadModule(
    "/src/features/dashboard/leaderGroupOrderPresentation.ts",
  ));
});
after(async () => await server?.close());
beforeEach(() => {
  state.userId = "leader";
  state.authError = null;
  state.filters = [];
  state.rows = {};
});
const raw = (id, batch = "batch-a", leader = "leader") => ({
  id,
  batch_id: batch,
  leader_id: leader,
  status: "forming",
  formation_deadline: "2099-01-01T00:00:00Z",
  payment_deadline: null,
  created_at: "2026-01-01T00:00:00Z",
  batches: { title: batch },
  group_order_members: [],
});
const summary = (id, status = "forming") => ({
  id,
  leaderId: "leader",
  batchId: "batch-a",
  batchTitle: "Batch A",
  status,
  formationDeadline: "2099-01-01T00:00:00Z",
  paymentDeadline: null,
  createdAt: "2026-01-01T00:00:00Z",
});
test("query lists only authenticated leader groups across batches, including history", async () => {
  state.rows.group_orders = [
    raw("a"),
    raw("b", "batch-b"),
    { ...raw("old"), status: "cancelled" },
    raw("other", "batch-c", "someone-else"),
  ];
  const groups = await loadLedGroupOrders();
  assert.deepEqual(
    groups.map((g) => g.id),
    ["a", "b", "old"],
  );
  assert.equal(groups[1].batchTitle, "batch-b");
  assert(
    state.filters.some(
      (f) => f.table === "group_orders" && f.field === "leader_id" && f.value === "leader",
    ),
  );
});
test("logged out and auth errors fail closed", async () => {
  state.userId = "";
  await assert.rejects(loadLedGroupOrders(), /Sign in/);
  state.authError = new Error("Session failed");
  await assert.rejects(loadLedGroupOrders(), /Session failed/);
  await assert.rejects(loadGroupOrder("a", true), /Session failed/);
});
test("exact ID opens the selected group even when another belongs to the same batch", async () => {
  state.rows.group_orders = [raw("first"), raw("second")];
  state.rows.group_order_members = [];
  state.rows.group_order_commitments = [];
  const group = await loadGroupOrder("second", true);
  assert.equal(group.id, "second");
  assert(group.isLeader);
  assert(
    state.filters.some(
      (f) => f.table === "group_orders" && f.field === "id" && f.value === "second",
    ),
  );
  assert(
    state.filters.some(
      (f) => f.table === "group_orders" && f.field === "leader_id" && f.value === "leader",
    ),
  );
});
test("dashboard exact-group loading denies nonleaders and deleted groups", async () => {
  state.rows.group_orders = [raw("private", "batch-a", "other")];
  await assert.rejects(loadGroupOrder("private", true), /unavailable/);
  await assert.rejects(loadGroupOrder("deleted", true), /unavailable/);
});
test("existing participant loader remains available without leader-only mode", async () => {
  state.rows.group_orders = [raw("member-group", "batch-a", "other")];
  const group = await loadGroupOrder("member-group");
  assert.equal(group.id, "member-group");
  assert.equal(group.isLeader, false);
  assert(!state.filters.some((f) => f.table === "group_orders" && f.field === "leader_id"));
});
test("active groups sort before historical groups, without mutating caller data", () => {
  const groups = [
    summary("done", "payment_confirmed"),
    summary("awaiting", "payment_pending"),
    summary("forming"),
    summary("old", "cancelled"),
  ];
  const sorted = sortLeaderGroups(groups);
  assert.deepEqual(
    sorted
      .slice(0, 2)
      .map((g) => g.id)
      .sort(),
    ["awaiting", "forming"],
  );
  assert.equal(groups[0].id, "done");
  assert(groupCanManage(summary("forming")));
  assert(!groupCanManage(summary("paid", "payment_confirmed")));
  assert(!groupCanManage({ ...summary("past"), formationDeadline: "2020-01-01T00:00:00Z" }));
});
test("compact responsive list has correct management/view actions and safe batch fallback", () => {
  const html = renderToStaticMarkup(
    createElement(List, {
      groups: [
        summary("active"),
        summary("paid", "payment_confirmed"),
        { ...summary("missing", "cancelled"), batchTitle: null },
      ],
      onOpen: () => {},
    }),
  );
  assert.match(html, /Manage Group/);
  assert.equal(html.split("View Group").length - 1, 2);
  assert.match(html, /Batch unavailable/);
  assert.match(html, /sm:flex-row/);
  assert.match(html, /flex-col/);
  assert.match(html, /overflow-wrap:anywhere/);
});
test("section remains hidden before any leader records are present", () => {
  assert.equal(
    renderToStaticMarkup(
      createElement(Section, {
        buyerId: "leader",
        batches: [],
        onOpenClaims: () => {},
        onUpdated: async () => {},
      }),
    ),
    "",
  );
});
test("modal retains original batch entry path and uses exact ID for dashboard opens", () => {
  const source = readFileSync(
    new URL("../src/features/batches/GroupOrderModal.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /loadGroupOrder\(groupOrderId, true\)/);
  assert.match(source, /loadMyGroupOrder\(batch.dbId\)/);
  assert.match(source, /groupOrderId && !group/);
  assert.match(source, /!readOnly/);
});
