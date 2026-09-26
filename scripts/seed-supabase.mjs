// ─── KARGO live Supabase seed (Option A: authenticated, via real RPCs) ───────

//

// Populates the LIVE Supabase database with realistic PH-context demo data by

// driving the SAME code paths the app uses:

//   - service-role: create Auth users + set profiles (incl. bir_status)

//   - each seller (signed in, anon key): insert batches/products, payment

//     methods, address — exactly what `authenticated` is granted

//   - each buyer (signed in): claim_batch_product RPC, submit_order_payment RPC

//   - sellers (signed in): review_order_payment + set_fulfillment_status RPCs

//

// This respects RLS and the transactional RPCs, so seeded data is guaranteed

// consistent with what the app expects. No schema changes required.

//

// SECURITY: SUPABASE_SECRET_KEY (service role) is used ONLY to create users and

// set the seller BIR flag (a field authenticated users cannot set). All domain

// data is written as the authenticated user who owns it. Run locally only.

//

// USAGE:

//   node scripts/seed-supabase.mjs           # idempotent create/insert

//   node scripts/seed-supabase.mjs --reset    # remove demo domain data, then seed

import { readFileSync } from "node:fs"

import { fileURLToPath } from "node:url"

import path from "node:path"

import { createClient } from "@supabase/supabase-js"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

function loadEnv() {
  const env = {}

  try {
    for (const line of readFileSync(
      path.join(root, ".env.local"),
      "utf8",
    ).split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)

      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "")
    }
  } catch {}

  return { ...env, ...process.env }
}

const env = loadEnv()

const URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL

const SERVICE_KEY = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY

const ANON_KEY =
  env.SUPABASE_PUBLISHABLE_KEY ||
  env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  env.VITE_SUPABASE_ANON_KEY

if (!URL || !SERVICE_KEY || !ANON_KEY) {
  console.error(
    "Missing SUPABASE_URL, SUPABASE_SECRET_KEY, or publishable key in .env.local.",
  )

  process.exit(1)
}

const RESET = process.argv.includes("--reset")
const VALIDATE_ONLY = process.argv.includes("--validate-only")

const PASSWORD = "KargoDemo123!"

const DOMAIN = "kargo.demo"

const emailFor = (k) => `${k}@${DOMAIN}`

