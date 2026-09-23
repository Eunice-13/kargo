import type {
  BatchExpenses,
  BatchType,
  BirState,
  ClaimRow,
  WaitlistEntry,
  ExpenseItem,
  ExpenseMode,
  FulfillmentOrder,
  OrderRow,
  PayHistRow,
  ToPayRow,
  UserInfo,
  SellerWaitlistGroup,
} from "@/types"
import { requireSupabase } from "@/lib/supabase"
import { resolveContactUrl } from "@/components/shared/contactLink"

type DbProfile = {
  id: string
  display_name: string
  bio: string | null
  social_links: Record<string, string> | null
  social_visibility: Record<string, boolean> | null
  avatar_path: string | null
  can_sell: boolean
  bir_status: "none" | "pending" | "verified" | "flagged"
  account_status: "active" | "suspended"
  notification_preferences: Record<string, boolean> | null
  waitlist_response_hours: number | null
}

export type LoadedAppData = {
  user: UserInfo
  batches: BatchType[]
  claims: ClaimRow[]
  toPay: ToPayRow[]
  payHistory: PayHistRow[]
  orders: OrderRow[]
  fulfillment: FulfillmentOrder[]
  waitlist: WaitlistEntry[]
  sellerWaitlist: SellerWaitlistGroup[]
}

const birToUi: Record<DbProfile["bir_status"], BirState> = {
  none: "None",
  pending: "Verifying",
  verified: "Verified",
  flagged: "None",
}

function statusToClaim(status: string): ClaimRow["status"] {
  if (status === "expired") return "Expired"
  if (status === "cancelled" || status === "incomplete") return "Cancelled"
  if (status === "insufficient_payment") return "Insufficient Payment"
  if (["payment_confirmed", "preparing", "completed"].includes(status)) {
    return "Paid and Reserved"
  }
  return "Pending"
}

function statusToStep(status: string) {
  return {
    payment_pending: 1,
    payment_submitted: 2,
    insufficient_payment: 2,
    payment_confirmed: 3,
    preparing: 4,
    completed: 5,
    cancelled: 0,
    expired: 0,
    incomplete: 0,
  }[status] ?? 1
}

function statusToColumn(status: string): FulfillmentOrder["col"] {
  if (status === "payment_pending") return "Pending Payment"
  if (status === "payment_confirmed") return "Payment Confirmed"
  if (status === "preparing") return "Preparing"
  if (status === "completed") return "Completed"
  if (["cancelled", "expired", "incomplete"].includes(status)) return "Cancelled"
  return "Claimed"
}

function numericId(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (Math.imul(hash, 31) + value.charCodeAt(index)) | 0
  }
  return Math.abs(hash) || 1
}

async function profileFor(id: string, email: string): Promise<UserInfo> {
  const client = requireSupabase()
  const { data, error } = await client
    .from("profiles")
    .select("id,display_name,bio,social_links,social_visibility,avatar_path,can_sell,bir_status,account_status,notification_preferences,waitlist_response_hours")
    .eq("id", id)
    .single()
  if (error) throw error
  const profile = data as DbProfile
  const avatarUrl = profile.avatar_path
    ? client.storage.from("profile-avatars").getPublicUrl(profile.avatar_path).data.publicUrl
    : undefined
  return {
    id,
    name: profile.display_name,
    email,
    role: profile.can_sell ? "Seller" : "Buyer",
    bio: profile.bio ?? undefined,
    fb: profile.social_links?.Facebook,
    socialLinks: profile.social_links ?? {},
    socialVisibility: profile.social_visibility ?? {},
    avatarUrl,
    sellerEnabled: profile.can_sell,
    birState: birToUi[profile.bir_status],
    accountStatus: profile.account_status,
    notificationPreferences: profile.notification_preferences ?? {},
    waitlistResponseHours: profile.waitlist_response_hours ?? 24,
  }
}

export async function signIn(email: string, password: string) {
  const client = requireSupabase()
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw error
  return profileFor(data.user.id, data.user.email ?? email)
}

export async function signUp(input: {
  name: string
  email: string
  password: string
  shopName?: string
  phone?: string
  socials?: Record<string, { on: boolean; url: string }>
  role?: "Buyer" | "Seller"
}) {
  const client = requireSupabase()
  const { data, error } = await client.auth.signUp({
    email: input.email,
    password: input.password,
    options: { data: { display_name: input.name } },
  })
  if (error) throw error
  if (!data.user) throw new Error("Supabase did not return a user")
  if (!data.session) return { needsEmailConfirmation: true as const, user: null }

  const links = Object.fromEntries(
    Object.entries(input.socials ?? {})
      .filter(([, value]) => value.on && value.url.trim())
      .map(([provider, value]) => [provider, value.url.trim()]),
  )
  const { error: updateError } = await client
    .from("profiles")
    .update({
      display_name: input.name,
      shop_name: input.shopName || null,
      phone: input.phone || null,
      social_links: links,
      social_visibility: Object.fromEntries(Object.keys(links).map((key) => [key, true])),
      can_sell: input.role === "Seller",
    })
    .eq("id", data.user.id)
  if (updateError) throw updateError
  return {
    needsEmailConfirmation: false as const,
    user: await profileFor(data.user.id, data.user.email ?? input.email),
  }
}

export async function requestPasswordReset(email: string) {
  const client = requireSupabase()
  const redirectTo = `${window.location.origin}/reset-password`
  const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo })
  if (error) throw error
}

export async function signOut() {
  const { error } = await requireSupabase().auth.signOut()
  if (error) throw error
}

