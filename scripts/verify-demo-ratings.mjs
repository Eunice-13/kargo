// Resolves the project's `@/` path alias for plain `node --experimental-strip-types`
// runs, so the TS seed modules can be imported directly without a bundler.
import { pathToFileURL } from "node:url"
import path from "node:path"

const root = process.env.KARGO_ROOT

const { DEMO_RATINGS, DEMO_PROFILES, REVIEWS_INIT } = await import(
  pathToFileURL(path.join(root, "src", "data", "reviews.ts")).href
)
const { summarizeReviews } = await import(
  pathToFileURL(path.join(root, "src", "lib", "ratings.ts")).href
)

let failures = 0
const fail = (m) => {
  failures += 1
  console.log(`  FAIL  ${m}`)
}

console.log(`review rows: ${REVIEWS_INIT.length}`)
console.log(`profiles: ${DEMO_PROFILES.length}\n`)

const distribution = {}
for (const r of REVIEWS_INIT) {
  distribution[r.rating] = (distribution[r.rating] ?? 0) + 1
}
console.log("rating distribution:", distribution)
if (Object.keys(distribution).length < 3) {
  fail("ratings have too little variation to look earned")
}

console.log("\nper-user computed averages:")
const rows = []
for (const p of DEMO_PROFILES) {
  const s = DEMO_RATINGS[p.id]
  // Recompute independently: DEMO_RATINGS must equal summarizeReviews() of
  // the same rows, proving the stored aggregate is really derived.
  const recomputed = summarizeReviews(
    REVIEWS_INIT.filter((r) => r.revieweeId === p.id),
  )
  if (s.average !== recomputed.average || s.count !== recomputed.count) {
    fail(
      `${p.name}: DEMO_RATINGS ${s.average}/${s.count} != recomputed ${recomputed.average}/${recomputed.count}`,
    )
  }
  if (s.count === 0 && s.average !== null) {
    fail(`${p.name}: no reviews but carries average ${s.average}`)
  }
  if (s.count > 0 && s.average === null) {
    fail(`${p.name}: has reviews but no average`)
  }
  const breakdownTotal = Object.values(s.breakdown).reduce((a, b) => a + b, 0)
  if (breakdownTotal !== s.count) {
    fail(`${p.name}: star breakdown sums to ${breakdownTotal}, expected ${s.count}`)
  }
  rows.push({ name: p.name, avg: s.average, n: s.count, reviews: s.reviews.length })
}

rows.sort((a, b) => (a.avg ?? -1) - (b.avg ?? -1))
for (const r of rows) {
  console.log(
    `  ${r.name.padEnd(18)} ${r.avg === null ? "New (no ratings)" : r.avg.toFixed(2).padStart(5)}  n=${String(r.n).padStart(2)}  listed=${r.reviews}`,
  )
}

const rated = rows.filter((r) => r.avg !== null)
const atFive = rated.filter((r) => r.avg === 5)
const unreviewed = rows.filter((r) => r.avg === null)

if (atFive.length === rated.length) {
  fail("every rated user sits at exactly 5.0 — unrealistic")
}
if (new Set(rated.map((r) => r.avg)).size < 4) {
  fail("averages lack variety")
}
if (unreviewed.length === 0) fail("no user exercises the 'no ratings yet' state")
if (!rows.some((r) => r.n > 0 && r.n < 3)) {
  fail("no user exercises the thin-history state")
}
// Every review row must name two distinct real demo accounts.
const ids = new Set(DEMO_PROFILES.map((p) => p.id))
for (const r of REVIEWS_INIT) {
  if (!ids.has(r.reviewerId) || !ids.has(r.revieweeId)) {
    fail(`review ${r.id} references an unknown account`)
  }
  if (r.reviewerId === r.revieweeId) fail(`review ${r.id} is a self-review`)
  if (!r.comment || r.comment.trim().length < 10) {
    fail(`review ${r.id} has no substantive comment`)
  }
}

console.log(
  `\n${rated.length} rated users: ${atFive.length} at 5.0, ${new Set(rated.map((r) => r.avg)).size} distinct averages, ${unreviewed.length} with no ratings`,
)
console.log(`\n${failures === 0 ? "PASS" : `FAIL (${failures})`}`)
process.exit(failures === 0 ? 0 : 1)
