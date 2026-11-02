// Read-only local audit. No network requests or database access.
// Run: node --experimental-strip-types scripts/verify-catalog-images.mjs
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BATCHES_INIT } from "../src/data/batches.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const manifest = JSON.parse(
  readFileSync(path.join(root, "docs/catalog-image-sources.json"), "utf8"),
);

function dimensions(bytes) {
  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") {
    for (let offset = 12; offset + 8 <= bytes.length;) {
      const chunk = bytes.toString("ascii", offset, offset + 4);
      const size = bytes.readUInt32LE(offset + 4);
      const data = offset + 8;
      if (chunk === "VP8X") {
        return {
          width: bytes.readUIntLE(data + 4, 3) + 1,
          height: bytes.readUIntLE(data + 7, 3) + 1,
        };
      }
      if (chunk === "VP8 ") {
        assert.equal(bytes.toString("hex", data + 3, data + 6), "9d012a", "Invalid WebP frame");
        return {
          width: bytes.readUInt16LE(data + 6) & 0x3fff,
          height: bytes.readUInt16LE(data + 8) & 0x3fff,
        };
      }
      if (chunk === "VP8L") {
        assert.equal(bytes[data], 0x2f, "Invalid lossless WebP frame");
        const packed = bytes.readUInt32LE(data + 1);
        return { width: (packed & 0x3fff) + 1, height: ((packed >>> 14) & 0x3fff) + 1 };
      }
      offset = data + size + (size % 2);
    }
    throw new Error("WebP has no dimensions");
  }
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  assert.equal(
    bytes.readUInt16BE(0),
    0xffd8,
    "Catalog files must be real JPEG, PNG or WebP images",
  );
  let offset = 2;
  while (offset < bytes.length) {
    assert.equal(bytes[offset++], 0xff, "Invalid JPEG marker");
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    const length = bytes.readUInt16BE(offset);
    assert.ok(length >= 2, "Invalid JPEG segment length");
    if (
      [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(
        marker,
      )
    ) {
      return { width: bytes.readUInt16BE(offset + 5), height: bytes.readUInt16BE(offset + 3) };
    }
    offset += length;
  }
  throw new Error("JPEG has no dimensions");
}

const assetById = new Map();
const paths = new Set();
for (const asset of manifest.assets) {
  assert.ok(!assetById.has(asset.id), `Duplicate asset id: ${asset.id}`);
  assert.ok(!paths.has(asset.path), `Duplicate asset path: ${asset.path}`);
  assert.match(asset.path, /^\/catalog\/(covers|products)\/[a-z0-9-]+\.(jpg|png|webp)$/);
  const absolutePath = path.resolve(root, "public", `.${asset.path}`);
  assert.ok(absolutePath.startsWith(path.resolve(root, "public/catalog") + path.sep));
  const bytes = readFileSync(absolutePath);
  assert.deepEqual(dimensions(bytes), asset.dimensions, `Wrong dimensions: ${asset.path}`);
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    asset.sha256,
    `Changed file: ${asset.path}`,
  );
  assert.ok(asset.sourceDimensions.width >= asset.dimensions.width, `Upscaled source: ${asset.id}`);
  assert.ok(
    asset.sourceDimensions.height >= asset.dimensions.height,
    `Upscaled source: ${asset.id}`,
  );
  for (const key of ["sourcePageUrl", "imageUrl", "downloadUrl"]) {
    assert.equal(new URL(asset[key]).protocol, "https:", `Missing source URL: ${asset.id}/${key}`);
  }
  assert.ok(
    asset.verification && asset.verifiedOn && asset.attribution,
    `Incomplete provenance: ${asset.id}`,
  );
  if (asset.kind === "cover") {
    assert.ok(asset.dimensions.width >= 1200, `Small cover: ${asset.id}`);
    assert.ok(
      Math.abs(asset.dimensions.width / asset.dimensions.height - 2) <= 0.2,
      `Cover must be about 2:1: ${asset.id}`,
    );
  } else {
    assert.equal(asset.kind, "product");
    assert.equal(
      asset.verification.watermarkFree,
      true,
      `Product needs a watermark-free visual check: ${asset.id}`,
    );
    assert.ok(
      asset.dimensions.width >= 600 && asset.dimensions.height >= 600,
      `Small product: ${asset.id}`,
    );
    assert.equal(
      asset.dimensions.width,
      asset.dimensions.height,
      `Product must be square: ${asset.id}`,
    );
  }
  assetById.set(asset.id, asset);
  paths.add(asset.path);
}