export async function loadCurrentAppData(): Promise<LoadedAppData | null> {
  const client = requireSupabase()
  const { data: auth } = await client.auth.getUser()
  if (!auth.user) return null
  const user = await profileFor(auth.user.id, auth.user.email ?? "")

  const [{ data: catalog, error: catalogError }, { data: dbOrders, error: ordersError }] =
    await Promise.all([
      client.from("batch_catalog").select("*"),
      client
        .from("orders")
        .select("*,batch_products(name,batch_id,batches(title)),payments(amount,status,method_type,submitted_at),reviews(*)")
        .order("created_at", { ascending: false }),
    ])
  if (catalogError) throw catalogError
  if (ordersError) throw ordersError

  const participantIds = [...new Set([...(dbOrders ?? []).flatMap((row) => [row.buyer_id, row.seller_id]), ...(catalog ?? []).map((row) => row.seller_id)])]
  const participantNames = new Map<string, string>()
  const verifiedSellers = new Set<string>()
  const participantLinks = new Map<string, string | undefined>()
  if (participantIds.length > 0) {
    const { data: participants, error: participantsError } = await client
      .from("public_profiles")
      .select("id,display_name,bir_status,social_links")
      .in("id", participantIds)
    if (participantsError) throw participantsError
    for (const participant of participants ?? []) {
      participantNames.set(participant.id, participant.display_name)
      participantLinks.set(participant.id, resolveContactUrl(participant.social_links ?? undefined))
      if (participant.bir_status === "verified") verifiedSellers.add(participant.id)
    }
  }

  const batchMap = new Map<string, BatchType>()
  for (const row of catalog ?? []) {
    const current: BatchType = batchMap.get(row.batch_id) ?? {
      id: numericId(row.batch_id),
      dbId: row.batch_id,
      live: row.batch_status === "live",
      locked: row.batch_status === "locked",
      title: row.batch_title,
      seller: row.seller_name,
      sellerId: row.seller_id,
      sellerFb: participantLinks.get(row.seller_id),
      sellerBirVerified: verifiedSellers.has(row.seller_id),
      rating: Number(row.rating ?? 0),
      trips: `${row.starts_on} – ${row.ends_on}`,
      items: Number(row.batch_total_items ?? 0),
      claimed: Number(row.batch_claimed ?? 0),
      category: row.category,
      reserveHours: row.reservation_hours,
      notes: row.notes ?? undefined,
      products: [],
    }
    current.products.push({
      id: numericId(row.product_id),
      dbId: row.product_id,
      name: row.product_name,
      basePrice: Number(row.base_price),
      markup: Number(row.markup),
      price: Number(row.selling_price),
      qty: row.quantity_total,
      claimed: Number(row.quantity_claimed ?? 0),
      waitlist: Number(row.waitlist_count ?? 0),
      locked: row.product_locked,
      limitPerUser:
        row.limit_per_user != null && Number(row.limit_per_user) > 0
          ? Number(row.limit_per_user)
          : undefined,
    })
    batchMap.set(row.batch_id, current)
  }

  const claims: ClaimRow[] = []
  const orders: OrderRow[] = []
  const fulfillment: FulfillmentOrder[] = []
  const payHistory: PayHistRow[] = []
  const toPay: ToPayRow[] = []
  for (const row of dbOrders ?? []) {
    const product = row.batch_products as unknown as {
      name: string
      batch_id: string
      batches: { title: string }
    }
    const isBuyer = row.buyer_id === auth.user.id
    const sellerName = participantNames.get(row.seller_id) ?? batchMap.get(product.batch_id)?.seller ?? "Seller"
    const buyerName = participantNames.get(row.buyer_id) ?? "Buyer"
    const ownReview = (row.reviews ?? []).find((review: { reviewer_id: string }) => review.reviewer_id === auth.user.id) as
      | { rating: number; comment: string | null; quick_statements?: string[] | null; created_at: string; updated_at: string }
      | undefined
    const expires = new Date(row.reservation_expires_at).getTime()
    const hours = Math.max(0, Math.ceil((expires - Date.now()) / 3_600_000))
    const deadlineExpired = expires <= Date.now() && ["payment_pending", "insufficient_payment"].includes(row.status)
    if (isBuyer) {
      claims.push({
        id: row.id,
        productId: row.batch_product_id,
        product: product.name,
        batch: product.batches.title,
        seller: sellerName,
        sellerId: row.seller_id,
        sellerFb: participantLinks.get(row.seller_id),
        qty: row.quantity,
        amount: Number(row.total_amount),
        status: deadlineExpired ? "Expired" : statusToClaim(row.status),
        hours,
        expiresAt: row.reservation_expires_at,
        extensionRequested: row.extension_status === "pending",
      })
      orders.push({
        id: row.order_number,
        dbId: row.id,
        product: product.name,
        batch: product.batches.title,
        seller: sellerName,
        sellerFb: participantLinks.get(row.seller_id),
        amount: Number(row.total_amount),
        step: statusToStep(row.status),
        trackingNo: row.tracking_number,
        eta: row.eta ? new Date(row.eta).toLocaleDateString() : "Pending",
        rated: Boolean(ownReview),
        rating: ownReview?.rating,
        reviewComment: ownReview?.comment ?? undefined,
        reviewStatements: ownReview?.quick_statements ?? undefined,
        reviewCreatedAt: ownReview?.created_at,
        reviewUpdatedAt: ownReview?.updated_at,
      })
    } else {
      claims.push({
        id: row.id,
        productId: row.batch_product_id,
        product: product.name,
        batch: product.batches.title,
        seller: user.name,
        buyer: buyerName,
        buyerFb: participantLinks.get(row.buyer_id),
        qty: row.quantity,
        amount: Number(row.total_amount),
        status: deadlineExpired ? "Expired" : statusToClaim(row.status),
        hours,
        expiresAt: row.reservation_expires_at,
        extensionRequested: row.extension_status === "pending",
      })
      fulfillment.push({
        id: row.id,
        dbId: row.id,
        col: statusToColumn(row.status),
        buyer: buyerName,
        buyerFb: participantLinks.get(row.buyer_id),
        product: product.name,
        qty: row.quantity,
        amount: Number(row.total_amount),
        rated: Boolean(ownReview),
        rating: ownReview?.rating,
        reviewComment: ownReview?.comment ?? undefined,
        reviewStatements: ownReview?.quick_statements ?? undefined,
        reviewCreatedAt: ownReview?.created_at,
        reviewUpdatedAt: ownReview?.updated_at,
      })
    }
    const verifiedPaid = (row.payments ?? [])
      .filter((payment: { status: string }) => payment.status === "verified")
      .reduce((sum: number, payment: { amount: number | string }) => sum + Number(payment.amount), 0)
    if (isBuyer && !deadlineExpired && ["payment_pending", "insufficient_payment"].includes(row.status)) {
      toPay.push({
        id: row.id,
        orderId: row.id,
        product: product.name,
        seller: sellerName,
        sellerId: row.seller_id,
        qty: row.quantity,
        amount: Math.max(0, Number(row.total_amount) - verifiedPaid),
        hours,
        expiresAt: row.reservation_expires_at,
      })
    }
    for (const payment of row.payments ?? []) {
      if (!isBuyer) continue
      payHistory.push({
        id: `${row.id}-${payment.submitted_at}`,
        product: product.name,
        batch: product.batches.title,
        method: payment.method_type,
        amount: Number(payment.amount),
        date: new Date(payment.submitted_at).toLocaleDateString(),
        status: statusToClaim(row.status),
      })
    }
  }

  const waitlist = await loadBuyerWaitlist(client, auth.user.id, batchMap)
  const sellerWaitlist = user.sellerEnabled
    ? await loadSellerWaitlist(client, auth.user.id)
    : []
  return { user, batches: [...batchMap.values()], claims, toPay, payHistory, orders, fulfillment, waitlist, sellerWaitlist }
}