const admin = createClient(URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// A fresh authenticated client per user (each holds its own session).

function userClient() {
  return createClient(URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// ── People ───────────────────────────────────────────────────────────────────

const SELLERS = [
  {
    key: "maria",
    name: "Maria Santos",
    shop: "Maria's Japan Finds",
    fb: "https://facebook.com/maria.santos.pasabuy",
  },

  {
    key: "ana",
    name: "Ana Reyes",
    shop: "Seoul Sisters PH",
    fb: "https://facebook.com/ana.reyes.kbeauty",
  },

  {
    key: "paolo",
    name: "Paolo Garcia",
    shop: "Paolo's US Haul",
    fb: "https://facebook.com/paolo.garcia.haul",
  },

  {
    key: "kristine",
    name: "Kristine Aquino",
    shop: "BKK Treats",
    fb: "https://facebook.com/kristine.aquino.bkk",
  },

  {
    key: "jade",
    name: "Jade Bautista",
    shop: "SG Luxe Skincare",
    fb: "https://facebook.com/jade.bautista.sg",
  },
]

const BUYERS = [
  { key: "trisha", name: "Trisha Lim", fb: "https://facebook.com/trisha.lim" },

  {
    key: "carlo",
    name: "Carlo Santos",
    fb: "https://facebook.com/carlo.santos",
  },

  {
    key: "anna",
    name: "Anna Bautista",
    fb: "https://facebook.com/anna.bautista",
  },

  { key: "mia", name: "Mia Cruz", fb: "https://facebook.com/mia.cruz" },

  { key: "ben", name: "Ben Torres", fb: "https://facebook.com/ben.torres" },

  { key: "grace", name: "Grace Reyes", fb: "https://facebook.com/grace.reyes" },
]

const BATCHES = [
  {
    seller: "maria",
    title: "Japan Autumn Finds — October 2026",
    category: "Food",
    startsOn: "2026-10-03",
    endsOn: "2026-10-12",
    createdAt: "2026-09-01T08:15:00+08:00",
    reservationHours: 24,
    notes:
      "Trip runs Oct 3-12. Prices in PHP, include local sourcing. QR/BDO preferred.",

    products: [
      { name: "Tokyo Banana", base: 400, markup: 80, qty: 6 },
      { name: "KitKat Sakura", base: 260, markup: 60, qty: 8 },
      { name: "Shiseido Sunscreen", base: 1450, markup: 200, qty: 4 },
      { name: "Meiji Chocolate", base: 240, markup: 50, qty: 6 },
    ],
  },

  {
    seller: "ana",
    title: "Seoul Skincare Run — October 2026",
    category: "Skincare",
    startsOn: "2026-10-18",
    endsOn: "2026-10-27",
    createdAt: "2026-09-03T10:30:00+08:00",
    reservationHours: 36,

    products: [
      { name: "Laneige Lip Mask", base: 800, markup: 150, qty: 10 },
      { name: "COSRX Snail Cream", base: 650, markup: 130, qty: 8 },
      { name: "Korean Skincare Set", base: 2050, markup: 350, qty: 5 },
      { name: "Paldo Bibimmyeon", base: 320, markup: 60, qty: 8 },
    ],
  },

  {
    seller: "paolo",
    title: "US Holiday Grocery Haul — November 2026",
    category: "Grocery & Snacks",
    startsOn: "2026-11-05",
    endsOn: "2026-11-20",
    createdAt: "2026-09-05T14:10:00+08:00",
    reservationHours: 48,

    products: [
      { name: "Trader Joe's Snacks", base: 1000, markup: 200, qty: 10 },
      { name: "Muji Skincare", base: 740, markup: 150, qty: 8 },
    ],
  },

  {
    seller: "kristine",
    title: "Bangkok Market Mix — November 2026",
    category: "Mixed",
    startsOn: "2026-11-12",
    endsOn: "2026-11-19",
    createdAt: "2026-09-07T09:45:00+08:00",
    reservationHours: 60,
    notes: "Snacks and skincare. OOS items refunded within 48h.",

    products: [
      { name: "Thai Snack Box", base: 540, markup: 110, qty: 10 },
      { name: "Mistine Sunscreen", base: 350, markup: 70, qty: 10 },
    ],
  },

  {
    seller: "jade",
    title: "Singapore Skincare Edit — December 2026",
    category: "Skincare",
    startsOn: "2026-12-02",
    endsOn: "2026-12-10",
    createdAt: "2026-09-10T11:20:00+08:00",
    reservationHours: 72,

    products: [
      { name: "SK-II Essence", base: 4100, markup: 700, qty: 6 },
      { name: "Hada Labo Serum", base: 650, markup: 130, qty: 8 },
      { name: "Innisfree Sheet Mask", base: 320, markup: 70, qty: 5 },
    ],
  },

  {
    seller: "maria",
    title: "Australia Snack Run — December 2026",
    category: "Grocery & Snacks",
    startsOn: "2026-12-14",
    endsOn: "2026-12-23",
    createdAt: "2026-09-12T16:05:00+08:00",
    reservationHours: 30,

    products: [
      { name: "Tim Tam Assorted", base: 600, markup: 120, qty: 8 },
      { name: "Aesop Hand Cream", base: 2200, markup: 400, qty: 6 },
    ],
  },
  {
    seller: "jade",
    title: "Hong Kong Beauty Run — January 2027",
    category: "Beauty",
    startsOn: "2027-01-08",
    endsOn: "2027-01-14",
    createdAt: "2026-09-14T13:40:00+08:00",
    reservationHours: 42,
    products: [
      { name: "Charlotte Tilbury Set", base: 2800, markup: 420, qty: 8 },
      { name: "Rare Beauty Blush", base: 1350, markup: 250, qty: 8 },
    ],
  },
  {
    seller: "paolo",
    title: "Dubai Luxury Edit — January 2027",
    category: "Luxury",
    startsOn: "2027-01-20",
    endsOn: "2027-01-29",
    createdAt: "2026-09-16T15:25:00+08:00",
    reservationHours: 54,
    products: [
      { name: "Nars Blush", base: 2450, markup: 350, qty: 6 },
      { name: "MAC Lipstick Set", base: 2750, markup: 450, qty: 6 },
    ],
  },
  {
    seller: "kristine",
    title: "Taiwan Night Market Finds — October 2026",
    category: "Food",
    startsOn: "2026-10-25",
    endsOn: "2026-11-02",
    createdAt: "2026-09-18T12:00:00+08:00",
    reservationHours: 28,
    products: [
      { name: "Pineapple Cake Box", base: 480, markup: 80, qty: 12 },
      { name: "Dr. Wu Serum", base: 920, markup: 180, qty: 8 },
    ],
  },
  {
    seller: "ana",
    title: "Paris Beauty Edit — February 2027",
    category: "Beauty",
    startsOn: "2027-02-03",
    endsOn: "2027-02-12",
    createdAt: "2026-09-20T08:50:00+08:00",
    reservationHours: 66,
    products: [
      { name: "French Pharmacy Set", base: 1800, markup: 300, qty: 8 },
      { name: "Bioderma Duo", base: 1100, markup: 180, qty: 10 },
    ],
  },
  {
    seller: "maria",
    title: "London Luxury Finds — February 2027",
    category: "Luxury",
    startsOn: "2027-02-15",
    endsOn: "2027-02-24",
    createdAt: "2026-09-22T17:15:00+08:00",
    reservationHours: 40,
    products: [
      { name: "Jo Malone Mini Set", base: 3600, markup: 600, qty: 6 },
      { name: "Liberty Beauty Box", base: 4200, markup: 650, qty: 5 },
    ],
  },
  {
    seller: "jade",
    title: "Vietnam Market Mix — November 2026",
    category: "Mixed",
    startsOn: "2026-11-25",
    endsOn: "2026-12-02",
    createdAt: "2026-09-24T10:05:00+08:00",
    reservationHours: 52,
    products: [
      { name: "Vietnamese Coffee Set", base: 520, markup: 100, qty: 10 },
      { name: "Herbal Skincare Kit", base: 760, markup: 140, qty: 8 },
    ],
  },
]

const PAYMENT_METHODS = [
  {
    seller: "maria",
    method: "GCash",
    acctName: "Maria S. Santos",
    acctNum: "0917-555-1201",
  },

  {
    seller: "maria",
    method: "Bank Transfer",
    acctName: "Maria Santos",
    acctNum: "BDO-0044-2201",
  },

  {
    seller: "ana",
    method: "Maya",
    acctName: "Ana R. Reyes",
    acctNum: "0918-555-3302",
  },

  {
    seller: "paolo",
    method: "GCash",
    acctName: "Paolo Garcia",
    acctNum: "0919-555-4410",
  },

  {
    seller: "kristine",
    method: "GCash",
    acctName: "Kristine Aquino",
    acctNum: "0917-555-6650",
  },

  {
    seller: "jade",
    method: "Bank Transfer",
    acctName: "Jade Bautista",
    acctNum: "BPI-9921-8830",
  },
]

const ADDRESSES = [
  {
    user: "trisha",
    label: "Home",
    line: "12 Mabini St., Brgy. San Antonio",
    city: "Mandaluyong City",
  },

  {
    user: "carlo",
    label: "Home",
    line: "88 Katipunan Ave.",
    city: "Marikina City",
  },

  {
    user: "anna",
    label: "Office",
    line: "5F Ayala Tower, Brgy. San Lorenzo",
    city: "Makati City",
  },

  {
    user: "mia",
    label: "Home",
    line: "23 Sampaguita St.",
    city: "Caloocan City",
  },

  {
    user: "maria",
    label: "Meetup",
    line: "Trinoma Mall, North Ave.",
    city: "Quezon City",
  },
]

// Orders drive claims/payments/fulfillment. `advance` is the final state we want.

//   pending           → claim only

//   submitted         → claim + buyer submits payment (pending review)

//   confirmed         → + seller verifies payment

//   preparing         → + seller sets Preparing

//   completed         → + seller sets Completed

//   insufficient      → buyer pays a partial amount, seller verifies (→ insufficient_payment)

//   cancelled         → buyer cancels

// Buyer requests (sourcing asks) → create_buyer_request RPC.

const BUYER_REQUESTS = [
  {
    buyer: "trisha",
    seller: "maria",
    batch: "Japan Autumn Finds — October 2026",
    product: "Royce Nama Chocolate",
    qty: 2,
    message: "Any chance you can add Royce Nama (matcha)? Would claim 2.",
  },

  {
    buyer: "carlo",
    seller: "paolo",
    batch: "US Holiday Grocery Haul — November 2026",
    product: "Costco Vitamins",
    qty: 1,
    message: "Can you source Kirkland vitamins from Costco?",
  },

  {
    buyer: "mia",
    seller: "ana",
    batch: "Seoul Skincare Run — October 2026",
    product: "Beauty of Joseon Sunscreen",
    qty: 3,
    message: "Please add Beauty of Joseon relief sun if there's room.",
  },

  {
    buyer: "grace",
    seller: "jade",
    batch: "Singapore Skincare Edit — December 2026",
    product: "Charles & Keith Bag",
    qty: 1,
    message: "Open to a C&K crossbody if you pass by the outlet?",
  },
]

// Waitlist joins (for sold-out / popular products) → direct insert as buyer.

const WAITLIST = [
  { buyer: "ben", seller: "jade", product: "SK-II Essence" },

  { buyer: "grace", seller: "ana", product: "Laneige Lip Mask" },

  { buyer: "mia", seller: "maria", product: "Shiseido Sunscreen" },

  { buyer: "trisha", seller: "paolo", product: "Nars Blush" },

  { buyer: "carlo", seller: "kristine", product: "Pineapple Cake Box" },

  { buyer: "anna", seller: "maria", product: "Jo Malone Mini Set" },
]

const ORDERS = [
  {
    buyer: "trisha",
    seller: "ana",
    product: "Laneige Lip Mask",
    qty: 2,
    advance: "pending",
  },

  {
    buyer: "grace",
    seller: "ana",
    product: "COSRX Snail Cream",
    qty: 2,
    advance: "submitted",
    method: "Maya",
  },

  {
    buyer: "carlo",
    seller: "paolo",
    product: "Trader Joe's Snacks",
    qty: 3,
    advance: "confirmed",
    method: "GCash",
  },

  {
    buyer: "anna",
    seller: "maria",
    product: "Shiseido Sunscreen",
    qty: 1,
    advance: "preparing",
    method: "GCash",
  },

  {
    buyer: "mia",
    seller: "maria",
    product: "Meiji Chocolate",
    qty: 4,
    advance: "completed",
    method: "Bank Transfer",
  },

  {
    buyer: "ben",
    seller: "jade",
    product: "SK-II Essence",
    qty: 1,
    advance: "insufficient",
    method: "Bank Transfer",
    partial: 3800,
  },

  {
    buyer: "trisha",
    seller: "kristine",
    product: "Thai Snack Box",
    qty: 2,
    advance: "submitted",
    method: "GCash",
  },

  {
    buyer: "carlo",
    seller: "jade",
    product: "Hada Labo Serum",
    qty: 1,
    advance: "completed",
    method: "Bank Transfer",
  },

  {
    buyer: "grace",
    seller: "maria",
    product: "KitKat Sakura",
    qty: 3,
    advance: "cancelled",
  },

  {
    buyer: "mia",
    seller: "ana",
    product: "Korean Skincare Set",
    qty: 1,
    advance: "pending",
  },

  {
    buyer: "anna",
    seller: "paolo",
    product: "Muji Skincare",
    qty: 2,
    advance: "confirmed",
    method: "GCash",
  },
  {
    buyer: "ben",
    seller: "ana",
    product: "Laneige Lip Mask",
    qty: 3,
    advance: "confirmed",
    method: "Maya",
  },
  {
    buyer: "grace",
    seller: "paolo",
    product: "Trader Joe's Snacks",
    qty: 2,
    advance: "confirmed",
    method: "GCash",
  },
  {
    buyer: "mia",
    seller: "kristine",
    product: "Mistine Sunscreen",
    qty: 3,
    advance: "confirmed",
    method: "GCash",
  },
  {
    buyer: "anna",
    seller: "jade",
    product: "Innisfree Sheet Mask",
    qty: 4,
    advance: "confirmed",
    method: "Bank Transfer",
  },
  {
    buyer: "trisha",
    seller: "maria",
    product: "Tim Tam Assorted",
    qty: 4,
    advance: "completed",
    method: "GCash",
  },
  {
    buyer: "carlo",
    seller: "maria",
    product: "Aesop Hand Cream",
    qty: 2,
    advance: "confirmed",
    method: "Bank Transfer",
  },
  {
    buyer: "grace",
    seller: "jade",
    product: "Charlotte Tilbury Set",
    qty: 5,
    advance: "completed",
    method: "Bank Transfer",
  },
  {
    buyer: "ben",
    seller: "jade",
    product: "Rare Beauty Blush",
    qty: 4,
    advance: "completed",
    method: "Bank Transfer",
  },
  {
    buyer: "mia",
    seller: "paolo",
    product: "Nars Blush",
    qty: 4,
    advance: "confirmed",
    method: "GCash",
  },
  {
    buyer: "anna",
    seller: "paolo",
    product: "MAC Lipstick Set",
    qty: 4,
    advance: "completed",
    method: "GCash",
  },
  {
    buyer: "carlo",
    seller: "kristine",
    product: "Pineapple Cake Box",
    qty: 9,
    advance: "confirmed",
    method: "GCash",
  },
  {
    buyer: "trisha",
    seller: "kristine",
    product: "Dr. Wu Serum",
    qty: 5,
    advance: "completed",
    method: "GCash",
  },
  {
    buyer: "grace",
    seller: "ana",
    product: "French Pharmacy Set",
    qty: 5,
    advance: "completed",
    method: "Maya",
  },
  {
    buyer: "ben",
    seller: "ana",
    product: "Bioderma Duo",
    qty: 6,
    advance: "confirmed",
    method: "Maya",
  },
  {
    buyer: "mia",
    seller: "maria",
    product: "Jo Malone Mini Set",
    qty: 4,
    advance: "confirmed",
    method: "GCash",
  },
  {
    buyer: "anna",
    seller: "maria",
    product: "Liberty Beauty Box",
    qty: 3,
    advance: "confirmed",
    method: "Bank Transfer",
  },
  {
    buyer: "carlo",
    seller: "jade",
    product: "Vietnamese Coffee Set",
    qty: 6,
    advance: "confirmed",
    method: "Bank Transfer",
  },
  {
    buyer: "trisha",
    seller: "jade",
    product: "Herbal Skincare Kit",
    qty: 4,
    advance: "confirmed",
    method: "Bank Transfer",
  },
]

// ── State ─────────────────────────────────────────────────────────────────────

function validateSeedDefinitions() {
  const allowedCategories = new Set([
    "Food",
    "Skincare",
    "Grocery & Snacks",
    "Beauty",
    "Luxury",
    "Mixed",
  ])
  if (BATCHES.length < 10) throw new Error("At least 10 batches are required")

  const represented = new Set()
  const createdDates = new Set()
  const productToBatch = new Map()
  const claimedByBatch = new Map(BATCHES.map((batch) => [batch.title, 0]))

  for (const batch of BATCHES) {
    if (!allowedCategories.has(batch.category))
      throw new Error(`Invalid category on ${batch.title}: ${batch.category}`)
    if (!batch.createdAt || !batch.startsOn || !batch.endsOn)
      throw new Error(`Missing required dates on ${batch.title}`)
    if (new Date(batch.startsOn) > new Date(batch.endsOn))
      throw new Error(`Invalid trip range on ${batch.title}`)
    if (createdDates.has(batch.createdAt))
      throw new Error(`Duplicate batch creation date: ${batch.createdAt}`)
    if (!batch.products.length)
      throw new Error(`Batch has no products: ${batch.title}`)

    represented.add(batch.category)
    createdDates.add(batch.createdAt)
    for (const product of batch.products) {
      productToBatch.set(`${batch.seller}::${product.name}`, {
        batch: batch.title,
        capacity: product.qty,
        claimed: 0,
      })
    }
  }

  for (const category of allowedCategories) {
    if (!represented.has(category))
      throw new Error(`Missing category: ${category}`)
  }

  for (const order of ORDERS) {
    if (order.advance === "cancelled") continue
    const product = productToBatch.get(`${order.seller}::${order.product}`)
    if (!product)
      throw new Error(`Order references missing product: ${order.product}`)
    product.claimed += order.qty
    if (product.claimed > product.capacity)
      throw new Error(`Seed claims exceed inventory for ${order.product}`)
    claimedByBatch.set(
      product.batch,
      (claimedByBatch.get(product.batch) ?? 0) + order.qty,
    )
  }

  if ([...claimedByBatch.values()].some((claimed) => claimed <= 0))
    throw new Error("Every seeded batch must have at least one active claim")
  if (new Set(claimedByBatch.values()).size < 6)
    throw new Error("Seeded claim totals are not varied enough")

  const activeOrders = ORDERS.filter((order) => order.advance !== "cancelled")
  const paidOrders = activeOrders.filter((order) => order.advance !== "pending")
  const completedOrders = activeOrders.filter(
    (order) => order.advance === "completed",
  )
  const waitlistedBuyers = new Set(WAITLIST.map((entry) => entry.buyer))
  const waitlistedSellers = new Set(WAITLIST.map((entry) => entry.seller))

  for (const buyer of BUYERS) {
    if (!activeOrders.some((order) => order.buyer === buyer.key))
      throw new Error(`Buyer has no claim/order: ${buyer.key}`)
    if (!paidOrders.some((order) => order.buyer === buyer.key))
      throw new Error(`Buyer has no payment: ${buyer.key}`)
    if (!completedOrders.some((order) => order.buyer === buyer.key))
      throw new Error(`Buyer has no completed order for reviews: ${buyer.key}`)
    if (!waitlistedBuyers.has(buyer.key))
      throw new Error(`Buyer has no waitlist entry: ${buyer.key}`)
  }

  for (const seller of SELLERS) {
    if (!activeOrders.some((order) => order.seller === seller.key))
      throw new Error(`Seller has no received order: ${seller.key}`)
    if (!paidOrders.some((order) => order.seller === seller.key))
      throw new Error(`Seller has no received payment: ${seller.key}`)
    if (!completedOrders.some((order) => order.seller === seller.key))
      throw new Error(
        `Seller has no completed order for reviews: ${seller.key}`,
      )
    if (!waitlistedSellers.has(seller.key))
      throw new Error(`Seller has no waitlisted product: ${seller.key}`)
  }

  console.log(
    `Validated ${BATCHES.length} live batches, ${BUYERS.length} covered buyers, and ${SELLERS.length} covered sellers across ${represented.size} categories with ${new Set(claimedByBatch.values()).size} distinct claimed totals.`,
  )
}

const userIds = new Map()

const clients = new Map() // key -> signed-in supabase client

// productId lookup: `${sellerKey}::${productName}` -> uuid

const productIds = new Map()

// batchId lookup: `${sellerKey}::${batchTitle}` -> uuid (for buyer requests)

const batchIds = new Map()

// completed orders captured during seedOrders, for reviews:

//   [{ orderId, buyer, seller, product }]

const completedOrders = []

async function findUserByEmail(email) {
  let page = 1

  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    })

    if (error) throw error

    const hit = data.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase(),
    )

    if (hit) return hit

    if (data.users.length < 200) return null

    page += 1
  }
}

