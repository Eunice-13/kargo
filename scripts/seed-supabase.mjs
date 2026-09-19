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
const ANON_KEY =
  env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY

if (!URL || !SERVICE_KEY || !ANON_KEY) {
  console.error("Missing SUPABASE_URL, SUPABASE_SECRET_KEY, or publishable key in .env.local.")
  process.exit(1)
}

const RESET = process.argv.includes("--reset")
const PASSWORD = "KargoDemo123!"
const DOMAIN = "kargo.demo"
const emailFor = (k) => `${k}@${DOMAIN}`

const admin = createClient(URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
// A fresh authenticated client per user (each holds its own session).
function userClient() {
  return createClient(URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
}

// ── People ───────────────────────────────────────────────────────────────────
const SELLERS = [
  { key: "maria", name: "Maria Santos", shop: "Maria's Japan Finds", fb: "https://facebook.com/maria.santos.pasabuy" },
  { key: "ana", name: "Ana Reyes", shop: "Seoul Sisters PH", fb: "https://facebook.com/ana.reyes.kbeauty" },
  { key: "paolo", name: "Paolo Garcia", shop: "Paolo's US Haul", fb: "https://facebook.com/paolo.garcia.haul" },
  { key: "kristine", name: "Kristine Aquino", shop: "BKK Treats", fb: "https://facebook.com/kristine.aquino.bkk" },
  { key: "jade", name: "Jade Bautista", shop: "SG Luxe Skincare", fb: "https://facebook.com/jade.bautista.sg" },
]
const BUYERS = [
  { key: "trisha", name: "Trisha Lim", fb: "https://facebook.com/trisha.lim" },
  { key: "carlo", name: "Carlo Santos", fb: "https://facebook.com/carlo.santos" },
  { key: "anna", name: "Anna Bautista", fb: "https://facebook.com/anna.bautista" },
  { key: "mia", name: "Mia Cruz", fb: "https://facebook.com/mia.cruz" },
  { key: "ben", name: "Ben Torres", fb: "https://facebook.com/ben.torres" },
  { key: "grace", name: "Grace Reyes", fb: "https://facebook.com/grace.reyes" },
]

const BATCHES = [
  { seller: "maria", title: "Japan Trip — March 2026", category: "Food & Beauty", startsOn: "2026-03-10", endsOn: "2026-03-18", reservationHours: 48, notes: "Trip runs Mar 10-18. Prices in PHP, include local sourcing. QR/BDO preferred.",
    products: [ { name: "Tokyo Banana", base: 400, markup: 80, qty: 6 }, { name: "KitKat Sakura", base: 260, markup: 60, qty: 8 }, { name: "Shiseido Sunscreen", base: 1450, markup: 200, qty: 4 }, { name: "Meiji Chocolate", base: 240, markup: 50, qty: 6 } ] },
  { seller: "ana", title: "Korea Haul — April 2026", category: "Skincare", startsOn: "2026-04-03", endsOn: "2026-04-12", reservationHours: 48,
    products: [ { name: "Laneige Lip Mask", base: 800, markup: 150, qty: 10 }, { name: "COSRX Snail Cream", base: 650, markup: 130, qty: 8 }, { name: "Korean Skincare Set", base: 2050, markup: 350, qty: 5 }, { name: "Paldo Bibimmyeon", base: 320, markup: 60, qty: 8 } ] },
  { seller: "paolo", title: "US Pasabuy — May 2026", category: "Grocery & Snacks", startsOn: "2026-05-05", endsOn: "2026-05-20", reservationHours: 48,
    products: [ { name: "Trader Joe's Snacks", base: 1000, markup: 200, qty: 10 }, { name: "Muji Skincare", base: 740, markup: 150, qty: 8 } ] },
  { seller: "kristine", title: "Bangkok Haul — June 2026", category: "Mixed", startsOn: "2026-06-02", endsOn: "2026-06-08", reservationHours: 48, notes: "Snacks and skincare. OOS items refunded within 48h.",
    products: [ { name: "Thai Snack Box", base: 540, markup: 110, qty: 10 }, { name: "Mistine Sunscreen", base: 350, markup: 70, qty: 10 } ] },
  { seller: "jade", title: "Singapore Haul — August 2026", category: "Skincare", startsOn: "2026-08-20", endsOn: "2026-08-27", reservationHours: 48,
    products: [ { name: "SK-II Essence", base: 4100, markup: 700, qty: 6 }, { name: "Hada Labo Serum", base: 650, markup: 130, qty: 8 }, { name: "Innisfree Sheet Mask", base: 320, markup: 70, qty: 5 } ] },
  { seller: "maria", title: "Australia Run — September 2026", category: "Grocery & Snacks", startsOn: "2026-09-01", endsOn: "2026-09-10", reservationHours: 48,
    products: [ { name: "Tim Tam Assorted", base: 600, markup: 120, qty: 8 }, { name: "Aesop Hand Cream", base: 2200, markup: 400, qty: 6 } ] },
]

const PAYMENT_METHODS = [
  { seller: "maria", method: "GCash", acctName: "Maria S. Santos", acctNum: "0917-555-1201" },
  { seller: "maria", method: "Bank Transfer", acctName: "Maria Santos", acctNum: "BDO-0044-2201" },
  { seller: "ana", method: "Maya", acctName: "Ana R. Reyes", acctNum: "0918-555-3302" },
  { seller: "paolo", method: "GCash", acctName: "Paolo Garcia", acctNum: "0919-555-4410" },
  { seller: "kristine", method: "GCash", acctName: "Kristine Aquino", acctNum: "0917-555-6650" },
  { seller: "jade", method: "Bank Transfer", acctName: "Jade Bautista", acctNum: "BPI-9921-8830" },
]

const ADDRESSES = [
  { user: "trisha", label: "Home", line: "12 Mabini St., Brgy. San Antonio", city: "Mandaluyong City" },
  { user: "carlo", label: "Home", line: "88 Katipunan Ave.", city: "Marikina City" },
  { user: "anna", label: "Office", line: "5F Ayala Tower, Brgy. San Lorenzo", city: "Makati City" },
  { user: "mia", label: "Home", line: "23 Sampaguita St.", city: "Caloocan City" },
  { user: "maria", label: "Meetup", line: "Trinoma Mall, North Ave.", city: "Quezon City" },
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
  { buyer: "trisha", seller: "maria", batch: "Japan Trip — March 2026", product: "Royce Nama Chocolate", qty: 2, message: "Any chance you can add Royce Nama (matcha)? Would claim 2." },
  { buyer: "carlo", seller: "paolo", batch: "US Pasabuy — May 2026", product: "Costco Vitamins", qty: 1, message: "Can you source Kirkland vitamins from Costco?" },
  { buyer: "mia", seller: "ana", batch: "Korea Haul — April 2026", product: "Beauty of Joseon Sunscreen", qty: 3, message: "Please add Beauty of Joseon relief sun if there's room." },
  { buyer: "grace", seller: "jade", batch: "Singapore Haul — August 2026", product: "Charles & Keith Bag", qty: 1, message: "Open to a C&K crossbody if you pass by the outlet?" },
]

// Waitlist joins (for sold-out / popular products) → direct insert as buyer.
const WAITLIST = [
  { buyer: "ben", seller: "jade", product: "SK-II Essence" },
  { buyer: "grace", seller: "ana", product: "Laneige Lip Mask" },
  { buyer: "mia", seller: "maria", product: "Shiseido Sunscreen" },
]

const ORDERS = [
  { buyer: "trisha", seller: "ana", product: "Laneige Lip Mask", qty: 2, advance: "pending" },
  { buyer: "grace", seller: "ana", product: "COSRX Snail Cream", qty: 2, advance: "submitted", method: "Maya" },
  { buyer: "carlo", seller: "paolo", product: "Trader Joe's Snacks", qty: 3, advance: "confirmed", method: "GCash" },
  { buyer: "anna", seller: "maria", product: "Shiseido Sunscreen", qty: 1, advance: "preparing", method: "GCash" },
  { buyer: "mia", seller: "maria", product: "Meiji Chocolate", qty: 4, advance: "completed", method: "Bank Transfer" },
  { buyer: "ben", seller: "jade", product: "SK-II Essence", qty: 1, advance: "insufficient", method: "Bank Transfer", partial: 3800 },
  { buyer: "trisha", seller: "kristine", product: "Thai Snack Box", qty: 2, advance: "submitted", method: "GCash" },
  { buyer: "carlo", seller: "jade", product: "Hada Labo Serum", qty: 1, advance: "completed", method: "Bank Transfer" },
  { buyer: "grace", seller: "maria", product: "KitKat Sakura", qty: 3, advance: "cancelled" },
  { buyer: "mia", seller: "ana", product: "Korean Skincare Set", qty: 1, advance: "pending" },
  { buyer: "anna", seller: "paolo", product: "Muji Skincare", qty: 2, advance: "confirmed", method: "GCash" },
]

// ── State ─────────────────────────────────────────────────────────────────────
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
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
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
      email, password: PASSWORD, email_confirm: true, user_metadata: { display_name: person.name },
    })
    if (error) throw error
    user = data.user
    console.log(`  + ${email}`)
  } else {
    console.log(`  = ${email}`)
  }
  userIds.set(person.key, user.id)
  // service-role profile update (sets bir_status, which authenticated cannot).
  const { error } = await admin.from("profiles").update({
    display_name: person.name,
    shop_name: isSeller ? person.shop : null,
    social_links: { Facebook: person.fb },
    bir_status: isSeller ? "verified" : "none",
    bir_checked_at: isSeller ? new Date().toISOString() : null,
    account_status: "active",
  }).eq("id", user.id)
  if (error) throw error
}