// Seller view: every product the seller owns that has waiting buyers, each with
// its ordered queue (buyer name + contact link + join position). RLS
// (waitlist_select_buyer_or_seller) already scopes this to the seller's own
// products, so a non-seller call returns nothing.
async function loadSellerWaitlist(
  client: ReturnType<typeof requireSupabase>,
  sellerId: string,
): Promise<SellerWaitlistGroup[]> {
  const { data, error } = await client
    .from("waitlist_entries")
    .select("batch_product_id, buyer_id, joined_at, desired_quantity, batch_products(name, batch_id, batches(title, seller_id))")
    .in("status", ["waiting", "offered"])
    .order("joined_at", { ascending: true })
  if (error) throw error
  type Row = {
    batch_product_id: string
    buyer_id: string
    joined_at: string
    desired_quantity: number
    batch_products: {
      name: string
      batch_id: string
      batches: { title: string; seller_id: string } | null
    } | null
  }
  const rows = (data ?? []) as unknown as Row[]
  // Keep only rows for products owned by this seller.
  const mine = rows.filter((r) => r.batch_products?.batches?.seller_id === sellerId)
  if (mine.length === 0) return []

  // Resolve buyer names + contact links.
  const buyerIds = [...new Set(mine.map((r) => r.buyer_id))]
  const names = new Map<string, string>()
  const links = new Map<string, string | undefined>()
  if (buyerIds.length) {
    const { data: profiles } = await client
      .from("public_profiles")
      .select("id,display_name,social_links")
      .in("id", buyerIds)
    for (const profile of profiles ?? []) {
      names.set(profile.id, profile.display_name)
      links.set(profile.id, resolveContactUrl(profile.social_links ?? undefined))
    }
  }

  // Group by product, preserving join order for queue positions.
  const groups = new Map<string, SellerWaitlistGroup>()
  for (const r of mine) {
    const productId = r.batch_product_id
    let group = groups.get(productId)
    if (!group) {
      group = {
        productId,
        product: r.batch_products?.name ?? "Product",
        batch: r.batch_products?.batches?.title ?? "",
        queue: [],
      }
      groups.set(productId, group)
    }
    group.queue.push({
      buyer: names.get(r.buyer_id) ?? "Buyer",
      buyerFb: links.get(r.buyer_id),
      position: group.queue.length + 1,
      joinedAt: r.joined_at,
      desiredQuantity: r.desired_quantity ?? 1,
    })
  }
  return [...groups.values()]
}

