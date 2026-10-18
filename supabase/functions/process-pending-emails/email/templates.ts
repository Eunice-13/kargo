import type { EmailView, Rail } from "./layout.ts"
import { dateTime, humanize, pesos, shortDate } from "./format.ts"

export type RenderInput = {
  template: string
  subject: string
  body: string
  recipientName: string | null
  context: Record<string, unknown>
  details: Record<string, unknown>
}

const STAGES = ["Claimed", "Paid", "Shipped", "Delivered"]

const text = (value: unknown): string | null => {
  if (typeof value === "string") return value.trim() || null
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  return null
}

const number = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function rowList(entries: Array<[string, string | null, string?]>): NonNullable<EmailView["rows"]> {
  return entries
    .filter((entry): entry is [string, string, string?] => Boolean(entry[1]))
    .map(([label, value, note]) => ({ label, value, ...(note ? { note } : {}) }))
}

function stage(active: number, complete = false): Rail {
  const clamped = Math.max(0, Math.min(active, STAGES.length - 1))
  return { steps: STAGES, active: clamped, complete }
}

/** Everything the builders need, read defensively so a partial row still renders. */
function facts(input: RenderInput) {
  const d = input.details
  const orderNumber = text(d.orderNumber) ?? text(input.context.orderNumber)
  const product = text(d.productName)
  const quantity = number(d.quantity)
  const total = number(d.totalAmount)
  const shippingFee = number(d.shippingFee)
  const verified = number(d.verifiedAmount)
  const balance = number(d.balanceDue)
  const deadline = text(d.deadline)
  const method = text(d.paymentMethod)
  const courier = text(d.courier)
  const riderName = text(d.riderName)
  const riderContact = text(d.riderContact)
  const trackingNumber = text(d.trackingNumber)
  const trackingUrl = text(d.trackingUrl)
  const eta = text(d.eta)
  const reason = text(d.declineReason) ?? text(input.context.reason)
  const paymentReason = text(d.paymentRejectionReason) ?? reason
  const offerQuantity = number(d.offerQuantity) ?? number(input.context.offer_quantity)
  const desiredQuantity = number(d.desiredQuantity)
  const hasDetails = Object.keys(d).length > 0

  return {
    orderNumber,
    product,
    item: product ?? "your order",
    quantity,
    total,
    shippingFee,
    verified,
    balance,
    deadline,
    method,
    courier,
    rider: [riderName, riderContact].filter(Boolean).join(" · ") || null,
    trackingNumber,
    trackingUrl,
    eta,
    reason,
    paymentReason,
    offerQuantity,
    desiredQuantity,
    hasDetails,
  }
}

const amount = (value: number | null) => pesos(value)

/* ── Payments ─────────────────────────────────────────────────────────────── */

const paymentSubmitted = (input: RenderInput): EmailView => {
  const f = facts(input)
  return {
    preheader: `Your proof for ${f.item} is with the seller for review.`,
    headline: "Payment received",
    lead: `Your payment proof for ${f.item} is in. The seller reviews it next — you do not need to send anything else right now.`,
    chip: { label: "Awaiting verification", tone: "info" },
    orderNumber: f.orderNumber ?? undefined,
    rows: rowList([
      ["Product", f.product],
      ["Quantity", f.quantity !== null ? String(f.quantity) : null],
      ["Order total", amount(f.total)],
      ["Payment method", f.method],
    ]),
    rail: stage(0),
    closing: "If the seller needs a clearer proof, they will ask for a new one before the deadline.",
    cta: { label: "View submission", tab: "My Claims" },
  }
}

const paymentVerified = (input: RenderInput): EmailView => {
  const f = facts(input)
  return {
    preheader: `Payment confirmed — ${f.orderNumber ?? f.item} is reserved for you.`,
    headline: "You're paid and reserved",
    lead: `The seller verified your payment for ${f.item}. Your order is confirmed and moves to fulfillment next.`,
    chip: { label: "Paid and reserved", tone: "success" },
    orderNumber: f.orderNumber ?? undefined,
    rows: rowList([
      ["Product", f.product],
      ["Quantity", f.quantity !== null ? String(f.quantity) : null],
      ["Order total", amount(f.total)],
      ["Payment method", f.method],
    ]),
    rail: stage(1),
    cta: { label: "View order", tab: "Orders" },
  }
}

