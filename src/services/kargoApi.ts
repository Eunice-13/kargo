import { batchFormationDeadline } from "./groupFormation"
import { membershipError, resolveGroupMembership } from "./groupMembership"
import { loadPaymentCompatibleRows } from "./paymentReadCompatibility"
import { combinedDeliveryMutationError } from "./combinedDeliveryErrors"
import { PASSWORD_RESET_PATH } from "@/constants/auth"

import { normalizeBatchCategory } from "@/constants/categories"

import type {
  BatchExpenses,
  BatchType,
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
  ClaimReservationInput,
  GroupOrder,
  GroupDiscountType,
  SellingUnit,
} from "@/types"

import { requireSupabase } from "@/lib/supabase"

import { resolveContactUrl } from "@/components/shared/contactLink"

import { effectiveOrderPaymentStatus } from "./orderPaymentState"

type DbProfile = {
  id: string

  display_name: string

  bio: string | null

  social_links: Record<string, string> | null

  social_visibility: Record<string, boolean> | null

  avatar_path: string | null

  can_sell: boolean

  notification_preferences: Record<string, boolean> | null

  created_at: string
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

  // display name -> profile id, for every user this account transacts with.

  profileIdByName: Record<string, string>
}

const PAYMENT_METHOD_TYPES = new Set([
  "GCash",

  "Maya",

  "Bank Transfer",

  "Cash on Meetup",

  "Cash on Delivery",

  "Others",

  "Receipt Upload",
])

function statusToClaim(status: string): ClaimRow["status"] {
  if (status === "expired") return "Expired"

  if (status === "cancelled" || status === "incomplete") return "Cancelled"

  if (status === "insufficient_payment") return "Insufficient Payment"

  // `payment_submitted` = the buyer submitted proof and is awaiting the

  // seller's verification. It gets its OWN status so it shows in the filtered

  // table (as "Awaiting Verification") but is NOT payable — the buyer can't pay

  // again until the seller acts. Rejection sends the order back to

  // `payment_pending` (→ "Pending", payable) and a short payment lands on

  // `insufficient_payment` (→ "Insufficient Payment", payable again).

  if (status === "payment_submitted") return "Awaiting Verification"

  if (["payment_confirmed", "preparing", "completed"].includes(status)) {
    return "Paid and Reserved"
  }

  return "Pending"
}

function statusToStep(status: string, fulfillmentStage?: string | null) {
  if (fulfillmentStage === "shipped" || fulfillmentStage === "in_transit")
    return 4

  if (fulfillmentStage === "delivered") return 5

  return (
    {
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
  )
}

function statusToColumn(
  status: string,

  fulfillmentStage?: string | null,

  role: FulfillmentOrder["perspective"] = "seller",
): FulfillmentOrder["col"] | null {
  if (fulfillmentStage === "delivered" || status === "completed")
    return "Delivered"

  if (
    ["shipped", "in_transit"].includes(fulfillmentStage ?? "") ||
    ["shipped", "in_transit"].includes(status)
  )
    return "Shipped"

  if (fulfillmentStage === "preparing" || status === "preparing")
    return "Preparing"

  if (status === "payment_confirmed") return "Payment Confirmed"

  if (
    ["payment_pending", "payment_submitted", "insufficient_payment"].includes(
      status,
    )
  )
    return role === "buyer" ? "Pending Payment" : null

  if (["cancelled", "expired", "incomplete"].includes(status))
    return role === "seller" ? "Cancelled" : null

  return null
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

    .from("user_profiles")

    .select(
      "id,display_name,bio,social_links,social_visibility,avatar_path,can_sell,notification_preferences,created_at",
    )

    .eq("id", id)

    .single()

  if (error) throw error

  const profile = data as DbProfile

  const avatarUrl = profile.avatar_path
    ? client.storage.from("profile-avatars").getPublicUrl(profile.avatar_path)
        .data.publicUrl
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

    memberSince: profile.created_at,

    sellerEnabled: profile.can_sell,

    notificationPreferences: profile.notification_preferences ?? {},
  }
}

export async function signIn(email: string, password: string) {
  const client = requireSupabase()

  const { data, error } = await client.auth.signInWithPassword({
    email,

    password,
  })

  if (error) throw error

  return profileFor(data.user.id, data.user.email ?? email)
}

export async function signUp(input: {
  name: string

  email: string

  password: string

  shopName?: string

  socials?: Record<string, { on: boolean; url: string }>

  role?: "Buyer" | "Seller"
}) {
  const client = requireSupabase()

  const links = Object.fromEntries(
    Object.entries(input.socials ?? {})

      .filter(([, value]) => value.on && value.url.trim())

      .map(([provider, value]) => [provider, value.url.trim()]),
  )

  // Every field the signup form collects travels in the auth metadata, because

  // `handle_new_auth_user` writes the profile row from `raw_user_meta_data` the

  // moment the auth user is created. That trigger runs whether or not Supabase

  // issues a session, so the shop name, social links and seller flag survive the

  // email-confirmation round trip. Writing them from here cannot be relied on:

  // `auth.signUp` returns no session while a confirmation is pending, and

  // `user_profiles` is update-authenticated only, so the write would match zero

  // rows without raising an error.

  const { data, error } = await client.auth.signUp({
    email: input.email,

    password: input.password,

    options: {
      // Return the confirmation link to wherever the user signed up from. Without

      // this Supabase falls back to the configured Site URL, so confirming from a

      // local development server would land on the deployed site instead.

      emailRedirectTo: `${window.location.origin}/`,

      data: {
        display_name: input.name,

        shop_name: input.shopName || null,

        social_links: links,

        social_visibility: Object.fromEntries(
          Object.keys(links).map((key) => [key, true]),
        ),

        can_sell: input.role === "Seller",
      },
    },
  })

  if (error) throw error

  if (!data.user) throw new Error("Supabase did not return a user")

  // Supabase will not reveal whether an address is registered. For an email that

  // already has a confirmed account it returns a placeholder user with NO

  // identities, no session and no error, and sends no email at all. Reporting

  // that as "we emailed you" is how a buyer ends up waiting on a message that

  // will never arrive, so surface it as its own outcome.

  if (data.user.identities && data.user.identities.length === 0)
    return { status: "already_registered" as const, user: null }

  if (!data.session) return { status: "confirmation_sent" as const, user: null }

  return {
    status: "signed_in" as const,

    user: await profileFor(data.user.id, data.user.email ?? input.email),
  }
}

// Sends a fresh signup confirmation link. Supabase enforces a minimum gap between

// sends (60s on this project) and answers the same way whether or not the address

// has an unconfirmed account, so callers must not claim an email definitely went out.

export async function resendConfirmation(email: string) {
  const { error } = await requireSupabase().auth.resend({
    type: "signup",

    email: email.trim(),

    options: { emailRedirectTo: `${window.location.origin}/` },
  })

  if (error) throw error
}

export async function requestPasswordReset(email: string) {
  const client = requireSupabase()

  const redirectTo = `${window.location.origin}${PASSWORD_RESET_PATH}`

  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo,
  })

  if (error) throw error
}

// Called by the recovery screen once Supabase has accepted a reset link and

// established the short-lived session that authorizes the change.

export async function updatePassword(password: string) {
  const { error } = await requireSupabase().auth.updateUser({ password })

  if (error) throw error
}

// Changing a password from Settings has to prove the current one first. Supabase

// does not ask for it when an authenticated user calls `updateUser`, so sign in

// again with it and let that step reject a wrong password.

export async function changePassword(input: {
  currentPassword: string

  newPassword: string
}) {
  const client = requireSupabase()

  // Read the address from the session rather than the profile form: the two

  // differ while an email change is still waiting to be confirmed.

  const { data, error: userError } = await client.auth.getUser()

  if (userError) throw userError

  const email = data.user?.email

  if (!email) throw new Error("Authentication required")

  const { error: verifyError } = await client.auth.signInWithPassword({
    email,

    password: input.currentPassword,
  })

  if (verifyError) {
    // Only a credential rejection means the password was wrong. A rate limit or a

    // network fault has to surface as itself.

    const wrongPassword =
      verifyError.code === "invalid_credentials" ||
      /invalid login credentials/i.test(verifyError.message)

    if (wrongPassword) throw new Error("Current password is incorrect.")

    throw verifyError
  }

  const { error } = await client.auth.updateUser({
    password: input.newPassword,
  })

  if (error) throw error
}