async function signIn(key) {
  if (clients.has(key)) return clients.get(key)
  const c = userClient()
  const { error } = await c.auth.signInWithPassword({ email: emailFor(key), password: PASSWORD })
  if (error) throw new Error(`sign in ${key}: ${error.message}`)
  clients.set(key, c)
  return c
}

async function reset() {
  console.log("Resetting demo domain data (service-role)…")
  const ids = [...userIds.values()]
  if (!ids.length) return
  await admin.from("payments").delete().in("submitted_by", ids)
  await admin.from("orders").delete().in("buyer_id", ids)
  await admin.from("waitlist_entries").delete().in("buyer_id", ids)
  await admin.from("buyer_requests").delete().in("buyer_id", ids)
  await admin.from("reviews").delete().in("reviewer_id", ids)
  await admin.from("notifications").delete().in("recipient_id", ids)
  await admin.from("addresses").delete().in("user_id", ids)
  await admin.from("seller_payment_methods").delete().in("seller_id", ids)
  await admin.from("batches").delete().in("seller_id", ids)
  console.log("  removed")
}

async function alreadySeeded() {
  // If this seller already has batches, treat as seeded (skip re-inserting).
  const mariaId = userIds.get("maria")
  const { count } = await admin.from("batches").select("*", { count: "exact", head: true }).eq("seller_id", mariaId)
  return (count ?? 0) > 0
}