async function ensureUser(person, isSeller) {
  const email = emailFor(person.key)

  let user = await findUserByEmail(email)

  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { display_name: person.name },
    })

    if (error) throw error

    user = data.user

    console.log(`  + ${email}`)
  } else {
    console.log(`  = ${email}`)
  }

  userIds.set(person.key, user.id)

  // service-role profile update (sets bir_status, which authenticated cannot).

  const { error } = await admin
    .from("profiles")
    .update({
      display_name: person.name,

      shop_name: isSeller ? person.shop : null,

      social_links: { Facebook: person.fb },

      bir_status: isSeller ? "verified" : "none",

      bir_checked_at: isSeller ? new Date().toISOString() : null,

      account_status: "active",
    })
    .eq("id", user.id)

  if (error) throw error
}

async function signIn(key) {
  if (clients.has(key)) return clients.get(key)

  const c = userClient()

  const { error } = await c.auth.signInWithPassword({
    email: emailFor(key),
    password: PASSWORD,
  })

  if (error) throw new Error(`sign in ${key}: ${error.message}`)

  clients.set(key, c)

  return c
}

async function reset() {
  console.log("Resetting demo domain data (service-role)…")

  const ids = [...userIds.values()]

  if (!ids.length) return

  const remove = async (table, column) => {
    const { error } = await admin.from(table).delete().in(column, ids)
    if (error) throw new Error(`reset ${table}: ${error.message}`)
  }

  // Delete dependents before their referenced rows. Failing loudly here keeps a
  // partial prior run from silently doubling claims and other engagement data.
  await remove("batch_reactions", "user_id")
  await remove("reviews", "reviewer_id")
  await remove("payments", "submitted_by")
  await remove("waitlist_entries", "buyer_id")
  await remove("buyer_requests", "buyer_id")
  await remove("notifications", "recipient_id")
  await remove("orders", "buyer_id")
  await remove("addresses", "user_id")
  await remove("seller_payment_methods", "seller_id")

  // A non-demo buyer may have claimed an older demo-seller product. Preserve
  // that batch and order; only remove demo batches with no remaining orders.
  const { data: demoBatches, error: demoBatchesError } = await admin
    .from("batches")
    .select("id")
    .in("seller_id", ids)
  if (demoBatchesError)
    throw new Error(`reset batches lookup: ${demoBatchesError.message}`)

  const demoBatchIds = (demoBatches ?? []).map((batch) => batch.id)
  let protectedBatchIds = new Set()
  if (demoBatchIds.length) {
    const { data: demoProducts, error: demoProductsError } = await admin
      .from("batch_products")
      .select("id,batch_id")
      .in("batch_id", demoBatchIds)
    if (demoProductsError)
      throw new Error(`reset products lookup: ${demoProductsError.message}`)

    const batchByProduct = new Map(
      (demoProducts ?? []).map((product) => [product.id, product.batch_id]),
    )
    const productIds = [...batchByProduct.keys()]
    if (productIds.length) {
      const { data: retainedOrders, error: retainedOrdersError } = await admin
        .from("orders")
        .select("batch_product_id")
        .in("batch_product_id", productIds)
      if (retainedOrdersError)
        throw new Error(
          `reset retained orders lookup: ${retainedOrdersError.message}`,
        )
      protectedBatchIds = new Set(
        (retainedOrders ?? []).map((order) =>
          batchByProduct.get(order.batch_product_id),
        ),
      )
    }
  }

  for (const batchId of demoBatchIds) {
    if (protectedBatchIds.has(batchId)) continue
    const { error } = await admin.from("batches").delete().eq("id", batchId)
    if (error) throw new Error(`reset batch ${batchId}: ${error.message}`)
  }

  if (protectedBatchIds.size) {
    console.log(
      `  preserved ${protectedBatchIds.size} demo-seller batch(es) referenced by non-demo orders`,
    )
  }

  console.log("  removed")
}