export async function signOut() {
  const { error } = await requireSupabase().auth.signOut()

  if (error) throw error
}

function formatBatchDateRange(startsOn: string, endsOn: string) {
  const start = new Date(`${startsOn}T00:00:00`)

  const end = new Date(`${endsOn}T00:00:00`)

  const startMonth = start.toLocaleDateString("en-US", { month: "short" })

  const endMonth = end.toLocaleDateString("en-US", { month: "short" })

  const startYear = start.getFullYear()

  const endYear = end.getFullYear()

  if (startMonth === endMonth && startYear === endYear) {
    return `${startMonth} ${start.getDate()}–${end.getDate()}, ${endYear}`
  }

  if (startYear === endYear) {
    return `${startMonth} ${start.getDate()}–${endMonth} ${end.getDate()}, ${endYear}`
  }

  return `${startMonth} ${start.getDate()}, ${startYear}–${endMonth} ${end.getDate()}, ${endYear}`
}

export async function setBatchReaction(batchId: string, reacted: boolean) {
  const client = requireSupabase()

  const { data, error } = await client.rpc("set_batch_reaction", {
    p_batch_id: batchId,

    p_reacted: reacted,
  })

  if (error) throw error

  const result = Array.isArray(data) ? data[0] : data

  if (!result) throw new Error("The reaction could not be confirmed.")

  return {
    reacted: Boolean(result.reacted),

    reactionCount: Number(result.reaction_count ?? 0),
  }
}

