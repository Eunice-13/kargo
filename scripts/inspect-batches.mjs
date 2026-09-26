// Executes src/data/batches.ts and reports what it actually produced. Catches
// module-init errors and bad data that a typecheck or build would not.
//
//   node --experimental-strip-types --import ./scripts/lib/register.mjs scripts/inspect-batches.mjs

import path from "node:path"
import { pathToFileURL } from "node:url"

const root = process.env.KARGO_ROOT
const { BATCHES_INIT } = await import(
  pathToFileURL(path.join(root, "src", "data", "batches.ts")).href
)
const { DEMO_RATINGS, DEMO_SELLERS } = await import(
  pathToFileURL(path.join(root, "src", "data", "reviews.ts")).href
)

console.log(`BATCHES_INIT: ${Array.isArray(BATCHES_INIT) ? BATCHES_INIT.length : "NOT AN ARRAY"} batches\n`)

let problems = 0
const seenIds = new Set()

for (const b of BATCHES_INIT) {
  const issues = []
  if (seenIds.has(b.id)) issues.push(`duplicate id ${b.id}`)
  seenIds.add(b.id)

  if (!b.title) issues.push("missing title")
  if (!b.seller) issues.push("missing seller")
  if (!b.sellerId) issues.push("sellerId not resolved")
  if (!Array.isArray(b.products) || b.products.length === 0) issues.push("no products")

  // rating / ratingCount must agree with the shared aggregate.
  const summary = b.sellerId ? DEMO_RATINGS[b.sellerId] : undefined
  if (!summary) issues.push("no rating entry for sellerId")
  else {
    if (b.rating !== (summary.average ?? null)) {
      issues.push(`rating ${b.rating} != aggregate ${summary.average}`)
    }
    if (b.ratingCount !== summary.count) {
      issues.push(`ratingCount ${b.ratingCount} != ${summary.count}`)
    }
  }

  if (issues.length) {
    problems += 1
    console.log(`  FAIL  #${b.id} "${b.title}" (${b.seller}): ${issues.join("; ")}`)
  }
}

console.log()
for (const b of BATCHES_INIT) {
  const label =
    b.rating === null
      ? "New seller"
      : `${b.rating.toFixed(1)} (n=${b.ratingCount})`
  console.log(
    `  #${String(b.id).padStart(2)} ${b.seller.padEnd(18)} ${label.padEnd(14)} ${b.title}`,
  )
}

// Sellers present in batches but missing from the demo profile list would
// silently lose their rating.
const batchSellers = new Set(BATCHES_INIT.map((b) => b.seller))
const known = new Set(DEMO_SELLERS.map((p) => p.name))
const orphans = [...batchSellers].filter((name) => !known.has(name))
if (orphans.length) {
  problems += 1
  console.log(`\n  FAIL  sellers in batches.ts absent from the review seed: ${orphans.join(", ")}`)
}

console.log(`\n${problems === 0 ? "PASS" : `FAIL (${problems} problem(s))`}`)
process.exit(problems === 0 ? 0 : 1)