async function loadBuyerWaitlist(
  client: ReturnType<typeof requireSupabase>,
  userId: string,
  batchMap: Map<string, BatchType>,
): Promise<WaitlistEntry[]> {
  const { data, error } = await client
    .from("waitlist_entries")
    .select("id, batch_product_id, joined_at, status, desired_quantity, offer_quantity, offer_expires_at, batch_products(name, selling_price, batch_id)")
    .eq("buyer_id", userId)
    .in("status", ["waiting", "offered"])
  if (error) throw error
  type WaitlistDbRow = {
    id: string
    batch_product_id: string
    joined_at: string
    status: "waiting" | "offered" | "converted" | "cancelled"
    desired_quantity: number
    offer_quantity: number | null
    offer_expires_at: string | null
    batch_products: Array<{ name: string; selling_price: number | string; batch_id: string }> | null
  }
  const rows = (data ?? []) as unknown as WaitlistDbRow[]
  const productIds = [...new Set(rows.map((row: { batch_product_id: string }) => row.batch_product_id))]
  let peers: { batch_product_id: string; joined_at: string }[] = []
  if (productIds.length > 0) {
    const { data: peerRows, error: peerError } = await client
      .from("waitlist_entries")
      .select("batch_product_id, joined_at")
      .in("batch_product_id", productIds)
      .eq("status", "waiting")
    if (peerError) throw peerError
    peers = peerRows ?? []
  }
  return rows.map((row) => {
    const product = row.batch_products?.[0]
    const batch = product ? batchMap.get(product.batch_id) : undefined
    const joined = new Date(row.joined_at).getTime()
    const queue = peers.filter((p) => p.batch_product_id === row.batch_product_id)
    const position = queue.filter((p) => new Date(p.joined_at).getTime() <= joined).length
    const catalogProduct = batch?.products.find((p) => p.dbId === row.batch_product_id)
    return {
      id: row.id,
      productId: row.batch_product_id,
      product: product?.name ?? catalogProduct?.name ?? "Product",
      batchId: batch?.id ?? (product ? numericId(product.batch_id) : 0),
      batch: batch?.title ?? "",
      seller: batch?.seller ?? "",
      trips: batch?.trips ?? "",
      position: Math.max(1, position),
      queueSize: catalogProduct?.waitlist ?? queue.length,
      amount: Number(product?.selling_price ?? catalogProduct?.price ?? 0),
      desiredQuantity: row.desired_quantity ?? 1,
      status: row.status,
      offerQuantity: row.offer_quantity ?? undefined,
      offerExpiresAt: row.offer_expires_at ?? undefined,
    }
  })
}

export async function claimProduct(productId: string, quantity: number) {
  const { data, error } = await requireSupabase().rpc("claim_batch_product", {
    p_batch_product_id: productId,
    p_quantity: quantity,
  })
  if (error) throw error
  return data
}

export async function createBatch(batch: {
  title: string
  category: string
  startsOn: string
  endsOn: string
  reservationHours: number
  notes?: string
  products: Array<{ name: string; basePrice: number; markup: number; quantity: number; limitPerUser?: number }>
}) {
  const client = requireSupabase()
  const { data: auth } = await client.auth.getUser()
  if (!auth.user) throw new Error("Authentication required")
  const { data: created, error } = await client
    .from("batches")
    .insert({
      seller_id: auth.user.id,
      title: batch.title,
      status: "live",
      starts_on: batch.startsOn,
      ends_on: batch.endsOn,
      category: batch.category,
      reservation_hours: batch.reservationHours,
      notes: batch.notes ?? null,
    })
    .select("id")
    .single()
  if (error) throw error
  const { error: productsError } = await client.from("batch_products").insert(
    batch.products.map((product) => ({
      batch_id: created.id,
      name: product.name,
      base_price: product.basePrice,
      markup: product.markup,
      quantity_total: product.quantity,
      limit_per_user:
        product.limitPerUser && product.limitPerUser > 0
          ? product.limitPerUser
          : null,
    })),
  )
  if (productsError) throw productsError
  return created.id as string
}

export async function uploadBirBadge(file: File) {
  const client = requireSupabase()
  const { data: auth } = await client.auth.getUser()
  if (!auth.user) throw new Error("Sign in before uploading a BIR badge")
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg"
  const objectPath = `${auth.user.id}/${crypto.randomUUID()}.${extension}`
  const { error: uploadError } = await client.storage
    .from("bir-certificates")
    .upload(objectPath, file, { upsert: false })
  if (uploadError) throw uploadError
  const { error: submitError } = await client.rpc("submit_bir_badge", {
    p_object_path: objectPath,
  })
  if (submitError) throw submitError
  const { data, error } = await client.functions.invoke("verify-bir-badge", {
    body: { objectPath },
  })
  if (error) throw error
  return data as { status: "verified" | "none"; reason: "unreadable" | "bad_domain" | null }
}

export async function submitPayment(input: {
  orderId: string
  method: string
  amount: number
  referenceNumber?: string
  receipt?: File
  payerAccountName?: string
  payerPhone?: string
  buyerContactUrl?: string
}) {
  const client = requireSupabase()
  const { data: auth } = await client.auth.getUser()
  if (!auth.user) throw new Error("Authentication required")
  let receiptPath: string | null = null
  if (input.receipt) {
    const extension = input.receipt.name.split(".").pop()?.toLowerCase() || "jpg"
    receiptPath = `${auth.user.id}/${crypto.randomUUID()}.${extension}`
    const { error: uploadError } = await client.storage
      .from("payment-receipts")
      .upload(receiptPath, input.receipt)
    if (uploadError) throw uploadError
  }
  const { data, error } = await client.rpc("submit_order_payment", {
    p_order_id: input.orderId,
    p_method_type: input.method,
    p_amount: input.amount,
    p_reference_number: input.referenceNumber ?? null,
    p_receipt_path: receiptPath,
    p_payer_account_name: input.payerAccountName ?? null,
    p_payer_phone: input.payerPhone ?? null,
    p_buyer_contact_url: input.buyerContactUrl ?? null,
  })
  if (error) throw error
  const result = data as { accepted?: boolean; error?: string } | null
  if (!result?.accepted) throw new Error(result?.error || "Payment was rejected")
  return result
}