async function alreadySeeded() {
  // If this seller already has batches, treat as seeded (skip re-inserting).

  const mariaId = userIds.get("maria")

  const { count } = await admin
    .from("batches")
    .select("*", { count: "exact", head: true })
    .eq("seller_id", mariaId)

  return (count ?? 0) > 0
}

async function seedSellerOwned() {
  for (const b of BATCHES) {
    const c = await signIn(b.seller)

    const { data: batch, error } = await c
      .from("batches")
      .insert({
        seller_id: userIds.get(b.seller),

        title: b.title,
        status: "live",
        starts_on: b.startsOn,
        ends_on: b.endsOn,

        category: b.category,
        reservation_hours: b.reservationHours,
        notes: b.notes ?? null,
        created_at: b.createdAt,
      })
      .select("id")
      .single()

    if (error) throw new Error(`batch ${b.title}: ${error.message}`)

    batchIds.set(`${b.seller}::${b.title}`, batch.id)

    const { data: products, error: pErr } = await c
      .from("batch_products")
      .insert(
        b.products.map((p) => ({
          batch_id: batch.id,
          name: p.name,
          base_price: p.base,
          markup: p.markup,
          quantity_total: p.qty,
        })),
      )
      .select("id,name")

    if (pErr) throw new Error(`products ${b.title}: ${pErr.message}`)

    for (const p of products) productIds.set(`${b.seller}::${p.name}`, p.id)

    console.log(`  + batch "${b.title}"`)
  }

  for (const m of PAYMENT_METHODS) {
    const c = await signIn(m.seller)

    const { error } = await c.from("seller_payment_methods").insert({
      seller_id: userIds.get(m.seller),
      method_type: m.method,
      account_name: m.acctName,
      account_number: m.acctNum,
    })

    if (error && !/duplicate key/.test(error.message))
      throw new Error(`pay method ${m.seller}: ${error.message}`)
  }

  console.log(`  + payment methods`)

  for (const a of ADDRESSES) {
    const c = await signIn(a.user)

    if (a.isDefault !== false)
      await c
        .from("addresses")
        .update({ is_default: false })
        .eq("user_id", userIds.get(a.user))

    const { error } = await c.from("addresses").insert({
      user_id: userIds.get(a.user),
      label: a.label,
      address_line: a.line,
      city: a.city,
      is_default: true,
    })

    if (error) throw new Error(`address ${a.user}: ${error.message}`)
  }

  console.log(`  + addresses`)
}