export async function loadCurrentAppData(): Promise<LoadedAppData | null> {
  const client = requireSupabase()

  const { data: auth } = await client.auth.getUser()

  if (!auth.user) return null

  const user = await profileFor(auth.user.id, auth.user.email ?? "")

  const [
    { data: catalog, error: catalogError },

    { data: dbOrders, error: ordersError },

    { data: reactionCounts, error: reactionCountsError },

    { data: ownReactions, error: ownReactionsError },

    { data: buyerPaymentStates, error: buyerPaymentStatesError },

    { data: dbGroupOrders, error: groupOrdersError },
  ] = await Promise.all([
    client.from("batch_catalog").select("*"),

    loadPaymentCompatibleRows(client, "orders"),

    client

      .from("batch_reaction_counts")

      .select("batch_id,batch_created_at,reaction_count")

      .order("reaction_count", { ascending: false })

      .order("batch_created_at", { ascending: false }),

    client

      .from("batch_reactions")

      .select("batch_id")

      .eq("user_id", auth.user.id),

    client.rpc("buyer_order_payment_states"),

    client
      .from("group_orders")
      .select("*,group_order_members(status),group_order_commitments(quantity,batch_products(name))"),
  ])

  if (catalogError) throw catalogError

  if (ordersError) throw ordersError

  const reactionSchemaMissing = [reactionCountsError, ownReactionsError].some(
    (error) => error && ["PGRST205", "42P01"].includes(error.code),
  )

  if (reactionCountsError && !reactionSchemaMissing) throw reactionCountsError

  if (ownReactionsError && !reactionSchemaMissing) throw ownReactionsError

  if (buyerPaymentStatesError) throw buyerPaymentStatesError

  if (groupOrdersError) throw groupOrdersError

  if (reactionSchemaMissing) {
    console.warn(
      "Batch reaction tables are not migrated yet; loading catalog without reaction metadata.",
    )
  }

  const reactionMetadata = new Map(
    (reactionCounts ?? []).map((row) => [
      row.batch_id,

      {
        count: Number(row.reaction_count ?? 0),

        createdAt: row.batch_created_at as string,
      },
    ]),
  )

  const reactedBatchIds = new Set(
    (ownReactions ?? []).map((row) => row.batch_id),
  )

  const buyerPaymentStateByOrderId = new Map<string, {
    effectiveStatus: string

    latestPaymentStatus: string | null

    rejectionDeadline: string | null
  }>(
    (buyerPaymentStates ?? []).map(
      (row: {
        order_id: string

        effective_status: string

        latest_payment_status: string | null

        rejection_deadline: string | null
      }) => [
        row.order_id as string,

        {
          effectiveStatus: row.effective_status as string,

          latestPaymentStatus: row.latest_payment_status as string | null,

          rejectionDeadline: row.rejection_deadline as string | null,
        },
      ],
    ),
  )

  const groupOrderById = new Map(
    (dbGroupOrders ?? []).map((group) => [group.id as string, group]),
  )

  const participantIds = [
    ...new Set([
      ...(dbOrders ?? []).flatMap((row) => [row.buyer_id, row.seller_id]),

      ...(catalog ?? []).map((row) => row.seller_id),
    ]),
  ]

  const participantNames = new Map<string, string>()

  const participantShopNames = new Map<string, string>()

  const participantLinks = new Map<string, string | undefined>()

  const participantSocialLinks = new Map<string, Record<string, string>>()

  if (participantIds.length > 0) {
    const { data: participants, error: participantsError } = await client

      .from("public_profiles")

      .select("id,display_name,shop_name,social_links")

      .in("id", participantIds)

    if (participantsError) throw participantsError

    for (const participant of participants ?? []) {
      participantNames.set(participant.id, participant.display_name)

      if (participant.shop_name) {
        participantShopNames.set(participant.id, participant.shop_name)
      }

      const socialLinks = (participant.social_links ??
        {}) as Record<string, string>

      participantSocialLinks.set(participant.id, socialLinks)

      participantLinks.set(participant.id, resolveContactUrl(socialLinks))
    }
  }

  const batchMap = new Map<string, BatchType>()

  for (const row of catalog ?? []) {
    const reactions = reactionMetadata.get(row.batch_id)

    const current: BatchType = batchMap.get(row.batch_id) ?? {
      id: numericId(row.batch_id),

      dbId: row.batch_id,

      createdAt: reactions?.createdAt,

      reactionCount: reactions?.count ?? 0,

      reactedByCurrentUser: reactedBatchIds.has(row.batch_id),

      live: row.batch_status === "live",

      locked: row.batch_status === "locked",

      title: row.batch_title,

      seller: row.seller_name,

      sellerId: row.seller_id,

      sellerFb: participantLinks.get(row.seller_id),

      trips: formatBatchDateRange(row.starts_on, row.ends_on),

      items: Number(row.batch_total_items ?? 0),

      claimed: Number(row.batch_claimed ?? 0),

      category: normalizeBatchCategory(row.category),

      reserveHours: row.reservation_hours,

      notes: row.notes ?? undefined,

      coverImage: batchMediaUrl(row.batch_cover_path),

      galleryImages: (row.batch_gallery_paths ?? []).map((path: string) =>
        batchMediaUrl(path),
      ).filter((url: string | undefined): url is string => Boolean(url)),

      groupOrdersEnabled: Boolean(row.group_orders_enabled),

      groupDiscountType: row.group_discount_type ?? undefined,

      groupDiscountValue:
        row.group_discount_value == null
          ? undefined
          : Number(row.group_discount_value),

      groupDiscountMinSubtotal:
        row.group_discount_min_subtotal == null
          ? undefined
          : Number(row.group_discount_min_subtotal),

      products: [],
    }

    current.products.push({
      id: numericId(row.product_id),

      dbId: row.product_id,

      name: row.product_name,

      imageUrl: batchMediaUrl(row.product_image_path),

      sellingUnit: row.selling_unit === "box" ? "box" : "piece",

      piecesPerBox:
        row.pieces_per_box == null ? undefined : Number(row.pieces_per_box),

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

      waitlistLimit:
        row.waitlist_limit != null && Number(row.waitlist_limit) >= 0
          ? Number(row.waitlist_limit)
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
    const groupOrder = row.group_order_id
      ? groupOrderById.get(row.group_order_id)
      : undefined

    if (groupOrder && row.id !== groupOrder.payment_order_id) continue

    const rawProduct = row.batch_products as unknown as {
      name: string

      batch_id: string

      batches: { title: string }
    }

    const groupCommitments = (groupOrder?.group_order_commitments ?? []) as Array<{
      quantity: number
      batch_products: { name: string }
    }>

    const product = {
      ...rawProduct,
      name: groupOrder
        ? `Group Order · ${groupCommitments.length} item${groupCommitments.length === 1 ? "" : "s"}`
        : rawProduct.name,
    }

    const isBuyer = row.buyer_id === auth.user.id

    const sellerName =
      participantNames.get(row.seller_id) ??
      batchMap.get(product.batch_id)?.seller ??
      "Seller"

    const buyerName = participantNames.get(row.buyer_id) ?? "Buyer"

    const buyerPaymentState = buyerPaymentStateByOrderId.get(row.id)

    const effectiveStatus =
      isBuyer && buyerPaymentState
        ? buyerPaymentState.effectiveStatus
        : effectiveOrderPaymentStatus(row.status, row.payments)

    const expiresAt = groupOrder?.payment_deadline ?? row.reservation_expires_at

    const expires = new Date(expiresAt).getTime()

    const hours = Math.max(0, Math.ceil((expires - Date.now()) / 3_600_000))

    const deadlineExpired =
      !row.deadline_paused_at &&
      expires <= Date.now() &&
      ["payment_pending", "insufficient_payment"].includes(effectiveStatus)

    const deliveryFields = {
      reservedPaymentMethod: row.reserved_payment_method ?? undefined,

      shippingApplies: Boolean(row.shipping_applies),

      shippingState: row.shipping_state ?? undefined,

      shippingFee:
        row.shipping_fee == null ? undefined : Number(row.shipping_fee),

      deadlinePausedAt: row.deadline_paused_at ?? undefined,

      deliveryPinLat:
        row.delivery_pin_lat == null ? undefined : Number(row.delivery_pin_lat),

      deliveryPinLng:
        row.delivery_pin_lng == null ? undefined : Number(row.delivery_pin_lng),

      deliveryPinUrl: row.delivery_pin_url ?? undefined,

      deliveryPinAddress: row.delivery_pin_address ?? undefined,

      courierCompany: row.courier_company ?? undefined,

      riderName: row.rider_name ?? undefined,

      riderContact: row.rider_contact ?? undefined,

      trackingNumber: row.tracking_number ?? undefined,

      eta: row.eta ?? undefined,

      trackingUrl: row.tracking_url ?? undefined,

      fulfillmentStage: row.fulfillment_stage ?? undefined,

      declineReason: row.decline_reason ?? undefined,
    }

    const orderTotal = groupOrder
      ? Number(groupOrder.final_subtotal) + Number(groupOrder.shipping_fee ?? 0)
      : Number(row.total_amount) +
        (row.shipping_fee == null ? 0 : Number(row.shipping_fee))

    const groupFields = groupOrder
      ? {
          groupOrderId: groupOrder.id as string,
          groupOrderCode: groupOrder.referral_code as string,
          groupItemCount: groupCommitments.reduce(
            (sum, commitment) => sum + Number(commitment.quantity),
            0,
          ),
          groupMemberCount: (groupOrder.group_order_members ?? []).filter(
            (member: { status: string }) => member.status === "active",
          ).length,
          groupRegularSubtotal: Number(groupOrder.regular_subtotal ?? 0),
          groupDiscountAmount: Number(groupOrder.discount_amount ?? 0),
        }
      : {}

    if (isBuyer) {
      claims.push({
        id: row.id,

        createdAt: row.created_at,

        productId: row.batch_product_id,

        ...groupFields,

        product: product.name,

        batch: product.batches.title,

        seller: sellerName,

        sellerId: row.seller_id,

        sellerFb: participantLinks.get(row.seller_id),

        sellerSocialLinks: participantSocialLinks.get(row.seller_id),

        orderStatus: effectiveStatus,

        qty: groupOrder
          ? groupCommitments.reduce(
              (sum, commitment) => sum + Number(commitment.quantity),
              0,
            )
          : row.quantity,

        amount: orderTotal,

        status: deadlineExpired ? "Expired" : statusToClaim(effectiveStatus),

        hours,

        expiresAt,

        extensionStatus: row.extension_status ?? "none",
        extensionRequested: row.extension_status === "pending",
        extensionRequestedHours: row.extension_requested_hours ?? undefined,
        extensionDecidedAt: row.extension_decided_at ?? undefined,

        ...deliveryFields,
      })

      orders.push({
        id: row.order_number,

        dbId: row.id,

        product: product.name,

        batch: product.batches.title,

        seller: sellerName,

        sellerFb: participantLinks.get(row.seller_id),

        amount: orderTotal,

        step: statusToStep(effectiveStatus, row.fulfillment_stage),

        qty: row.quantity,

        ...deliveryFields,
      })

      const buyerColumn = statusToColumn(
        effectiveStatus,

        row.fulfillment_stage,

        "buyer",
      )

      if (buyerColumn) {
        fulfillment.push({
          id: row.id,

          dbId: row.id,

          col: buyerColumn,

          perspective: "buyer",

          buyer: buyerName,

          seller: sellerName,

          sellerFb: participantLinks.get(row.seller_id),
          sellerSocialLinks: participantSocialLinks.get(row.seller_id),
          product: product.name,

          qty: row.quantity,

          amount: orderTotal,

          ...deliveryFields,
        })
      }
    } else {
      claims.push({
        id: row.id,

        createdAt: row.created_at,

        productId: row.batch_product_id,

        ...groupFields,

        product: product.name,

        batch: product.batches.title,

        seller: user.name,

        buyer: buyerName,

        buyerFb: participantLinks.get(row.buyer_id),

        buyerSocialLinks: participantSocialLinks.get(row.buyer_id),

        orderStatus: effectiveStatus,

        qty: groupOrder
          ? groupCommitments.reduce(
              (sum, commitment) => sum + Number(commitment.quantity),
              0,
            )
          : row.quantity,

        amount: orderTotal,

        status: deadlineExpired ? "Expired" : statusToClaim(effectiveStatus),

        hours,

        expiresAt,

        extensionStatus: row.extension_status ?? "none",
        extensionRequested: row.extension_status === "pending",
        extensionRequestedHours: row.extension_requested_hours ?? undefined,
        extensionDecidedAt: row.extension_decided_at ?? undefined,

        ...deliveryFields,
      })

      const sellerColumn = statusToColumn(
        effectiveStatus,

        row.fulfillment_stage,

        "seller",
      )

      if (sellerColumn) {
        fulfillment.push({
          id: row.id,

          dbId: row.id,

          col: sellerColumn,

          perspective: "seller",

          buyer: buyerName,

          buyerFb: participantLinks.get(row.buyer_id),
          buyerSocialLinks: participantSocialLinks.get(row.buyer_id),
          product: product.name,

          qty: row.quantity,

          amount: orderTotal,

          ...deliveryFields,
        })
      }
    }

    const verifiedPaid = (row.payments ?? [])

      .filter((payment: { status: string }) => payment.status === "verified")

      .reduce(
        (sum: number, payment: { amount: number | string }) =>
          sum + Number(payment.amount),

        0,
      )

    if (
      isBuyer &&
      !deadlineExpired &&
      ["payment_pending", "insufficient_payment"].includes(effectiveStatus)
    ) {
      toPay.push({
        id: row.id,

        createdAt: row.created_at,

        orderId: row.id,

        groupOrderId: groupOrder?.id,

        product: product.name,

        seller: sellerName,

        sellerId: row.seller_id,

        qty: groupOrder
          ? groupCommitments.reduce(
              (sum, commitment) => sum + Number(commitment.quantity),
              0,
            )
          : row.quantity,

        amount: Math.max(0, orderTotal - verifiedPaid),

        hours,

        expiresAt,

        reservedPaymentMethod: deliveryFields.reservedPaymentMethod,

        shippingApplies: deliveryFields.shippingApplies,

        shippingState: deliveryFields.shippingState,

        shippingFee: deliveryFields.shippingFee,

        deadlinePausedAt: deliveryFields.deadlinePausedAt,
      })
    }

    for (const payment of row.payments ?? []) {
      if (!isBuyer) continue

      payHistory.push({
        id: payment.id ?? `${row.id}-${payment.submitted_at}`,

        orderId: row.id,
        combinedDeliveryGroupId: payment.combined_delivery_group_id ?? undefined,
        reservationIds: payment.combined_delivery_group_id ? (payment.combined ?? []).map((link: any) => link.order_id as string) : undefined,

        seller: participantNames.get(row.seller_id) ?? batchMap.get(product.batch_id)?.seller ?? undefined,

        sellerShopName: participantShopNames.get(row.seller_id),

        submittedAt: payment.submitted_at,

        product: payment.combined_delivery_group_id
          ? `Combined delivery · ${(payment.combined ?? []).map((link: any) => `${link.orders?.batch_products?.name ?? "Product"} × ${link.orders?.quantity ?? "—"}`).join(", ")}`
          : product.name,

        imageUrl: batchMap
          .get(product.batch_id)
          ?.products.find((batchProduct) => batchProduct.dbId === row.batch_product_id)
          ?.imageUrl,

        batch: product.batches.title,

        method: payment.method_type,

        amount: Number(payment.amount),

        date: new Date(payment.submitted_at).toLocaleDateString(),

        status:
          payment.status === "rejected"
            ? "Rejected"
            : payment.status === "verified"
              ? "Paid and Reserved"
              : "Pending",

        referenceNumber: payment.reference_number ?? undefined,

        receiptPath: payment.receipt_path ?? undefined,

        payerAccountName: payment.payer_account_name ?? undefined,

        payerPhone: payment.payer_phone ?? undefined,

        buyerContactUrl: payment.buyer_contact_url ?? undefined,

        rejectionReason: payment.rejection_reason ?? undefined,

        rejectionDeadline: payment.rejection_deadline ?? undefined,
      })
    }
  }

  const waitlist = await loadBuyerWaitlist(client, auth.user.id, batchMap)

  const sellerWaitlist = user.sellerEnabled
    ? await loadSellerWaitlist(client, auth.user.id)
    : []

  const profileIdByName: Record<string, string> = {}

  for (const [id, name] of participantNames) {
    if (name) profileIdByName[name] = id
  }

  return {
    user,

    batches: [...batchMap.values()],

    claims,

    toPay,

    payHistory,

    orders,

    fulfillment,

    waitlist,

    sellerWaitlist,

    profileIdByName,
  }
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

    .select(
      "batch_product_id, buyer_id, joined_at, desired_quantity, batch_products(name, batch_id, batches(title, seller_id))",
    )

    .eq("status", "waiting")

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

  const mine = rows.filter(
    (r) => r.batch_products?.batches?.seller_id === sellerId,
  )

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

      links.set(
        profile.id,

        resolveContactUrl(profile.social_links ?? undefined),
      )
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

    .select(
      "id, batch_product_id, joined_at, status, desired_quantity, batch_products(name, selling_price, batch_id)",
    )

    .eq("buyer_id", userId)

    .eq("status", "waiting")

  if (error) throw error

  type WaitlistDbRow = {
    id: string

    batch_product_id: string

    joined_at: string

    status: "waiting" | "converted" | "cancelled"

    desired_quantity: number

    batch_products: Array<{
      name: string

      selling_price: number | string

      batch_id: string
    }> | null
  }

  const rows = (data ?? []) as unknown as WaitlistDbRow[]

  const productIds = [
    ...new Set(
      rows.map((row: { batch_product_id: string }) => row.batch_product_id),
    ),
  ]

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

    const queue = peers.filter(
      (p) => p.batch_product_id === row.batch_product_id,
    )

    const position = queue.filter(
      (p) => new Date(p.joined_at).getTime() <= joined,
    ).length

    const catalogProduct = batch?.products.find(
      (p) => p.dbId === row.batch_product_id,
    )

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
    }
  })
}

