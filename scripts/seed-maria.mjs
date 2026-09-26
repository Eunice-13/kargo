// ─── Enrich Maria Santos (seller) demo data — LIVE Supabase ──────────────────

//

// Adds a rich, self-consistent dataset scoped ONLY to maria@kargo.demo so every

// seller-side screen renders with realistic, non-empty data:

//   - batches: live/open, LOCKED (closed to claims), and one with an EXPIRED

//     claim deadline (reservation set in the past)

//   - orders across EVERY fulfillment column: Claimed, Pending Payment,

//     Payment Confirmed, Preparing, Completed, Cancelled

//   - payments in pending / verified / rejected states

//   - historical completed orders (older confirmed dates) so the financial

//     summary + sales report show non-zero realistic totals

//   - seller notifications are generated automatically by the RPCs

//

// Runs through the app's real code paths (auth + RPCs) so everything is

// RLS-consistent. Uses the service-role key ONLY to (a) look up Maria's id and

// (b) backdate a couple of timestamps that no RPC exposes (expired deadline,

// historical confirmed dates). Buyers/sellers from the base seed must already

// exist (run scripts/seed-supabase.mjs first).

//

// USAGE:

//   node scripts/seed-maria.mjs           # idempotent add

//   node scripts/seed-maria.mjs --reset    # remove Maria's extra batches first

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
  console.error("Missing Supabase env vars.")
  process.exit(1)
}

const RESET = process.argv.includes("--reset")

const PASSWORD = "KargoDemo123!"

const emailFor = (k) => `${k}@kargo.demo`