export async function requestOrderExtension(orderId: string, hours: number, reason?: string) {
  const { error } = await requireSupabase().rpc("request_order_extension", {
    p_order_id: orderId,
    p_hours: hours,
    p_reason: reason ?? null,
  })
  if (error) throw error
}

export async function cancelOrder(orderId: string) {
  const { error } = await requireSupabase().rpc("cancel_order", { p_order_id: orderId })
  if (error) throw error
}

export async function expireClaim(orderId: string) {
  const { data, error } = await requireSupabase().rpc("expire_claim_if_due", { p_order_id: orderId })
  if (error) throw error
  return Boolean(data)
}

export async function setFulfillmentStatus(orderId: string, status: string) {
  const { error } = await requireSupabase().rpc("set_fulfillment_status", {
    p_order_id: orderId,
    p_status: status,
    p_tracking_number: null,
    p_eta: null,
  })
  if (error) throw error
}

export async function updateProfile(values: {
  displayName?: string
  bio?: string
  socialLinks?: Record<string, string>
  socialVisibility?: Record<string, boolean>
  canSell?: boolean
  email?: string
  notificationPreferences?: Record<string, boolean>
  waitlistResponseHours?: number
}) {
  const client = requireSupabase()
  const payload: Record<string, unknown> = {}
  if (values.displayName !== undefined) payload.display_name = values.displayName
  if (values.bio !== undefined) payload.bio = values.bio
  if (values.socialLinks !== undefined) payload.social_links = values.socialLinks
  if (values.socialVisibility !== undefined) payload.social_visibility = values.socialVisibility
  if (values.canSell !== undefined) payload.can_sell = values.canSell
  if (values.notificationPreferences !== undefined) payload.notification_preferences = values.notificationPreferences
  if (values.waitlistResponseHours !== undefined) payload.waitlist_response_hours = values.waitlistResponseHours
  if (values.email) {
    const { error: authError } = await client.auth.updateUser({ email: values.email })
    if (authError) throw authError
  }
  const { error } = await client.from("profiles").update(payload).eq("id", (await client.auth.getUser()).data.user?.id)
  if (error) throw error
}

export async function loadAddresses() {
  const { data, error } = await requireSupabase().from("addresses").select("*").order("created_at")
  if (error) throw error
  return data ?? []
}

export async function saveAddress(input: {
  id?: string
  label: string
  addressLine: string
  city: string
  isDefault: boolean
}) {
  const client = requireSupabase()
  const userId = (await client.auth.getUser()).data.user?.id
  if (!userId) throw new Error("Authentication required")
  if (input.isDefault) await client.from("addresses").update({ is_default: false }).eq("user_id", userId)
  const row = {
    user_id: userId,
    label: input.label,
    address_line: input.addressLine,
    city: input.city || null,
    is_default: input.isDefault,
  }
  const query = input.id
    ? client.from("addresses").update(row).eq("id", input.id)
    : client.from("addresses").insert(row)
  const { error } = await query
  if (error) throw error
}

export async function deleteAddress(id: string) {
  const { error } = await requireSupabase().from("addresses").delete().eq("id", id)
  if (error) throw error
}

export async function setBatchLock(batchId: string, locked: boolean) {
  const { error } = await requireSupabase()
    .from("batches")
    .update({ status: locked ? "locked" : "live" })
    .eq("id", batchId)
  if (error) throw error
}

export async function setProductLock(productId: string, locked: boolean) {
  const { error } = await requireSupabase()
    .from("batch_products")
    .update({ is_locked: locked })
    .eq("id", productId)
  if (error) throw error
}

// Join (or update) a waitlist entry with the buyer's desired quantity. The
// quantity drives the full-vs-partial match decision when stock later frees up.
export async function joinWaitlist(productId: string, quantity: number = 1) {
  const { error } = await requireSupabase().rpc("join_waitlist", {
    p_product_id: productId,
    p_quantity: Math.max(1, Math.floor(quantity)),
  })
  if (error) throw error
}

// Buyer accepts or declines a partial-match waitlist offer. Accepting claims the
// offered quantity on their behalf; declining (or timing out) rolls the offer to
// the next buyer in the queue.
export async function respondWaitlistOffer(waitlistId: string, accept: boolean) {
  const { error } = await requireSupabase().rpc("respond_waitlist_offer", {
    p_waitlist_id: waitlistId,
    p_accept: accept,
  })
  if (error) throw error
}

// Seller updates how many hours a waitlisted buyer has to respond to a
// partial-match offer (Dashboard waitlist section).
export async function setWaitlistResponseHours(hours: number) {
  return updateProfile({ waitlistResponseHours: Math.max(1, Math.floor(hours)) })
}

export async function createReview(orderId: string, rating: number, comment?: string, statements: string[] = []) {
  const { error } = await requireSupabase().rpc("create_order_review", {
    p_order_id: orderId,
    p_rating: rating,
    p_comment: comment ?? null,
    p_quick_statements: statements,
  })
  if (error) throw error
}

