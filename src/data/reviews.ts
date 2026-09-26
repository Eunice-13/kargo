// Demo-mode (`?preview=original`, or any run without Supabase env vars) review
// seed.
//
// This is the demo counterpart to the `public.reviews` table. Every row here is
// a review left on a COMPLETED transaction between two real seeded accounts —
// the same participants that appear in `batches.ts`, `orders.ts` and
// `fulfillmentData.ts`. Nothing is invented: no row is a placeholder, and no
// user is given a rating they did not earn.
//
// The point of the seed is that averages look *earned*. The distribution below
// is deliberately uneven — mostly 4s and 5s with a few 3s — so a seller's score
// reflects real history rather than every account sitting at a suspiciously
// perfect 5.0. Users with too little activity to judge (Mark Villanueva, one
// review) and users with none (Liza Mendoza, the demo buyer Alex Jordan) are
// left that way on purpose, so the "New seller" / "New buyer" empty states are
// exercised rather than hidden.
//
// The aggregates are NOT written down here. `DEMO_RATINGS` is computed from
// `REVIEWS_INIT` by the same `summarizeReviews` used against Supabase rows, so
// demo and live mode cannot drift apart in how they average.

import type { ReviewRecord, UserRating } from "@/types"
import { buildUserRating } from "@/lib/ratings"

// ── Accounts ─────────────────────────────────────────────────────────────────
// Stable ids so demo batches, claims and reviews all reference the same user,
// mirroring the profile-uuid keying used in Supabase mode.

export type DemoProfile = { id: string; name: string }

export const DEMO_SELLERS: DemoProfile[] = [
  { id: "demo-maria", name: "Maria Santos" },
  { id: "demo-ana", name: "Ana Reyes" },
  { id: "demo-jade", name: "Jade Bautista" },
  { id: "demo-paolo", name: "Paolo Garcia" },
  { id: "demo-kristine", name: "Kristine Aquino" },
  { id: "demo-ella", name: "Ella Torres" },
  { id: "demo-rico", name: "Rico Santos" },
  { id: "demo-mark", name: "Mark Villanueva" },
  // No completed transactions yet — exercises the "New seller" empty state.
  { id: "demo-liza", name: "Liza Mendoza" },
]

export const DEMO_BUYERS: DemoProfile[] = [
  { id: "demo-alex", name: "Alex Jordan" },
  { id: "demo-trisha", name: "Trisha Lim" },
  { id: "demo-grace", name: "Grace Reyes" },
  { id: "demo-ben", name: "Ben Torres" },
  { id: "demo-anna", name: "Anna Bautista" },
  { id: "demo-carlo", name: "Carlo Santos" },
  { id: "demo-mia", name: "Mia Cruz" },
  { id: "demo-jadeg", name: "Jade Garcia" },
  { id: "demo-ricom", name: "Rico Mendoza" },
]

export const DEMO_PROFILES: DemoProfile[] = [
  ...DEMO_SELLERS,
  ...DEMO_BUYERS,
]

const NAME_BY_ID = new Map(DEMO_PROFILES.map((p) => [p.id, p.name]))
const ID_BY_NAME = new Map(DEMO_PROFILES.map((p) => [p.name, p.id]))

export const DEMO_USER = DEMO_BUYERS[0]

export function demoProfileId(name: string): string | undefined {
  return ID_BY_NAME.get(name)
}

export function demoProfileName(id: string): string {
  return NAME_BY_ID.get(id) ?? id
}

export const DEMO_PROFILE_ID_BY_NAME: Record<string, string> =
  Object.fromEntries(DEMO_PROFILES.map((p) => [p.name, p.id]))

// ── Reviews ──────────────────────────────────────────────────────────────────
//
// One row per completed transaction per direction. `rating` is the score the
// reviewer gave; the reviewee is the other party on that order.
//
// Written as a compact table so the pairing stays auditable: each entry is one
// order, and the two ratings are independent (a buyer can rate a seller 5 while
// that seller rates the buyer 4).

