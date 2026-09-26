// Projects the per-user averages the seed will produce, straight from the seed
// script's own ORDERS + REVIEW_RATINGS tables — without writing to the database.
// Lets you sanity-check that the distribution looks earned before a live run.
//
//   node scripts/project-seed-ratings.mjs

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { register } from "node:module"

const here = path.dirname(fileURLToPath(import.meta.url))
register(pathToFileURL(path.join(here, "lib", "register.mjs")).href)

const root = path.resolve(here, "..")
const src = readFileSync(path.join(root, "scripts", "seed-supabase.mjs"), "utf8")

// Pull just the two data tables out of the seed module without executing it.
function literal(name) {
  const marker = `const ${name} = `
  const start = src.indexOf(marker)
  if (start < 0) throw new Error(`could not locate ${name}`)
  const open = src.indexOf("[", start) < src.indexOf("{", start)
    ? src.indexOf("[", start)
    : src.indexOf("{", start)
  const [openCh, closeCh] = src[open] === "[" ? ["[", "]"] : ["{", "}"]
  let depth = 0
  let inString = null
  for (let i = open; i < src.length; i += 1) {
    const ch = src[i]
    if (inString) {
      if (ch === "\\") i += 1
      else if (ch === inString) inString = null
      continue
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inString = ch
      continue
    }
    if (ch === openCh) depth += 1
    else if (ch === closeCh) {
      depth -= 1
      if (depth === 0) return src.slice(open, i + 1)
    }
  }
  throw new Error(`unbalanced literal for ${name}`)
}

const ORDERS = eval(`(${literal("ORDERS")})`)
const REVIEW_RATINGS = eval(`(${literal("REVIEW_RATINGS")})`)

const completed = ORDERS.filter((o) => o.advance === "completed")
console.log(`completed orders: ${completed.length}`)
console.log(`review rows: ${completed.length * 2}\n`)

const asSeller = {}
const asBuyer = {}
for (const o of completed) {
  const key = `${o.buyer}::${o.seller}::${o.product}`
  const e = REVIEW_RATINGS[key]
  ;(asSeller[o.seller] ??= []).push(e.buyer)
  ;(asBuyer[o.buyer] ??= []).push(e.seller)
}

const all = completed.flatMap((o) => {
  const e = REVIEW_RATINGS[`${o.buyer}::${o.seller}::${o.product}`]
  return [e.buyer, e.seller]
})
const dist = {}
for (const s of all) dist[s] = (dist[s] ?? 0) + 1
console.log("rating distribution:", dist, "\n")

const show = (label, table) => {
  const rows = Object.entries(table).map(([name, scores]) => ({
    name,
    avg: scores.reduce((a, b) => a + b, 0) / scores.length,
    n: scores.length,
  }))
  rows.sort((a, b) => a.avg - b.avg)
  console.log(label)
  for (const r of rows) {
    console.log(
      `  ${r.name.padEnd(12)} ${r.avg.toFixed(2).padStart(5)}  n=${r.n}  [${table[r.name].join(", ")}]`,
    )
  }
  console.log()
}

show("Sellers (rated by buyers):", asSeller)
show("Buyers (rated by sellers):", asBuyer)

const problems = []
if (new Set(all).size < 3) problems.push("not enough variation")
if (all.every((s) => s === 5)) problems.push("all 5 stars")
for (const [name, scores] of Object.entries({ ...asSeller, ...asBuyer })) {
  if (scores.length < 3) problems.push(`${name} has only ${scores.length} review(s)`)
}
const sellerAvgs = Object.values(asSeller).map((s) => s.reduce((a, b) => a + b, 0) / s.length)
if (new Set(sellerAvgs).size < 4) problems.push("seller averages too uniform")

console.log(problems.length ? `PROBLEMS: ${problems.join("; ")}` : "OK — distribution looks earned")
process.exit(problems.length ? 1 : 0)
