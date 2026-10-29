import type { Role, Tab } from "@/types";
import type { RecordFocusTarget } from "@/state/navIntent";

// Every notification row carries a target_path and a jsonb context written by
// the RPC/trigger that produced it. This module turns those two columns into
// exactly one action for the current role:
//
//   page   → the tab that actually shows the notified record, plus (when the
//            context names one) the exact record to scroll to and highlight,
//            the batch to open, or the group order to open
//   invite → re-open the admin invitation popup (Security is locked until the
//            user accepts, so no page can show it)
//   detail → no page shows it; the detail modal explains it instead
//
// Rules are keyed off the context columns that the SQL actually writes (see
// supabase/migrations). Nothing is inferred from message text.

export type NotificationContext = Record<string, unknown> | null | undefined;

export type NotificationIntent =
  // `id` is the batch's database uuid. With `groupOrderId` the batch opens on
  // that group's Group Order modal.
  | { type: "batch"; id: string; groupOrderId?: string }
  | { type: "extension-requests" }
  | { type: "account-status" }
  | { type: "admin-security" }
  // Buyer "My Group Orders" modal on My Claims, with this group expanded.
  | { type: "group-orders"; groupOrderId: string }
  // Scroll to and highlight this record on the destination page.
  | { type: "record"; target: RecordFocusTarget };

export type NotificationRoute =
  | { kind: "page"; tab: Tab; intent?: NotificationIntent }
  | { kind: "invite" }
  | { kind: "detail" };

export type NotificationFact = { label: string; value: string };

// Mirrors App.tsx's allowed-tab guard. A page the role cannot open must fall
// back to the detail modal instead of being snapped somewhere unrelated.
const NON_ADMIN_TABS: Tab[] = [
  "Dashboard",
  "Batches",
  "My Claims",
  "Payments",
  "Orders",
  "Settings",
  "Notifications",
];
const ADMIN_TABS: Tab[] = [
  "Dashboard",
  "Users",
  "Batches",
  "Transactions",
  "Security",
  "Notifications",
];

function canOpen(role: Role, tab: Tab) {
  return (role === "Admin" ? ADMIN_TABS : NON_ADMIN_TABS).includes(tab);
}

// Context ids are database uuids; anything else (missing, numeric, legacy) is
// treated as absent rather than guessed at.
const idOf = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

// Same URL/tab normalisation as before, but returns null for unknown targets
// so they can be handled by the detail modal rather than dumped on Dashboard.
export function normalizeTarget(value: unknown): Tab | null {
  if (typeof value !== "string") return null;
  const all: Tab[] = [
    "Dashboard",
    "Batches",
    "My Claims",
    "Payments",
    "Orders",
    "Settings",
    "Notifications",
    "Users",
    "Transactions",
    "Security",
  ];
  const direct = all.find((tab) => tab.toLowerCase() === value.toLowerCase());
  if (direct) return direct;
  try {
    const target = new URL(value, "https://kargo.local");
    const candidate = target.searchParams.get("tab") ?? target.pathname.slice(1);
    return all.find((tab) => tab.toLowerCase() === candidate.toLowerCase()) ?? null;
  } catch {
    return null;
  }
}

export function resolveNotificationRoute(
  role: Role,
  targetPath: unknown,
  context: NotificationContext,
): NotificationRoute {
  const ctx = context ?? {};
  const target = normalizeTarget(targetPath);
  const orderId = idOf(ctx.order_id);
  const paymentId = idOf(ctx.payment_id);
  const groupOrderId = idOf(ctx.group_order_id);
  const combinedGroupId = idOf(ctx.combined_delivery_group_id);
  const batchId = idOf(ctx.batch_id);

  const detail: NotificationRoute = { kind: "detail" };
  const page = (tab: Tab, intent?: NotificationIntent): NotificationRoute =>
    canOpen(role, tab) ? { kind: "page", tab, intent } : detail;

  // A page that shows the notified record. Buyers' Payments history only lists
  // verified ("Paid and Reserved") payments, so a rejection or pending-payment
  // notice would land on an empty page. My Claims always shows the claim and
  // its current payment state.
  const recordPage = (tab: Tab | null, record: RecordFocusTarget): NotificationRoute => {
    if (!tab) return detail;
    const destination = tab === "Payments" && role === "Buyer" ? "My Claims" : tab;
    const hasRecord = Object.values(record).some(Boolean);
    return page(destination, hasRecord ? { type: "record", target: record } : undefined);
  };

  // Admin membership lifecycle (admin_grant_admin / admin_accept / admin_decline
  // / admin_revoke). A pending invite has no page: Security is locked until the
  // user accepts, so reopen the invitation popup instead.
  if (typeof ctx.admin === "boolean") {
    if (ctx.pending === true) return { kind: "invite" };
    if (ctx.declined === true) {
      // Sent to the inviter; the decline is recorded in the audit log.
      return role === "Admin" ? page("Security", { type: "admin-security" }) : detail;
    }
    if (ctx.admin === true) return page("Security");
    return page("Dashboard");
  }

  // Suspended / restored. Settings → Account status renders the when/why trail
  // from my_account_status(). Admins have no Settings tab, so they get the
  // notice itself.
  if ("account_status" in ctx) {
    return page("Settings", { type: "account-status" });
  }

  // Seller access. Once enabled, the Dashboard is the seller's new home. When
  // it is removed, nothing shows the reason, so the notice itself is the page.
  if ("can_sell" in ctx) {
    return ctx.can_sell === true ? page("Dashboard") : detail;
  }

  // Group orders. This runs before the batch rule because a database trigger
  // adds batch_id (and group_open) to these notices.
  if (groupOrderId) {
    // Membership notices (joined / left / removed / cancelled) target Batches.
    // The group's members only appear inside the batch's Group Order modal, so
    // open the batch there while the recipient can still see that group, and
    // otherwise just the batch.
    if (target === "Batches") {
      if (!batchId || role === "Admin") return detail;
      return page("Batches", {
        type: "batch",
        id: batchId,
        groupOrderId: ctx.group_open === true ? groupOrderId : undefined,
      });
    }
    // Buyers follow their group in My Group Orders; sellers see it on the
    // order rows of the page the notice targets.
    if (role === "Buyer") return page("My Claims", { type: "group-orders", groupOrderId });
    return target === "My Claims" || target === "Orders" || target === "Payments"
      ? recordPage(target, { groupOrderId })
      : detail;
  }

  // Admin batch moderation (flag / hide / restore / close / lock).
  if (batchId) {
    return page("Batches", { type: "batch", id: batchId });
  }

  // Legacy waitlist offers ("accept or decline before the deadline"). No
  // current producer writes these and no waitlist offer UI exists.
  if ("waitlist_id" in ctx) return detail;

  // Combined delivery requests/reviews live in My Claims; payment events go to
  // the seller's Payments table or the buyer's My Claims, as the SQL writes.
  if (combinedGroupId) {
    return target === "My Claims" || target === "Payments"
      ? recordPage(target, { combinedGroupId, paymentId })
      : detail;
  }

  // Order-scoped events. An extension request is the only order event that
  // targets Batches, where the seller's request queue lives.
  if (orderId) {
    if (target === "Batches") {
      // Extension requests are seller-only; anyone else gets the notice.
      return role === "Seller" ? page("Batches", { type: "extension-requests" }) : detail;
    }
    if (target) return recordPage(target, { orderId, paymentId });
  }

  // Legacy extension requests were stored with request_id instead of order_id.
  if ("request_id" in ctx && target === "Batches") {
    return role === "Seller" ? page("Batches", { type: "extension-requests" }) : detail;
  }

  if (paymentId) return recordPage(target, { paymentId, orderId });

  // Producers always write target_path; if it is a tab this role can open, the
  // page is the intended destination.
  return recordPage(target, {});
}