const admin = createClient(URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const clients = new Map()

const userIds = new Map()

async function findUser(email) {
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

async function idOf(key) {
  if (userIds.has(key)) return userIds.get(key)

  const u = await findUser(emailFor(key))

  if (!u) throw new Error(`user ${key} not found — run seed-supabase.mjs first`)

  userIds.set(key, u.id)

  return u.id
}

async function signIn(key) {
  if (clients.has(key)) return clients.get(key)

  const c = createClient(URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { error } = await c.auth.signInWithPassword({
    email: emailFor(key),
    password: PASSWORD,
  })

  if (error) throw new Error(`sign in ${key}: ${error.message}`)

  clients.set(key, c)

  return c
}

// Maria's additional batches. `state`: live | locked | expired

const BATCHES = [
  {
    key: "japan-may",
    title: "Japan Spring — May 2026",
    category: "Food",
    startsOn: "2026-05-04",
    endsOn: "2026-05-14",
    reservationHours: 48,
    state: "live",
    notes: "Osaka + Tokyo run. Snacks, matcha, and drugstore beauty.",

    products: [
      { name: "Royce Nama Chocolate", base: 520, markup: 100, qty: 10 },
      { name: "Shiro Perfume", base: 1800, markup: 300, qty: 5 },
      { name: "Cezanne BB Cream", base: 380, markup: 80, qty: 8 },
      { name: "Calbee Jagabee", base: 180, markup: 40, qty: 12 },
    ],
  },

  {
    key: "korea-feb",
    title: "Korea Winter — February 2026",
    category: "Skincare",
    startsOn: "2026-02-05",
    endsOn: "2026-02-14",
    reservationHours: 48,
    state: "locked",

    notes: "CLOSED — trip already completed. Kept for records.",

    products: [
      { name: "Round Lab Toner", base: 620, markup: 130, qty: 8 },
      { name: "Torriden Serum", base: 750, markup: 150, qty: 8 },
      { name: "Medicube Zero Pad", base: 890, markup: 160, qty: 6 },
    ],
  },

  {
    key: "japan-jan",
    title: "Japan New Year — January 2026",
    category: "Grocery & Snacks",
    startsOn: "2026-01-08",
    endsOn: "2026-01-16",
    reservationHours: 24,
    state: "expired",

    notes: "Claim window closed — unpaid reservations expired.",

    products: [
      { name: "Shine Muscat Gummy", base: 300, markup: 70, qty: 10 },
      { name: "Yokan Red Bean", base: 260, markup: 60, qty: 8 },
    ],
  },
]

// Maria orders across every fulfillment column + payment states.

// advance: pending | pendingPayment | submitted | rejected | confirmed | preparing | completed

// Uses Maria's batch products (from BATCHES above) and existing buyers.

const ORDERS = [
  // Claimed column (payment_pending, fresh)

  {
    buyer: "trisha",
    batchKey: "japan-may",
    product: "Royce Nama Chocolate",
    qty: 2,
    advance: "pending",
  },

  {
    buyer: "carlo",
    batchKey: "japan-may",
    product: "Calbee Jagabee",
    qty: 3,
    advance: "pending",
  },

  // Pending Payment with a submitted-but-unreviewed proof (still payment_submitted → Pending Payment)

  {
    buyer: "mia",
    batchKey: "japan-may",
    product: "Cezanne BB Cream",
    qty: 1,
    advance: "submitted",
    method: "GCash",
  },

  // A rejected payment (buyer resubmits later) → order back to payment_pending

  {
    buyer: "ben",
    batchKey: "japan-may",
    product: "Shiro Perfume",
    qty: 1,
    advance: "rejected",
    method: "Maya",
  },

  // Payment Confirmed

  {
    buyer: "grace",
    batchKey: "korea-feb",
    product: "Round Lab Toner",
    qty: 2,
    advance: "confirmed",
    method: "GCash",
  },

  {
    buyer: "anna",
    batchKey: "korea-feb",
    product: "Torriden Serum",
    qty: 1,
    advance: "confirmed",
    method: "Bank Transfer",
  },

  // Preparing

  {
    buyer: "trisha",
    batchKey: "korea-feb",
    product: "Medicube Zero Pad",
    qty: 1,
    advance: "preparing",
    method: "GCash",
  },

  // Completed (historical — backdated for financials)

  {
    buyer: "carlo",
    batchKey: "korea-feb",
    product: "Round Lab Toner",
    qty: 1,
    advance: "completed",
    method: "GCash",
    historical: true,
  },

  {
    buyer: "mia",
    batchKey: "japan-jan",
    product: "Shine Muscat Gummy",
    qty: 3,
    advance: "completed",
    method: "Bank Transfer",
    historical: true,
  },

  {
    buyer: "grace",
    batchKey: "japan-jan",
    product: "Yokan Red Bean",
    qty: 2,
    advance: "completed",
    method: "GCash",
    historical: true,
  },

  {
    buyer: "anna",
    batchKey: "japan-may",
    product: "Royce Nama Chocolate",
    qty: 1,
    advance: "completed",
    method: "Maya",
    historical: true,
  },

  // Cancelled

  {
    buyer: "ben",
    batchKey: "japan-jan",
    product: "Shine Muscat Gummy",
    qty: 1,
    advance: "cancelled",
  },
]

const batchDbId = new Map() // key -> uuid

const productDbId = new Map() // `${batchKey}::${product}` -> uuid

async function reset() {
  const mariaId = await idOf("maria")

  const titles = BATCHES.map((b) => b.title)

  console.log("Reset: removing Maria's extra batches + their orders/payments…")

  const { data: batches } = await admin
    .from("batches")
    .select("id")
    .eq("seller_id", mariaId)
    .in("title", titles)

  const ids = (batches ?? []).map((b) => b.id)

  if (ids.length) {
    const { data: prods } = await admin
      .from("batch_products")
      .select("id")
      .in("batch_id", ids)

    const pids = (prods ?? []).map((p) => p.id)

    if (pids.length) {
      const { data: ords } = await admin
        .from("orders")
        .select("id")
        .in("batch_product_id", pids)

      const oids = (ords ?? []).map((o) => o.id)

      if (oids.length) {
        await admin.from("payments").delete().in("order_id", oids)

        await admin.from("reviews").delete().in("order_id", oids)

        await admin.from("orders").delete().in("id", oids)
      }

      await admin.from("waitlist_entries").delete().in("batch_product_id", pids)
    }

    await admin.from("batches").delete().in("id", ids)
  }

  console.log(`  removed ${ids.length} batch(es)`)
}

async function alreadySeeded() {
  const mariaId = await idOf("maria")

  const { count } = await admin
    .from("batches")
    .select("*", { count: "exact", head: true })

    .eq("seller_id", mariaId)
    .eq("title", BATCHES[0].title)

  return (count ?? 0) > 0
}

async function seedBatches() {
  const maria = await signIn("maria")

  const mariaId = await idOf("maria")

  for (const b of BATCHES) {
    const { data: batch, error } = await maria
      .from("batches")
      .insert({
        seller_id: mariaId,
        title: b.title,
        status: "live",

        starts_on: b.startsOn,
        ends_on: b.endsOn,
        category: b.category,

        reservation_hours: b.reservationHours,
        notes: b.notes ?? null,
      })
      .select("id")
      .single()

    if (error) throw new Error(`batch ${b.title}: ${error.message}`)

    batchDbId.set(b.key, batch.id)

    const { data: products, error: pErr } = await maria
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

    for (const p of products) productDbId.set(`${b.key}::${p.name}`, p.id)

    console.log(`  + batch "${b.title}" (${b.state})`)
  }
}

async function seedOrders() {
  for (const o of ORDERS) {
    const productId = productDbId.get(`${o.batchKey}::${o.product}`)

    if (!productId) {
      console.warn(`  ! no product ${o.batchKey}::${o.product}`)
      continue
    }

    const buyer = await signIn(o.buyer)

    const { data: order, error: claimErr } = await buyer.rpc(
      "claim_batch_product",
      { p_batch_product_id: productId, p_quantity: o.qty },
    )

    if (claimErr)
      throw new Error(`claim ${o.buyer}/${o.product}: ${claimErr.message}`)

    const orderId = order.id

    const total = Number(order.total_amount)

    if (o.advance === "pending") {
      console.log(`  + ${o.product} → Claimed (payment_pending)`)
      continue
    }

    if (o.advance === "cancelled") {
      const { error } = await buyer.rpc("cancel_order", { p_order_id: orderId })

      if (error) throw new Error(`cancel: ${error.message}`)

      console.log(`  + ${o.product} → Cancelled`)
      continue
    }

    // Buyer submits payment.

    const buyerName =
      {
        trisha: "Trisha Lim",
        carlo: "Carlo Santos",
        anna: "Anna Bautista",
        mia: "Mia Cruz",
        ben: "Ben Torres",
        grace: "Grace Reyes",
      }[o.buyer] ?? "Buyer"

    const { data: payment, error: payErr } = await buyer.rpc(
      "submit_order_payment",
      {
        p_order_id: orderId,
        p_method_type: o.method,
        p_amount: total,

        p_reference_number: `${o.method.slice(0, 3).toUpperCase()}-${orderId.slice(0, 8)}`,

        p_receipt_path: null,
        p_payer_account_name: buyerName,
        p_payer_phone: "0917-000-0000",
        p_buyer_contact_url: null,
      },
    )

    if (payErr) throw new Error(`pay ${o.product}: ${payErr.message}`)

    if (o.advance === "submitted") {
      console.log(
        `  + ${o.product} → Pending Payment (submitted, awaiting review)`,
      )
      continue
    }

    const maria = await signIn("maria")

    if (o.advance === "rejected") {
      const { error } = await maria.rpc("review_order_payment", {
        p_payment_id: payment.id,
        p_decision: "rejected",
        p_reason:
          "Amount/reference did not match. Please resend a clear receipt.",
      })

      if (error) throw new Error(`reject ${o.product}: ${error.message}`)

      console.log(`  + ${o.product} → payment REJECTED`)
      continue
    }

    // verify

    const { error: revErr } = await maria.rpc("review_order_payment", {
      p_payment_id: payment.id,
      p_decision: "verified",
      p_reason: null,
    })

    if (revErr) throw new Error(`verify ${o.product}: ${revErr.message}`)

    if (o.advance === "confirmed") {
      console.log(`  + ${o.product} → Payment Confirmed`)
      continue
    }

    if (o.advance === "preparing" || o.advance === "completed") {
      const { error: e1 } = await maria.rpc("set_fulfillment_status", {
        p_order_id: orderId,
        p_status: "preparing",
        p_tracking_number: "JP-EMS-" + orderId.slice(0, 8),
        p_eta: null,
      })

      if (e1) throw new Error(`prepare ${o.product}: ${e1.message}`)
    }

    if (o.advance === "completed") {
      const { error: e2 } = await maria.rpc("set_fulfillment_status", {
        p_order_id: orderId,
        p_status: "completed",
        p_tracking_number: null,
        p_eta: null,
      })

      if (e2) throw new Error(`complete ${o.product}: ${e2.message}`)

      // Backdate for historical financials (service-role; no RPC exposes this).

      if (o.historical) {
        const daysAgo = 30 + Math.floor(Math.random() * 120)

        const when = new Date(Date.now() - daysAgo * 86400_000).toISOString()

        await admin
          .from("orders")
          .update({ payment_confirmed_at: when, completed_at: when })
          .eq("id", orderId)
      }
    }

    console.log(`  + ${o.product} → ${o.advance}`)
  }
}

async function applyBatchStates() {
  // LOCKED batch: close it to new claims. EXPIRED batch: set its live orders'

  // reservation_expires_at into the past so the claim window reads as expired.

  const lockedId = batchDbId.get("korea-feb")

  if (lockedId) {
    await admin.from("batches").update({ status: "locked" }).eq("id", lockedId)

    console.log('  ~ "Korea Winter — February 2026" set to LOCKED')
  }

  // Expired claim deadline: create a fresh unpaid claim on the January batch,

  // then backdate its reservation_expires_at into the past so it reads as an

  // expired/lapsed reservation (hours-left = 0) in the seller's view.

  const expiredProductId = productDbId.get("japan-jan::Yokan Red Bean")

  if (expiredProductId) {
    const buyer = await signIn("ben")

    const { data: order, error } = await buyer.rpc("claim_batch_product", {
      p_batch_product_id: expiredProductId,
      p_quantity: 1,
    })

    if (!error && order) {
      const past = new Date(Date.now() - 5 * 86400_000).toISOString()

      await admin
        .from("orders")
        .update({ reservation_expires_at: past })
        .eq("id", order.id)

      console.log(
        '  ~ "Japan New Year — January 2026" now has an EXPIRED unpaid reservation',
      )
    } else if (error) {
      console.warn("  ! could not create expired reservation:", error.message)
    }
  }
}

async function main() {
  console.log(`Enriching Maria Santos on ${URL} …`)

  if (RESET) await reset()
  else if (await alreadySeeded()) {
    console.log(
      "Maria's extra batches already exist. Re-run with --reset to rebuild.",
    )
    return
  }

  console.log("Batches + products:")

  await seedBatches()

  console.log("Orders / payments / fulfillment:")

  await seedOrders()

  console.log("Batch states (locked / expired deadline):")

  await applyBatchStates()

  console.log(
    "\nDone. Log in as maria@kargo.demo (password " + PASSWORD + ") to view.",
  )
}

main().catch((e) => {
  console.error("\nFailed:", e.message || e)
  process.exit(1)
})
