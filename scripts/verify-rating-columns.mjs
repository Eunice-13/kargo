// Confirms the exact column list the client selects from `profile_ratings` and
// `batch_catalog` actually resolves against the live database. A missing column
// here is what turns into a runtime Supabase error in the app.
//
//   node scripts/verify-rating-columns.mjs

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
// The publishable key is what the browser uses, so probe with it.
const client = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Mirror the exact selects in src/services/kargoApi.ts.
const CHECKS = [
  {
    label: "profile_ratings",
    select: "profile_id,average_rating,review_count,member_since",
  },
  {
    label: "batch_catalog",
    select: "batch_id,seller_id,rating,rating_count",
  },
]

// Both views are granted to `authenticated` only, so an unauthenticated read
// being denied is correct. Sign in as a demo seller to test what the app does.
const {
  data: { session },
} = await client.auth.signInWithPassword({
  email: "maria@kargo.demo",
  password: "KargoDemo123!",
})

if (!session) {
  console.log("FAIL  could not sign in as a demo seller")
  process.exit(1)
}
console.log("signed in as maria@kargo.demo (authenticated role)\n")

let failures = 0
for (const check of CHECKS) {
  const { data, error } = await client
    .from(check.label)
    .select(check.select)
    .limit(3)
  // An empty result is fine; an unresolved column, missing relation, or a
  // missing grant is not.
  if (error) {
    failures += 1
    console.log(`  FAIL  ${check.label} (${check.select}): ${error.message}`)
  } else {
    console.log(
      `  ok    ${check.label} (${check.select}) -> ${data.length} row(s)`,
    )
  }
}

// The anon role must NOT be able to read these directly.
const anonProbe = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const { error: anonError } = await anonProbe
  .from("profile_ratings")
  .select("profile_id")
  .limit(1)
if (anonError) {
  console.log("  ok    unauthenticated read is denied")
} else {
  console.log("  FAIL  unauthenticated read was allowed")
  failures += 1
}

console.log(`\n${failures === 0 ? "PASS" : `FAIL (${failures})`}`)
process.exit(failures === 0 ? 0 : 1)