const paymentInsufficient = (input: RenderInput): EmailView => {
  const f = facts(input)
  const balance = f.balance !== null ? f.balance : f.total !== null && f.verified !== null ? f.total - f.verified : null
  return {
    preheader: `A balance of ${amount(balance) ?? "your remaining total"} is still open.`,
    headline: "A balance is still open",
    lead: `Your payment for ${f.item} was verified, but it did not cover the full total. Pay the difference to keep the reservation.`,
    chip: { label: "Insufficient payment", tone: "warning" },
    orderNumber: f.orderNumber ?? undefined,
    focus: balance !== null
      ? {
          label: "Balance due",
          value: amount(balance) ?? "",
          note: f.deadline ? `Pay before ${dateTime(f.deadline)}` : undefined,
          tone: "warning",
        }
      : undefined,
    rows: rowList([
      ["Product", f.product],
      ["Order total", amount(f.total)],
      ["Already verified", amount(f.verified)],
      ["Payment method", f.method],
    ]),
    rail: stage(0),
    cta: { label: "Pay the balance", tab: "My Claims" },
  }
}

const paymentRejected = (input: RenderInput): EmailView => {
  const f = facts(input)
  return {
    preheader: `The seller could not verify your payment for ${f.item}.`,
    headline: "Your payment needs another look",
    lead: `The seller could not verify your payment for ${f.item}. Send a new proof before the deadline so the reservation is not released.`,
    chip: { label: "Rejected", tone: "danger" },
    orderNumber: f.orderNumber ?? undefined,
    rows: rowList([
      ["Product", f.product],
      ["Order total", amount(f.total)],
      ["Payment method", f.method],
      ["New deadline", f.deadline ? dateTime(f.deadline) : null],
    ]),
    note: f.paymentReason ? { label: "Reason from the seller", text: f.paymentReason, tone: "danger" } : undefined,
    rail: stage(0),
    closing: "Nothing is confirmed until a new proof is accepted, so send one before the deadline.",
    cta: { label: "Submit a new payment", tab: "My Claims" },
  }
}

const paymentDeadlineReminder = (input: RenderInput): EmailView => {
  const f = facts(input)
  return {
    preheader: f.deadline
      ? `Pay before ${dateTime(f.deadline)} to keep ${f.item}.`
      : `Your reservation for ${f.item} expires within the hour.`,
    headline: "One hour left to pay",
    lead: `Your reservation for ${f.item} is almost out of time. Submit payment before the deadline to keep it.`,
    chip: { label: "Payment pending", tone: "warning" },
    orderNumber: f.orderNumber ?? undefined,
    focus: {
      label: "Pay before",
      value: f.deadline ? dateTime(f.deadline) ?? "" : "Under one hour",
      ...(f.total !== null ? { note: `Amount due ${amount(f.total)}` } : {}),
      tone: "warning",
    },
    rows: rowList([
      ["Product", f.product],
      ["Quantity", f.quantity !== null ? String(f.quantity) : null],
      ["Payment method", f.method],
    ]),
    cta: { label: "Pay now", tab: "My Claims" },
    closing: "If the timer runs out, the stock returns to the batch automatically.",
  }
}

/* ── Fulfillment ──────────────────────────────────────────────────────────── */

const trackingRows = (f: ReturnType<typeof facts>) =>
  rowList([
    ["Courier", f.courier],
    ["Rider", f.rider],
    ["Estimated arrival", f.eta ? dateTime(f.eta) : null],
  ])

const orderShipped = (input: RenderInput): EmailView => {
  const f = facts(input)
  return {
    preheader: `${f.item} has left the seller. ${f.courier ? `Shipping with ${f.courier}.` : "Tracking details inside."}`,
    headline: "Your order is on its way",
    lead: `${f.item} has shipped${f.courier ? ` with ${f.courier}` : ""}. Here is what you need to follow it.`,
    chip: { label: "Shipped", tone: "info" },
    orderNumber: f.orderNumber ?? undefined,
    focus: f.trackingNumber
      ? {
          label: "Tracking number",
          value: f.trackingNumber,
          note: [f.courier, f.eta ? `Arriving ${dateTime(f.eta)}` : null].filter(Boolean).join(" · ") || undefined,
          tone: "info",
        }
      : undefined,
    rows: trackingRows(f),
    rail: stage(2),
    cta: { label: "Track order", tab: "Orders", url: f.trackingUrl },
  }
}

const orderInTransit = (input: RenderInput): EmailView => {
  const f = facts(input)
  return {
    preheader: `${f.item} is moving through the courier network.`,
    headline: "Your order is in transit",
    lead: `${f.item} has been scanned in transit${f.courier ? ` by ${f.courier}` : ""}. The next update is delivery.`,
    chip: { label: "In transit", tone: "info" },
    orderNumber: f.orderNumber ?? undefined,
    focus: f.trackingNumber
      ? {
          label: "Tracking number",
          value: f.trackingNumber,
          note: f.eta ? `Arriving ${dateTime(f.eta)}` : undefined,
          tone: "info",
        }
      : undefined,
    rows: trackingRows(f),
    rail: stage(2),
    cta: { label: "Track order", tab: "Orders", url: f.trackingUrl },
  }
}