export async function claimProduct(
  productId: string,

  reservation: ClaimReservationInput,
) {
  const { data, error } = await requireSupabase().rpc(
    "claim_batch_product_with_address",

    {
      p_batch_product_id: productId,

      p_quantity: reservation.quantity,

      p_payment_method: reservation.paymentMethod,

      p_pin_lat: reservation.pinLat ?? null,

      p_pin_lng: reservation.pinLng ?? null,

      p_pin_url: reservation.pinUrl ?? null,

      p_accept_shipping: reservation.acceptShipping,

      p_pin_address: reservation.pinAddress ?? null,
    },
  )

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

  coverFile?: File

  galleryFiles?: File[]

  groupOrdersEnabled?: boolean

  groupDiscountType?: GroupDiscountType

  groupDiscountValue?: number

  groupDiscountMinSubtotal?: number

  products: Array<{
    name: string

    basePrice: number

    markup: number

    quantity: number

    limitPerUser?: number

    waitlistLimit?: number

    imageFile?: File

    sellingUnit?: SellingUnit

    piecesPerBox?: number
  }>
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

      group_orders_enabled: Boolean(batch.groupOrdersEnabled),

      group_discount_type:
        batch.groupOrdersEnabled && batch.groupDiscountType
          ? batch.groupDiscountType
          : null,

      group_discount_value:
        batch.groupOrdersEnabled && batch.groupDiscountType
          ? batch.groupDiscountValue ?? null
          : null,

      group_discount_min_subtotal:
        batch.groupOrdersEnabled && batch.groupDiscountType
          ? batch.groupDiscountMinSubtotal ?? null
          : null,
    })

    .select("id")

    .single()

  if (error) throw error

  let coverPath: string | null = null
  if (batch.coverFile) {
    coverPath = await uploadBatchMediaFile(
      client,
      auth.user.id,
      created.id,
      "cover",
      batch.coverFile,
    )

    const { error: coverError } = await client
      .from("batches")
      .update({ cover_path: coverPath })
      .eq("id", created.id)

    if (coverError) throw coverError
  }

  const galleryPaths = await Promise.all(
    (batch.galleryFiles ?? []).map((file, index) =>
      uploadBatchMediaFile(
        client,
        auth.user.id,
        created.id,
        `gallery-${index + 1}`,
        file,
      ),
    ),
  )
  if (galleryPaths.length > 0) {
    const { error: galleryError } = await client
      .from("batches")
      .update({ gallery_paths: galleryPaths })
      .eq("id", created.id)
    if (galleryError) throw galleryError
  }

  const productImagePaths = await Promise.all(
    batch.products.map((product, index) =>
      product.imageFile
        ? uploadBatchMediaFile(
            client,
            auth.user.id,
            created.id,
            `product-${index + 1}`,
            product.imageFile,
          )
        : Promise.resolve(null),
    ),
  )

  const { data: createdProducts, error: productsError } = await client.from("batch_products").insert(
    batch.products.map((product, index) => ({
      batch_id: created.id,

      name: product.name,

      base_price: product.basePrice,

      markup: product.markup,

      quantity_total: product.quantity,

      image_path: productImagePaths[index],

      selling_unit: product.sellingUnit ?? "piece",

      pieces_per_box:
        product.sellingUnit === "box" ? product.piecesPerBox ?? null : null,

      limit_per_user:
        product.limitPerUser && product.limitPerUser > 0
          ? product.limitPerUser
          : null,

      waitlist_limit:
        product.waitlistLimit != null && product.waitlistLimit >= 0
          ? product.waitlistLimit
          : null,
    })),
  ).select("id")

  if (productsError) throw productsError

  return {
    id: created.id as string,
    coverImage: batchMediaUrl(coverPath),
    galleryImages: galleryPaths
      .map((path) => batchMediaUrl(path))
      .filter((url): url is string => Boolean(url)),
    productImages: (createdProducts ?? []).map((_, index) =>
      batchMediaUrl(productImagePaths[index]),
    ),
  }
}

const BATCH_MEDIA_BUCKET = "batch-media"
const MAX_BATCH_IMAGE_BYTES = 5 * 1024 * 1024

function assertBatchImage(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose an image file for the batch photo.")
  }

  if (file.size > MAX_BATCH_IMAGE_BYTES) {
    throw new Error("Batch photos must be 5 MB or smaller.")
  }
}

function batchMediaUrl(path?: string | null) {
  if (!path) return undefined

  return requireSupabase().storage.from(BATCH_MEDIA_BUCKET).getPublicUrl(path)
    .data.publicUrl
}

