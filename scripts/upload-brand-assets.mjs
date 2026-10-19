// Upload the KARGO email brand assets to the public `brand-assets` bucket.
//
//   node scripts/upload-brand-assets.mjs
//
// The email templates use the public app asset directly. This helper keeps a
// backup copy in Supabase Storage for other consumers and disaster recovery.

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

function loadEnv() {
  const env = {}
  try {
    for (const line of readFileSync(path.join(root, ".env.local"), "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "")
    }
  } catch {}
  return { ...env, ...process.env }
}

const env = loadEnv()
const URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL
const SERVICE_KEY = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) in .env.local.")
  process.exit(1)
}

const BUCKET = "brand-assets"
const ASSETS = ["kargo-logo-head.png", "kargo-logo.png"]
const admin = createClient(URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })

const { error: bucketError } = await admin.storage.createBucket(BUCKET, {
  public: true,
  fileSizeLimit: 1048576,
  allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"],
})
// The migration already creates the bucket; "already exists" is the happy path.
if (bucketError && !/already exists|duplicate/i.test(bucketError.message)) {
  console.error(`Could not ensure the ${BUCKET} bucket: ${bucketError.message}`)
  process.exit(1)
}

for (const name of ASSETS) {
  const file = path.join(root, "public", name)
  let bytes
  try {
    bytes = readFileSync(file)
  } catch {
    console.warn(`skip  ${name} (not found in public/)`)
    continue
  }

  const { error } = await admin.storage.from(BUCKET).upload(name, bytes, {
    contentType: "image/png",
    cacheControl: "86400",
    upsert: true,
  })
  if (error) {
    console.error(`fail  ${name}: ${error.message}`)
    process.exitCode = 1
    continue
  }

  const { data } = admin.storage.from(BUCKET).getPublicUrl(name)
  const response = await fetch(data.publicUrl).catch(() => null)
  const reachable = response?.ok ? `HTTP ${response.status}` : "not reachable yet"
  console.log(`ok    ${name}  ${(bytes.length / 1024).toFixed(1)} KB  ${reachable}`)
  console.log(`      ${data.publicUrl}`)
}

console.log("")
console.log(`Banner mark: ${URL.replace(/\/$/, "")}/storage/v1/object/public/${BUCKET}/kargo-logo-head.png`)
console.log("Email templates continue to use the canonical public app asset.")