const orderDelivered = (input: RenderInput): EmailView => {
  const f = facts(input)
  return {
    preheader: `${f.item} was marked delivered.`,
    headline: "Your order was delivered",
    lead: `${f.item} was marked delivered${f.courier ? ` by ${f.courier}` : ""}. Open KARGO to check the order and close it out.`,
    chip: { label: "Delivered", tone: "success" },
    orderNumber: f.orderNumber ?? undefined,
    rows: rowList([
      ["Courier", f.courier],
      ["Rider", f.rider],
      ["Tracking number", f.trackingNumber],
      ["Original estimate", f.eta ? shortDate(f.eta) : null],
    ]),
    rail: stage(3, true),
    cta: { label: "Review your order", tab: "Orders" },
  }
}

/* ── Delivery coordination ────────────────────────────────────────────────── */

const shippingFeeNeeded = (input: RenderInput): EmailView => {
  const f = facts(input)
  return {
    preheader: `${f.item} is waiting on a shipping fee before the buyer can pay.`,
    headline: "A delivery order needs a shipping fee",
    lead: `A buyer reserved ${f.item} and the payment clock is paused until you review the delivery location and set the shipping fee.`,
    chip: { label: "Deadline paused", tone: "warning" },
    orderNumber: f.orderNumber ?? undefined,
    rows: rowList([
      ["Product", f.product],
      ["Quantity", f.quantity !== null ? String(f.quantity) : null],
      ["Item total", amount(f.total)],
      ["Buyer status", "Waiting for you"],
    ]),
    note: {
      label: "Why the timer is stopped",
      text: "The buyer cannot pay until the fee is set, so the reservation deadline is paused rather than counting down.",
      tone: "warning",
    },
    cta: { label: "Set the shipping fee", tab: "My Claims" },
  }
}

const shippingFeeAdded = (input: RenderInput): EmailView => {
  const f = facts(input)
  const newTotal = f.total !== null && f.shippingFee !== null ? f.total + f.shippingFee : f.total
  return {
    preheader: `Shipping is set. ${amount(newTotal) ?? "Your total"} is ready to pay.`,
    headline: "Shipping added — you can pay now",
    lead: `The seller set the shipping fee for ${f.item}. Your payment deadline picked up exactly where it paused.`,
    chip: { label: "Ready to pay", tone: "success" },
    orderNumber: f.orderNumber ?? undefined,
    focus: newTotal !== null
      ? {
          label: "New total",
          value: amount(newTotal) ?? "",
          note: f.deadline ? `Pay before ${dateTime(f.deadline)}` : undefined,
          tone: "success",
        }
      : undefined,
    rows: rowList([
      ["Product", f.product],
      ["Item total", amount(f.total)],
      ["Shipping fee", amount(f.shippingFee)],
      ["Payment method", f.method],
    ]),
    rail: stage(0),
    cta: { label: "Pay now", tab: "My Claims" },
  }
}

const locationCorrection = (input: RenderInput): EmailView => {
  const f = facts(input)
  return {
    preheader: `The seller needs a more precise delivery pin for ${f.orderNumber ?? f.item}.`,
    headline: "Update your delivery pin",
    lead: `The seller needs a more precise delivery location for ${f.item}. Drop a new pin or paste a Google Maps link — the clock stays paused until the seller confirms.`,
    chip: { label: "Deadline paused", tone: "warning" },
    orderNumber: f.orderNumber ?? undefined,
    rows: rowList([
      ["Product", f.product],
      ["Quantity", f.quantity !== null ? String(f.quantity) : null],
      ["Delivery status", "Location needed"],
    ]),
    note: {
      label: "Your reservation is safe",
      text: "The deadline cannot expire while the seller is waiting on your corrected location.",
      tone: "info",
    },
    cta: { label: "Update delivery pin", tab: "My Claims" },
  }
}

const deliveryDeclined = (input: RenderInput): EmailView => {
  const f = facts(input)
  return {
    preheader: `${f.orderNumber ?? "Your order"} was declined and the stock released.`,
    headline: "This order was declined",
    lead: `The seller declined your order for ${f.item}, so the reservation is cancelled and the stock went back to the batch.`,
    chip: { label: "Cancelled", tone: "danger" },
    orderNumber: f.orderNumber ?? undefined,
    rows: rowList([
      ["Product", f.product],
      ["Quantity", f.quantity !== null ? String(f.quantity) : null],
      ["Order", f.orderNumber],
    ]),
    note: f.reason ? { label: "Reason from the seller", text: f.reason, tone: "danger" } : undefined,
    closing: "Nothing was charged for this order, and the reservation is fully closed.",
    cta: { label: "Browse live batches", tab: "Batches" },
  }
}

/* ── Claims and waitlist ──────────────────────────────────────────────────── */

