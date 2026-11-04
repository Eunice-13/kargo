import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

let server, List;
before(async () => {
  server = await createServer({
    configFile: false,
    envDir: false,
    plugins: [react()],
    resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  List = (await server.ssrLoadModule("/src/features/batches/SellerExtensionRequests.tsx")).default;
});
after(async () => {
  await server?.close();
});

const now = Date.parse("2026-11-04T12:00:00Z");
const request = {
  id: "expired",
  buyer: "Buyer",
  product: "Expired Product",
  batch: "Hanoi",
  status: "pending",
  orderStatus: "payment_pending",
  requestedAt: "Nov 4, 2026",
  expiresAt: "2026-11-04T12:00:00Z",
  reason: "Need more time to pay.",
};
const render = (requests, time = now) =>
  renderToStaticMarkup(createElement(List, { requests, now: time, onDecision() {} }));
test("expired requests are separated from pending requests and have no decision buttons", () => {
  const html = render([
    request,
    { ...request, id: "pending", product: "Pending Product", expiresAt: "2026-11-05T12:00:00Z" },
  ]);
  const expiredSection = html.split('aria-label="Expired extension requests"')[1];
  assert.match(expiredSection, /Expired Product/);
  assert.match(expiredSection, /Need more time to pay/);
  assert.match(expiredSection, /Deadline:/);
  assert.doesNotMatch(expiredSection, /Pending Product|>Approve<|>Deny</);
  const pendingSection = html
    .split('aria-label="Pending extension requests"')[1]
    .split("</section>")[0];
  assert.match(pendingSection, /Pending Product/);
  assert.match(pendingSection, />Approve</);
  assert.match(pendingSection, />Deny</);
  assert.doesNotMatch(pendingSection, /Expired Product/);
});
test("the same loaded request moves to Expired when its deadline passes", () => {
  assert.match(render([request], now - 1), />Approve</);
  const html = render([request], now);
  assert.match(html, /No pending extension requests/);
  assert.match(html, /payment timer ran out/);
  assert.doesNotMatch(html, />Approve<|>Deny</);
});
test("empty request lists show both section empty states", () => {
  const html = render([]);
  assert.match(html, /No pending extension requests/);
  assert.match(html, /No expired extension requests/);
});
