import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";
let server, api, fixture;
before(async () => {
  server = await createServer({
    configFile: false,
    envFile: false, // Tests must never load production environment files.
    resolve: {
      alias: [
        {
          find: "@/lib/supabase",
          replacement: fileURLToPath(new URL("./fixtures/AppDataClient.ts", import.meta.url)),
        },
        { find: "@", replacement: fileURLToPath(new URL("../src", import.meta.url)) },
      ],
    },
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  fixture = await server.ssrLoadModule("/tests/fixtures/AppDataClient.ts");
  api = await server.ssrLoadModule("/src/services/kargoApi.ts");
});
after(async () => {
  await server?.close();
});
for (const role of ["Buyer", "Seller"]) {
  for (const error of [
    undefined,
    {
      code: "PGRST200",
      message: "Could not find relationship combined_delivery_payment_reservations",
    },
    { code: "42703", message: "column payments.combined_delivery_group_id does not exist" },
  ]) {
    test(`${role} complete app loader preserves catalog with ${error?.code ?? "available schema"}`, async () => {
      const requests = fixture.configureAppDataFixture(role, error);
      const result = await api.loadCurrentAppData();
      assert.equal(result.user.role, role);
      assert.equal(result.batches.length, 1);
      assert.equal(result.batches[0].dbId, "existing-batch");
      assert.equal(result.batches[0].products[0].dbId, "existing-product");
      assert.equal(requests.filter((r) => r.pathname.endsWith("/orders")).length, error ? 2 : 1);
    });
  }
}
for (const failure of [
  { code: "42501", message: "permission denied for orders" },
  { code: "PGRST200", message: "Missing orders/batch_products relationship" },
]) {
  test(`app loader surfaces ${failure.code} instead of reporting a successful empty catalog`, async () => {
    fixture.configureAppDataFixture("Buyer", failure);
    await assert.rejects(api.loadCurrentAppData(), (error) => error.code === failure.code);
  });
}
test("network failure does not become missing-schema fallback or successful empty data", async () => {
  const requests = fixture.configureAppDataFixture("Seller", undefined, true);
  await assert.rejects(api.loadCurrentAppData(), (error) =>
    /Network unavailable/.test(error.message),
  );
  const orderRequests = requests.filter((r) => r.pathname.endsWith("/orders"));
  assert.ok(orderRequests.length >= 1);
  // Supabase may retry transport errors; none may switch to the legacy projection.
  assert.ok(
    orderRequests.every((r) =>
      r.searchParams.get("select").includes("combined_delivery_payment_reservations"),
    ),
  );
});
