// Notification / email preference catalog, grouped into role-aware sections.
//
// Each item's `key` is the stable identifier stored in
// profiles.notification_preferences (jsonb) and checked server-side by
// wants_email(user, key). Preferences use an OPT-OUT model: a key missing from
// the saved map means the buyer is still opted in (true).
//
// `roles` controls which sections appear for the signed-in user. "shared"
// items show for everyone.

export type NotifRole = "Buyer" | "Seller" | "shared"

export type NotifItem = {
  label: string
  sub: string
  key: string
}

export type NotifGroup = {
  title: string
  roles: NotifRole
  items: NotifItem[]
}

export const NOTIF_GROUPS: NotifGroup[] = [
  // ── Buyer-facing ────────────────────────────────────────────────────────────
  {
    title: "Orders & Claims",
    roles: "Buyer",
    items: [
      {
        label: "Orders & Claims",
        sub: "Claim successful, order status changes (shipped, delivered), and claim expiry",
        key: "claims",
      },
    ],
  },
  {
    title: "Payments",
    roles: "Buyer",
    items: [
      {
        label: "Payments",
        sub: "Payment received/verified, payment rejected, and payment deadline reminders",
        key: "payments",
      },
    ],
  },
  {
    title: "Waitlist",
    roles: "Buyer",
    items: [
      {
        label: "Waitlist",
        sub: "Reached #1, stock offered (partial/full match), and offer expiring soon",
        key: "waitlist",
      },
    ],
  },
  {
    title: "Batches You're Watching",
    roles: "Buyer",
    items: [
      {
        label: "Batches You're Watching",
        sub: "Claim deadline approaching, batch extension granted, and new batch from a followed seller",
        key: "watchedBatches",
      },
    ],
  },
  {
    title: "Ratings & Reviews",
    roles: "Buyer",
    items: [
      {
        label: "Ratings & Reviews",
        sub: "Someone left you a review, and reminders to rate a completed order",
        key: "reviews",
      },
    ],
  },

  // ── Seller-facing ─────────────────────────────────────────────────────────
  {
    title: "Buyer Activity",
    roles: "Seller",
    items: [
      {
        label: "Buyer Activity",
        sub: "New claims, buyer requests/messages, and waitlist joins",
        key: "buyerActivity",
      },
    ],
  },
  {
    title: "Payments to Verify",
    roles: "Seller",
    items: [
      {
        label: "Payments to Verify",
        sub: "New payment submissions awaiting your review",
        key: "paymentsToVerify",
      },
    ],
  },
  {
    title: "Batch Management",
    roles: "Seller",
    items: [
      {
        label: "Batch Management",
        sub: "Extension requests, batch closing soon, and batch recap on close",
        key: "batchManagement",
      },
    ],
  },
  {
    title: "Account & Verification",
    roles: "Seller",
    items: [
      {
        label: "Account & Verification",
        sub: "BIR badge status updates (Verified / Flagged)",
        key: "verification",
      },
    ],
  },

  // ── Shared (both roles) ─────────────────────────────────────────────────────
  {
    title: "Account & Security",
    roles: "shared",
    items: [
      {
        label: "Account & Security",
        sub: "Login alerts and profile changes such as password updates",
        key: "accountSecurity",
      },
    ],
  },
]

// Flat list of every preference key with its default (all opt-in except the
// legacy newBatches which was off). Used to seed the toggle state.
export const NOTIF_DEFAULT_STATE: Record<string, boolean> = {
  claims: true,
  payments: true,
  waitlist: true,
  watchedBatches: true,
  reviews: true,
  buyerActivity: true,
  paymentsToVerify: true,
  batchManagement: true,
  verification: true,
  accountSecurity: true,
}
