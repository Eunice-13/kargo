import { Star } from "lucide-react"
import type {
  RatingSummary,
  ReviewSummaryItem,
  UserRating,
} from "@/types"
import { AMBER } from "@/constants/theme"
import {
  emptyUserRating,
  formatRating,
  MIN_REVIEWS_FOR_ESTABLISHED,
  pluralizeReviews,
} from "@/lib/ratings"

// The single rating renderer for the whole app.
//
// Given a computed aggregate it shows `4.7 ★ · 12 reviews`. Given nothing it
// shows an explicit "No ratings yet" / "New seller" line. It has no default
// score, so a user with no reviews can never be displayed as 0 or 5 stars.

type Tone = "plain" | "badge" | "stack"

const FONT = "'Josefin Sans',sans-serif"

function shellStyle(tone: Tone, fontSize: number, color: string) {
  const base = {
    fontSize,
    color,
    display: "inline-flex" as const,
    alignItems: "center" as const,
    gap: 4,
    lineHeight: 1.3,
  }
  if (tone === "badge") {
    return {
      ...base,
      background: "rgba(255,255,255,0.22)",
      color: "#fff",
      borderRadius: 999,
      padding: "2px 8px",
      fontWeight: 700,
    }
  }
  if (tone === "stack") {
    return { ...base, flexDirection: "column" as const, alignItems: "flex-start" as const, gap: 1 }
  }
  return base
}

export function RatingStars({
  rating,
  size = 12,
  gap = 1,
}: {
  rating: number
  size?: number
  gap?: number
}) {
  const rounded = Math.round(rating)
  return (
    <span
      style={{ display: "inline-flex", gap, alignItems: "center" }}
      role="img"
      aria-label={`${rounded} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={size}
          aria-hidden="true"
          fill={star <= rounded ? AMBER : "none"}
          color={star <= rounded ? AMBER : "#D1D5DB"}
        />
      ))}
    </span>
  )
}

export default function RatingDisplay({
  summary,
  tone = "plain",
  fontSize = 12,
  emptyLabel = "No ratings yet",
  subject = "seller",
  showCount = true,
}: {
  summary: RatingSummary | null | undefined
  tone?: Tone
  fontSize?: number
  emptyLabel?: string
  // "seller" renders "New seller" for the no-ratings case; "buyer" renders
  // "New buyer". Pass "none" for surfaces that already name the party.
  subject?: "seller" | "buyer" | "none"
  showCount?: boolean
}) {
  const style = shellStyle(tone, fontSize, "#6B7280")
  // `average: null` is the only signal for "no ratings yet" — never a
  // substitute score, so an unreviewed user can never render as 0 or 5 stars.
  const average = summary?.average ?? null
  const label = formatRating(average)

  if (label === null || average === null) {
    const text =
      subject === "seller"
        ? "New seller"
        : subject === "buyer"
          ? "New buyer"
          : emptyLabel
    return (
      <span style={{ ...style, color: "#9CA3AF" }}>
        {subject === "none" ? (
          <Star size={fontSize - 1} aria-hidden="true" fill="none" color="#D1D5DB" />
        ) : null}
        {text}
      </span>
    )
  }

  const count = summary?.count ?? 0
  // Flag scores built on very few transactions so a lone 5★ is not mistaken
  // for a well-established reputation.
  const thin = count < MIN_REVIEWS_FOR_ESTABLISHED

  return (
    <span style={style} title={`${label} average from ${pluralizeReviews(count)}`}>
      {tone === "stack" ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <RatingStars rating={average} size={fontSize} />
          <strong style={{ fontFamily: FONT, fontSize: fontSize + 1 }}>{label}</strong>
        </span>
      ) : (
        <>
          <Star size={fontSize - 1} aria-hidden="true" fill={AMBER} color={AMBER} />
          <strong style={{ fontFamily: FONT, fontSize }}>{label}</strong>
        </>
      )}
      {showCount && (
        <span style={{ opacity: 0.8, fontWeight: 500 }}>
          · {pluralizeReviews(count)}
        </span>
      )}
      {thin && (
        <span
          style={{ fontSize: Math.max(9, fontSize - 3), opacity: 0.75 }}
          title="Based on very few completed transactions"
        >
          new
        </span>
      )}
    </span>
  )
}

// The Reviews tab body. Renders real review rows from `public.reviews`; the
// empty state is explicit rather than a placeholder list.
export function ReviewList({
  reviews,
  emptyText = "No reviews yet. Ratings appear here after a completed transaction.",
}: {
  reviews: ReviewSummaryItem[]
  emptyText?: string
}) {
  if (reviews.length === 0) {
    return (
      <div
        style={{
          textAlign: "center",
          color: "#9CA3AF",
          fontSize: 12,
          padding: "18px 8px",
          border: "1px dashed #E5E7EB",
          borderRadius: 8,
        }}
      >
        {emptyText}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {reviews.map((review) => (
        <div
          key={review.id}
          style={{ border: "1px solid #E5E7EB", borderRadius: 8, padding: "12px 14px" }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span
              aria-hidden="true"
              style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                background: "#EEF0FF",
                color: "#191BA9",
                fontSize: 10,
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {review.reviewerName.slice(0, 2).toUpperCase()}
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}>
              {review.reviewerName}
            </span>
            <RatingStars rating={review.rating} size={11} />
            <span style={{ fontSize: 11, color: "#9CA3AF", marginLeft: "auto" }}>
              {new Date(review.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
          {review.quickStatements.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {review.quickStatements.map((statement) => (
                <span
                  key={statement}
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: "#191BA9",
                    background: "#EEF0FF",
                    borderRadius: 999,
                    padding: "1px 7px",
                  }}
                >
                  {statement}
                </span>
              ))}
            </div>
          )}
          {review.comment && (
            <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.5 }}>
              {review.comment}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// Lookup used by every profile surface so no screen keeps its own copy.
export function ratingFor(
  ratings: Record<string, UserRating>,
  profileId: string | undefined,
): UserRating {
  if (!profileId) return emptyUserRating()
  return ratings[profileId] ?? emptyUserRating()
}
