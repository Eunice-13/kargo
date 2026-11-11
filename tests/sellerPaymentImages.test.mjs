import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

let server, api, fixture, ProductThumb;
before(async () => {
  server = await createServer({
    configFile: false,
    envDir: false,
    plugins: [react()],
    resolve: {
      alias: [
        {
          find: /^@\/lib\/supabase$/,
          replacement: fileURLToPath(new URL("./fixtures/BatchImagesClient.ts", import.meta.url)),
        },
        { find: "@", replacement: fileURLToPath(new URL("../src", import.meta.url)) },
      ],
    },
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  fixture = await server.ssrLoadModule("/tests/fixtures/BatchImagesClient.ts");
  api = await server.ssrLoadModule("/src/services/kargoApi.ts");
  ProductThumb = (await server.ssrLoadModule("/src/components/shared/ProductThumb.tsx")).default;
});
after(async () => {
  await server?.close();
});

for (const fallback of [false, true]) {
  for (const catalog of ["absent", "stale"]) {
    test(`seller payment photos come from the ordered product with ${catalog} catalog, fallback=${fallback}`, async () => {
      const { requests, imagePath } = fixture.configureProductImageReadFixture("Seller", {
        fallback,
        catalog,
      });
      const [payment] = await api.loadSellerPaymentSubmissions();
      const expected = `https://kargo.test/storage/v1/object/public/batch-media/${imagePath}`;
      assert.equal(payment.imageUrl, expected);
      const html = renderToStaticMarkup(
        createElement(ProductThumb, { name: payment.product, imageUrl: payment.imageUrl }),
      );
      assert.ok(html.includes(`src="${expected}"`));
      assert.doesNotMatch(html, /images\.unsplash\.com|catalog\/stale/);
      const reads = requests.filter((url) => url.pathname.endsWith("/payments"));
      assert.equal(reads.length, fallback ? 2 : 1);
      for (const read of reads) {
        assert.match(
          read.searchParams.get("select"),
          /orders!inner\([^]*batch_products\(name,image_path\)/,
        );
      }
      if (fallback) assert.doesNotMatch(reads[1].searchParams.get("select"), /combined_delivery/);
    });
  }
}
test("combined payment summary uses its representative order's photo despite its combined display name", async () => {
  fixture.configureProductImageReadFixture("Seller", { combined: true });
  const [payment] = await api.loadSellerPaymentSubmissions();
  assert.equal(payment.combinedDeliveryGroupId, "combined-group");
  assert.match(payment.product, /Combined delivery/);
  assert.equal(
    payment.imageUrl,
    "https://kargo.test/storage/v1/object/public/batch-media/seller/closed/product.png",
  );
});
test("absolute product image URLs are preserved", async () => {
  const imagePath = "https://example.com/product.jpg";
  fixture.configureProductImageReadFixture("Seller", { imagePath });
  const [payment] = await api.loadSellerPaymentSubmissions();
  assert.equal(payment.imageUrl, imagePath);
});
test("products without an uploaded photo retain the existing thumbnail fallback", async () => {
  fixture.configureProductImageReadFixture("Seller", { imagePath: null });
  const [payment] = await api.loadSellerPaymentSubmissions();
  assert.equal(payment.imageUrl, undefined);
  const html = renderToStaticMarkup(
    createElement(ProductThumb, { name: payment.product, imageUrl: payment.imageUrl }),
  );
  assert.match(html, /<img/);
  assert.doesNotMatch(html, /src="undefined"|src="null"/);
});