type ReviewSeed = {
  order: string
  buyer: string
  seller: string
  batch: string
  product: string
  // Score the buyer gave the seller, and the seller's note about them.
  buyerRating: number
  buyerComment: string
  buyerStatements: string[]
  // Score the seller gave the buyer, and the buyer's note about them.
  sellerRating: number
  sellerComment: string
  sellerStatements: string[]
  date: string
}

const TRANSACTIONS: ReviewSeed[] = [
  // ── Maria Santos — long-running Japan seller, 4.6 ──────────────────────────
  {
    order: "ORD-2026-0031",
    buyer: "Alex Jordan",
    seller: "Maria Santos",
    batch: "Japan Trip — March 2026",
    product: "Meiji Chocolate",
    buyerRating: 5,
    buyerComment:
      "Arrived in perfect condition, no melted boxes at all. Maria updated me twice while it was in transit.",
    buyerStatements: ["Well packed", "Great communication"],
    sellerRating: 4,
    sellerComment:
      "Paid on time and confirmed the item count right away. Easy to coordinate.",
    sellerStatements: ["Paid on time", "Easy to coordinate"],
    date: "2026-03-22T09:15:00.000Z",
  },
  {
    order: "ORD-2026-0007",
    buyer: "Jade Garcia",
    seller: "Maria Santos",
    batch: "Japan Trip — March 2026",
    product: "Tokyo Banana",
    buyerRating: 5,
    buyerComment:
      "Flavors were spot on and the packaging was so good I could gift them straight away.",
    buyerStatements: ["Well packed", "Fast shipping"],
    sellerRating: 5,
    sellerComment:
      "Clear about pickup time and very easy to talk to. Would gladly sell to again.",
    sellerStatements: ["Easy to coordinate", "Clear communication"],
    date: "2026-03-18T14:40:00.000Z",
  },
  {
    order: "ORD-2026-0009",
    buyer: "Trisha Lim",
    seller: "Maria Santos",
    batch: "Japan Trip — March 2026",
    product: "KitKat Sakura",
    buyerRating: 5,
    buyerComment:
      "Best seller I've transacted with. Sent photos before shipping so I knew exactly what I was getting.",
    buyerStatements: ["Great communication", "Item as described"],
    sellerRating: 5,
    sellerComment:
      "Very organized buyer, settled the payment right away and was flexible on meetup.",
    sellerStatements: ["Paid on time", "Easy to coordinate"],
    date: "2026-03-11T11:05:00.000Z",
  },
  {
    order: "ORD-2026-0012",
    buyer: "Grace Reyes",
    seller: "Maria Santos",
    batch: "Japan Trip — March 2026",
    product: "Shiseido Sunscreen",
    buyerRating: 4,
    buyerComment:
      "Product was exactly as listed. Took a couple of days longer to update me on the flight delay, but she made up for it.",
    buyerStatements: ["Item as described", "Well packed"],
    sellerRating: 5,
    sellerComment:
      "Patient buyer who understood the delay. Sent payment ahead of the meetup.",
    sellerStatements: ["Easy to coordinate", "Paid on time"],
    date: "2026-03-05T08:20:00.000Z",
  },
  {
    order: "ORD-2026-0015",
    buyer: "Anna Bautista",
    seller: "Maria Santos",
    batch: "Japan Trip — March 2026",
    product: "Meiji Chocolate",
    buyerRating: 4,
    buyerComment:
      "Good value for the price. One box had a small dent but the contents were sealed.",
    buyerStatements: ["Item as described", "Well packed"],
    sellerRating: 5,
    sellerComment:
      "Super straightforward. Confirmed the dent claim immediately and refunded the difference without being asked.",
    sellerStatements: ["Easy to coordinate", "Responded quickly"],
    date: "2026-02-27T16:30:00.000Z",
  },

  // ── Ana Reyes — skincare, 4.5 ─────────────────────────────────────────────
  {
    order: "ORD-2026-0016",
    buyer: "Carlo Santos",
    seller: "Ana Reyes",
    batch: "Korea Haul — April 2026",
    product: "Korean Skincare Set",
    buyerRating: 5,
    buyerComment:
      "The set alone was worth it. Ana even included a sample I wasn't expecting.",
    buyerStatements: ["Fast shipping", "Item as described"],
    sellerRating: 4,
    sellerComment:
      "Smooth payment, though it came in a day later than agreed. No complaints otherwise.",
    sellerStatements: ["Easy to coordinate", "Responded quickly"],
    date: "2026-04-12T10:10:00.000Z",
  },
  {
    order: "ORD-2026-0018",
    buyer: "Mia Cruz",
    seller: "Ana Reyes",
    batch: "Korea Haul — April 2026",
    product: "Laneige Lip Mask",
    buyerRating: 4,
    buyerComment:
      "Authentic and well sealed. Communication was a bit slow during the holidays but she replied to everything.",
    buyerStatements: ["Item as described", "Well packed"],
    sellerRating: 5,
    sellerComment:
      "Pleasant buyer who was happy to meet at a different mall. Would transact again.",
    sellerStatements: ["Easy to coordinate", "Clear communication"],
    date: "2026-04-08T13:25:00.000Z",
  },
  {
    order: "ORD-2026-0019",
    buyer: "Ben Torres",
    seller: "Ana Reyes",
    batch: "Korea Haul — April 2026",
    product: "COSRX Snail Cream",
    buyerRating: 5,
    buyerComment:
      "No notes. Fast shipping and exactly as described.",
    buyerStatements: ["Fast shipping", "Item as described"],
    sellerRating: 4,
    sellerComment:
      "Paid on time. Took a while to confirm the meetup spot, otherwise fine.",
    sellerStatements: ["Paid on time", "Easy to coordinate"],
    date: "2026-04-06T09:45:00.000Z",
  },
  {
    order: "ORD-2026-0021",
    buyer: "Grace Reyes",
    seller: "Ana Reyes",
    batch: "Korea Haul — April 2026",
    product: "Paldo Bibimmyeon",
    buyerRating: 4,
    buyerComment:
      "Good condition and fair price. Would have liked a few more photos of the actual stock.",
    buyerStatements: ["Item as described", "Well packed"],
    sellerRating: 4,
    sellerComment:
      "Reliable buyer, paid promptly and showed up on time. A little hard to reach mid-week.",
    sellerStatements: ["Paid on time", "Responded quickly"],
    date: "2026-03-30T15:50:00.000Z",
  },

  // ── Jade Bautista — premium skincare, 4.8 ──────────────────────────────────
  {
    order: "ORD-2026-0003",
    buyer: "Trisha Lim",
    seller: "Jade Bautista",
    batch: "Singapore Haul — Aug 2026",
    product: "SK-II Essence",
    buyerRating: 5,
    buyerComment:
      "Legit seller, batch code checked and sealed. Expensive but worth it for the peace of mind.",
    buyerStatements: ["Authentic items", "Well packed"],
    sellerRating: 5,
    sellerComment:
      "Knows what she's buying and paid in full ahead of the shipping date. Ideal buyer.",
    sellerStatements: ["Paid on time", "Clear communication"],
    date: "2026-08-26T12:00:00.000Z",
  },
  {
    order: "ORD-2026-0004",
    buyer: "Mia Cruz",
    seller: "Jade Bautista",
    batch: "Singapore Haul — Aug 2026",
    product: "Hada Labo Serum",
    buyerRating: 5,
    buyerComment:
      "Genuine and beautifully boxed. Jade answered my questions about expiry dates within minutes.",
    buyerStatements: ["Great communication", "Authentic items"],
    sellerRating: 5,
    sellerComment:
      "Thoughtful buyer who checked expiry before claiming. Very smooth from start to finish.",
    sellerStatements: ["Easy to coordinate", "Paid on time"],
    date: "2026-08-24T10:35:00.000Z",
  },
  {
    order: "ORD-2026-0005",
    buyer: "Grace Reyes",
    seller: "Jade Bautista",
    batch: "Singapore Haul — Aug 2026",
    product: "COSRX Snail Cream",
    buyerRating: 4,
    buyerComment:
      "Product was great. One small ding: the outer box was slightly crushed on arrival.",
    buyerStatements: ["Authentic items", "Well packed"],
    sellerRating: 4,
    sellerComment:
      "Good transaction. Buyer took a while to reply but confirmed the refund quickly.",
    sellerStatements: ["Clear communication", "Responded quickly"],
    date: "2026-08-21T09:15:00.000Z",
  },
  {
    order: "ORD-2026-0006",
    buyer: "Ben Torres",
    seller: "Jade Bautista",
    batch: "Singapore Haul — Aug 2026",
    product: "SK-II Essence",
    buyerRating: 5,
    buyerComment:
      "Fast shipping and the packaging was proper luxury-grade. Recommended.",
    buyerStatements: ["Fast shipping", "Well packed"],
    sellerRating: 5,
    sellerComment:
      "Paid immediately and was easy to schedule with. Great buyer.",
    sellerStatements: ["Paid on time", "Easy to coordinate"],
    date: "2026-08-18T14:50:00.000Z",
  },
  {
    order: "ORD-2026-0008",
    buyer: "Rico Mendoza",
    seller: "Jade Bautista",
    batch: "Singapore Haul — Aug 2026",
    product: "Hada Labo Serum",
    buyerRating: 5,
    buyerComment:
      "Smooth from claim to meetup. Would definitely buy from Jade again.",
    buyerStatements: ["Easy to coordinate", "Item as described"],
    sellerRating: 5,
    sellerComment:
      "Prompt payer and very patient during the waitlist offer. Thanks!",
    sellerStatements: ["Paid on time", "Easy to coordinate"],
    date: "2026-08-14T11:20:00.000Z",
  },

  // ── Paolo Garcia — US haul, 4.3 ────────────────────────────────────────────
  {
    order: "ORD-2026-0022",
    buyer: "Carlo Santos",
    seller: "Paolo Garcia",
    batch: "US Pasabuy — May 2026",
    product: "Trader Joe's Snacks",
    buyerRating: 3,
    buyerComment:
      "The markup on this batch came out well above the range Paolo quoted, and sourcing took longer than planned. Snacks themselves were fine.",
    buyerStatements: ["Item as described", "Price higher than expected"],
    sellerRating: 4,
    sellerComment:
      "Big order, took a couple of days to settle payment. Appreciate the patience.",
    sellerStatements: ["Easy to coordinate", "Clear communication"],
    date: "2026-05-25T13:40:00.000Z",
  },
  {
    order: "ORD-2026-0023",
    buyer: "Anna Bautista",
    seller: "Paolo Garcia",
    batch: "US Pasabuy — May 2026",
    product: "Muji Skincare",
    buyerRating: 4,
    buyerComment:
      "Fine for the price, though the markup on this batch was higher than the others.",
    buyerStatements: ["Item as described", "Well packed"],
    sellerRating: 4,
    sellerComment:
      "Polite buyer, no issues at all during handoff.",
    sellerStatements: ["Easy to coordinate", "Paid on time"],
    date: "2026-05-20T10:05:00.000Z",
  },
  {
    order: "ORD-2026-0024",
    buyer: "Trisha Lim",
    seller: "Paolo Garcia",
    batch: "US Pasabuy — May 2026",
    product: "Trader Joe's Snacks",
    buyerRating: 4,
    buyerComment:
      "Snacks were good and well packed. Updates came a bit late once, but the item itself was fine.",
    buyerStatements: ["Well packed", "Item as described"],
    sellerRating: 5,
    sellerComment:
      "One of my repeat buyers. Always pays on time and picks up promptly.",
    sellerStatements: ["Paid on time", "Easy to coordinate"],
    date: "2026-05-18T16:20:00.000Z",
  },

  // ── Kristine Aquino — Bangkok treats, 4.3 ──────────────────────────────────
  {
    order: "ORD-2026-0025",
    buyer: "Trisha Lim",
    seller: "Kristine Aquino",
    batch: "Bangkok Haul — June 2026",
    product: "Thai Snack Box",
    buyerRating: 4,
    buyerComment:
      "Generous snack box. Some items had expired dates closer than I'd like, so check before ordering.",
    buyerStatements: ["Item as described", "Well packed"],
    sellerRating: 4,
    sellerComment:
      "Clear about what she wanted and paid right away.",
    sellerStatements: ["Paid on time", "Clear communication"],
    date: "2026-06-08T09:30:00.000Z",
  },
  {
    order: "ORD-2026-0026",
    buyer: "Ben Torres",
    seller: "Kristine Aquino",
    batch: "Bangkok Haul — June 2026",
    product: "Thai Snack Box",
    buyerRating: 3,
    buyerComment:
      "Two of the glass jars arrived cracked and I had to chase twice for the refund. Kristine made it right in the end, but it was a hassle.",
    buyerStatements: ["Slow to respond", "Packaging needs work"],
    sellerRating: 4,
    sellerComment:
      "Friendly buyer. Hard to reach during work hours but settled everything.",
    sellerStatements: ["Easy to coordinate", "Paid on time"],
    date: "2026-06-06T12:15:00.000Z",
  },
  {
    order: "ORD-2026-0011",
    buyer: "Anna Bautista",
    seller: "Kristine Aquino",
    batch: "Bangkok Haul — June 2026",
    product: "Thai Snack Box",
    buyerRating: 5,
    buyerComment:
      "Kristine went above and beyond, threw in extra items that were on sale. Ate everything.",
    buyerStatements: ["Generous seller", "Great communication"],
    sellerRating: 5,
    sellerComment:
      "My favorite buyer to transact with. Prompt and appreciative.",
    sellerStatements: ["Paid on time", "Easy to coordinate"],
    date: "2026-06-02T14:45:00.000Z",
  },
  {
    order: "ORD-2026-0013",
    buyer: "Carlo Santos",
    seller: "Kristine Aquino",
    batch: "Bangkok Haul — June 2026",
    product: "Thai Snack Box",
    buyerRating: 4,
    buyerComment:
      "Good stuff overall, just a slow reply when I asked about shipping costs. Item itself was fine.",
    buyerStatements: ["Item as described", "Well packed"],
    sellerRating: 5,
    sellerComment:
      "Understanding buyer who accepted the shipping delay without any drama.",
    sellerStatements: ["Clear communication", "Responded quickly"],
    date: "2026-05-28T11:00:00.000Z",
  },

  // ── Ella Torres — UK trip, 4.7 ────────────────────────────────────────────
  {
    order: "ORD-2026-0010",
    buyer: "Trisha Lim",
    seller: "Ella Torres",
    batch: "UK Trip — August 2026",
    product: "Cadbury Hamper",
    buyerRating: 5,
    buyerComment:
      "The hamper was huge and every shelf-stable item survived. Ella's updates were excellent.",
    buyerStatements: ["Well packed", "Great communication"],
    sellerRating: 4,
    sellerComment:
      "Great buyer, though the payment took a weekend to clear.",
    sellerStatements: ["Easy to coordinate", "Clear communication"],
    date: "2026-08-20T15:30:00.000Z",
  },
  {
    order: "ORD-2026-0014",
    buyer: "Grace Reyes",
    seller: "Ella Torres",
    batch: "UK Trip — August 2026",
    product: "Tim Tam Assorted",
    buyerRating: 5,
    buyerComment:
      "Fast and fuss-free. Would happily buy from Ella again.",
    buyerStatements: ["Fast shipping", "Easy to coordinate"],
    sellerRating: 5,
    sellerComment:
      "Paid immediately and picked up on time. Ideal.",
    sellerStatements: ["Paid on time", "Easy to coordinate"],
    date: "2026-08-16T10:50:00.000Z",
  },
  {
    order: "ORD-2026-0017",
    buyer: "Mia Cruz",
    seller: "Ella Torres",
    batch: "UK Trip — August 2026",
    product: "Cadbury Hamper",
    buyerRating: 4,
    buyerComment:
      "Good condition. Was hoping for a slightly lower markup given the item weights.",
    buyerStatements: ["Item as described", "Well packed"],
    sellerRating: 5,
    sellerComment:
      "Easy transaction from start to finish. Thanks!",
    sellerStatements: ["Paid on time", "Clear communication"],
    date: "2026-08-12T13:20:00.000Z",
  },

  // ── Rico Santos — Taiwan finds, 4.5 ────────────────────────────────────────
  {
    order: "ORD-2026-0020",
    buyer: "Jade Garcia",
    seller: "Rico Santos",
    batch: "Taiwan Finds — July 2026",
    product: "85°C Pastries",
    buyerRating: 4,
    buyerComment:
      "Pastries were fresh and safely packed. The queue at the counter made pickup take a while.",
    buyerStatements: ["Well packed", "Item as described"],
    sellerRating: 5,
    sellerComment:
      "Very patient about the pickup delay and tipped in for the queue slot.",
    sellerStatements: ["Easy to coordinate", "Responded quickly"],
    date: "2026-07-31T08:45:00.000Z",
  },
  {
    order: "ORD-2026-0027",
    buyer: "Rico Mendoza",
    seller: "Rico Santos",
    batch: "Taiwan Finds — July 2026",
    product: "85°C Pastries",
    buyerRating: 3,
    buyerComment:
      "Two boxes were squashed in transit and the pastries were stale by the time I got home. The refund was quick at least.",
    buyerStatements: ["Item not as described", "Responded quickly"],
    sellerRating: 4,
    sellerStatements: ["Clear communication", "Easy to coordinate"],
    sellerComment:
      "Reliable buyer. Needed a reminder to send payment but sorted it out quickly.",
    date: "2026-07-27T12:30:00.000Z",
  },

  // ── Mark Villanueva — 1 review only, so his 4.0 reads as "new" ────────────
  {
    order: "ORD-2026-0002",
    buyer: "Ben Torres",
    seller: "Mark Villanueva",
    batch: "Dubai Pasabuy — July 2026",
    product: "Nars Blush",
    buyerRating: 4,
    buyerComment:
      "Authentic blush, sealed box. First order with Mark and it went smoothly.",
    buyerStatements: ["Authentic items", "Easy to coordinate"],
    sellerRating: 4,
    sellerComment:
      "Courteous buyer who arrived on time for the meetup.",
    sellerStatements: ["Paid on time", "Easy to coordinate"],
    date: "2026-07-20T14:10:00.000Z",
  },
]