async function uploadBatchMediaFile(
  client: ReturnType<typeof requireSupabase>,
  userId: string,
  batchId: string,
  slot: string,
  file: File,
) {
  assertBatchImage(file)
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg"
  const objectPath = `${userId}/${batchId}/${slot}-${Date.now()}.${extension}`
  const { error } = await client.storage.from(BATCH_MEDIA_BUCKET).upload(
    objectPath,
    file,
    { contentType: file.type || undefined, upsert: false },
  )

  if (error) throw error
  return objectPath
}

export async function updateBatchCover(batchId: string, file: File) {
  const client = requireSupabase()
  const { data: auth } = await client.auth.getUser()
  if (!auth.user) throw new Error("Authentication required")

  const path = await uploadBatchMediaFile(
    client,
    auth.user.id,
    batchId,
    "cover",
    file,
  )
  const { error } = await client
    .from("batches")
    .update({ cover_path: path })
    .eq("id", batchId)
  if (error) throw error
  return batchMediaUrl(path) as string
}

export async function addBatchGalleryImages(batchId: string, files: File[]) {
  if (files.length === 0) return []

  const client = requireSupabase()
  const { data: auth } = await client.auth.getUser()
  if (!auth.user) throw new Error("Authentication required")

  const { data: batch, error: loadError } = await client
    .from("batches")
    .select("gallery_paths")
    .eq("id", batchId)
    .single()
  if (loadError) throw loadError

  const addedPaths = await Promise.all(
    files.map((file, index) =>
      uploadBatchMediaFile(
        client,
        auth.user.id,
        batchId,
        `gallery-${Date.now()}-${index + 1}`,
        file,
      ),
    ),
  )
  const galleryPaths = [...(batch.gallery_paths ?? []), ...addedPaths]
  const { error: saveError } = await client
    .from("batches")
    .update({ gallery_paths: galleryPaths })
    .eq("id", batchId)
  if (saveError) throw saveError

  return addedPaths.map((path) => batchMediaUrl(path) as string)
}

export async function updateProductImage(
  batchId: string,
  productId: string,
  file: File,
) {
  const client = requireSupabase()
  const { data: auth } = await client.auth.getUser()
  if (!auth.user) throw new Error("Authentication required")

  const path = await uploadBatchMediaFile(
    client,
    auth.user.id,
    batchId,
    `product-${productId}`,
    file,
  )
  const { error } = await client
    .from("batch_products")
    .update({ image_path: path })
    .eq("id", productId)
  if (error) throw error
  return batchMediaUrl(path) as string
}

export async function updateBatchGroupSettings(input: {
  batchId: string
  enabled: boolean
  discountType?: GroupDiscountType
  discountValue?: number
  discountMinSubtotal?: number
  products: Array<{
    id: string
    sellingUnit: SellingUnit
    piecesPerBox?: number
  }>
}) {
  const client = requireSupabase()
  const { error: batchError } = await client
    .from("batches")
    .update({
      group_orders_enabled: input.enabled,
      group_discount_type:
        input.enabled && input.discountType ? input.discountType : null,
      group_discount_value:
        input.enabled && input.discountType ? input.discountValue ?? null : null,
      group_discount_min_subtotal:
        input.enabled && input.discountType
          ? input.discountMinSubtotal ?? null
          : null,
    })
    .eq("id", input.batchId)

  if (batchError) throw batchError

  for (const product of input.products) {
    const { error } = await client
      .from("batch_products")
      .update({
        selling_unit: product.sellingUnit,
        pieces_per_box:
          product.sellingUnit === "box" ? product.piecesPerBox ?? null : null,
      })
      .eq("id", product.id)
    if (error) throw error
  }
}

export async function loadGroupOrder(groupOrderId: string, leaderOnly = false): Promise<GroupOrder> {
  const client = requireSupabase()
  let ownerId: string | undefined
  if (leaderOnly) {
    const { data, error } = await client.auth.getUser()
    if (error) throw error
    ownerId = data.user?.id
    if (!ownerId) throw new Error("Sign in to view your group orders.")
  }
  let groupQuery = client.from("group_orders").select("*,batches(ends_on)").eq("id", groupOrderId)
  if (leaderOnly) groupQuery = groupQuery.eq("leader_id", ownerId!)
  const [{ data: group, error: groupError }, { data: members, error: memberError }, { data: commitments, error: commitmentError }] =
    await Promise.all([
      groupQuery.single(),
      client
        .from("group_order_members")
        .select("user_id,role,status")
        .eq("group_order_id", groupOrderId),
      client
        .from("group_order_commitments")
        .select("user_id,batch_product_id,quantity,unit_selling_price,batch_products(name)")
        .eq("group_order_id", groupOrderId),
    ])

  if (groupError) throw groupError
  if (!group.batches?.ends_on) throw new Error("This group’s batch is unavailable.")
  if (memberError) throw memberError
  if (commitmentError) throw commitmentError

  const userIds = [
    ...new Set((members ?? []).map((member) => member.user_id as string)),
  ]
  const names = new Map<string, string>()
  if (userIds.length > 0) {
    const { data: profiles, error } = await client
      .from("public_profiles")
      .select("id,display_name")
      .in("id", userIds)
    if (error) throw error
    for (const profile of profiles ?? []) names.set(profile.id, profile.display_name)
  }

  const userId = (await client.auth.getUser()).data.user?.id
  return {
    id: group.id,
    batchId: group.batch_id,
    leaderId: group.leader_id,
    leaderName: names.get(group.leader_id) ?? "Group leader",
    referralCode: group.referral_code,
    status: group.status,
    formationDeadline: batchFormationDeadline(group.batches.ends_on),
    regularSubtotal: Number(group.regular_subtotal ?? 0),
    discountAmount: Number(group.discount_amount ?? 0),
    finalSubtotal: Number(group.final_subtotal ?? 0),
    shippingFee:
      group.shipping_fee == null ? undefined : Number(group.shipping_fee),
    shippingState: group.shipping_state ?? undefined,
    paymentDeadline: group.payment_deadline ?? undefined,
    reservedPaymentMethod: group.reserved_payment_method ?? undefined,
    isLeader: group.leader_id === userId,
    currentUserId: userId ?? "",
    members: (members ?? []).map((member) => ({
      userId: member.user_id,
      name: names.get(member.user_id) ?? "Member",
      role: member.role,
      status: member.status,
    })),
    commitments: (commitments ?? []).map((commitment) => ({
      userId: commitment.user_id,
      memberName: names.get(commitment.user_id) ?? "Member",
      productId: commitment.batch_product_id,
      productName: (commitment.batch_products as unknown as { name: string }).name,
      quantity: Number(commitment.quantity),
      unitPrice: Number(commitment.unit_selling_price),
    })),
  }
}

export async function loadMyGroupOrder(batchId: string) {
  const client = requireSupabase()
  const userId = (await client.auth.getUser()).data.user?.id
  if (!userId) return null

  const { data, error } = await client
    .from("group_order_members")
    .select("group_order_id,group_orders!inner(batch_id,status,created_at)")
    .eq("user_id", userId)
    .eq("status", "active")
    .eq("group_orders.batch_id", batchId)
    .in("group_orders.status", [
      "forming",
      "waiting_for_seller",
      "payment_pending",
      "payment_submitted",
      "payment_confirmed",
    ])

  if (error) throw error
  const selected = resolveGroupMembership((data ?? []) as unknown as Parameters<typeof resolveGroupMembership>[0])
  return selected ? loadGroupOrder(selected.group_order_id) : null
}

export async function startGroupOrder(batchId: string) {
  const { data, error } = await requireSupabase().rpc("start_group_order", {
    p_batch_id: batchId,
  })
  if (error) throw membershipError(error)
  return loadGroupOrder(data.id)
}

export async function joinGroupOrder(code: string) {
  const { data, error } = await requireSupabase().rpc("join_group_order", {
    p_referral_code: code,
  })
  if (error) throw membershipError(error)
  return loadGroupOrder(data.id)
}

export async function setGroupCommitment(
  groupOrderId: string,
  productId: string,
  quantity: number,
) {
  const { error } = await requireSupabase().rpc("set_group_commitment", {
    p_group_order_id: groupOrderId,
    p_batch_product_id: productId,
    p_quantity: quantity,
  })
  if (error) throw error
  return loadGroupOrder(groupOrderId)
}

export async function leaveGroupOrder(groupOrderId: string) {
  const { error } = await requireSupabase().rpc("leave_group_order", {
    p_group_order_id: groupOrderId,
  })
  if (error) throw error
}