export async function uploadProfileAvatar(file: File) {
  const client = requireSupabase()
  const userId = (await client.auth.getUser()).data.user?.id
  if (!userId) throw new Error("Authentication required")
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg"
  const objectPath = `${userId}/avatar.${extension}`
  const { error: uploadError } = await client.storage
    .from("profile-avatars")
    .upload(objectPath, file, { upsert: true, contentType: file.type || undefined })
  if (uploadError) throw uploadError
  const { error: profileError } = await client.from("profiles").update({ avatar_path: objectPath }).eq("id", userId)
  if (profileError) throw profileError
  return client.storage.from("profile-avatars").getPublicUrl(objectPath).data.publicUrl
}

export async function createBuyerRequest(batchId: string, productName: string, quantity: number, message?: string) {
  const { error } = await requireSupabase().rpc("create_buyer_request", {
    p_batch_id: batchId,
    p_product_name: productName,
    p_quantity: quantity,
    p_message: message ?? null,
  })
  if (error) throw error
}

export async function loadPaymentMethods() {
  const { data, error } = await requireSupabase()
    .from("seller_payment_methods")
    .select("*")
    .eq("is_active", true)
    .order("created_at")
  if (error) throw error
  return data ?? []
}

// Upload a seller's payment QR image to the public payment-qr bucket and return
// its object path (stored in seller_payment_methods.qr_path).
export async function uploadPaymentQr(file: File): Promise<string> {
  const client = requireSupabase()
  const userId = (await client.auth.getUser()).data.user?.id
  if (!userId) throw new Error("Authentication required")
  const extension = file.name.split(".").pop()?.toLowerCase() || "png"
  const objectPath = `${userId}/qr-${Date.now()}.${extension}`
  const { error } = await client.storage
    .from("payment-qr")
    .upload(objectPath, file, { upsert: true, contentType: file.type || undefined })
  if (error) throw error
  return objectPath
}

export function paymentQrUrl(qrPath?: string | null): string | undefined {
  if (!qrPath) return undefined
  return requireSupabase().storage.from("payment-qr").getPublicUrl(qrPath).data.publicUrl
}

// Buyer-facing: a seller's display-safe receive methods (type, name, number,
// public QR image URL) via the seller_receive_methods security-definer RPC.
export type SellerReceiveMethod = {
  methodType: string
  accountName: string | null
  accountNumber: string | null
  qrUrl?: string
}
export async function loadSellerReceiveMethods(sellerId: string): Promise<SellerReceiveMethod[]> {
  const { data, error } = await requireSupabase().rpc("seller_receive_methods", { p_seller_id: sellerId })
  if (error) throw error
  return (data ?? []).map((row: { method_type: string; account_name: string | null; account_number: string | null; qr_path: string | null }) => ({
    methodType: row.method_type,
    accountName: row.account_name,
    accountNumber: row.account_number,
    qrUrl: paymentQrUrl(row.qr_path),
  }))
}

export async function addPaymentMethod(
  methodType: string,
  accountName: string,
  accountNumber: string,
  qrFile?: File,
) {
  const client = requireSupabase()
  const userId = (await client.auth.getUser()).data.user?.id
  if (!userId) throw new Error("Authentication required")
  const qrPath = qrFile ? await uploadPaymentQr(qrFile) : null
  const { error } = await client.from("seller_payment_methods").insert({
    seller_id: userId,
    method_type: methodType,
    account_name: accountName,
    account_number: accountNumber,
    qr_path: qrPath,
  })
  if (error) throw error
}

export async function updatePaymentMethod(
  id: string,
  methodType: string,
  accountNumber: string,
  verified?: boolean,
  qrFile?: File,
) {
  const values: Record<string, unknown> = { method_type: methodType, account_number: accountNumber }
  if (verified !== undefined) values.is_verified = verified
  if (qrFile) values.qr_path = await uploadPaymentQr(qrFile)
  const { error } = await requireSupabase().from("seller_payment_methods").update(values).eq("id", id)
  if (error) throw error
}

export async function deactivatePaymentMethod(id: string) {
  const { error } = await requireSupabase().from("seller_payment_methods").update({ is_active: false }).eq("id", id)
  if (error) throw error
}

export async function loadNotifications() {
  const { data, error } = await requireSupabase()
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20)
  if (error) throw error
  return data ?? []
}

export async function markNotificationRead(id?: string) {
  const client = requireSupabase()
  let query = client.from("notifications").update({ read_at: new Date().toISOString() })
  if (id) query = query.eq("id", id)
  else query = query.is("read_at", null)
  const { error } = await query
  if (error) throw error
}

export async function loadSellerPaymentSubmissions() {
  const client = requireSupabase()
  const { data, error } = await client
    .from("payments")
    .select("*,orders!inner(total_amount,buyer_id,batch_products(name))")
    .order("submitted_at", { ascending: false })
  if (error) throw error
  const buyerIds = [...new Set((data ?? []).map((row) => row.orders.buyer_id as string))]
  const names = new Map<string, string>()
  if (buyerIds.length) {
    const { data: profiles } = await client.from("public_profiles").select("id,display_name").in("id", buyerIds)
    for (const profile of profiles ?? []) names.set(profile.id, profile.display_name)
  }
  return (data ?? []).map((row) => ({
    id: row.id as string,
    buyer: names.get(row.orders.buyer_id) ?? "Buyer",
    product: row.orders.batch_products.name as string,
    amount: Number(row.orders.total_amount),
    ref: row.reference_number ?? "—",
    date: new Date(row.submitted_at).toLocaleDateString(),
    status: row.status === "verified" ? "Verified" as const : row.status === "rejected" ? "Rejected" as const : "Pending" as const,
    method: row.method_type,
    acctName: row.payer_account_name ?? "—",
    acctNum: row.payer_phone ?? "—",
    receipt: row.receipt_path ?? "No receipt",
    rejectReason: row.rejection_reason ?? undefined,
    phone: row.payer_phone ?? undefined,
    amountPaid: String(row.amount),
    contact: row.buyer_contact_url ?? undefined,
  }))
}

