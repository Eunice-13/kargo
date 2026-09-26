// Applies a SQL migration file to the linked Supabase project using the
// Management API's query endpoint (no psql / supabase CLI in this environment).
//
//   node scripts/apply-migration.mjs supabase/migrations/<file>.sql
//
// Idempotent by construction: every statement in the migrations it applies is
// itself idempotent (create or replace / drop if exists / if not exists).

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"

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
const projectUrl = env.SUPABASE_URL
const TOKEN = env.SUPABASE_ACCESS_TOKEN

if (!projectUrl || !TOKEN) {
  console.error("Missing SUPABASE_URL or SUPABASE_ACCESS_TOKEN in .env.local.")
  process.exit(1)
}

const ref = new URL(projectUrl).hostname.split(".")[0]
const file = process.argv[2]

if (!file) {
  console.error("Usage: node scripts/apply-migration.mjs <path-to.sql>")
  process.exit(1)
}

const sql = readFileSync(path.resolve(root, file), "utf8")

const res = await fetch(
  `https://api.supabase.com/v1/projects/${ref}/database/query`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  },
)

const text = await res.text()

if (!res.ok) {
  console.error(`FAILED (${res.status}) applying ${file}`)
  console.error(text)
  process.exit(1)
}

console.log(`Applied ${file} to project ${ref}`)
console.log(text.slice(0, 2000))