async function seedSellerOwned() {
  for (const b of BATCHES) {
    const c = await signIn(b.seller)
    const { data: batch, error } = await c.from("batches").insert({
      seller_id: userIds.get(b.seller),
      title: b.title, status: "live", starts_on: b.startsOn, ends_on: b.endsOn,
      category: b.category, reservation_hours: b.reservationHours, notes: b.notes ?? null,
    }).select("id").single()
    if (error) throw new Error(`batch ${b.title}: ${error.message}`)
    batchIds.set(`${b.seller}::${b.title}`, batch.id)
    const { data: products, error: pErr } = await c.from("batch_products").insert(
      b.products.map((p) => ({ batch_id: batch.id, name: p.name, base_price: p.base, markup: p.markup, quantity_total: p.qty })),
    ).select("id,name")
    if (pErr) throw new Error(`products ${b.title}: ${pErr.message}`)
    for (const p of products) productIds.set(`${b.seller}::${p.name}`, p.id)
    console.log(`  + batch "${b.title}"`)
  }
  for (const m of PAYMENT_METHODS) {
    const c = await signIn(m.seller)
    const { error } = await c.from("seller_payment_methods").insert({
      seller_id: userIds.get(m.seller), method_type: m.method, account_name: m.acctName, account_number: m.acctNum,
    })
    if (error && !/duplicate key/.test(error.message)) throw new Error(`pay method ${m.seller}: ${error.message}`)
  }
  console.log(`  + payment methods`)
  for (const a of ADDRESSES) {
    const c = await signIn(a.user)
    if (a.isDefault !== false) await c.from("addresses").update({ is_default: false }).eq("user_id", userIds.get(a.user))
    const { error } = await c.from("addresses").insert({
      user_id: userIds.get(a.user), label: a.label, address_line: a.line, city: a.city, is_default: true,
    })
    if (error) throw new Error(`address ${a.user}: ${error.message}`)
  }
  console.log(`  + addresses`)
}

