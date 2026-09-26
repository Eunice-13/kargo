// ─── One-off: sync batches.category to the new 5-category taxonomy ───────────
//
// Non-destructive. Only rewrites the `category` text on existing batch rows —
// it does NOT delete or recreate any batches, orders, payments, or users.
//
//   Grocery & Snacks -> Food
//   Skincare         -> Beauty
//   Mixed            -> Others
//
// New Apparel batches are added by the normal seed (`node scripts/seed-supabase.mjs`),
// which inserts any batch title that doesn't already exist.
//
// USAGE:
//   node scripts/sync-categories.mjs           # show current category counts, then remap
//   node scripts/sync-categories.mjs --dry-run  # only show counts, make no changes

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

function loadEnv() {
  const env = {}
  try {
    for (const line of readFileSync(path.join(root, ".env.local"), "utf8").split(
      /\r?\n/,
    )) {
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
  console.error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local.")
  process.exit(1)
}

const DRY_RUN = process.argv.includes("--dry-run")

const admin = createClient(URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const REMAP = {
  "Grocery & Snacks": "Food",
  Skincare: "Beauty",
  Mixed: "Others",
}

const DOMAIN = "kargo.demo"
const emailFor = (k) => `${k}@${DOMAIN}`

// New Apparel batches. Inserted directly via the admin client (bypasses RLS),
// mirroring the shape ensureMissingBatches() writes. Idempotent: skipped if a
// batch with the same seller + title already exists.
const APPAREL_BATCHES = [
  {
    seller: "maria",
    title: "Tokyo Streetwear Drop — April 2027",
    category: "Apparel",
    startsOn: "2027-04-14",
    endsOn: "2027-04-22",
    createdAt: "2026-09-26T04:00:00+08:00",
    reservationHours: 40,
    products: [
      { name: "Uniqlo U Collection Tee", base: 720, markup: 170, qty: 18 },
      { name: "GU Wide Trousers", base: 980, markup: 220, qty: 12 },
    ],
  },
  {
    seller: "ana",
    title: "Seoul Fashion Week Finds — May 2027",
    category: "Apparel",
    startsOn: "2027-05-05",
    endsOn: "2027-05-14",
    createdAt: "2026-09-26T05:00:00+08:00",
    reservationHours: 48,
    products: [
      { name: "Korean Oversized Knit", base: 1100, markup: 250, qty: 16 },
      { name: "Musinsa Cargo Pants", base: 1350, markup: 300, qty: 10 },
    ],
  },
  {
    seller: "kristine",
    title: "Bangkok Thrift Haul — May 2027",
    category: "Apparel",
    startsOn: "2027-05-18",
    endsOn: "2027-05-25",
    createdAt: "2026-09-26T06:00:00+08:00",
    reservationHours: 36,
    products: [
      { name: "Chatuchak Vintage Denim", base: 950, markup: 230, qty: 20 },
      { name: "Platinum Mall Graphic Tee", base: 480, markup: 120, qty: 24 },
    ],
  },
]

async function sellerIdByKey(key) {
  const email = emailFor(key)
  // page through auth users to find the id by email
  let page = 1
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error(`listUsers: ${error.message}`)
    const found = data.users.find((u) => u.email === email)
    if (found) return found.id
    if (data.users.length < 200) return null
    page += 1
  }
}

async function insertApparel() {
  const { data: existing, error: exErr } = await admin
    .from("batches")
    .select("seller_id,title")
  if (exErr) throw new Error(`existing lookup: ${exErr.message}`)
  const existingTitles = new Set((existing ?? []).map((b) => b.title))

  for (const def of APPAREL_BATCHES) {
    if (existingTitles.has(def.title)) {
      console.log(`  skip (exists): ${def.title}`)
      continue
    }
    const sellerId = await sellerIdByKey(def.seller)
    if (!sellerId) {
      console.log(`  skip (no seller ${def.seller}): ${def.title}`)
      continue
    }
    const { data: batch, error: bErr } = await admin
      .from("batches")
      .insert({
        seller_id: sellerId,
        title: def.title,
        status: "live",
        starts_on: def.startsOn,
        ends_on: def.endsOn,
        category: def.category,
        reservation_hours: def.reservationHours,
        notes: def.notes ?? null,
        created_at: def.createdAt,
      })
      .select("id")
      .single()
    if (bErr) throw new Error(`insert batch ${def.title}: ${bErr.message}`)

    const { error: pErr } = await admin.from("batch_products").insert(
      def.products.map((p) => ({
        batch_id: batch.id,
        name: p.name,
        base_price: p.base,
        markup: p.markup,
        quantity_total: p.qty,
      })),
    )
    if (pErr) throw new Error(`insert products ${def.title}: ${pErr.message}`)
    console.log(`  added: ${def.title} (${def.products.length} products)`)
  }
}

async function counts() {
  const { data, error } = await admin.from("batches").select("category")
  if (error) throw new Error(`count query: ${error.message}`)
  const c = {}
  for (const row of data) c[row.category] = (c[row.category] ?? 0) + 1
  return c
}

async function main() {
  console.log("Before:", await counts())

  if (DRY_RUN) {
    console.log("--dry-run: no changes made.")
    return
  }

  for (const [from, to] of Object.entries(REMAP)) {
    const { data, error } = await admin
      .from("batches")
      .update({ category: to })
      .eq("category", from)
      .select("id")
    if (error) throw new Error(`update ${from}->${to}: ${error.message}`)
    console.log(`  ${from} -> ${to}: ${data.length} row(s)`)
  }

  console.log("Inserting Apparel batches:")
  await insertApparel()

  console.log("After:", await counts())
  console.log("Done.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
