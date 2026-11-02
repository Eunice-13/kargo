import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";

let server, api, fixture, state;
const photo = (type = "image/png", size = 3) =>
  new File([new Uint8Array(size)], "image.png", { type });
const input = () => ({
  title: "Photos",
  category: "Food",
  startsOn: "2026-11-01",
  endsOn: "2026-11-30",
  reservationHours: 24,
  coverFile: photo(),
  galleryFiles: [photo()],
  products: ["One", "Two"].map((name) => ({
    name,
    basePrice: 100,
    markup: 10,
    quantity: 5,
    imageFile: photo(),
  })),
});
const updateFixture = () => {
  state.batches.set("batch", {
    id: "batch",
    cover_path: "old-cover",
    gallery_paths: ["old-gallery"],
  });
  state.products.set("product", { id: "product", batch_id: "batch", image_path: "old-product" });
};
before(async () => {
  server = await createServer({
    configFile: false,
    envDir: false,
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
});
after(async () => await server?.close());
beforeEach(() => {
  state = fixture.configureBatchImagesFixture();
});

for (const bad of [
  undefined,
  null,
  photo("text/plain"),
  photo("image/svg+xml"),
  photo("image/png", 0),
  photo("image/png", 5 * 1024 * 1024 + 1),
]) {
  for (const slot of ["cover", "last-product", "gallery"]) {
    test(`invalid ${slot} (${bad?.type ?? "missing"}, ${bad?.size ?? 0}) causes zero writes`, async () => {
      const batch = input();
      if (slot === "cover") batch.coverFile = bad;
      if (slot === "last-product") batch.products[1].imageFile = bad;
      if (slot === "gallery") batch.galleryFiles.push(bad);
      await assert.rejects(api.createBatch(batch), /photo|image/i);
      assert.deepEqual(state.events, []);
    });
  }
}
test("empty product list is rejected before uploads", async () => {
  await assert.rejects(api.createBatch({ ...input(), products: [] }), /product/i);
  assert.deepEqual(state.events, []);
});
test("all uploads precede one atomic RPC with paths and stable product order", async () => {
  const result = await api.createBatch(input());
  assert.deepEqual(
    state.events.map((e) => e.kind),
    ["upload", "upload", "upload", "upload", "rpc"],
  );
  const { body } = state.events.at(-1);
  assert.equal(body.p_batch_id, result.id);
  assert.equal(body.p_batch.cover_path, state.events[0].path);
  assert.deepEqual(body.p_batch.gallery_paths, [state.events[1].path]);
  assert.deepEqual(
    body.p_products.map((p) => p.image_path),
    state.events.slice(2, 4).map((e) => e.path),
  );
  assert.deepEqual(
    body.p_products.map((p) => p.name),
    ["One", "Two"],
  );
  assert.equal(new Set(body.p_products.map((p) => p.id)).size, 2);
  assert.ok([...state.objects].every((path) => path.startsWith(`${fixture.seller}/${result.id}/`)));
  assert.equal(typeof result.coverImage, "string");
  assert.equal(result.productImages.length, 2);
});
for (const failUploadAt of [1, 2, 3, 4]) {
  test(`upload ${failUploadAt} failure removes all attempted objects without DB rows`, async () => {
    state.failUploadAt = failUploadAt;
    await assert.rejects(api.createBatch(input()));
    assert.equal(state.objects.size, 0);
    assert.equal(state.batches.size, 0);
    assert.equal(state.products.size, 0);
    assert.equal(
      state.events.some((e) => e.kind === "rpc"),
      false,
    );
  });
}
test("RPC rejection cleans uploads and never falls back to separate inserts", async () => {
  state.failRpc = true;
  await assert.rejects(api.createBatch(input()), (e) => e.code === "23514");
  assert.equal(state.objects.size, 0);
  assert.equal(state.batches.size, 0);
});
test("lost RPC response preserves committed image references", async () => {
  state.commitThenFail = true;
  await assert.rejects(api.createBatch(input()));
  assert.equal(state.batches.size, 1);
  assert.equal(state.products.size, 2);
  assert.equal(state.objects.size, 4);
  assert.equal(
    state.events.some((e) => e.kind === "cleanup"),
    false,
  );
});
test("cleanup failure reports both errors without hiding the save failure", async () => {
  state.failRpc = true;
  state.failCleanup = true;
  await assert.rejects(api.createBatch(input()), (e) => {
    assert.match(e.message, /could not be cleaned up/);
    assert.equal(e.errors[0].code, "23514");
    assert.ok(e.errors[1]);
    return true;
  });
});
test("unavailable reference reads preserve files and expose failed compensation", async () => {
  state.failRpc = true;
  state.failRead = true;
  await assert.rejects(api.createBatch(input()), /could not be cleaned up/);
  assert.equal(state.objects.size, 4);
});
test("uncertain database failure preserves files even if its commit is not visible yet", async () => {
  state.commitThenFail = true;
  state.failRead = true;
  await assert.rejects(api.createBatch(input()), /could not be confirmed/);
  assert.equal(state.objects.size, 4);
});

const updates = {
  cover: () => api.updateBatchCover("batch", photo()),
  product: () => api.updateProductImage("batch", "product", photo()),
  gallery: () => api.addBatchGalleryImages("batch", [photo(), photo()]),
};
for (const [name, write] of Object.entries(updates)) {
  for (const failure of ["failUpdate", "zeroUpdate"]) {
    test(`${name} ${failure} cleans only new uploads and preserves old paths`, async () => {
      updateFixture();
      state[failure] = true;
      await assert.rejects(write());
      assert.equal(state.objects.size, 0);
      assert.equal(state.batches.get("batch").cover_path, "old-cover");
      assert.equal(state.products.get("product").image_path, "old-product");
      assert.deepEqual(state.batches.get("batch").gallery_paths, ["old-gallery"]);
    });
  }
  test(`${name} success saves uploaded paths`, async () => {
    updateFixture();
    const result = await write();
    assert.ok(result);
    assert.equal(
      state.events.some((e) => e.kind === "cleanup"),
      false,
    );
    if (name === "gallery") assert.equal(state.batches.get("batch").gallery_paths.length, 3);
  });
  test(`${name} lost update response preserves referenced photos`, async () => {
    updateFixture();
    state.commitThenFail = true;
    await assert.rejects(write());
    assert.equal(state.objects.size, name === "gallery" ? 2 : 1);
    assert.equal(
      state.events.some((e) => e.kind === "cleanup"),
      false,
    );
  });
}
test("updates validate the complete selection before even loading the row", async () => {
  for (const write of [
    () => api.updateBatchCover("batch", photo("text/plain")),
    () => api.updateProductImage("batch", "product", undefined),
    () => api.addBatchGalleryImages("batch", [photo(), photo("text/plain")]),
  ])
    await assert.rejects(write);
  assert.deepEqual(state.events, []);
});
test("product updates cannot target a product in another batch", async () => {
  updateFixture();
  state.products.get("product").batch_id = "other-batch";
  await assert.rejects(updates.product());
  assert.equal(state.products.get("product").image_path, "old-product");
  assert.equal(state.objects.size, 0);
});

test("supported MIME types and the exact 5 MB boundary are accepted", async () => {
  const batch = input();
  batch.coverFile = photo("image/jpeg", 5 * 1024 * 1024);
  batch.galleryFiles = [photo("image/gif")];
  batch.products[0].imageFile = photo("image/webp");
  await api.createBatch(batch);
  assert.ok(state.events[0].path.endsWith(".jpg"));
  assert.ok(state.events[1].path.endsWith(".gif"));
  assert.ok(state.events[2].path.endsWith(".webp"));
});

test("legacy catalog DTOs expose empty strings for missing cover and product paths", async () => {
  const reader = await createServer({
    configFile: false,
    envDir: false,
    resolve: {
      alias: [
        {
          find: /^@\/lib\/supabase$/,
          replacement: fileURLToPath(new URL("./fixtures/AppDataClient.ts", import.meta.url)),
        },
        { find: "@", replacement: fileURLToPath(new URL("../src", import.meta.url)) },
      ],
    },
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  try {
    const oldFixture = await reader.ssrLoadModule("/tests/fixtures/AppDataClient.ts");
    oldFixture.configureAppDataFixture("Seller");
    const oldApi = await reader.ssrLoadModule("/src/services/kargoApi.ts");
    const result = await oldApi.loadCurrentAppData();
    assert.equal(result.batches[0].coverImage, "");
    assert.equal(result.batches[0].products[0].imageUrl, "");
  } finally {
    await reader.close();
  }
});

for (const role of ["Buyer", "Seller"]) {
  for (const fallback of [false, true]) {
    for (const catalog of ["absent", "stale"]) {
      test(`${role} image DTOs use product relations with ${catalog} catalog and fallback=${fallback}`, async () => {
        const { requests, imagePath } = fixture.configureProductImageReadFixture(role, {
          fallback,
          catalog,
        });
        const result = await api.loadCurrentAppData();
        const expected = `https://kargo.test/storage/v1/object/public/batch-media/${imagePath}`;
        assert.equal(result.claims[0].imageUrl, expected);
        if (role === "Buyer") {
          for (const rows of [
            result.toPay,
            result.orders,
            result.payHistory,
            result.waitlist,
            result.fulfillment,
          ]) {
            assert.equal(rows[0].imageUrl, expected);
          }
          const waitlistRead = requests.find(
            (url) =>
              url.pathname.endsWith("/waitlist_entries") &&
              url.searchParams.get("select")?.startsWith("id,"),
          );
          assert.match(waitlistRead.searchParams.get("select"), /batch_products\([^)]*image_path/);
        } else {
          const submissions = await api.loadSellerPaymentSubmissions();
          assert.equal(submissions[0].imageUrl, expected);
        }
        const paymentReads = requests.filter((url) => /\/(orders|payments)$/.test(url.pathname));
        for (const url of paymentReads) {
          assert.match(url.searchParams.get("select"), /batch_products\([^)]*image_path/);
        }
        assert.equal(paymentReads.length, (role === "Buyer" ? 1 : 2) * (fallback ? 2 : 1));
        if (fallback) {
          for (const url of paymentReads.filter((_, index) => index % 2 === 1)) {
            assert.doesNotMatch(url.searchParams.get("select"), /combined_delivery/);
          }
        }
      });
    }
  }
}
for (const waitlistArray of [false, true]) {
  test(`waitlist photos survive missing catalog with array relationship=${waitlistArray}`, async () => {
    fixture.configureProductImageReadFixture("Buyer", { waitlistArray });
    const result = await api.loadCurrentAppData();
    assert.match(result.waitlist[0].imageUrl, /seller\/closed\/product.png$/);
    assert.equal(result.waitlist[0].product, "Closed batch product");
    assert.equal(result.waitlist[0].amount, 110);
  });
}
test("legacy null product images remain empty strings across order and payment DTOs", async () => {
  fixture.configureProductImageReadFixture("Buyer", { imagePath: null });
  const result = await api.loadCurrentAppData();
  for (const rows of [
    result.claims,
    result.toPay,
    result.orders,
    result.payHistory,
    result.waitlist,
    result.fulfillment,
  ]) {
    assert.equal(rows[0].imageUrl, "");
  }
  fixture.configureProductImageReadFixture("Seller", { imagePath: null });
  assert.equal((await api.loadSellerPaymentSubmissions())[0].imageUrl, "");
});
test("combined payment history and seller submissions use their nested product photo", async () => {
  fixture.configureProductImageReadFixture("Buyer", { combined: true });
  const result = await api.loadCurrentAppData();
  assert.match(result.payHistory[0].imageUrl, /seller\/closed\/combined.png$/);
  fixture.configureProductImageReadFixture("Seller", { combined: true });
  assert.match(
    (await api.loadSellerPaymentSubmissions())[0].imageUrl,
    /seller\/closed\/combined.png$/,
  );
});