async function seedOrders() {
  for (const o of ORDERS) {
    const productId = productIds.get(`${o.seller}::${o.product}`)
    if (!productId) { console.warn(`  ! no product ${o.seller}::${o.product}`); continue }
    const buyer = await signIn(o.buyer)

    // 1) Claim (creates the order via the transactional RPC).
    const { data: order, error: claimErr } = await buyer.rpc("claim_batch_product", {
      p_batch_product_id: productId, p_quantity: o.qty,
    })
    if (claimErr) throw new Error(`claim ${o.buyer}/${o.product}: ${claimErr.message}`)
    const orderId = order.id
    const total = Number(order.total_amount)

    if (o.advance === "pending") { console.log(`  + ${o.product} → pending`); continue }
    if (o.advance === "cancelled") {
      const { error } = await buyer.rpc("cancel_order", { p_order_id: orderId })
      if (error) throw new Error(`cancel: ${error.message}`)
      console.log(`  + ${o.product} → cancelled`); continue
    }

    // 2) Buyer submits payment.
    const amount = o.partial ?? total
    const { data: payment, error: payErr } = await buyer.rpc("submit_order_payment", {
      p_order_id: orderId, p_method_type: o.method, p_amount: amount,
      p_reference_number: `${o.method.slice(0, 3).toUpperCase()}-${orderId.slice(0, 8)}`,
      p_receipt_path: null, p_payer_account_name: BUYERS.find((b) => b.key === o.buyer)?.name ?? "Buyer",
      p_payer_phone: "0917-000-0000", p_buyer_contact_url: BUYERS.find((b) => b.key === o.buyer)?.fb ?? null,
    })
    if (payErr) throw new Error(`pay ${o.product}: ${payErr.message}`)
    if (o.advance === "submitted") { console.log(`  + ${o.product} → payment submitted`); continue }

    // 3) Seller verifies payment.
    const seller = await signIn(o.seller)
    const { error: revErr } = await seller.rpc("review_order_payment", {
      p_payment_id: payment.id, p_decision: "verified", p_reason: null,
    })
    if (revErr) throw new Error(`review ${o.product}: ${revErr.message}`)
    if (o.advance === "insufficient" || o.advance === "confirmed") {
      console.log(`  + ${o.product} → ${o.advance === "insufficient" ? "insufficient_payment" : "payment_confirmed"}`); continue
    }

    // 4) Seller advances fulfillment.
    if (o.advance === "preparing" || o.advance === "completed") {
      const { error: e1 } = await seller.rpc("set_fulfillment_status", {
        p_order_id: orderId, p_status: "preparing", p_tracking_number: o.advance === "preparing" ? "JP-EMS-1122334455" : null, p_eta: null,
      })
      if (e1) throw new Error(`prepare ${o.product}: ${e1.message}`)
    }
    if (o.advance === "completed") {
      const { error: e2 } = await seller.rpc("set_fulfillment_status", {
        p_order_id: orderId, p_status: "completed", p_tracking_number: null, p_eta: null,
      })
      if (e2) throw new Error(`complete ${o.product}: ${e2.message}`)
      completedOrders.push({ orderId, buyer: o.buyer, seller: o.seller, product: o.product })
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
      p_order_id: co.orderId, p_rating: 5, p_comment: reviewComments[ri % reviewComments.length],
    })
    if (error) throw new Error(`review ${co.product}: ${error.message}`)
    ri += 1
    console.log(`  + review on ${co.product}`)
  }

  // Buyer requests — create_buyer_request RPC.
  for (const r of BUYER_REQUESTS) {
    const batchId = batchIds.get(`${r.seller}::${r.batch}`)
    if (!batchId) { console.warn(`  ! no batch ${r.seller}::${r.batch}`); continue }
    const buyer = await signIn(r.buyer)
    const { error } = await buyer.rpc("create_buyer_request", {
      p_batch_id: batchId, p_product_name: r.product, p_quantity: r.qty, p_message: r.message,
    })
    if (error) throw new Error(`buyer request ${r.product}: ${error.message}`)
    console.log(`  + buyer request "${r.product}"`)
  }

  // Waitlist — direct insert as the buyer (matches kargoApi.joinWaitlist).
  for (const w of WAITLIST) {
    const productId = productIds.get(`${w.seller}::${w.product}`)
    if (!productId) { console.warn(`  ! no product ${w.seller}::${w.product}`); continue }
    const buyer = await signIn(w.buyer)
    const { error } = await buyer.from("waitlist_entries").upsert(
      { batch_product_id: productId, buyer_id: userIds.get(w.buyer), status: "waiting" },
      { onConflict: "batch_product_id,buyer_id" },
    )
    if (error) throw new Error(`waitlist ${w.product}: ${error.message}`)
    console.log(`  + waitlist ${w.buyer} → ${w.product}`)
  }
}

async function main() {
  console.log(`Seeding ${URL} …`)
  console.log("Ensuring auth users + profiles:")
  for (const s of SELLERS) await ensureUser(s, true)
  for (const b of BUYERS) await ensureUser(b, false)

  if (RESET) await reset()
  else if (await alreadySeeded()) {
    console.log("\nDemo batches already exist. Re-run with --reset to rebuild. Nothing to do.")
    return
  }

  console.log("Seller-owned data (batches, products, methods, addresses):")
  await seedSellerOwned()
  console.log("Orders / claims / payments / fulfillment:")
  await seedOrders()
  console.log("Engagement (reviews, buyer requests, waitlist):")
  await seedEngagement()

  console.log(`\nDone. Demo logins (password: ${PASSWORD}):`)
  console.log("  Seller (BIR verified): maria@kargo.demo, ana@kargo.demo, jade@kargo.demo …")
  console.log("  Buyer: trisha@kargo.demo, carlo@kargo.demo …")
}

main().catch((e) => { console.error("\nSeed failed:", e.message || e); process.exit(1) })
