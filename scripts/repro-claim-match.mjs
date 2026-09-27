// Reproduces how App.tsx routes an expiring demo claim to a batch.
//
//   node --experimental-strip-types --import ./scripts/lib/register.mjs scripts/repro-claim-match.mjs
//
// App.tsx picks the batches a claim belongs to with:
//
//   claim.batch === batch.title ||
//   batch.products.some((product) => product.dbId === claim.productId)
//
// Demo seed rows carry neither a matching title nor a dbId/productId pair, so
// this checks what the predicate actually returns.

import path from "node:path"
import { pathToFileURL } from "node:url"

const root = process.env.KARGO_ROOT
const load = (rel) => import(pathToFileURL(path.join(root, rel)).href)

const { BATCHES_INIT } = await load("src/data/batches.ts")
const { CLAIMS_INIT } = await load("src/data/claims.ts")

// A claim whose timer has run out, as the expiry effect would build it.
const claim = CLAIMS_INIT[0]
console.log(`claim: id=${claim.id} "${claim.product}" batch="${claim.batch}"`)
console.log(`       productId=${claim.productId}  (${claim.productId === undefined ? "undefined" : "set"})\n`)

const byTitle = BATCHES_INIT.filter((b) => claim.batch === b.title)
const byProductId = BATCHES_INIT.filter((b) =>
  b.products.some((p) => p.dbId === claim.productId),
)
// Mirrors the predicate in App.tsx's claim-expiry effect.
const released = BATCHES_INIT.filter(
  (b) =>
    claim.batch === b.title ||
    (claim.productId != null &&
      b.products.some((p) => p.dbId === claim.productId)),
)

console.log(`matched by title:      ${byTitle.length}  ${JSON.stringify(byTitle.map((b) => b.id))}`)
console.log(`matched by productId:  ${byProductId.length}  ${JSON.stringify(byProductId.map((b) => b.id))}`)
console.log(`=> App.tsx "released":  ${released.length} of ${BATCHES_INIT.length} batches\n`)

const hasDbId = BATCHES_INIT.some((b) => b.products.some((p) => p.dbId !== undefined))
console.log(`any demo product has a dbId?        ${hasDbId ? "yes" : "no"}`)
console.log(`any demo claim has a productId?      ${CLAIMS_INIT.some((c) => c.productId !== undefined) ? "yes" : "no"}`)

const undefinedMatch = BATCHES_INIT.some((b) =>
  b.products.some((p) => p.dbId === claim.productId),
)
console.log(`\n"undefined === undefined" is true, so the productId branch matches every batch: ${undefinedMatch}`)

if (released.length === BATCHES_INIT.length && BATCHES_INIT.length > 1) {
  console.log(
    `\nBROKEN: one expiring claim is attributed to all ${released.length} batches, so every\n` +
      `batch's claimed count is decremented (App.tsx) instead of just the ${byTitle.length} it belongs to.`,
  )
  process.exit(1)
}
console.log(`\nOK: claim routed to ${released.length} batch(es)`)