export async function removeGroupMember(groupOrderId: string, userId: string) {
  const { error } = await requireSupabase().rpc("remove_group_member", {
    p_group_order_id: groupOrderId,
    p_user_id: userId,
  })
  if (error) throw error
  return loadGroupOrder(groupOrderId)
}

export async function regenerateGroupCode(groupOrderId: string) {
  const { data, error } = await requireSupabase().rpc("regenerate_group_code", {
    p_group_order_id: groupOrderId,
  })
  if (error) throw error
  return data as string
}

export async function checkoutGroupOrder(input: {
  groupOrderId: string
  paymentMethod: string
  pinLat?: number
  pinLng?: number
  pinUrl?: string
  pinAddress?: string
  acceptShipping: boolean
}) {
  const { data, error } = await requireSupabase().rpc("checkout_group_order", {
    p_group_order_id: input.groupOrderId,
    p_payment_method: input.paymentMethod,
    p_pin_lat: input.pinLat ?? null,
    p_pin_lng: input.pinLng ?? null,
    p_pin_url: input.pinUrl ?? null,
    p_pin_address: input.pinAddress ?? null,
    p_accept_shipping: input.acceptShipping,
    p_acknowledged: true,
  })
  if (error) throw error
  return loadGroupOrder(data.id)
}

// Translate a raw Supabase/Postgres error from submit_order_payment into a

// clear, actionable message for the buyer. The live DB enforces:

//   - unique (order_id, reference_number)  -> 23505 duplicate reference number

//   - method_type CHECK                    -> 23514 unsupported method

//   - amount > 0 CHECK                      -> 23514 invalid amount

// Anything else falls back to the DB message so we never hide a real error.

function paymentErrorMessage(error: {
  code?: string

  message?: string

  details?: string
}): string {
  const code = error.code ?? ""

  const raw = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase()

  // Unique violation on the reference number for this order.

  if (code === "23505" || raw.includes("payments_order_reference_uidx")) {
    return "A payment with this reference number was already submitted for this order. Enter the exact reference number from your latest transaction — each submission needs its own reference."
  }

  // Check-constraint violations.

  if (code === "23514" || raw.includes("violates check constraint")) {
    if (raw.includes("method_type")) {
      return "That payment method is not supported. Choose GCash, Maya, Bank Transfer, Cash on Meetup, or Cash on Delivery."
    }

    if (raw.includes("amount")) {
      return "Enter a payment amount greater than zero."
    }

    return "Some of the payment details are not in the expected format. Please review the fields and try again."
  }

  // Not-null violation — a required field was left blank.

  if (code === "23502") {
    return "A required payment detail is missing. Fill in the reference number and amount, then submit again."
  }

  return error.message || "Payment was rejected"
}

export async function submitPayment(input: {
  orderId: string
  combinedDeliveryGroupId?: string

  method: string

  amount: number

  referenceNumber?: string

  receipt?: File

  payerAccountName?: string

  payerPhone?: string

  buyerContactUrl?: string
}) {
  if (!PAYMENT_METHOD_TYPES.has(input.method)) {
    throw new Error(
      "Invalid payment method. Please select GCash, Maya, bank transfer, or cash.",
    )
  }

  const client = requireSupabase()

  const { data: auth } = await client.auth.getUser()

  if (!auth.user) throw new Error("Authentication required")

  let receiptPath: string | null = null

  if (input.receipt) {
    const extension =
      input.receipt.name.split(".").pop()?.toLowerCase() || "jpg"

    receiptPath = `${auth.user.id}/${crypto.randomUUID()}.${extension}`

    const { error: uploadError } = await client.storage

      .from("payment-receipts")

      .upload(receiptPath, input.receipt)

    if (uploadError)
      throw new Error(
        "We could not upload your receipt image. Please try a different photo (JPG or PNG) and submit again.",
      )
  }

  const { data, error } = await client.rpc(input.combinedDeliveryGroupId ? "submit_combined_delivery_payment" : "submit_order_payment", {
    ...(input.combinedDeliveryGroupId
      ? { p_group_id: input.combinedDeliveryGroupId }
      : { p_order_id: input.orderId }),

    p_method_type: input.method,

    p_amount: input.amount,

    p_reference_number: input.referenceNumber ?? null,

    p_receipt_path: receiptPath,

    p_payer_account_name: input.payerAccountName ?? null,

    p_payer_phone: input.payerPhone ?? null,

    p_buyer_contact_url: input.buyerContactUrl ?? null,
  })

  if (error) throw new Error(paymentErrorMessage(input.combinedDeliveryGroupId ? combinedDeliveryMutationError(error) : error))

  const result = data as { accepted?: boolean; error?: string } | null

  if (!result?.accepted)
    throw new Error(result?.error || "Payment was rejected")

  return result
}

export async function submitGroupPayment(input: {
  groupOrderId: string
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
    if (uploadError) throw new Error("We could not upload your receipt image.")
  }

  const { data, error } = await client.rpc("submit_group_order_payment", {
    p_group_order_id: input.groupOrderId,
    p_method_type: input.method,
    p_amount: input.amount,
    p_reference_number: input.referenceNumber ?? null,
    p_receipt_path: receiptPath,
    p_payer_account_name: input.payerAccountName ?? null,
    p_payer_phone: input.payerPhone ?? null,
    p_buyer_contact_url: input.buyerContactUrl ?? null,
  })
  if (error) throw new Error(paymentErrorMessage(error))
  const result = data as { accepted?: boolean; error?: string } | null
  if (!result?.accepted) throw new Error(result?.error || "Payment was rejected")
  return result
}

export async function requestOrderExtension(
  orderId: string,

  hours: number,

  reason?: string,
) {
  const { error } = await requireSupabase().rpc("request_order_extension", {
    p_order_id: orderId,

    p_hours: hours,

    p_reason: reason ?? null,
  })

  if (error) throw error
}

export async function cancelOrder(orderId: string) {
  const { error } = await requireSupabase().rpc("cancel_order", {
    p_order_id: orderId,
  })

  if (error) throw error
}

export async function expireClaim(orderId: string) {
  const { data, error } = await requireSupabase().rpc("expire_claim_if_due", {
    p_order_id: orderId,
  })

  if (error) throw error

  return Boolean(data)
}

export async function setFulfillmentStatus(orderId: string, status: string) {
  const { error } = await requireSupabase().rpc("set_fulfillment_status", {
    p_order_id: orderId,

    p_status: status,
  })

  if (error) throw error
}

export async function setOrderShippingFee(orderId: string, fee: number) {
  const { error } = await requireSupabase().rpc("set_order_shipping_fee", {
    p_order_id: orderId,

    p_fee: fee,
  })

  if (error) throw error
}

export async function setGroupOrderShippingFee(groupOrderId: string, fee: number) {
  const { error } = await requireSupabase().rpc("set_group_order_shipping_fee", {
    p_group_order_id: groupOrderId,
    p_fee: fee,
  })
  if (error) throw error
}

export async function requestGroupLocationCorrection(groupOrderId: string) {
  const { error } = await requireSupabase().rpc("request_group_location_correction", {
    p_group_order_id: groupOrderId,
  })
  if (error) throw error
}

export async function updateGroupDeliveryPin(
  groupOrderId: string,
  pin: { lat?: number; lng?: number; url?: string; address?: string },
) {
  const { error } = await requireSupabase().rpc("update_group_delivery_pin", {
    p_group_order_id: groupOrderId,
    p_lat: pin.lat ?? null,
    p_lng: pin.lng ?? null,
    p_url: pin.url ?? null,
    p_address: pin.address ?? null,
  })
  if (error) throw error
}

export async function declineGroupDeliveryOrder(groupOrderId: string, reason: string) {
  const { error } = await requireSupabase().rpc("decline_group_delivery_order", {
    p_group_order_id: groupOrderId,
    p_reason: reason,
  })
  if (error) throw error
}

export async function requestLocationCorrection(orderId: string) {
  const { error } = await requireSupabase().rpc("request_location_correction", {
    p_order_id: orderId,
  })

  if (error) throw error
}

