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

  if (issues.length) {
    problems += 1
    console.log(`  FAIL  #${b.id} "${b.title}" (${b.seller}): ${issues.join("; ")}`)
  }
}

console.log()
for (const b of BATCHES_INIT) {
  console.log(`  #${String(b.id).padStart(2)} ${b.seller.padEnd(18)} ${b.title}`)
}

console.log(`\n${problems === 0 ? "PASS" : `FAIL (${problems} problem(s))`}`)
process.exit(problems === 0 ? 0 : 1)
