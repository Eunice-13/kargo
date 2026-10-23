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
  loadMyGroupOrder,
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
  ({ loadGroupOrder, loadMyGroupOrder } = await server.ssrLoadModule("/src/services/kargoApi.ts"));
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
  batches: { title: batch, ends_on: "2099-01-01" },
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
test("expandable list has collapsed accessible details and safe batch fallback", () => {
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
  assert.equal((html.match(/aria-expanded="false"/g) ?? []).length, 3);
  assert.match(html, /aria-controls=/);
  assert.match(html, /Batch unavailable/);
  assert.match(html, /group-shortcut-summary/);
  assert.match(html, /group-shortcut-panel/);
  assert.match(html, /inert=/);
});
test("section remains hidden without an authenticated buyer", () => {
  assert.equal(
    renderToStaticMarkup(
      createElement(Section, {
        buyerId: undefined,
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

test("batch resolution chooses active membership instead of the first historical row", async () => {
  state.rows.group_order_members = [
    {
      user_id: "leader",
      status: "active",
      group_order_id: "old",
      group_orders: { batch_id: "batch-a", status: "payment_confirmed", created_at: "2026-02-01" },
    },
    {
      user_id: "leader",
      status: "active",
      group_order_id: "current",
      group_orders: { batch_id: "batch-a", status: "forming", created_at: "2026-01-01" },
    },
  ];
  state.rows.group_orders = [raw("old"), raw("current")];
  assert.equal((await loadMyGroupOrder("batch-a")).id, "current");
});
test("friendly notice never suggests leaving after checkout", async () => {
  const Notice = (await server.ssrLoadModule("/src/features/batches/GroupMembershipNotice.tsx"))
    .default;
  const message =
    "You can only join one group order per batch. You're already a member of another group in this batch.";
  for (const status of ["payment_pending", "waiting_for_seller", undefined]) {
    const html = renderToStaticMarkup(createElement(Notice, { message, status }));
    assert.match(html, /role="alert"/);
    assert.doesNotMatch(html, /leave your current group first/);
  }
  assert.match(
    renderToStaticMarkup(createElement(Notice, { message, status: "forming" })),
    /leave your current group first/,
  );
});

test("leader summary uses real member profiles, own items, one shipping fee and verified balance", async () => {
  state.rows.group_orders = [
    {
      ...raw("financial"),
      status: "payment_pending",
      checked_out_at: "2026-10-23T00:00:00Z",
      final_subtotal: 500,
      shipping_fee: 50,
      payment_order_id: "representative",
      batches: { title: "Batch", ends_on: "2099-01-01", seller_id: "seller" },
      group_order_members: [
        { user_id: "leader", status: "active" },
        { user_id: "member", status: "active" },
        { user_id: "left", status: "left" },
      ],
      group_order_commitments: [
        { user_id: "leader", quantity: 2, unit_selling_price: 100 },
        { user_id: "member", quantity: 3, unit_selling_price: 100 },
      ],
      orders: [
        {
          id: "representative",
          fulfillment_stage: "shipped",
          payments: [
            { status: "verified", amount: 100 },
            { status: "rejected", amount: 900 },
          ],
        },
      ],
    },
  ];
  state.rows.public_profiles = [
    { id: "seller", display_name: "Test seller" },
    { id: "leader", display_name: "Leader" },
    { id: "member", display_name: "Member" },
  ];
  const [g] = await loadLedGroupOrders();
  assert.equal(g.sellerName, "Test seller");
  assert.equal(g.members.length, 2);
  assert.equal(g.ownItemCount, 2);
  assert.equal(g.ownSubtotal, 200);
  assert.equal(g.amount, 550);
  assert.equal(g.amountRemaining, 450);
  assert.equal(g.fulfillmentStage, "shipped");
});
test("progress does not invent shipping and expired deadlines never offer payment", async () => {
  const { groupProgress, groupTimeLeft } = await server.ssrLoadModule(
    "/src/features/dashboard/groupOrderProgress.ts",
  );
  const pending = {
    ...summary("p", "payment_pending"),
    paymentDeadline: "2099-01-01T00:00:00Z",
    amountRemaining: 550,
  };
  assert.equal(groupProgress(pending).payable, true);
  assert.equal(
    groupProgress({ ...pending, paymentDeadline: "2020-01-01T00:00:00Z" }).payable,
    false,
  );
  assert.equal(groupProgress({ ...pending, amountRemaining: 0 }).payable, false);
  assert.equal(groupProgress(summary("paid", "payment_confirmed")).step, 3);
  assert.equal(
    groupProgress({ ...summary("paid", "payment_confirmed"), fulfillmentStage: "delivered" }).step,
    5,
  );
  assert.equal(groupProgress(summary("review", "payment_submitted")).payable, false);
  assert.equal(
    groupTimeLeft("2026-10-23T01:02:03Z", Date.parse("2026-10-23T00:00:00Z")),
    "01:02:03",
  );
});
test("expanded details show real item subtotal, progress and payment countdown without invented nudge", async () => {
  const { GroupOrderDetails } = await server.ssrLoadModule(
    "/src/features/dashboard/GroupOrderRow.tsx",
  );
  const html = renderToStaticMarkup(
    createElement(GroupOrderDetails, {
      group: {
        ...summary("due", "payment_pending"),
        paymentDeadline: "2099-01-01T00:00:00Z",
        ownItemCount: 2,
        ownSubtotal: 200,
        members: Array.from({ length: 6 }, (_, i) => ({ id: String(i), name: `Member ${i}` })),
      },
      now: Date.parse("2098-12-31T23:00:00Z"),
      onOpen: () => {},
      onPay: () => {},
    }),
  );
  assert.match(html, /Your items · 2 items/);
  assert.match(html, /6 members/);
  assert.match(html, /\+2/);
  assert.match(html, /Due in 01:00:00/);
  assert.match(html, /aria-current="step"/);
  assert.doesNotMatch(html, /Nudge seller/);
});
test("authenticated initial load shows skeletons instead of hiding the section", () => {
  const html = renderToStaticMarkup(
    createElement(Section, {
      buyerId: "leader",
      batches: [],
      onOpenClaims: () => {},
      onUpdated: async () => {},
    }),
  );
  assert.match(html, /Loading group orders/);
  assert.match(html, /aria-busy="true"/);
});
test("mobile details form an accordion while desktop rows expand independently", async () => {
  const { toggleGroupDetails } = await server.ssrLoadModule(
    "/src/features/dashboard/groupOrderProgress.ts",
  );
  const original = new Set(["a"]);
  assert.deepEqual([...toggleGroupDetails(original, "b", true)], ["b"]);
  assert.deepEqual([...toggleGroupDetails(original, "b", false)], ["a", "b"]);
  assert.deepEqual([...toggleGroupDetails(original, "a", true)], []);
  assert.deepEqual([...original], ["a"]);
});
test("historical un-checked-out groups retain their item subtotal", async () => {
  state.rows.group_orders = [
    {
      ...raw("expired"),
      status: "expired",
      checked_out_at: null,
      final_subtotal: 0,
      group_order_commitments: [{ user_id: "leader", quantity: 2, unit_selling_price: 100 }],
    },
  ];
  const [group] = await loadLedGroupOrders();
  assert.equal(group.amount, 200);
  assert.equal(group.amountIsSubtotal, true);
});
