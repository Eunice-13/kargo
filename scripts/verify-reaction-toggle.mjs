import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const env = {}
for (const line of readFileSync(path.join(root, ".env.local"), "utf8").split(
  /\r?\n/,
)) {
  const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
  if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, "")
}

const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL
const key = env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY
if (!url || !key) throw new Error("Supabase URL/publishable key is missing")

const client = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const { data: signIn, error: signInError } = await client.auth.signInWithPassword({
  email: "grace@kargo.demo",
  password: "KargoDemo123!",
})
if (signInError) throw signInError

const userId = signIn.user.id
const { data: catalog, error: catalogError } = await client
  .from("batch_catalog")
  .select("batch_id,batch_title")
  .limit(1)
if (catalogError) throw catalogError
if (!catalog?.[0]) throw new Error("No visible batch found")

const batchId = catalog[0].batch_id
const readOwn = async () => {
  const { data, error } = await client
    .from("batch_reactions")
    .select("batch_id")
    .eq("batch_id", batchId)
    .eq("user_id", userId)
  if (error) throw error
  return (data?.length ?? 0) > 0
}
const readCount = async () => {
  const { data, error } = await client
    .from("batch_reaction_counts")
    .select("reaction_count")
    .eq("batch_id", batchId)
    .single()
  if (error) throw error
  return Number(data.reaction_count)
}

const originallyReacted = await readOwn()
const countBefore = await readCount()
let restored = false
try {
  const { data: mutationResult, error: mutationError } = await client.rpc(
    "set_batch_reaction",
    {
      p_batch_id: batchId,
      p_reacted: !originallyReacted,
    },
  )
  if (mutationError) throw mutationError

  const reactedAfter = await readOwn()
  const countAfter = await readCount()
  const confirmed = mutationResult?.[0]
  const expectedCount = countBefore + (originallyReacted ? -1 : 1)
  if (
    reactedAfter === originallyReacted ||
    countAfter !== expectedCount ||
    Boolean(confirmed?.reacted) !== reactedAfter ||
    Number(confirmed?.reaction_count) !== countAfter
  ) {
    throw new Error(
      `Toggle mismatch: own ${originallyReacted} -> ${reactedAfter}, count ${countBefore} -> ${countAfter}`,
    )
  }

  console.log(
    JSON.stringify(
      {
        batchId,
        batchTitle: catalog[0].batch_title,
        originallyReacted,
        reactedAfter,
        countBefore,
        countAfter,
      },
      null,
      2,
    ),
  )
} finally {
  const { error: restoreError } = await client.rpc("set_batch_reaction", {
    p_batch_id: batchId,
    p_reacted: originallyReacted,
  })
  if (restoreError) throw restoreError
  restored = true
}

if (!restored) throw new Error("Reaction was not restored")
await client.auth.signOut()
