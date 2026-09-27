// Integrity checks for the demo batch seed.
//
//   node --experimental-strip-types --import ./scripts/lib/register.mjs scripts/check-batch-seed.mjs
//
// `batches.ts` is not just display data: `App.tsx` matches expiring claims to a
// batch by exact title (`claim.batch === batch.title`), and the Batches screen
// keys navigation off `batch.id`. So a duplicate id or a duplicate title is a
// real data bug, not a cosmetic one. Ratings are checked here too, because a
// batch's score must be the same computed aggregate the seller's profile shows
// — never an authored literal.

import path from "node:path"
import { readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"

const root = process.env.KARGO_ROOT
const load = (rel) => import(pathToFileURL(path.join(root, rel)).href)

const { BATCHES_INIT } = await load("src/data/batches.ts")
const { DEMO_RATINGS, DEMO_PROFILES, DEMO_SELLERS } = await load(
  "src/data/reviews.ts",
)
const { CLAIMS_INIT } = await load("src/data/claims.ts")
const { ORDERS_INIT } = await load("src/data/orders.ts")
const { WAITLIST_INIT } = await load("src/data/waitlist.ts")
const { FULFILLMENT_INIT } = await load(
  "src/features/fulfillment/fulfillmentData.ts",
)
const { BATCH_CATEGORIES } = await load("src/constants/categories.ts")

let failures = 0
const fail = (msg) => {
  failures += 1
  console.log(`  FAIL  ${msg}`)
}
const pass = (msg) => console.log(`  ok    ${msg}`)

console.log(`BATCHES_INIT: ${BATCHES_INIT.length} batches\n`)

// ── 1. Array shape ───────────────────────────────────────────────────────────
if (!Array.isArray(BATCHES_INIT) || BATCHES_INIT.length === 0) {
  fail("BATCHES_INIT is not a non-empty array")
}

const ids = new Map()
const titles = new Map()
for (const b of BATCHES_INIT) {
  if (ids.has(b.id)) fail(`duplicate batch id ${b.id}: "${ids.get(b.id)}" and "${b.title}"`)
  ids.set(b.id, b.title)

  if (titles.has(b.title)) fail(`duplicate batch title "${b.title}" (ids ${titles.get(b.title)} and ${b.id})`)
  titles.set(b.title, b.id)

  if (!b.title) fail(`batch ${b.id} has no title`)
  if (!b.seller) fail(`batch ${b.id} has no seller`)
  if (!b.sellerId) fail(`batch ${b.id} ("${b.title}") did not resolve a sellerId`)
  if (!Array.isArray(b.products) || b.products.length === 0)
    fail(`batch ${b.id} ("${b.title}") has no products`)

  // `items` is the claimed-against inventory; a product claiming more than the
  // batch total is what drives the "claimed > items" percentage bars.
  const productTotal = b.products.reduce((sum, p) => sum + p.qty, 0)
  if (productTotal !== b.items)
    fail(`batch ${b.id} ("${b.title}"): items=${b.items} but products sum to ${productTotal}`)
  if (b.claimed > b.items)
    fail(`batch ${b.id} ("${b.title}"): claimed ${b.claimed} exceeds items ${b.items}`)

  for (const p of b.products) {
    if (p.claimed > p.qty)
      fail(`batch ${b.id} product "${p.name}": claimed ${p.claimed} exceeds qty ${p.qty}`)
    if (typeof p.price !== "number" || p.price <= 0)
      fail(`batch ${b.id} product "${p.name}": bad price ${p.price}`)
  }

  if (!BATCH_CATEGORIES.includes(b.category) && !["Skincare", "Grocery & Snacks", "Mixed"].includes(b.category))
    fail(`batch ${b.id} ("${b.title}"): unknown category "${b.category}"`)
}

if (failures === 0) pass(`${BATCHES_INIT.length} batches: ids, titles, inventory and categories all valid`)

// ── 2. Ratings are the shared aggregate, never authored ──────────────────────
for (const b of BATCHES_INIT) {
  const summary = DEMO_RATINGS[b.sellerId]
  if (!summary) {
    fail(`batch ${b.id} ("${b.title}"): no rating entry for sellerId ${b.sellerId}`)
    continue
  }
  if (b.rating !== (summary.average ?? null))
    fail(`batch ${b.id}: rating ${b.rating} != aggregate ${summary.average}`)
  if (b.ratingCount !== summary.count)
    fail(`batch ${b.id}: ratingCount ${b.ratingCount} != ${summary.count}`)
}
if (!failures) pass("every batch rating equals the seller's computed aggregate")

// A seller with no reviews must carry null, never 0 or a placeholder.
for (const b of BATCHES_INIT) {
  if (b.ratingCount === 0 && b.rating !== null)
    fail(`batch ${b.id} ("${b.title}"): no reviews but rating is ${b.rating}`)
}

// Two batches by the same seller must show the same score.
const bySeller = new Map()
for (const b of BATCHES_INIT) {
  const prev = bySeller.get(b.sellerId)
  if (prev && (prev.rating !== b.rating || prev.ratingCount !== b.ratingCount))
    fail(`seller ${b.seller} shows different ratings on batches ${prev.id} and ${b.id}`)
  bySeller.set(b.sellerId, b)
}
pass("batches by the same seller never disagree on their rating")

// ── 3. Sellers referenced by batches exist in the profile list ───────────────
const knownSellers = new Set(DEMO_SELLERS.map((p) => p.name))
const orphanSellers = [
  ...new Set(BATCHES_INIT.map((b) => b.seller).filter((n) => !knownSellers.has(n))),
]
if (orphanSellers.length) {
  fail(
    `sellers in batches.ts absent from the review seed (their rating would silently vanish): ${orphanSellers.join(", ")}`,
  )
} else {
  pass("every batch seller is present in the review seed")
}

// ── 4. Cross-seed title resolution ───────────────────────────────────────────
// App.tsx routes an expiring claim to its batch with `claim.batch === batch.title`.
// If these strings drift apart, claims silently stop decrementing their batch.
const referrers = [
  ["CLAIMS_INIT", CLAIMS_INIT],
  ["ORDERS_INIT", ORDERS_INIT],
  ["WAITLIST_INIT", WAITLIST_INIT],
  ["FULFILLMENT_INIT", FULFILLMENT_INIT],
]
for (const [label, rows] of referrers) {
  for (const row of rows) {
    const ref = row.batch
    if (!ref) continue
    if (!titles.has(ref)) {
      fail(
        `${label} "${row.id}" references batch "${ref}", which matches no batch title — the claim will not decrement its batch`,
      )
    }
  }
}
if (!failures) pass("every cross-seed batch reference resolves to a real batch title")

// The product branch of that same predicate must not match on absent ids: demo
// rows carry no dbId/productId, and `undefined === undefined` would match every
// batch. Assert the guarded form is what App.tsx uses.
const appSource = readFileSync(
  path.join(root, "src/App.tsx"),
  "utf8",
)
if (/product\.dbId === claim\.productId/.test(appSource)) {
  const guarded = /claim\.productId != null[\s\S]{0,200}?product\.dbId === claim\.productId/.test(
    appSource,
  )
  if (!guarded) {
    fail(
      "App.tsx compares product.dbId to claim.productId without guarding a null productId — an expiring demo claim would be applied to every batch",
    )
  } else {
    pass("App.tsx guards the productId branch against a missing id")
  }
} else {
  fail("App.tsx no longer routes claims by product id; the expiry effect may be incomplete")
}

console.log(`\n${failures === 0 ? "PASS" : `FAIL (${failures} problem(s))`}`)
process.exit(failures === 0 ? 0 : 1)