// Both directions of every transaction become review rows, so the reviewer and
// reviewee are always the two real parties on that completed order.
export const REVIEWS_INIT: ReviewRecord[] = TRANSACTIONS.flatMap(
  (transaction, index) => {
    const reviewerId = ID_BY_NAME.get(transaction.buyer)
    const revieweeId = ID_BY_NAME.get(transaction.seller)
    if (!reviewerId || !revieweeId) {
      throw new Error(
        `Review seed references an unknown account: ${transaction.buyer} -> ${transaction.seller}`,
      )
    }
    const base = {
      orderId: transaction.order,
      createdAt: transaction.date,
      updatedAt: transaction.date,
    }
    return [
      {
        ...base,
        id: `demo-rev-${index + 1}a`,
        reviewerId,
        revieweeId,
        rating: transaction.buyerRating,
        comment: transaction.buyerComment,
        quickStatements: transaction.buyerStatements,
      },
      {
        ...base,
        id: `demo-rev-${index + 1}b`,
        reviewerId: revieweeId,
        revieweeId: reviewerId,
        rating: transaction.sellerRating,
        comment: transaction.sellerComment,
        quickStatements: transaction.sellerStatements,
      },
    ]
  },
)

// ── Computed aggregates ──────────────────────────────────────────────────────
// Derived from REVIEWS_INIT by the same aggregation Supabase mode runs over
// database rows, so a demo average and a live average are the same number by
// construction. Every profile gets an entry — including the ones with no
// reviews, which land on `average: null` and render as "New seller" /
// "New buyer".
export const DEMO_RATINGS: Record<string, UserRating> = Object.fromEntries(
  DEMO_PROFILES.map((profile) => [
    profile.id,
    buildUserRating(
      REVIEWS_INIT.filter((review) => review.revieweeId === profile.id),
      NAME_BY_ID,
    ),
  ]),
)

// Guarantees the seed keeps the property the UI depends on: a user with no
// reviews never carries a score. Throwing at module load beats shipping a
// fabricated 5.0 into the demo.
for (const [id, summary] of Object.entries(DEMO_RATINGS)) {
  if (summary.count > 0 && summary.average === null) {
    throw new Error(`Demo rating seed lost its average for ${id}`)
  }
  if (summary.count === 0 && summary.average !== null) {
    throw new Error(`Demo rating seed invented a score for ${id}`)
  }
}
