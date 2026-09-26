// The one place rating math happens.
//
// Every screen — batch cards, seller shop/profile, seller directory, buyer
// profile, order history — renders numbers produced here, from real
// `public.reviews` rows. There are deliberately no fallback constants: a user
// with no reviews gets `average: null`, which callers must surface as
// "No ratings yet" / "New seller" rather than a fabricated 0 or 5.
//
// Supabase mode feeds these functions rows read from the database; demo mode
// feeds them the review seed in `src/data/reviews.ts`. Same math either way,
// so the two modes cannot drift apart.

import {
  EMPTY_RATING_SUMMARY,
  type RatingSummary,
  type ReviewRecord,
  type ReviewSummaryItem,
  type UserRating,
} from "@/types"

const MIN_STAR = 1
const MAX_STAR = 5

// Anything outside 1–5 is corrupt data, not a rating. Dropping it here keeps a
// bad row from skewing an average instead of failing loudly at the render site.
function isValidRating(value: number): boolean {
  return Number.isInteger(value) && value >= MIN_STAR && value <= MAX_STAR
}

// One decimal place matches how the UI has always presented scores, and keeps
// a single 5★ from reading identically to a 40-review 4.96 average.
export function formatRating(average: number | null): string | null {
  if (average === null) return null
  return average.toFixed(1)
}

export function pluralizeReviews(count: number): string {
  return count === 1 ? "1 review" : `${count} reviews`
}

// A user's rating is "new" until there is enough history to mean anything. One
// lone review is noise, not a reputation.
export const MIN_REVIEWS_FOR_ESTABLISHED = 3

// The core aggregation. Returns the shared EMPTY_RATING_SUMMARY (average:
// null) when there is nothing valid to average, so an empty result is always
// distinguishable from a genuine 0 or a perfect score.
export function summarizeReviews(reviews: ReviewRecord[]): RatingSummary {
  const valid = reviews.filter((review) => isValidRating(review.rating))
  if (valid.length === 0) return EMPTY_RATING_SUMMARY

  const breakdown: Record<1 | 2 | 3 | 4 | 5, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  }
  let total = 0
  for (const review of valid) {
    const star = review.rating as 1 | 2 | 3 | 4 | 5
    breakdown[star] += 1
    total += star
  }

  return { average: total / valid.length, count: valid.length, breakdown }
}

// Newest first — the order people expect to read a review list in.
function sortReviewsNewest(reviews: ReviewRecord[]): ReviewRecord[] {
  return [...reviews].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

// Reviewer names come from the profiles the caller already loaded. Reviews
// whose reviewer is unknown (deleted/suspended profile, or a seed row with no
// matching account) fall back to initials rather than vanishing — a rating the
// reviewee actually received should still be visible and counted.
function toReviewSummaryItems(
  reviews: ReviewRecord[],
  nameById: Map<string, string>,
): ReviewSummaryItem[] {
  return sortReviewsNewest(reviews).map((review) => {
    const known = nameById.get(review.reviewerId)
    const reviewerName = known?.trim() || initialsOf(review.reviewerId)
    return {
      id: review.id,
      reviewerName,
      rating: review.rating,
      comment: review.comment,
      quickStatements: review.quickStatements,
      createdAt: review.createdAt,
    }
  })
}

export function buildUserRating(
  reviews: ReviewRecord[],
  nameById: Map<string, string>,
): UserRating {
  return {
    ...summarizeReviews(reviews),
    reviews: toReviewSummaryItems(reviews, nameById),
  }
}

export function emptyUserRating(): UserRating {
  return { ...EMPTY_RATING_SUMMARY, reviews: [] }
}

// The trust-strip counters on a profile are derived from the same completed
// order rows the reviews hang off, not from hand-typed literals.
export type OrderTrustCounts = {
  completed: number
  cancelled: number
  incomplete: number
}

// Status vocabularies differ by surface — `orders.status` is a lowercase DB
// enum, the seller's kanban `col` is a display label — so match
// case-insensitively and let callers pass whichever they hold.
export function trustCounts(statuses: string[]): OrderTrustCounts {
  const counts: OrderTrustCounts = { completed: 0, cancelled: 0, incomplete: 0 }
  for (const raw of statuses) {
    const status = raw.toLowerCase()
    if (status === "completed") counts.completed += 1
    else if (status === "cancelled" || status === "expired") counts.cancelled += 1
    else if (status === "incomplete") counts.incomplete += 1
  }
  return counts
}

// "Member since Mar 2025" from a real created_at, or null when unknown.
export function memberSince(createdAt: string | null | undefined): string | null {
  if (!createdAt) return null
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" })
}