export async function declineDeliveryOrder(orderId: string, reason: string) {
  const { error } = await requireSupabase().rpc("decline_delivery_order", {
    p_order_id: orderId,

    p_reason: reason,
  })

  if (error) throw error
}

export async function updateOrderDeliveryPin(
  orderId: string,

  pin: { lat?: number; lng?: number; url?: string; address?: string },
) {
  const { error } = await requireSupabase().rpc(
    "update_order_delivery_pin_with_address",

    {
      p_order_id: orderId,

      p_lat: pin.lat ?? null,

      p_lng: pin.lng ?? null,

      p_url: pin.url ?? null,

      p_address: pin.address ?? null,
    },
  )

  if (error) throw error
}

export async function setOrderTracking(
  orderId: string,

  tracking: {
    courier: string

    riderName: string

    riderContact: string

    trackingNumber: string

    eta: string

    trackingUrl?: string
  },
) {
  const { error } = await requireSupabase().rpc("set_order_tracking", {
    p_order_id: orderId,

    p_courier: tracking.courier,

    p_rider_name: tracking.riderName,

    p_rider_contact: tracking.riderContact,

    p_tracking_number: tracking.trackingNumber,

    p_eta: tracking.eta,

    p_tracking_url: tracking.trackingUrl ?? null,
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
}) {
  const client = requireSupabase()

  const { data: auth, error: userError } = await client.auth.getUser()

  if (userError) throw userError

  if (!auth.user) throw new Error("Authentication required")

  const payload: Record<string, unknown> = {}

  if (values.displayName !== undefined)
    payload.display_name = values.displayName

  if (values.bio !== undefined) payload.bio = values.bio

  if (values.socialLinks !== undefined)
    payload.social_links = values.socialLinks

  if (values.socialVisibility !== undefined)
    payload.social_visibility = values.socialVisibility

  if (values.canSell !== undefined) payload.can_sell = values.canSell

  if (values.notificationPreferences !== undefined)
    payload.notification_preferences = values.notificationPreferences

  const requestedEmail = values.email?.trim()

  const currentEmail = auth.user.email?.trim()

  if (
    requestedEmail &&
    requestedEmail.toLocaleLowerCase() !== currentEmail?.toLocaleLowerCase()
  ) {
    const { error: authError } = await client.auth.updateUser({
      email: requestedEmail,
    })

    if (authError) throw authError
  }

  if (Object.keys(payload).length === 0) return

  const { data, error } = await client

    .from("user_profiles")

    .update(payload)

    .eq("id", auth.user.id)

    .select("id")

    .single()

  if (error) throw error

  if (!data) throw new Error("Profile update did not affect an account")
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

export async function setProductWaitlistLimit(
  productId: string,

  limit?: number,
) {
  const normalized =
    limit !== undefined && limit >= 0 ? Math.floor(limit) : null

  const { error } = await requireSupabase().rpc("set_product_waitlist_limit", {
    p_product_id: productId,

    p_limit: normalized,
  })

  if (error) throw error
}

// Join (or update) a waitlist entry with the quantity the buyer wants. When

// stock frees up, the available amount is automatically added to My Claims.

export async function joinWaitlist(productId: string, quantity: number = 1) {
  const { error } = await requireSupabase().rpc("join_waitlist", {
    p_product_id: productId,

    p_quantity: Math.max(1, Math.floor(quantity)),
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

    .upload(objectPath, file, {
      upsert: true,

      contentType: file.type || undefined,
    })

  if (uploadError) throw uploadError

  const { error: profileError } = await client

    .from("user_profiles")

    .update({ avatar_path: objectPath })

    .eq("id", userId)

  if (profileError) throw profileError

  return client.storage.from("profile-avatars").getPublicUrl(objectPath).data
    .publicUrl
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

    .upload(objectPath, file, {
      upsert: true,

      contentType: file.type || undefined,
    })

  if (error) throw error

  return objectPath
}

export function paymentQrUrl(qrPath?: string | null): string | undefined {
  if (!qrPath) return undefined

  return requireSupabase().storage.from("payment-qr").getPublicUrl(qrPath).data
    .publicUrl
}

export async function paymentReceiptUrl(receiptPath: string): Promise<string> {
  const { data, error } = await requireSupabase()

    .storage.from("payment-receipts")

    .createSignedUrl(receiptPath, 600)

  if (error) throw error

  return data.signedUrl
}

// Buyer-facing: a seller's display-safe receive methods (type, name, number,

// public QR image URL) via the seller_receive_methods security-definer RPC.

export type SellerReceiveMethod = {
  methodType: string

  accountName: string | null

  accountNumber: string | null

  qrUrl?: string
}

export type SellerPaymentMethod = SellerReceiveMethod & {
  id: string
}

export async function loadOwnPaymentMethods(): Promise<SellerPaymentMethod[]> {
  const { data, error } = await requireSupabase()

    .from("seller_payment_methods")

    .select("id,method_type,account_name,account_number,qr_path")

    .eq("is_active", true)

    .order("method_type")

  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id,

    methodType: row.method_type,

    accountName: row.account_name,

    accountNumber: row.account_number,

    qrUrl: paymentQrUrl(row.qr_path),
  }))
}

export async function loadSellerReceiveMethods(
  sellerId: string,
): Promise<SellerReceiveMethod[]> {
  const { data, error } = await requireSupabase().rpc(
    "seller_receive_methods",

    { p_seller_id: sellerId },
  )

  if (error) throw error

  return (data ?? [])

    .filter((row: { method_type: string }) =>
      PAYMENT_METHOD_TYPES.has(row.method_type),
    )

    .map(
      (row: {
        method_type: string

        account_name: string | null

        account_number: string | null

        qr_path: string | null
      }) => ({
        methodType: row.method_type,

        accountName: row.account_name,

        accountNumber: row.account_number,

        qrUrl: paymentQrUrl(row.qr_path),
      }),
    )
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

  accountName: string,

  accountNumber: string,

  _verified?: boolean,

  qrFile?: File,
) {
  const values: Record<string, unknown> = {
    method_type: methodType,

    account_name: accountName,

    account_number: accountNumber,
  }

  if (qrFile) values.qr_path = await uploadPaymentQr(qrFile)

  const { error } = await requireSupabase()

    .from("seller_payment_methods")

    .update(values)

    .eq("id", id)

  if (error) throw error
}

export async function deactivatePaymentMethod(id: string) {
  const { error } = await requireSupabase()

    .from("seller_payment_methods")

    .update({ is_active: false })

    .eq("id", id)

  if (error) throw error
}

export async function loadNotifications(offset = 0, pageSize = 20) {
  const { data, error } = await requireSupabase()

    .from("notifications")

    .select("*")

    .order("created_at", { ascending: false })

    .order("id", { ascending: false })

    .range(offset, offset + pageSize - 1)

  if (error) throw error

  return data ?? []
}

export async function loadUnreadNotificationCount() {
  const { count, error } = await requireSupabase().from("notifications").select("id", { count: "exact", head: true }).is("read_at", null)
  if (error) throw error
  return count ?? 0
}

export async function markNotificationRead(id?: string) {
  const client = requireSupabase()

  let query = client

    .from("notifications")

    .update({ read_at: new Date().toISOString() })

  if (id) query = query.eq("id", id)
  else query = query.is("read_at", null)

  const { error } = await query

  if (error) throw error
}

export async function loadSellerPaymentSubmissions() {
  const client = requireSupabase()

  const { data, error } = await loadPaymentCompatibleRows(client, "submissions")

  if (error) throw error

  const buyerIds = [
    ...new Set((data ?? []).map((row) => row.orders.buyer_id as string)),
  ]

  const names = new Map<string, string>()

  if (buyerIds.length) {
    const { data: profiles } = await client

      .from("public_profiles")

      .select("id,display_name")

      .in("id", buyerIds)

    for (const profile of profiles ?? [])
      names.set(profile.id, profile.display_name)
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,

    orderId: row.orders.id as string,

    groupOrderId: row.orders.group_order_id ?? undefined,
    combinedDeliveryGroupId: row.combined_delivery_group_id ?? undefined,

    buyer: names.get(row.orders.buyer_id) ?? "Buyer",

    product: row.combined_delivery_group_id
      ? `Combined delivery · ${(row.combined ?? []).map((link: any) => `${link.orders?.batch_products?.name ?? "Product"} × ${link.orders?.quantity ?? "—"}`).join(", ")}`
      : row.orders.group_order_id
      ? `Group Order · ${row.orders.group_orders?.group_order_commitments?.length ?? 0} items`
      : row.orders.batch_products.name as string,

    amount: row.combined_delivery_group_id
      ? Number(row.amount)
      : row.orders.group_order_id
      ? Number(row.orders.group_orders?.final_subtotal ?? 0) +
        Number(row.orders.group_orders?.shipping_fee ?? 0)
      : Number(row.orders.total_amount),

    ref: row.reference_number ?? "—",

    date: new Date(row.submitted_at).toLocaleDateString(),

    submittedAt: row.submitted_at,

    status:
      row.status === "verified"
        ? "Verified" as const
        : row.status === "rejected"
          ? "Rejected" as const
          : "Pending" as const,

    method: row.method_type,

    acctName: row.payer_account_name ?? "—",

    receipt: row.receipt_path?.split("/").pop() ?? "No receipt",

    receiptPath: row.receipt_path ?? undefined,

    rejectReason: row.rejection_reason ?? undefined,

    rejectionDeadline: row.rejection_deadline ?? undefined,

    phone: row.payer_phone ?? undefined,

    amountPaid: String(row.amount),

    contact: row.buyer_contact_url ?? undefined,
  }))
}

