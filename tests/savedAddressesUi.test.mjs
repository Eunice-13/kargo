import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
let server, Fields, Addresses, Settings;
before(async () => {
  server = await createServer({
    configFile: false,
    envFile: false,
    plugins: [
      {
        name: "address-map-test-double",
        enforce: "pre",
        resolveId(id) {
          if (/LocationPinPicker(?:\.tsx)?$/.test(id))
            return fileURLToPath(new URL("./fixtures/SavedAddressMap.tsx", import.meta.url));
        },
      },
      react(),
    ],
    resolve: {
      alias: [
        {
          find: "./LocationPinPicker",
          replacement: fileURLToPath(new URL("./fixtures/SavedAddressMap.tsx", import.meta.url)),
        },
        {
          find: /^@\/components\/shared$/,
          replacement: fileURLToPath(
            new URL("./fixtures/SavedAddressesShared.ts", import.meta.url),
          ),
        },
        { find: "@", replacement: fileURLToPath(new URL("../src", import.meta.url)) },
      ],
    },
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  Fields = (await server.ssrLoadModule("/src/components/shared/DeliveryAddressFields.tsx")).default;
  Addresses = (await server.ssrLoadModule("/src/features/settings/MyAddressesSection.tsx")).default;
  Settings = (await server.ssrLoadModule("/src/features/settings/Settings.tsx")).default;
});
after(async () => await server?.close());
test("shared fields retain the map and editable full address with unit details", () => {
  const html = renderToStaticMarkup(
    createElement(Fields, {
      value: { lat: 14.6, lng: 121, address: "Unit 12, Home" },
      onChange: () => {},
    }),
  );
  assert.match(html, /Existing interactive map/);
  assert.match(html, /data-lat="14.6"/);
  assert.match(html, /<textarea/);
  assert.match(html, /Unit 12, Home/);
  assert.match(html, /maxlength="1000"/i);
});
test("address section loads safely and prevents premature add actions", () => {
  const html = renderToStaticMarkup(createElement(Addresses));
  assert.match(html, /My Addresses/);
  assert.match(html, /Save up to 2 delivery addresses/);
  assert.match(html, /0\/2/);
  assert.match(html, /Loading addresses/);
  assert.match(html, /disabled/);
});
test("settings navigation offers addresses to buyers only", () => {
  const props = { user: { name: "Synthetic Buyer", email: "buyer@kargo.test" }, setUser: () => {} };
  const buyer = renderToStaticMarkup(createElement(Settings, { ...props, role: "Buyer" }));
  const seller = renderToStaticMarkup(createElement(Settings, { ...props, role: "Seller" }));
  assert.match(buyer, /My Addresses/);
  assert.doesNotMatch(seller, /My Addresses/);
});