async function seedOrders() {
  for (const [orderIndex, o] of ORDERS.entries()) {
    const productId = productIds.get(`${o.seller}::${o.product}`)

    if (!productId) {
      console.warn(`  ! no product ${o.seller}::${o.product}`)
      continue
    }

    const buyer = await signIn(o.buyer)

    // 1) Claim (creates the order via the transactional RPC).

    const { data: order, error: claimErr } = await buyer.rpc(
      "claim_batch_product",
      {
        p_batch_product_id: productId,
        p_quantity: o.qty,
      },
    )

    if (claimErr)
      throw new Error(`claim ${o.buyer}/${o.product}: ${claimErr.message}`)

    const orderId = order.id

    // Stagger order creation times so seller recency views and audit timelines
    // are realistic while all downstream screens still read one database value.
    const createdAt = new Date(
      Date.UTC(2026, 8, 4, 1, 0) + orderIndex * 18 * 3_600_000,
    ).toISOString()
    const { error: timestampError } = await admin
      .from("orders")
      .update({ created_at: createdAt })
      .eq("id", orderId)
    if (timestampError)
      throw new Error(`order timestamp ${o.product}: ${timestampError.message}`)

    const total = Number(order.total_amount)

    if (o.advance === "pending") {
      console.log(`  + ${o.product} → pending`)
      continue
    }

    if (o.advance === "cancelled") {
      const { error } = await buyer.rpc("cancel_order", { p_order_id: orderId })

      if (error) throw new Error(`cancel: ${error.message}`)

      console.log(`  + ${o.product} → cancelled`)
      continue
    }

    // 2) Buyer submits payment.

    const amount = o.partial ?? total

    const { data: paymentResult, error: payErr } = await buyer.rpc(
      "submit_order_payment",
      {
        p_order_id: orderId,
        p_method_type: o.method,
        p_amount: amount,

        p_reference_number: `${o.method.slice(0, 3).toUpperCase()}-${orderId.slice(0, 8)}`,

        p_receipt_path: null,
        p_payer_account_name:
          BUYERS.find((b) => b.key === o.buyer)?.name ?? "Buyer",

        p_payer_phone: "0917-000-0000",
        p_buyer_contact_url: BUYERS.find((b) => b.key === o.buyer)?.fb ?? null,
      },
    )

    if (payErr) throw new Error(`pay ${o.product}: ${payErr.message}`)

    const paymentId = paymentResult?.payment?.id

    if (!paymentId) {
      throw new Error(
        `pay ${o.product}: submit_order_payment did not return payment.id`,
      )
    }

    if (o.advance === "submitted") {
      console.log(`  + ${o.product} → payment submitted`)
      continue
    }

    // 3) Seller verifies payment.

    const seller = await signIn(o.seller)

    const { error: revErr } = await seller.rpc("review_order_payment", {
      p_payment_id: paymentId,
      p_decision: "verified",
      p_reason: null,
      p_deadline_hours: null,
    })

    if (revErr) throw new Error(`review ${o.product}: ${revErr.message}`)

    if (o.advance === "insufficient" || o.advance === "confirmed") {
      console.log(
        `  + ${o.product} → ${
          o.advance === "insufficient"
            ? "insufficient_payment"
            : "payment_confirmed"
        }`,
      )
      continue
    }

    // 4) Seller advances fulfillment.

    if (o.advance === "preparing" || o.advance === "completed") {
      const { error: e1 } = await seller.rpc("set_fulfillment_status", {
        p_order_id: orderId,
        p_status: "preparing",
        p_tracking_number:
          o.advance === "preparing" ? "JP-EMS-1122334455" : null,
        p_eta: null,
      })

      if (e1) throw new Error(`prepare ${o.product}: ${e1.message}`)
    }

    if (o.advance === "completed") {
      const { error: e2 } = await seller.rpc("set_fulfillment_status", {
        p_order_id: orderId,
        p_status: "completed",
        p_tracking_number: null,
        p_eta: null,
      })

      if (e2) throw new Error(`complete ${o.product}: ${e2.message}`)

      completedOrders.push({
        orderId,
        buyer: o.buyer,
        seller: o.seller,
        product: o.product,
      })
    }

    console.log(`  + ${o.product} → ${o.advance}`)
  }
}