export async function reviewPayment(
  paymentId: string,

  decision: "verified" | "rejected",

  reason?: string,

  deadlineHours?: number,
  combinedDeliveryGroupId?: string,
) {
  const { error } = await requireSupabase().rpc(combinedDeliveryGroupId ? "review_combined_delivery_payment" : "review_order_payment", {
    p_payment_id: paymentId,

    p_decision: decision,

    p_reason: reason ?? null,

    p_deadline_hours: deadlineHours ?? null,
  })

  if (error) throw error
}

export async function reviewGroupPayment(
  paymentId: string,
  decision: "verified" | "rejected",
  reason?: string,
  deadlineHours?: number,
) {
  const { error } = await requireSupabase().rpc("review_group_order_payment", {
    p_payment_id: paymentId,
    p_decision: decision,
    p_reason: reason ?? null,
    p_deadline_hours: deadlineHours ?? null,
  })
  if (error) throw error
}

export async function notifyPaymentResubmission(paymentId: string) {
  const { error } = await requireSupabase().rpc("notify_payment_resubmission", {
    p_payment_id: paymentId,
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

export async function loadSellerExtensionRequests() {
  const client = requireSupabase()

  const { data: extensionRows, error: extensionError } = await client

    .from("orders")

    .select(
      "id,buyer_id,extension_status,extension_requested_at,batch_products(name,batches(title))",
    )

    .eq("extension_status", "pending")

  if (extensionError) throw extensionError

  const buyerIds = [
    ...new Set((extensionRows ?? []).map((row) => row.buyer_id)),
  ]

  const names = new Map<string, string>()

  if (buyerIds.length) {
    const { data: profiles } = await client

      .from("public_profiles")

      .select("id,display_name")

      .in("id", buyerIds)

    for (const profile of profiles ?? []) {
      names.set(profile.id, profile.display_name)
    }
  }

  return {
    extensions: (extensionRows ?? []).map((row) => {
      const product = row.batch_products as unknown as {
        name: string

        batches: { title: string }
      }

      return {
        id: row.id as string,

        buyer: names.get(row.buyer_id) ?? "Buyer",

        product: product.name,

        batch: product.batches.title,

        requestedAt: new Date(row.extension_requested_at).toLocaleDateString(),

        status: row.extension_status as "pending" | "approved" | "denied",
      }
    }),
  }
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

export async function getFinancialSummary(
  from: Date,

  to: Date,

  batchId?: string,
) {
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

    .select(
      "quantity,total_amount,payment_confirmed_at,status,batch_products(name)",
    )

    .eq("seller_id", auth.user.id)

    .in("status", ["payment_confirmed", "preparing", "completed"])

    .gte("payment_confirmed_at", from.toISOString())

    .lt("payment_confirmed_at", to.toISOString())

  if (error) throw error

  const map = new Map<string, ProductSales>()

  for (const row of data ?? []) {
    const name =
      (row.batch_products as unknown as { name: string } | null)?.name ??
      "Unknown"

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

export async function getPeriodOrders(
  from: Date,

  to: Date,
): Promise<PeriodOrder[]> {
  const client = requireSupabase()

  const { data: auth } = await client.auth.getUser()

  if (!auth.user) throw new Error("Authentication required")

  const { data, error } = await client

    .from("orders")

    .select(
      "id,buyer_id,quantity,total_amount,payment_confirmed_at,batch_products(name)",
    )

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

    purchase:
      (r.batch_products as unknown as { name: string } | null)?.name ?? "Item",

    qty: Number(r.quantity),

    amount: Number(r.total_amount),
  }))
}

// Recorded batch expenses attributed to a date range, for period kita.

// Attribution rule (deterministic, no double-count across periods):

//   - itemized line items with a `date` → counted in the period of that date

//   - single-total, or itemized items without a date → attributed to the batch

//     and counted in the period containing the batch's trip end (ends_on)

export async function getRecordedExpensesForPeriod(
  from: Date,

  to: Date,
): Promise<number> {
  const client = requireSupabase()

  const { data: auth } = await client.auth.getUser()

  if (!auth.user) throw new Error("Authentication required")

  const { data, error } = await client

    .from("batch_expenses")

    .select("mode,total_amount,items,batches!inner(seller_id,ends_on)")

    .eq("batches.seller_id", auth.user.id)

  if (error) throw error

  const inRange = (d: Date) =>
    d.getTime() >= from.getTime() && d.getTime() < to.getTime()

  let sum = 0

  for (const row of data ?? []) {
    const batch = row.batches as unknown as { ends_on: string }

    const endsOn = new Date(`${batch.ends_on}T00:00:00`)

    if (row.mode === "itemized") {
      for (const item of row.items as ExpenseItem[] ?? []) {
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

export async function loadBatchExpenses(
  batchDbId: string,
): Promise<BatchExpenses | null> {
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

    items: data.items as ExpenseItem[] ?? [],
  }
}

export async function saveBatchExpenses(
  batchDbId: string,

  value: BatchExpenses,
) {
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

export const kargoApi = {
  signIn,

  signUp,

  resendConfirmation,

  signOut,

  setBatchReaction,

  requestPasswordReset,

  updatePassword,

  changePassword,

  loadCurrentAppData,

  claimProduct,

  createBatch,
  updateBatchCover,
  addBatchGalleryImages,
  updateProductImage,
  updateBatchGroupSettings,
  loadGroupOrder,
  loadMyGroupOrder,
  startGroupOrder,
  joinGroupOrder,
  setGroupCommitment,
  leaveGroupOrder,
  removeGroupMember,
  regenerateGroupCode,
  checkoutGroupOrder,

  submitPayment,
  submitGroupPayment,

  requestOrderExtension,

  cancelOrder,

  expireClaim,

  setFulfillmentStatus,

  setOrderShippingFee,
  setGroupOrderShippingFee,
  requestGroupLocationCorrection,
  updateGroupDeliveryPin,
  declineGroupDeliveryOrder,

  requestLocationCorrection,

  declineDeliveryOrder,

  updateOrderDeliveryPin,

  setOrderTracking,

  updateProfile,

  uploadProfileAvatar,

  setBatchLock,

  setProductLock,

  setProductWaitlistLimit,

  joinWaitlist,

  loadSellerReceiveMethods,

  loadOwnPaymentMethods,

  uploadPaymentQr,

  paymentQrUrl,

  paymentReceiptUrl,

  addPaymentMethod,

  updatePaymentMethod,

  deactivatePaymentMethod,

  loadNotifications,

  loadUnreadNotificationCount,

  markNotificationRead,

  loadSellerPaymentSubmissions,

  reviewPayment,
  reviewGroupPayment,

  notifyPaymentResubmission,

  decideOrderExtension,

  loadSellerExtensionRequests,

  getFinancialSummary,

  getSalesByProduct,

  getPeriodOrders,

  getRecordedExpensesForPeriod,

  loadBatchExpenses,

  saveBatchExpenses,
}