// ─── Destination cue ────────────────────────────────────────────────────────
// A short label on every row that says where a tap goes, so users know before
// they tap. Tab names follow what the tab bar shows for the role.

function tabLabel(role: Role, tab: Tab) {
  if (role === "Seller") {
    if (tab === "My Claims") return "Orders";
    if (tab === "Orders") return "Fulfillment Board";
  }
  if (role === "Buyer") {
    if (tab === "Batches") return "Home";
    if (tab === "My Claims") return "Claims";
    if (tab === "Payments") return "History";
  }
  return tab;
}

export function routeCue(role: Role, route: NotificationRoute): string {
  if (route.kind === "invite") return "Respond to invitation";
  if (route.kind === "detail") return "View details";
  const intent = route.intent;
  if (intent?.type === "batch") return intent.groupOrderId ? "Open group order" : "Open batch";
  if (intent?.type === "group-orders") return "Open group order";
  if (intent?.type === "extension-requests") return "Review extension requests";
  if (intent?.type === "account-status") return "Open account status";
  if (intent?.type === "admin-security") return "Open audit log";
  return `Open in ${tabLabel(role, route.tab)}`;
}

// ─── Detail facts ───────────────────────────────────────────────────────────
// Only context keys that are human-meaningful. Raw ids are deliberately hidden:
// they mean nothing to the recipient and every page that shows them is already
// reachable from its own tab.

const formatMoment = (value: unknown) => {
  const date = new Date(String(value));
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
};

const formatMoney = (value: unknown) => {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? amount.toLocaleString(undefined, { style: "currency", currency: "PHP" })
    : null;
};

const humanize = (value: unknown) =>
  String(value).replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export function notificationFacts(context: NotificationContext): NotificationFact[] {
  if (!context) return [];
  const facts: NotificationFact[] = [];
  const add = (label: string, value: string | null) => {
    if (value) facts.push({ label, value });
  };

  if (typeof context.reason === "string" && context.reason.trim()) {
    add("Reason", context.reason.trim());
  }
  add("Resubmit by", context.rejection_deadline ? formatMoment(context.rejection_deadline) : null);
  add("New deadline", context.new_deadline ? formatMoment(context.new_deadline) : null);
  if (context.requested_hours !== undefined) {
    add("Extension requested", `${context.requested_hours} hour(s)`);
  }
  if (context.shipping_fee !== undefined) {
    add("Shipping fee", formatMoney(context.shipping_fee));
  }
  if (context.offer_quantity !== undefined) {
    add("Units available", String(context.offer_quantity));
  }
  if (context.fulfillment_stage) {
    add("Fulfilment stage", humanize(context.fulfillment_stage));
  }
  if (context.account_status === "active" || context.account_status === "suspended") {
    add("Account status", humanize(context.account_status));
  }
  add("Changed", context.changed_at ? formatMoment(context.changed_at) : null);
  if (typeof context.can_sell === "boolean") {
    add("Seller access", context.can_sell ? "Enabled" : "Removed");
  }
  if (context.action === "resubmit_payment") {
    add("Action needed", "Resubmit payment proof");
  }
  if (context.admin === true) {
    add("Admin invitation", context.pending === true ? "Pending your response" : "Granted");
  }
  if (context.declined === true) add("Invitation", "Declined");

  return facts;
}
