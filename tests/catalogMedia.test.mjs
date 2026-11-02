import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

let server, Media, Thumb, Home, Page;
const noop = () => {};
const batch = {
  id: 33,
  title: "Bangkok Thrift Haul",
  category: "Apparel",
  seller: "Seller",
  sellerId: "seller",
  trips: "May 18–25, 2027",
  live: true,
  locked: false,
  items: 1,
  claimed: 0,
  reserveHours: 48,
  coverImage: "/catalog/verified-bangkok.jpg",
  galleryImages: [],
  products: [
    {
      name: "Actual Vintage Denim",
      imageUrl: "/catalog/actual-denim.jpg",
      price: 100,
      qty: 1,
      claimed: 0,
      waitlist: 0,
      locked: false,
    },
  ],
};
before(async () => {
  server = await createServer({
    configFile: false,
    envDir: false,
    plugins: [
      {
        name: "exclude-browser-only-map-from-image-ssr",
        enforce: "pre",
        resolveId(id) {
          if (/(?:LocationPinPicker|DeliveryPreviewCard)(?:\.tsx)?$/.test(id))
            return fileURLToPath(new URL("./fixtures/SavedAddressMap.tsx", import.meta.url));
        },
      },
      react(),
    ],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("../src", import.meta.url)),
      },
    },
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
    ssr: { noExternal: ["leaflet"] },
  });
  Media = (await server.ssrLoadModule("/src/components/shared/BatchMedia.tsx")).default;
  Thumb = (await server.ssrLoadModule("/src/components/shared/ProductThumb.tsx")).default;
  Home = (await server.ssrLoadModule("/src/features/batches/BuyerHome.tsx")).default;
  Page = (await server.ssrLoadModule("/src/features/batches/BatchPage.tsx")).default;
});
after(async () => await server?.close());
const home = (batches) =>
  renderToStaticMarkup(
    createElement(Home, {
      batches,
      category: "All",
      date: "All",
      onCategoryChange: noop,
      onDateChange: noop,
      onOpenBatch: noop,
      onToggleReaction: noop,
      reactionPending: new Set(),
    }),
  );
const page = (value) =>
  renderToStaticMarkup(
    createElement(Page, {
      batch: value,
      batches: [value],
      role: "Buyer",
      user: { name: "Buyer", email: "", role: "Buyer" },
      claims: [],
      toPay: [],
      waitlist: [],
      setClaims: noop,
      setToPay: noop,
      setWaitlist: noop,
      setBatches: noop,
      refreshData: async () => {},
      onBack: noop,
      onSellerClick: noop,
    }),
  );
test("product thumbnails show only the supplied product photograph", () => {
  const html = renderToStaticMarkup(
    createElement(Thumb, {
      name: "Nars Blush",
      imageUrl: "/catalog/actual-blush.jpg",
    }),
  );
  assert.match(html, /<img[^>]+src="\/catalog\/actual-blush.jpg"/);
  assert.doesNotMatch(html, /unsplash|bing|loremflickr/i);
});
test("missing media is an explicit accessible error, never another photograph or an empty src", () => {
  for (const Component of [Media, Thumb]) {
    const html = renderToStaticMarkup(
      createElement(Component, {
        src: "",
        imageUrl: "",
        alt: "Missing item",
        name: "Missing item",
      }),
    );
    assert.match(html, /Photo unavailable/);
    assert.match(html, /data-media-state="missing"/);
    assert.doesNotMatch(html, /<img|background-image|data:image/);
  }
});
test("homepage cards and rankings keep the record's cover independently of category or ID", () => {
  for (const value of [batch, { ...batch, id: 1, category: "Food" }]) {
    const html = home([value]);
    const sources = [...html.matchAll(/<img[^>]*src="([^"]+)"/g)].map((match) => match[1]);
    assert.ok(sources.length > 0);
    assert.ok(sources.every((src) => src === batch.coverImage));
  }
});
test("homepage never swaps a missing batch cover for a product or category image", () => {
  const html = home([{ ...batch, coverImage: "" }]);
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /Photo unavailable/);
});
test("batch gallery includes the stored cover and item, without sample or title overrides", () => {
  const html = page({ ...batch, title: "PLM - October 2026" });
  assert.match(html, /src="\/catalog\/verified-bangkok.jpg"/);
  assert.match(html, /src="\/catalog\/actual-denim.jpg"/);
  assert.doesNotMatch(html, /Sample batch photo|gstatic|lazada|unsplash|bing|loremflickr/i);
});
