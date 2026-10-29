import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"

const limit = Number(process.argv[2] ?? 3)
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const index = line.indexOf("=")
      return [line.slice(0, index), line.slice(index + 1)]
    }),
)
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY)
const queries = {
  skincare: "Korean skincare cosmetics",
  market: "Thai market shopping",
  fashion: "fashion clothing store",
  food: "international grocery snacks",
  shopping: "shopping mall products",
  beauty: "beauty cosmetics product",
}
const sources = []
const seenSources = new Set()

for (const [kind, query] of Object.entries(queries)) {
  const endpoint = `https://commons.wikimedia.org/w/api.php?${new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: query,
    gsrnamespace: "6",
    gsrlimit: "50",
    prop: "imageinfo",
    iiprop: "url|size",
    iiurlwidth: "1200",
    format: "json",
    origin: "*",
  })}`
  const response = await fetch(endpoint)
  if (!response.ok) throw new Error(`Commons search failed: ${response.status}`)
  const payload = await response.json()
  for (const page of Object.values(payload.query?.pages ?? {})) {
    const source = page.imageinfo?.[0]?.thumburl
    if (source && !seenSources.has(source)) {
      seenSources.add(source)
      sources.push({ kind, source })
    }
  }
}

const { data: batches, error: batchError } = await db
  .from("batches")
  .select("id,category,cover_path,gallery_paths")
  .order("created_at")
if (batchError) throw batchError
const { data: products, error: productError } = await db
  .from("batch_products")
  .select("id,batch_id,name,image_path")
  .order("created_at")
if (productError) throw productError

const allPaths = [
  ...batches.flatMap((batch) => [batch.cover_path, ...(batch.gallery_paths ?? [])]),
  ...products.map((product) => product.image_path),
].filter(Boolean)
const usedHashes = new Set()

for (const path of allPaths) {
  const publicUrl = db.storage.from("batch-media").getPublicUrl(path).data.publicUrl
  const response = await fetch(publicUrl)
  if (response.ok) {
    usedHashes.add(
      createHash("sha256").update(Buffer.from(await response.arrayBuffer())).digest("hex"),
    )
  }
}

function batchKinds(category) {
  const value = (category ?? "").toLowerCase()
  if (value.includes("beaut")) return ["skincare", "beauty", "market"]
  if (value.includes("apparel") || value.includes("fashion")) return ["fashion", "shopping"]
  if (value.includes("food")) return ["food", "market", "shopping"]
  return ["shopping", "market", "fashion"]
}

function productKinds(name) {
  const value = name.toLowerCase()
  if (/lip|blush|cream|serum|mask|sunscreen|skincare|beauty|powder|essence|bioderma|shiseido|laneige|cosrx|nars|mac|aesop|etude|anua|round lab|rare|charlotte/.test(value)) return ["skincare", "beauty", "market"]
  if (/tee|pants|trouser|knit|denim|thrift|shirt|wallet/.test(value)) return ["fashion", "shopping"]
  if (/coffee|tea|snack|chocolate|banana|kitkat|pastr|cake|takoyaki|cookie|miso|tangerine|tim tam|grocery/.test(value)) return ["food", "market", "shopping"]
  return ["shopping", "market", "food"]
}

async function uploadUnique(pathStem, preferredKinds) {
  for (const kind of [...preferredKinds, ...Object.keys(queries)]) {
    for (const candidate of sources) {
      if (candidate.kind !== kind) continue
      const response = await fetch(candidate.source, { redirect: "error" })
      const contentType = response.headers.get("content-type") ?? ""
      if (!response.ok || !contentType.startsWith("image/")) continue
      const image = new Uint8Array(await response.arrayBuffer())
      const hash = createHash("sha256").update(image).digest("hex")
      if (!image.byteLength || image.byteLength > 5 * 1024 * 1024 || usedHashes.has(hash)) continue
      const extension = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg"
      const path = `${pathStem}.${extension}`
      const { error } = await db.storage.from("batch-media").upload(path, image, { contentType, upsert: true })
      if (error) throw error
      usedHashes.add(hash)
      return path
    }
  }
  throw new Error("No remaining verified unique source image")
}

const incomplete = batches.filter((batch) => !batch.cover_path || (batch.gallery_paths?.length ?? 0) < 3).slice(0, limit)
let covers = 0
let galleryImages = 0
let productImages = 0

for (const batch of incomplete) {
  const base = `curated-media/${batch.id}`
  const preferred = batchKinds(batch.category)
  const changes = {}
  if (!batch.cover_path) {
    changes.cover_path = await uploadUnique(`${base}/cover`, preferred)
    covers++
  }
  const gallery = [...(batch.gallery_paths ?? [])]
  while (gallery.length < 3) {
    gallery.push(await uploadUnique(`${base}/gallery-${gallery.length + 1}`, preferred))
    galleryImages++
  }
  changes.gallery_paths = gallery
  const { error } = await db.from("batches").update(changes).eq("id", batch.id)
  if (error) throw error
  for (const product of products.filter((product) => product.batch_id === batch.id && !product.image_path)) {
    const path = await uploadUnique(`${base}/product-${product.id}`, productKinds(product.name))
    const { error: imageError } = await db.from("batch_products").update({ image_path: path }).eq("id", product.id)
    if (imageError) throw imageError
    productImages++
  }
}

console.log(JSON.stringify({ batches: incomplete.length, covers, galleryImages, productImages, uniqueImages: usedHashes.size }))