async function seedEngagement() {
  // Reviews — buyer reviews their completed orders (create_order_review RPC).

  const reviewComments = [
    "Super smooth transaction, items well packed. Salamat!",

    "Legit seller, exactly as described. Will order again.",

    "Fast updates and safe packaging. Highly recommended!",
  ]

  let ri = 0

  for (const co of completedOrders) {
    const buyer = await signIn(co.buyer)

    const { error } = await buyer.rpc("create_order_review", {
      p_order_id: co.orderId,
      p_rating: 5,
      p_comment: reviewComments[ri % reviewComments.length],
      p_quick_statements: ["Well packed", "Great communication"],
    })

    if (error) throw new Error(`review ${co.product}: ${error.message}`)

    ri += 1

    console.log(`  + review on ${co.product}`)

    const seller = await signIn(co.seller)
    const { error: sellerReviewError } = await seller.rpc(
      "create_order_review",
      {
        p_order_id: co.orderId,
        p_rating: 5,
        p_comment:
          "Responsive buyer with clear payment and pickup coordination.",
        p_quick_statements: ["Paid on time", "Easy to coordinate"],
      },
    )
    if (sellerReviewError)
      throw new Error(
        `seller review ${co.product}: ${sellerReviewError.message}`,
      )

    console.log(`  + seller review on ${co.product}`)
  }

  // Batch reactions — unique per buyer/batch via the composite primary key.
  // The staggered pattern gives the Popular section useful deterministic data.
  for (let buyerIndex = 0; buyerIndex < BUYERS.length; buyerIndex += 1) {
    const buyerDef = BUYERS[buyerIndex]
    const buyer = await signIn(buyerDef.key)
    const likedBatches = BATCHES.filter(
      (_, batchIndex) => batchIndex < BATCHES.length - buyerIndex,
    )

    const { error } = await buyer.from("batch_reactions").insert(
      likedBatches.map((batch) => ({
        batch_id: batchIds.get(`${batch.seller}::${batch.title}`),
        user_id: userIds.get(buyerDef.key),
      })),
    )

    if (error)
      throw new Error(`batch reactions ${buyerDef.key}: ${error.message}`)
    console.log(
      `  + ${likedBatches.length} batch reactions from ${buyerDef.key}`,
    )
  }

  // Buyer requests — create_buyer_request RPC.

  for (const r of BUYER_REQUESTS) {
    const batchId = batchIds.get(`${r.seller}::${r.batch}`)

    if (!batchId) {
      console.warn(`  ! no batch ${r.seller}::${r.batch}`)
      continue
    }

    const buyer = await signIn(r.buyer)

    const { error } = await buyer.rpc("create_buyer_request", {
      p_batch_id: batchId,
      p_product_name: r.product,
      p_quantity: r.qty,
      p_message: r.message,
    })

    if (error) throw new Error(`buyer request ${r.product}: ${error.message}`)

    console.log(`  + buyer request "${r.product}"`)
  }

  // Waitlist — direct insert as the buyer (matches kargoApi.joinWaitlist).

  for (const w of WAITLIST) {
    const productId = productIds.get(`${w.seller}::${w.product}`)

    if (!productId) {
      console.warn(`  ! no product ${w.seller}::${w.product}`)
      continue
    }

    const buyer = await signIn(w.buyer)

    const { error } = await buyer.from("waitlist_entries").upsert(
      {
        batch_product_id: productId,
        buyer_id: userIds.get(w.buyer),
        status: "waiting",
      },

      { onConflict: "batch_product_id,buyer_id" },
    )

    if (error) throw new Error(`waitlist ${w.product}: ${error.message}`)

    console.log(`  + waitlist ${w.buyer} → ${w.product}`)
  }
}

async function main() {
  validateSeedDefinitions()
  if (VALIDATE_ONLY) return
  console.log(`Seeding ${URL} …`)

  console.log("Ensuring auth users + profiles:")

  for (const s of SELLERS) await ensureUser(s, true)

  for (const b of BUYERS) await ensureUser(b, false)

  if (RESET) await reset()
  else if (await alreadySeeded()) {
    console.log(
      "\nDemo batches already exist. Re-run with --reset to rebuild. Nothing to do.",
    )

    return
  }

  console.log("Seller-owned data (batches, products, methods, addresses):")

  await seedSellerOwned()

  console.log("Orders / claims / payments / fulfillment:")

  await seedOrders()

  console.log("Engagement (reviews, buyer requests, waitlist):")

  await seedEngagement()

  console.log(`\nDone. Demo logins (password: ${PASSWORD}):`)

  console.log(
    "  Seller (BIR verified): maria@kargo.demo, ana@kargo.demo, jade@kargo.demo …",
  )

  console.log("  Buyer: trisha@kargo.demo, carlo@kargo.demo …")
}

main().catch((e) => {
  console.error("\nSeed failed:", e.message || e)
  process.exit(1)
})