const claimExpired = (input: RenderInput): EmailView => {
  const f = facts(input)
  return {
    preheader: `No payment reached ${f.orderNumber ?? "your order"} in time.`,
    headline: "Your reservation expired",
    lead: `No payment came through for ${f.item} before the deadline, so the reservation closed and the stock went back to the batch.`,
    chip: { label: "Expired", tone: "danger" },
    orderNumber: f.orderNumber ?? undefined,
    rows: rowList([
      ["Product", f.product],
      ["Quantity", f.quantity !== null ? String(f.quantity) : null],
      ["Order", f.orderNumber],
    ]),
    closing: "If the seller lists another batch, you can claim the item again or rejoin the waitlist.",
    cta: { label: "Browse live batches", tab: "Batches" },
  }
}

const waitlistAutoClaimed = (input: RenderInput): EmailView => {
  const f = facts(input)
  const quantity = f.quantity ?? f.offerQuantity
  return {
    preheader: `${quantity ? `${quantity} × ` : ""}${f.item} moved into My Claims.`,
    headline: "Your waitlist item is yours",
    lead: `Stock opened up, so ${quantity ? `${quantity} × ` : ""}${f.item} moved into My Claims automatically. Pay before the reservation timer ends to keep it.`,
    chip: { label: "Claimed for you", tone: "success" },
    orderNumber: f.orderNumber ?? undefined,
    rows: rowList([
      ["Product", f.product],
      ["Quantity", quantity !== null ? String(quantity) : null],
      ["Status", "Waiting for payment"],
    ]),
    cta: { label: "Pay now", tab: "My Claims" },
  }
}

const waitlistPartialOffer = (input: RenderInput): EmailView => {
  const f = facts(input)
  const available = f.offerQuantity
  const asked = f.desiredQuantity
  const preheader = available !== null && asked !== null
    ? `${available} of the ${asked} you wanted from ${f.item} are available now.`
    : available !== null
      ? `${available} × ${f.item} opened up from your waitlist.`
      : `Part of your waitlist for ${f.item} is available now.`
  const lead = available !== null && asked !== null
    ? `Only ${available} of the ${asked} ${f.item} units you asked for are available now. Accept or decline before the response window closes.`
    : available !== null
      ? `${available} × ${f.item} from your waitlist are available now. Accept or decline before the response window closes.`
      : `Part of your waitlist for ${f.item} is available now. Accept or decline before the response window closes.`
  return {
    preheader,
    headline: "Part of your waitlist is available",
    lead,
    chip: { label: "Offer open", tone: "warning" },
    orderNumber: f.orderNumber ?? undefined,
    strip: available !== null
      ? {
          label: "Waitlist offer",
          value: asked !== null ? `${available} of ${asked} units` : `${available} available`,
        }
      : { label: "Waitlist offer", value: f.product ?? "Partial stock" },
    rows: rowList([
      ["Product", f.product],
      ["Available now", available !== null ? String(available) : null],
      ["You asked for", f.desiredQuantity !== null ? String(f.desiredQuantity) : null],
    ]),
    closing: "Declining releases the units to the next buyer on the list.",
    cta: { label: "Accept or decline", tab: "My Claims" },
  }
}

/* ── Registry ─────────────────────────────────────────────────────────────── */

const BUILDERS: Record<string, (input: RenderInput) => EmailView> = {
  payment_submitted: paymentSubmitted,
  payment_verified: paymentVerified,
  payment_insufficient: paymentInsufficient,
  payment_rejected: paymentRejected,
  payment_deadline_reminder: paymentDeadlineReminder,
  order_shipped: orderShipped,
  order_in_transit: orderInTransit,
  order_delivered: orderDelivered,
  shipping_fee_needed: shippingFeeNeeded,
  shipping_fee_added: shippingFeeAdded,
  location_correction: locationCorrection,
  delivery_order_declined: deliveryDeclined,
  claim_expired: claimExpired,
  waitlist_auto_claimed: waitlistAutoClaimed,
  waitlist_partial_offer: waitlistPartialOffer,
}

export const TEMPLATE_NAMES = Object.keys(BUILDERS)

/** Unknown templates still get the branded shell, with the queued body as the lead. */
function fallback(input: RenderInput): EmailView {
  const f = facts(input)
  const cleaned = input.body.trim()
  return {
    preheader: cleaned.slice(0, 96),
    headline: input.subject || `An update from KARGO`,
    lead: cleaned || "There is a new update on your KARGO account.",
    chip: { label: humanize(input.template) ?? "Update", tone: "neutral" },
    orderNumber: f.orderNumber ?? undefined,
    cta: { label: "Open KARGO", tab: "My Claims" },
  }
}

export function buildView(input: RenderInput): EmailView {
  const builder = BUILDERS[input.template]
  const view = builder ? builder(input) : fallback(input)
  return { ...view, preheader: view.preheader || input.subject }
}
