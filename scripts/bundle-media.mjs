// Bundles every remote image the app can show into public/media, then writes a
// lookup table (src/data/mediaManifest.ts) so the app renders local copies.
//
// Why: batch pictures live in Supabase Storage or on third-party sites. Some of
// those hosts block hotlinking (the Orchard Road cover returns 403 to browsers),
// and a copy running from a flash drive may have no Supabase credentials or no
// internet at all. With this manifest the same photos load from the bundle.
//
// Usage: pnpm bundle:media   (safe to re-run; already-downloaded files are kept)

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, "public", "media");
const MANIFEST_FILE = path.join(ROOT, "src", "data", "mediaManifest.ts");
const BUCKET = "batch-media";
const CONCURRENCY = 6;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function readEnv() {
  const file = path.join(ROOT, ".env.local");
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(file, "utf8")
      .split(/\r?\n/)
      .filter((line) => line && !line.trim().startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
      }),
  );
}

const EXT_BY_TYPE = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/avif": ".avif",
  "image/svg+xml": ".svg",
};

function extensionFor(url, contentType) {
  const fromType = EXT_BY_TYPE[(contentType ?? "").split(";")[0].trim().toLowerCase()];
  if (fromType) return fromType;
  const fromUrl = path.extname(new URL(url).pathname).toLowerCase();
  return /^\.(jpe?g|png|webp|gif|avif|svg)$/.test(fromUrl) ? fromUrl : ".jpg";
}

function fileNameFor(source) {
  return crypto.createHash("sha1").update(source).digest("hex").slice(0, 20);
}

async function fetchImage(url, referer) {
  const headers = { "user-agent": UA, accept: "image/*,*/*;q=0.8" };
  if (referer) headers.referer = referer;

  const response = await fetch(url, { headers, redirect: "follow" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const type = response.headers.get("content-type") ?? "";
  if (!type.startsWith("image/")) throw new Error(`not an image (${type})`);
  return { buffer: Buffer.from(await response.arrayBuffer()), type };
}

/** Collects every remote image source the app knows about. */
function collectSources(env) {
  const sources = new Set();

  // 1. Seed data, constants and the product thumbnail table.
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
        walk(full);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(entry.name)) continue;
      const text = fs.readFileSync(full, "utf8");
      for (const match of text.matchAll(/https?:\/\/[^\s"'`)]+/g)) {
        const url = match[0].replace(/\\$/, "");
        // Skip template literals — their `${...}` parts are not real URLs.
        if (/[${}]/.test(url)) continue;
        // Skip obvious non-image links (social profiles, app URLs, maps).
        if (/\/(facebook|instagram)\.com|kargo-psi|maps\.google|photon\.komoot|tile\.openstreetmap/.test(url)) {
          continue;
        }
        sources.add(url);
      }
    }
  };
  walk(path.join(ROOT, "src", "data"));
  walk(path.join(ROOT, "src", "constants"));
  walk(path.join(ROOT, "src", "components", "shared"));

  // Seed covers and product photos are assembled from id arrays at runtime, so
  // the literal scanner above only sees the template. Expand the real URLs.
  const seedFile = path.join(ROOT, "src", "data", "batches.ts");
  if (fs.existsSync(seedFile)) {
    const text = fs.readFileSync(seedFile, "utf8");
    for (const name of ["BATCH_COVER_IMAGE_IDS", "PRODUCT_IMAGE_IDS"]) {
      const start = text.indexOf(`const ${name}`);
      if (start === -1) continue;
      const end = text.indexOf("] as const", start);
      const segment = text.slice(start, end === -1 ? undefined : end);
      for (const match of segment.matchAll(/"(\d+-[0-9a-f]+)"/g)) {
        sources.add(
          `https://images.unsplash.com/photo-${match[1]}?w=1200&h=800&fit=crop&auto=format`,
        );
      }
    }
  }

  return sources;
}

async function collectDatabaseSources(env) {
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const extra = new Set();
  const storagePaths = new Set();

  if (!url || !key) {
    console.warn("[bundle-media] No Supabase credentials; bundling seed images only.");
    return { extra, storagePaths };
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: catalog, error } = await supabase.from("batch_catalog").select("*");
  if (error) throw error;

  for (const row of catalog ?? []) {
    for (const value of [
      row.batch_cover_path,
      row.product_image_path,
      ...(row.batch_gallery_paths ?? []),
    ]) {
      if (!value) continue;
      if (/^https?:/i.test(value)) extra.add(value);
      else storagePaths.add(value);
    }
  }

  const { data: products } = await supabase.from("batch_products").select("image_path");
  for (const row of products ?? []) {
    if (!row.image_path) continue;
    if (/^https?:/i.test(row.image_path)) extra.add(row.image_path);
    else storagePaths.add(row.image_path);
  }

  console.log(
    `[bundle-media] Database: ${extra.size} external links, ${storagePaths.size} storage objects.`,
  );
  return { extra, storagePaths, supabase };
}

async function main() {
  const env = readEnv();
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });

  const external = collectSources(env);
  const db = await collectDatabaseSources(env);
  for (const value of db.extra) external.add(value);

  const manifest = {};
  const jobs = [];

  const queue = (source, resolver) => jobs.push({ source, resolver });

  for (const source of external) {
    if (/^(?:data|blob):/i.test(source)) continue;
    queue(source, async () => {
      const url = new URL(source);
      return fetchImage(source, `${url.protocol}//${url.host}/`);
    });
  }

  const storage = db.storagePaths;
  if (db.supabase && storage.size) {
    for (const objectPath of storage) {
      queue(objectPath, async () => {
        const { data, error } = await db.supabase.storage
          .from(BUCKET)
          .createSignedUrl(objectPath, 120);
        if (error) throw error;
        const { buffer, type } = await fetchImage(data.signedUrl);
        // Map both the storage path and the public URL the app would build.
        const publicUrl = db.supabase.storage.from(BUCKET).getPublicUrl(objectPath).data.publicUrl;
        return { buffer, type, aliases: [objectPath, publicUrl] };
      });
    }
  }

  let done = 0;
  let failed = 0;
  const failures = [];

  const worker = async () => {
    for (;;) {
      const job = jobs.shift();
      if (!job) return;
      const base = fileNameFor(job.source);
      try {
        const { buffer, type, aliases } = await job.resolver();
        const name = `${base}${extensionFor(job.source, type)}`;
        const target = path.join(PUBLIC_DIR, name);
        if (!fs.existsSync(target)) fs.writeFileSync(target, buffer);
        const relative = `media/${name}`;
        manifest[job.source] = relative;
        for (const alias of aliases ?? []) manifest[alias] = relative;
        done += 1;
        if (done % 20 === 0) console.log(`[bundle-media] downloaded ${done}/${done + jobs.length}`);
      } catch (error) {
        failed += 1;
        failures.push(`${job.source} — ${error.message}`);
      }
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
  const body = `// AUTO-GENERATED by scripts/bundle-media.mjs — do not edit by hand.
// Remote image (or Supabase storage path) -> bundled file under public/.
export const MEDIA_MANIFEST: Record<string, string> = ${JSON.stringify(sorted, null, 2)};
`;
  fs.writeFileSync(MANIFEST_FILE, body);

  console.log(`[bundle-media] bundled ${done} images, ${failed} failed.`);
  if (failures.length) console.log(failures.join("\n"));
}

await main();