export async function reviewPayment(paymentId: string, decision: "verified" | "rejected", reason?: string) {
  const { error } = await requireSupabase().rpc("review_order_payment", {
    p_payment_id: paymentId,
    p_decision: decision,
    p_reason: reason ?? null,
  })
  if (error) throw error
}

export async function decideOrderExtension(orderId: string, approve: boolean) {
  const { error } = await requireSupabase().rpc("decide_order_extension", {
    p_order_id: orderId,
    p_approve: approve,
  })
  if (error) throw error
}

export async function loadSellerRequests() {
  const client = requireSupabase()
  const [{ data: extensionRows, error: extensionError }, { data: requestRows, error: requestError }] = await Promise.all([
    client
      .from("orders")
      .select("id,buyer_id,extension_status,extension_requested_at,batch_products(name,batches(title))")
      .eq("extension_status", "pending"),
    client
      .from("buyer_requests")
      .select("id,buyer_id,product_name,message,status,created_at,batches(title)"),
  ])
  if (extensionError) throw extensionError
  if (requestError) throw requestError
  const buyerIds = [...new Set([...(extensionRows ?? []).map((row) => row.buyer_id), ...(requestRows ?? []).map((row) => row.buyer_id)])]
  const names = new Map<string, string>()
  const links = new Map<string, string | undefined>()
  if (buyerIds.length) {
    const { data: profiles } = await client.from("public_profiles").select("id,display_name,social_links").in("id", buyerIds)
    for (const profile of profiles ?? []) {
      names.set(profile.id, profile.display_name)
      links.set(profile.id, resolveContactUrl(profile.social_links ?? undefined))
    }
  }
  return {
    extensions: (extensionRows ?? []).map((row) => {
      const product = row.batch_products as unknown as { name: string; batches: { title: string } }
      return {
        id: row.id as string,
        buyer: names.get(row.buyer_id) ?? "Buyer",
        product: product.name,
        batch: product.batches.title,
        requestedAt: new Date(row.extension_requested_at).toLocaleDateString(),
        status: row.extension_status as "pending" | "approved" | "denied",
      }
    }),
    buyerRequests: (requestRows ?? []).map((row) => {
      const batch = row.batches as unknown as { title: string } | null
      return {
        id: row.id as string,
        buyer: names.get(row.buyer_id) ?? "Buyer",
        buyerFb: links.get(row.buyer_id),
        product: row.product_name,
        batch: batch?.title ?? "General request",
        message: row.message ?? "",
        requestedAt: new Date(row.created_at).toLocaleDateString(),
        replied: row.status !== "pending",
      }
    }),
  }
}

export async function markBuyerRequestReplied(id: string) {
  const { error } = await requireSupabase()
    .from("buyer_requests")
    .update({ status: "replied", replied_at: new Date().toISOString() })
    .eq("id", id)
  if (error) throw error
}

export type FinancialSummary = {
  gross_sales: number
  verified_payments: number
  outstanding_amount: number
  insufficient_outstanding: number
  estimated_expenses: number
  gross_profit: number
  order_count: number
  items_sold: number
}

export async function getFinancialSummary(from: Date, to: Date, batchId?: string) {
  const { data, error } = await requireSupabase().rpc("get_financial_summary", {
    p_from: from.toISOString(),
    p_to: to.toISOString(),
    p_batch_id: batchId ?? null,
  })
  if (error) throw error
  const row = data?.[0] ?? {}
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, Number(value ?? 0)]),
  ) as FinancialSummary
}

// Per-product realized sales for the signed-in seller within a date range.
// Realized = payment_confirmed / preparing / completed, matching the gross-sales
// definition in get_financial_summary. Used by the Sales Report breakdown.
export type ProductSales = { product: string; qty: number; amount: number }
export async function getSalesByProduct(
  from: Date,
  to: Date,
): Promise<ProductSales[]> {
  const client = requireSupabase()
  const { data: auth } = await client.auth.getUser()
  if (!auth.user) throw new Error("Authentication required")
  const { data, error } = await client
    .from("orders")
    .select("quantity,total_amount,payment_confirmed_at,status,batch_products(name)")
    .eq("seller_id", auth.user.id)
    .in("status", ["payment_confirmed", "preparing", "completed"])
    .gte("payment_confirmed_at", from.toISOString())
    .lt("payment_confirmed_at", to.toISOString())
  if (error) throw error
  const map = new Map<string, ProductSales>()
  for (const row of data ?? []) {
    const name =
      (row.batch_products as unknown as { name: string } | null)?.name ?? "Unknown"
    const cur = map.get(name) ?? { product: name, qty: 0, amount: 0 }
    cur.qty += Number(row.quantity)
    cur.amount += Number(row.total_amount)
    map.set(name, cur)
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount)
}

