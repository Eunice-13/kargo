import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
let server, Item, Provider, Page, Menu;
before(async () => {
  server = await createServer({
    configFile: false,
    plugins: [react()],
    resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  Item = (await server.ssrLoadModule("/src/features/notifications/NotificationItem.tsx")).default;
  Provider = (await server.ssrLoadModule("/src/features/notifications/NotificationsProvider.tsx"))
    .default;
  Page = (await server.ssrLoadModule("/src/features/notifications/NotificationsPage.tsx")).default;
  Menu = (await server.ssrLoadModule("/src/components/layout/NotificationsMenu.tsx")).default;
});
after(async () => {
  await server?.close();
});
const notification = {
  id: "one",
  icon: "check",
  text: "A reservation update",
  time: "Today",
  unread: true,
  tab: "My Claims",
};
test("history rows expose unread state and an independent mark-read action", () => {
  const html = renderToStaticMarkup(
    createElement(Item, { notification, busy: false, onOpen() {}, onMarkRead() {} }),
  );
  assert.match(html, /Mark as read/);
  assert.match(html, /\(unread\)/);
  assert.match(html, />Unread</);
  assert.match(html, /go to My Claims/);
  const read = renderToStaticMarkup(
    createElement(Item, {
      notification: { ...notification, unread: false },
      busy: false,
      onOpen() {},
    }),
  );
  assert.match(read, />Read</);
  assert.doesNotMatch(read, /Mark as read/);
});
test("compact notification rows clamp descriptions and retain the full accessible message", () => {
  const html = renderToStaticMarkup(
    createElement(Item, { notification, compact: true, busy: false, onOpen() {} }),
  );
  assert.match(html, /line-clamp-2/);
  assert.match(html, /aria-label="A reservation update \(unread\), go to My Claims"/);
  assert.doesNotMatch(html, /Mark as read/);
});
test("page renders existing demo history and header badge shares its unread state", () => {
  const html = renderToStaticMarkup(
    createElement(
      Provider,
      { role: "Buyer" },
      createElement(Menu),
      createElement(Page, { onNavigate() {} }),
    ),
  );
  assert.match(html, /Notifications \(2 unread\)/);
  assert.match(html, /2 unread/);
  assert.equal((html.match(/>Mark as read</g) ?? []).length, 2);
  assert.equal((html.match(/go to /g) ?? []).length, 5);
});
