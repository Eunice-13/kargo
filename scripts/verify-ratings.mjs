// Verifies that ratings are computed from real `public.reviews` rows and are
// consistent across every surface that displays them.
//
//   node scripts/verify-ratings.mjs
//
// Checks:
//   1. `profile_ratings` exists and its averages match a client-side average
//      of the same rows (SQL and JS aggregation agree).
//   2. A user with no reviews has NULL average, not 0.
//   3. `batch_catalog.rating` equals that same seller's `profile_ratings`
//      average, so cards, shop pages and profiles cannot disagree.
//   4. Flags anyone whose reviews are not backed by a completed order.

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

function loadEnv() {
  const env = {}
  for (const line of readFileSync(path.join(root, ".env.local"), "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "")
  }
  return { ...env, ...process.env }
}

const env = loadEnv()
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

let failures = 0
const fail = (msg) => {
  failures += 1
  console.log(`  FAIL  ${msg}`)
}
const pass = (msg) => console.log(`  ok    ${msg}`)

// ── Load ──────────────────────────────────────────────────────────────────────
const { data: aggregates, error: aggErr } = await admin
  .from("profile_ratings")
  .select("*")
  .order("display_name")

if (aggErr) {
  console.error("profile_ratings view unavailable:", aggErr.message)
  process.exit(1)
}

const { data: reviews, error: revErr } = await admin.from("reviews").select("*")
if (revErr) throw revErr

const { data: orders } = await admin
  .from("orders")
  .select("id,order_number,status,buyer_id,seller_id")

console.log(`profile_ratings rows: ${aggregates.length}`)
console.log(`reviews rows: ${reviews.length}\n`)

console.log("1. SQL aggregate vs. client-side average of the same rows")
const byReviewee = new Map()
for (const r of reviews) {
  if (!byReviewee.has(r.reviewee_id)) byReviewee.set(r.reviewee_id, [])
  byReviewee.get(r.reviewee_id).push(r)
}
for (const row of aggregates) {
  const rows = byReviewee.get(row.profile_id) ?? []
  if (rows.length === 0) {
    if (row.average_rating !== null) {
      fail(`${row.display_name}: 0 reviews but average_rating=${row.average_rating} (expected null)`)
    } else {
      pass(`${row.display_name}: no reviews -> null (renders "No ratings yet")`)
    }
    continue
  }
  const clientAvg = Number(
    (rows.reduce((s, r) => s + r.rating, 0) / rows.length).toFixed(1),
  )
  if (Number(row.average_rating) !== clientAvg) {
    fail(`${row.display_name}: sql=${row.average_rating} vs client=${clientAvg}`)
  } else if (row.review_count !== rows.length) {
    fail(`${row.display_name}: review_count=${row.review_count} vs ${rows.length}`)
  } else {
    pass(`${row.display_name}: ${row.average_rating} from ${row.review_count} review(s)`)
  }
}

console.log("\n2. Ratings are backed by completed orders")
const orderById = new Map((orders ?? []).map((o) => [o.id, o]))
for (const r of reviews) {
  const order = orderById.get(r.order_id)
  if (!order) {
    fail(`review ${r.id} references a missing order`)
  } else if (order.status !== "completed") {
    fail(`review ${r.id} is on a ${order.status} order (${order.order_number})`)
  } else if (r.reviewer_id === r.reviewee_id) {
    fail(`review ${r.id} is a self-review`)
  }
}
if (failures === 0) pass(`all ${reviews.length} reviews sit on completed orders`)

console.log("\n3. batch_catalog.rating agrees with profile_ratings")
const aggById = new Map(aggregates.map((a) => [a.profile_id, a]))
const { data: catalog } = await admin
  .from("batch_catalog")
  .select("batch_id,batch_title,seller_id,seller_name,rating,rating_count")
const seen = new Set()
for (const row of catalog ?? []) {
  if (seen.has(row.seller_id)) continue
  seen.add(row.seller_id)
  const agg = aggById.get(row.seller_id)
  const catalogAvg = row.rating == null ? null : Number(row.rating)
  const profileAvg = agg?.average_rating == null ? null : Number(agg.average_rating)
  const catalogCount = row.rating_count == null ? null : Number(row.rating_count)
  const profileCount = agg?.review_count ?? null
  if (catalogAvg !== profileAvg || catalogCount !== profileCount) {
    fail(
      `${row.seller_name}: catalog(${catalogAvg}, n=${catalogCount}) != profile(${profileAvg}, n=${profileCount})`,
    )
  } else {
    pass(
      `${row.seller_name}: ${catalogAvg === null ? "no ratings yet" : `${catalogAvg} (n=${catalogCount})`} — identical on both`,
    )
  }
}

console.log("\n4. No fabricated defaults")
const allFive = aggregates.filter((a) => a.review_count > 0 && Number(a.average_rating) === 5)
const zeroed = aggregates.filter((a) => a.review_count === 0 && a.average_rating !== null)
if (zeroed.length) fail(`${zeroed.length} user(s) with no reviews have a non-null average`)
else pass("no user without reviews carries a score")

console.log(
  `\n${allFive.length} of ${aggregates.filter((a) => a.review_count > 0).length} rated users sit at exactly 5.0`,
)

console.log(`\n${failures === 0 ? "PASS" : `FAIL (${failures} problem(s))`}`)
process.exit(failures === 0 ? 0 : 1)
