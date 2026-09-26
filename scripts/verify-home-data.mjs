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

const url =
  process.env.SUPABASE_URL || env.SUPABASE_URL || env.VITE_SUPABASE_URL
const key =
  process.env.SUPABASE_SECRET_KEY ||
  env.SUPABASE_SECRET_KEY ||
  env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error("Supabase URL/service key is missing")

const client = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const sellerEmails = new Set([
  "maria@kargo.demo",
  "ana@kargo.demo",
  "paolo@kargo.demo",
  "kristine@kargo.demo",
  "jade@kargo.demo",
])
const buyerEmails = new Set([
  "trisha@kargo.demo",
  "carlo@kargo.demo",
  "anna@kargo.demo",
  "mia@kargo.demo",
  "ben@kargo.demo",
  "grace@kargo.demo",
])

const [
  { data: catalog, error: catalogError },
  { data: reactions, error: reactionError },
  { data: authPage, error: authError },
  { data: orders, error: ordersError },
  { data: payments, error: paymentsError },
  { data: waitlist, error: waitlistError },
  { data: reviews, error: reviewsError },
  { data: reactionRows, error: reactionRowsError },
  { data: products, error: productsError },
  { data: batchRows, error: batchesError },
] = await Promise.all([
  client
    .from("batch_catalog")
    .select(
      "batch_id,batch_title,batch_status,starts_on,ends_on,category,batch_total_items,batch_claimed",
    ),
  client
    .from("batch_reaction_counts")
    .select("batch_id,reaction_count,batch_created_at")
    .order("reaction_count", { ascending: false })
    .order("batch_created_at", { ascending: false }),
  client.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  client.from("orders").select("buyer_id,seller_id,status"),
  client.from("payments").select("submitted_by,reviewed_by"),
  client.from("waitlist_entries").select("buyer_id,batch_product_id"),
  client.from("reviews").select("reviewer_id,reviewee_id"),
  client.from("batch_reactions").select("user_id"),
  client.from("batch_products").select("id,batch_id"),
  client.from("batches").select("id,seller_id"),
])

if (catalogError) throw catalogError
for (const error of [
  authError,
  ordersError,
  paymentsError,
  waitlistError,
  reviewsError,
  reactionRowsError,
  productsError,
  batchesError,
]) {
  if (error) throw error
}

const batches = new Map()
for (const row of catalog ?? []) {
  batches.set(row.batch_id, {
    id: row.batch_id,
    title: row.batch_title,
    status: row.batch_status,
    category: row.category,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    items: Number(row.batch_total_items),
    claimed: Number(row.batch_claimed),
  })
}

const rows = [...batches.values()]
const allowed = new Set([
  "Food",
  "Skincare",
  "Grocery & Snacks",
  "Beauty",
  "Luxury",
  "Mixed",
])
const invalid = rows.filter(
  (batch) =>
    batch.status === "draft" ||
    !allowed.has(batch.category) ||
    !batch.startsOn ||
    !batch.endsOn ||
    batch.items <= 0,
)

const demoUsers = (authPage?.users ?? []).filter((user) =>
  user.email?.endsWith("@kargo.demo"),
)
const emailById = new Map(demoUsers.map((user) => [user.id, user.email]))
const buyerIds = new Set(
  demoUsers
    .filter((user) => buyerEmails.has(user.email))
    .map((user) => user.id),
)
const sellerIds = new Set(
  demoUsers
    .filter((user) => sellerEmails.has(user.email))
    .map((user) => user.id),
)
const productBatch = new Map(
  (products ?? []).map((product) => [product.id, product.batch_id]),
)
const batchSeller = new Map(
  (batchRows ?? []).map((batch) => [batch.id, batch.seller_id]),
)
const waitlistSellerIds = new Set(
  (waitlist ?? []).map((entry) =>
    batchSeller.get(productBatch.get(entry.batch_product_id)),
  ),
)

const missingEmails = (ids, predicate) =>
  [...ids].filter((id) => !predicate(id)).map((id) => emailById.get(id))

const buyerCoverage = {
  claims: missingEmails(buyerIds, (id) =>
    orders?.some((row) => row.buyer_id === id),
  ),
  orders: missingEmails(buyerIds, (id) =>
    orders?.some((row) => row.buyer_id === id),
  ),
  payments: missingEmails(buyerIds, (id) =>
    payments?.some((row) => row.submitted_by === id),
  ),
  waitlists: missingEmails(buyerIds, (id) =>
    waitlist?.some((row) => row.buyer_id === id),
  ),
  reviews: missingEmails(buyerIds, (id) =>
    reviews?.some((row) => row.reviewer_id === id || row.reviewee_id === id),
  ),
  reactions: missingEmails(buyerIds, (id) =>
    reactionRows?.some((row) => row.user_id === id),
  ),
}
const sellerCoverage = {
  claims: missingEmails(sellerIds, (id) =>
    orders?.some((row) => row.seller_id === id),
  ),
  orders: missingEmails(sellerIds, (id) =>
    orders?.some((row) => row.seller_id === id),
  ),
  payments: missingEmails(sellerIds, (id) =>
    payments?.some((row) => row.reviewed_by === id),
  ),
  waitlists: missingEmails(sellerIds, (id) => waitlistSellerIds.has(id)),
  reviews: missingEmails(sellerIds, (id) =>
    reviews?.some((row) => row.reviewer_id === id || row.reviewee_id === id),
  ),
}

console.log(
  JSON.stringify(
    {
      eligibleBatchCount: rows.length,
      categories: [...new Set(rows.map((batch) => batch.category))].sort(),
      distinctClaimedTotals: [
        ...new Set(rows.map((batch) => batch.claimed)),
      ].sort((left, right) => left - right),
      invalidEligibleRows: invalid.length,
      latestCandidates: rows.length,
      popularCandidates: reactions?.length ?? 0,
      reactionSchemaReady: !reactionError,
      reactionSchemaError: reactionError?.code ?? null,
      demoCoverage: {
        buyers: buyerIds.size,
        sellers: sellerIds.size,
        missingByBuyerRole: buyerCoverage,
        missingBySellerRole: sellerCoverage,
        totals: {
          orders: orders?.filter(
            (row) => buyerIds.has(row.buyer_id) && sellerIds.has(row.seller_id),
          ).length,
          payments: payments?.filter((row) => buyerIds.has(row.submitted_by))
            .length,
          waitlists: waitlist?.filter((row) => buyerIds.has(row.buyer_id))
            .length,
          reviews: reviews?.filter(
            (row) =>
              buyerIds.has(row.reviewer_id) ||
              buyerIds.has(row.reviewee_id) ||
              sellerIds.has(row.reviewer_id) ||
              sellerIds.has(row.reviewee_id),
          ).length,
          reactions: reactionRows?.filter((row) => buyerIds.has(row.user_id))
            .length,
        },
      },
      topPopular: (reactions ?? []).slice(0, 10).map((row) => ({
        batchId: row.batch_id,
        reactions: Number(row.reaction_count),
        createdAt: row.batch_created_at,
      })),
    },
    null,
    2,
  ),
)