function checkEntry(entry, expectedPath, kind) {
  assert.equal(typeof expectedPath, "string", "Image fields must always be strings");
  assert.equal(entry.path, expectedPath, "Seed/manifest image mismatch");
  if (entry.status === "verified") {
    const asset = assetById.get(entry.assetId);
    assert.ok(asset, `Unknown asset: ${entry.assetId}`);
    assert.equal(asset.kind, kind);
    assert.equal(asset.path, entry.path);
    assert.ok(entry.verification, "Each mapped entry needs its verification explanation");
  } else {
    assert.equal(entry.status, "needs manual image");
    assert.equal(entry.path, "");
    assert.equal(entry.assetId, null);
    assert.ok(entry.reason, "Missing images need a specific reason");
  }
}

const covers = new Map(manifest.covers.map((entry) => [entry.batchId, entry]));
assert.equal(covers.size, manifest.covers.length, "Duplicate cover entries");
assert.equal(covers.size, BATCHES_INIT.length, "Audit must include every batch");
const productNames = new Set(
  BATCHES_INIT.flatMap((batch) => batch.products.map((product) => product.name)),
);
const products = new Map(manifest.products.map((entry) => [entry.name, entry]));
assert.equal(products.size, manifest.products.length, "Duplicate product entries");
assert.equal(products.size, productNames.size, "Audit must include every unique product");
const productPhotos = new Map();
for (const batch of BATCHES_INIT) {
  const cover = covers.get(batch.id);
  assert.ok(cover, `Unaudited batch: ${batch.id}`);
  assert.equal(cover.title, batch.title);
  checkEntry(cover, batch.coverImage, "cover");
  for (const product of batch.products) {
    const entry = products.get(product.name);
    assert.ok(entry, `Unaudited product: ${product.name}`);
    assert.ok(
      entry.batchIds.includes(batch.id),
      `Missing product occurrence: ${product.name}/${batch.id}`,
    );
    checkEntry(entry, product.imageUrl, "product");
    if (entry.path) {
      const asset = assetById.get(entry.assetId);
      for (const identity of [entry.path, asset.imageUrl, asset.sha256]) {
        assert.ok(
          !productPhotos.has(identity) || productPhotos.get(identity) === product.name,
          `Different named products share a photograph: ${product.name}`,
        );
        productPhotos.set(identity, product.name);
      }
    }
  }
}
for (const name of productNames) {
  assert.deepEqual(
    products.get(name).batchIds,
    BATCHES_INIT.filter((batch) => batch.products.some((product) => product.name === name)).map(
      (batch) => batch.id,
    ),
  );
}
const count = (entries) => ({
  verified: entries.filter((entry) => entry.status === "verified").length,
  missing: entries.filter((entry) => entry.status === "needs manual image").length,
});
const actualCounts = {
  batches: BATCHES_INIT.length,
  uniqueProducts: productNames.size,
  productOccurrences: BATCHES_INIT.reduce((sum, batch) => sum + batch.products.length, 0),
  covers: count(manifest.covers),
  products: count(manifest.products),
  localFiles: manifest.assets.length,
};
assert.deepEqual(manifest.counts, actualCounts, "Manifest counts are stale");
console.log(JSON.stringify(actualCounts, null, 2));
console.log(
  "PASS: complete seed coverage, explicit missing strings, provenance, local bytes, dimensions, hashes, and product-photo uniqueness",
);
