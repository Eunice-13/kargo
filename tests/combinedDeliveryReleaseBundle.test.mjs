import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
const base = new URL("../supabase/release-bundles/combined-delivery/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("manifest.json", base)));
test("release delta bundle has unique ordered versions, exact reviewed sources and no historical replay", () => {
  assert.equal(manifest.migrations.length, 7);
  assert.equal(new Set(manifest.migrations.map((m) => m.version)).size, 7);
  assert.deepEqual(
    manifest.migrations.map((m) => m.version),
    manifest.migrations.map((m) => m.version).sort(),
  );
  assert.equal(manifest.capturedHistory.length, 26);
  for (const m of manifest.migrations) {
    assert.ok(!manifest.capturedHistory.some((h) => h.version === m.version));
    const shipped = readFileSync(new URL("migrations/" + m.file, base));
    const source = readFileSync(
      new URL(
        "../supabase/migrations (to update profile database name)/" + m.source,
        import.meta.url,
      ),
    );
    assert.deepEqual(shipped, source);
    assert.equal(createHash("sha256").update(shipped).digest("hex"), m.sha256);
  }
  assert.equal(readdirSync(new URL("migrations/", base)).length, 7);
});
test("all four legacy collisions are classified without pretending their changes were deployed", () => {
  assert.equal(manifest.collisions.length, 4);
  for (const c of manifest.collisions) {
    assert.equal(c.files.length, 2);
    for (const f of c.files) {
      assert.ok(f.disposition);
      assert.equal(f.sha256.length, 64);
    }
  }
  assert.equal(manifest.status, "prepared-only-not-production-approved");
});