// Orders (buyer + what they bought + amount) realized in a date range, for the
// signed-in seller's Sales Report period table.
export type PeriodOrder = {
  id: string
  buyer: string
  purchase: string
  qty: number
  amount: number
}
export async function getPeriodOrders(from: Date, to: Date): Promise<PeriodOrder[]> {
  const client = requireSupabase()
  const { data: auth } = await client.auth.getUser()
  if (!auth.user) throw new Error("Authentication required")
  const { data, error } = await client
    .from("orders")
    .select("id,buyer_id,quantity,total_amount,payment_confirmed_at,batch_products(name)")
    .eq("seller_id", auth.user.id)
    .in("status", ["payment_confirmed", "preparing", "completed"])
    .gte("payment_confirmed_at", from.toISOString())
    .lt("payment_confirmed_at", to.toISOString())
    .order("payment_confirmed_at", { ascending: true })
  if (error) throw error
  const rows = data ?? []
  const buyerIds = [...new Set(rows.map((r) => r.buyer_id as string))]
  const names = new Map<string, string>()
  if (buyerIds.length) {
    const { data: profiles } = await client
      .from("public_profiles")
      .select("id,display_name")
      .in("id", buyerIds)
    for (const p of profiles ?? []) names.set(p.id, p.display_name)
  }
  return rows.map((r) => ({
    id: r.id as string,
    buyer: names.get(r.buyer_id as string) ?? "Buyer",
    purchase: (r.batch_products as unknown as { name: string } | null)?.name ?? "Item",
    qty: Number(r.quantity),
    amount: Number(r.total_amount),
  }))
}

// Recorded batch expenses attributed to a date range, for period kita.
// Attribution rule (deterministic, no double-count across periods):
//   - itemized line items with a `date` → counted in the period of that date
//   - single-total, or itemized items without a date → attributed to the batch
//     and counted in the period containing the batch's trip end (ends_on)
export async function getRecordedExpensesForPeriod(from: Date, to: Date): Promise<number> {
  const client = requireSupabase()
  const { data: auth } = await client.auth.getUser()
  if (!auth.user) throw new Error("Authentication required")
  const { data, error } = await client
    .from("batch_expenses")
    .select("mode,total_amount,items,batches!inner(seller_id,ends_on)")
    .eq("batches.seller_id", auth.user.id)
  if (error) throw error
  const inRange = (d: Date) => d.getTime() >= from.getTime() && d.getTime() < to.getTime()
  let sum = 0
  for (const row of data ?? []) {
    const batch = row.batches as unknown as { ends_on: string }
    const endsOn = new Date(`${batch.ends_on}T00:00:00`)
    if (row.mode === "itemized") {
      for (const item of (row.items as ExpenseItem[]) ?? []) {
        const amount = Number(item.amount) || 0
        const when = item.date ? new Date(`${item.date}T00:00:00`) : endsOn
        if (inRange(when)) sum += amount
      }
    } else if (inRange(endsOn)) {
      sum += Number(row.total_amount) || 0
    }
  }
  return sum
}

// ─── Per-batch expenses (seller bookkeeping) ─────────────────────────────────
export async function loadBatchExpenses(batchDbId: string): Promise<BatchExpenses | null> {
  const { data, error } = await requireSupabase()
    .from("batch_expenses")
    .select("batch_id,mode,total_amount,items")
    .eq("batch_id", batchDbId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    batchDbId: data.batch_id,
    mode: data.mode as ExpenseMode,
    total: Number(data.total_amount),
    items: (data.items as ExpenseItem[]) ?? [],
  }
}

export async function saveBatchExpenses(batchDbId: string, value: BatchExpenses) {
  // One expense record per batch (unique batch_id) → upsert on conflict.
  const total =
    value.mode === "itemized"
      ? value.items.reduce((s, i) => s + (Number(i.amount) || 0), 0)
      : Number(value.total) || 0
  const { error } = await requireSupabase()
    .from("batch_expenses")
    .upsert(
      {
        batch_id: batchDbId,
        mode: value.mode,
        total_amount: total,
        items: value.mode === "itemized" ? value.items : [],
      },
      { onConflict: "batch_id" },
    )
  if (error) throw error
}

// Delegates to the email-batch-history Edge Function (same invoke pattern as
// verify-bir-badge). Returns the composed log so callers can surface it. (#Task 14)
async function emailBatchHistory(batchId: string) {
  const { data, error } = await requireSupabase().functions.invoke("email-batch-history", {
    body: { batchId },
  })
  if (error) throw error
  return data as {
    emailed: boolean
    to: string
    log: {
      batchId: string
      batchTitle: string
      totals: { products: number; claimed: number; paid: number; revenue: number }
    }
  }
}

export const kargoApi = {
  signIn,
  signUp,
  signOut,
  requestPasswordReset,
  loadCurrentAppData,
  claimProduct,
  createBatch,
  uploadBirBadge,
  submitPayment,
  requestOrderExtension,
  cancelOrder,
  expireClaim,
  setFulfillmentStatus,
  updateProfile,
  uploadProfileAvatar,
  loadAddresses,
  saveAddress,
  deleteAddress,
  setBatchLock,
  setProductLock,
  joinWaitlist,
  respondWaitlistOffer,
  setWaitlistResponseHours,
  createReview,
  createBuyerRequest,
  loadPaymentMethods,
  loadSellerReceiveMethods,
  uploadPaymentQr,
  paymentQrUrl,
  addPaymentMethod,
  updatePaymentMethod,
  deactivatePaymentMethod,
  loadNotifications,
  markNotificationRead,
  loadSellerPaymentSubmissions,
  reviewPayment,
  decideOrderExtension,
  loadSellerRequests,
  markBuyerRequestReplied,
  getFinancialSummary,
  getSalesByProduct,
  getPeriodOrders,
  getRecordedExpensesForPeriod,
  loadBatchExpenses,
  saveBatchExpenses,
  emailBatchHistory,
}
