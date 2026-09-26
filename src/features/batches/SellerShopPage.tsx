import { useState, useEffect } from "react"
import { MessageCircle, Star, Package, Clock3, CalendarDays, Wallet } from "lucide-react"
import type { BatchType, Role, UserInfo, UserRating } from "@/types"
import { INDIGO, CREAM, AMBER, CAT_GRAD, batchCoverSrc } from "@/constants/theme"
import { Card, Avatar, BIRBadge, PrimaryBtn, RatingDisplay, ReviewList, ratingFor, ContactModal } from "@/components/shared"
import { sortSoldOutLast } from "./batchSort"
import { isSupabaseConfigured } from "@/lib/supabase"
import { memberSince, pluralizeReviews } from "@/lib/ratings"
import { kargoApi } from "@/services"

// Dedicated seller storefront page (replaces the old popup modal). Laid out like
// a Shopee shop: a gradient header with avatar/name/online + Follow/Chat and a
// stats row, a tab/category nav, then a grid of the seller's active batches
// using the same cover-image batch card the Home page shows. Built entirely with
// the existing KARGO design system (INDIGO/Josefin, Card, shared buttons).
export default function SellerShopPage({
  seller,
  batches,
  onClaimItem,
  onBatchOpen,
  role,
  profileData,
  ratings,
}: {
  seller: string
  batches: BatchType[]
  onClaimItem?: (batchId: number, productName: string) => void
  // Opens the batch detail page (buyer taps a batch card on the storefront).
  onBatchOpen?: (batchId: number) => void
  role?: Role
  profileData?: UserInfo
  ratings: Record<string, UserRating>
}) {
  const canClaim = role !== "Seller" && Boolean(onClaimItem)
  const sellerBatches = batches.filter((b) => b.seller === seller)
  const sellerId = sellerBatches.find((b) => b.sellerId)?.sellerId
  const sellerRating = ratingFor(ratings, sellerId)

  const [acceptedMethods, setAcceptedMethods] = useState<string[]>([])
  useEffect(() => {
    if (!isSupabaseConfigured || !sellerId) return
    let active = true
    kargoApi
      .loadSellerReceiveMethods(sellerId)
      .then((rows) => {
        if (active) setAcceptedMethods(rows.map((r) => r.methodType))
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [sellerId])

  // ── Stats (row under the header) ────────────────────────────────────────────
  const totalProducts = sellerBatches.reduce((s, b) => s + b.products.length, 0)
  const totalClaimed = sellerBatches.reduce((s, b) => s + b.claimed, 0)
  const totalAvail = sellerBatches.reduce((s, b) => s + b.items, 0)
  const claimRate = totalAvail > 0 ? Math.round((totalClaimed / totalAvail) * 100) : 0
  const joined = memberSince(sellerRating.memberSince ?? profileData?.memberSince)
  const isBirVerified = profileData
    ? profileData.birState === "Verified"
    : sellerBatches[0]?.sellerBirVerified !== false

  // ── Contact (reuses the shared ContactModal) ───────────────────────────────
  const [showChat, setShowChat] = useState(false)
  const contactUrl = profileData?.socialLinks
    ? Object.entries(profileData.socialLinks).find(
        ([label]) => profileData.socialVisibility?.[label] !== false,
      )?.[1]
    : undefined

  // ── Tab / category nav ──────────────────────────────────────────────────────
  const categories = Array.from(new Set(sellerBatches.map((b) => b.category)))
  const TABS = ["Home", "All Batches", ...categories, "Reviews"] as const
  const [tab, setTab] = useState<string>("Home")
  const [sortBy, setSortBy] = useState("Newest")

  // Which batches the current tab shows.
  const catFilter =
    tab === "Home" || tab === "All Batches" || tab === "Reviews" ? "All" : tab
  const visibleBatches = sortSoldOutLast(
    sellerBatches
      .filter((b) => catFilter === "All" || b.category === catFilter)
      .sort((a, b_) =>
        sortBy === "Most Claimed"
          ? b_.claimed - a.claimed
          : sortBy === "Ending Soonest"
            ? a.id - b_.id
            : b_.id - a.id,
      ),
  )
  // "Home" leads with a shorter, recommended slice; other tabs show everything.
  const gridBatches = tab === "Home" ? visibleBatches.slice(0, 6) : visibleBatches

  const stats: { icon: typeof Package; label: string; value: string; accent?: boolean }[] = [
    { icon: Package, label: "Products", value: String(totalProducts) },
    {
      icon: Star,
      label: "Rating",
      value:
        sellerRating.average != null
          ? `${sellerRating.average.toFixed(1)} (${pluralizeReviews(sellerRating.count)})`
          : "New seller",
      accent: true,
    },
    { icon: Clock3, label: "Claim Rate", value: `${claimRate}%` },
    { icon: CalendarDays, label: "Joined", value: joined || "Recently" },
  ]

  return (
    <div className="space-y-5">
      {/* ── Storefront header ──────────────────────────────────────────────── */}
      <Card style={{ overflow: "hidden", padding: 0 }}>
        <div
          style={{
            background: `linear-gradient(135deg, ${INDIGO} 0%, #3548BD 100%)`,
            padding: "24px 24px",
            minHeight: 120,
            boxSizing: "border-box",
            display: "flex",
            alignItems: "center",
            gap: 18,
            flexWrap: "wrap" as const,
          }}
        >
          <span
            style={{
              display: "inline-flex",
              borderRadius: "50%",
              padding: 3,
              background: "rgba(255,255,255,0.35)",
              flexShrink: 0,
            }}
          >
            <Avatar name={seller} size={72} imageUrl={profileData?.avatarUrl} />
          </span>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div
              style={{
                fontFamily: "'Josefin Sans',sans-serif",
                fontSize: 22,
                fontWeight: 800,
                color: "#fff",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {seller}
              {isBirVerified && <BIRBadge size={16} />}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.9)",
                marginTop: 4,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#4ADE80",
                  boxShadow: "0 0 0 3px rgba(74,222,128,0.3)",
                }}
              />
              Online now
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={() => setShowChat(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
                fontWeight: 700,
                fontFamily: "'Josefin Sans',sans-serif",
                padding: "8px 18px",
                borderRadius: 8,
                cursor: "pointer",
                border: "none",
                background: "#fff",
                color: INDIGO,
                transition: "all 0.15s",
              }}
            >
              <MessageCircle size={15} aria-hidden="true" /> Contact
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${stats.length}, 1fr)`,
            borderTop: "1px solid #F3F4F6",
          }}
        >
          {stats.map((s, i) => (
            <div
              key={s.label}
              style={{
                padding: "14px 12px",
                textAlign: "center",
                borderLeft: i === 0 ? "none" : "1px solid #F3F4F6",
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 15,
                  fontWeight: 800,
                  fontFamily: "'Josefin Sans',sans-serif",
                  color: s.accent ? AMBER : "#111827",
                }}
              >
                {s.accent && <Star size={13} fill={AMBER} color={AMBER} aria-hidden="true" />}
                {s.value}
              </div>
              <div
                style={{
                  fontSize: 10.5,
                  color: "#9CA3AF",
                  fontWeight: 600,
                  marginTop: 3,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                }}
              >
                <s.icon size={11} aria-hidden="true" /> {s.label}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Tab / category nav ─────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          gap: 6,
          overflowX: "auto",
          paddingBottom: 4,
          borderBottom: "1px solid #E5E7EB",
        }}
      >
        {TABS.map((t) => {
          const active = tab === t
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              aria-current={active ? "page" : undefined}
              style={{
                fontFamily: "'Josefin Sans',sans-serif",
                fontSize: 13,
                fontWeight: active ? 700 : 500,
                color: active ? INDIGO : "#6B7280",
                background: "transparent",
                border: "none",
                borderBottom: `2px solid ${active ? INDIGO : "transparent"}`,
                padding: "8px 14px",
                marginBottom: -1,
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "color 0.15s, border-color 0.15s",
              }}
            >
              {t}
            </button>
          )
        })}
      </div>

      {/* ── Tab body ───────────────────────────────────────────────────────── */}
      {tab === "Reviews" ? (
        <Card>
          <RatingDisplay summary={sellerRating} tone="stack" fontSize={13} subject="seller" />
          <div className="mt-3">
            <ReviewList reviews={sellerRating.reviews} />
          </div>
        </Card>
      ) : (
        <div
          className="grid gap-5"
          style={{ gridTemplateColumns: "1fr 300px", alignItems: "start" }}
        >
          {/* Left — batches */}
          <div>
            {/* On Home, a light "About" strip mirrors Shopee's shop intro. */}
            {tab === "Home" && (profileData?.bio || acceptedMethods.length > 0) && (
              <Card style={{ marginBottom: 16 }}>
                {profileData?.bio && (
                  <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.6 }}>
                    {profileData.bio}
                  </div>
                )}
                {acceptedMethods.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                      background: CREAM,
                      borderRadius: 8,
                      padding: "8px 12px",
                      marginTop: profileData?.bio ? 10 : 0,
                    }}
                  >
                    <Wallet size={15} color={INDIGO} aria-hidden="true" style={{ marginTop: 1, flexShrink: 0 }} />
                    <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.5 }}>
                      <span style={{ fontWeight: 700, color: "#111827" }}>Accepting: </span>
                      {acceptedMethods.join(", ")}
                    </div>
                  </div>
                )}
              </Card>
            )}

            <div
              className="flex items-center justify-between"
              style={{ marginBottom: 14 }}
            >
              <div
                style={{
                  fontFamily: "'Josefin Sans',sans-serif",
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#111827",
                }}
              >
                {tab === "Home" ? "Recommended for you" : `${visibleBatches.length} batch${visibleBatches.length !== 1 ? "es" : ""}`}
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{
                  fontSize: 12,
                  border: "1px solid #E5E7EB",
                  borderRadius: 6,
                  padding: "6px 10px",
                  background: "#fff",
                  outline: "none",
                  color: "#374151",
                }}
              >
                {["Newest", "Most Claimed", "Ending Soonest"].map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </div>

            {gridBatches.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  color: "#9CA3AF",
                  fontSize: 13,
                  padding: "40px 0",
                }}
              >
                No batches in this category yet.
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
                  gap: 16,
                  alignItems: "start",
                }}
              >
                {gridBatches.map((b) => (
                  <StorefrontBatchCard
                    key={b.id}
                    batch={b}
                    canClaim={canClaim}
                    onOpen={onBatchOpen}
                    onClaimItem={onClaimItem}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right — trust panel (kept from the old shop page) */}
          <div className="space-y-4">
            <Card>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#374151",
                  letterSpacing: 0.5,
                  marginBottom: 10,
                }}
              >
                TRACK RECORD
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ["Completed", String(totalClaimed), "#0B7A59"],
                  ["Active Batches", String(sellerBatches.filter((b) => b.live).length), INDIGO],
                  ["Products", String(totalProducts), "#111827"],
                  ["Claim Rate", `${claimRate}%`, AMBER],
                ].map(([label, val, color]) => (
                  <div
                    key={label}
                    style={{
                      background: "#F9FAFB",
                      borderRadius: 8,
                      padding: "8px 10px",
                      textAlign: "center",
                      border: "1px solid #E5E7EB",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 800,
                        color,
                        fontFamily: "'Josefin Sans',sans-serif",
                      }}
                    >
                      {val}
                    </div>
                    <div style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 500 }}>
                      {label}
                    </div>
                  </div>
                ))}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "#374151",
                  background: "#EEF0FF",
                  borderRadius: 8,
                  padding: "8px 12px",
                  marginTop: 10,
                  lineHeight: 1.5,
                }}
              >
                These numbers come from recorded transactions, not self-reported
                ratings.
              </div>
            </Card>
          </div>
        </div>
      )}

      {showChat && (
        <ContactModal
          name={seller}
          context="shop inquiry"
          contactUrl={contactUrl}
          onClose={() => setShowChat(false)}
        />
      )}
    </div>
  )
}

// Storefront batch card — matches the Home batch card look (cover image banner
// with gradient/icon fallback, title, seller trips, progress) and opens the
// batch detail page when tapped.
function StorefrontBatchCard({
  batch: b,
  canClaim,
  onOpen,
  onClaimItem,
}: {
  batch: BatchType
  canClaim: boolean
  onOpen?: (batchId: number) => void
  onClaimItem?: (batchId: number, productName: string) => void
}) {
  const pct = b.items > 0 ? Math.round((b.claimed / b.items) * 100) : 0
  const grad = CAT_GRAD[b.category] || CAT_GRAD["Mixed"]
  const barColor = pct > 85 ? "#EF4444" : pct > 60 ? AMBER : INDIGO
  const soldOut = b.claimed >= b.items
  const open = () => onOpen?.(b.id)
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`View ${b.title}`}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          open()
        }
      }}
      style={{
        background: "#fff",
        border: "1px solid #E5E7EB",
        borderRadius: 8,
        overflow: "hidden",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        cursor: "pointer",
        transition: "transform 0.15s, box-shadow 0.15s",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement
        el.style.transform = "translateY(-2px)"
        el.style.boxShadow = "0 6px 20px rgba(0,0,0,0.10)"
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement
        el.style.transform = ""
        el.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06)"
      }}
    >
      <div
        style={{
          height: 120,
          background: grad,
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <img
          src={batchCoverSrc(b.coverImage, b.category)}
          alt=""
          aria-hidden="true"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
        <span
          style={{
            position: "absolute",
            top: 10,
            left: 10,
            background: "rgba(255,255,255,0.9)",
            backdropFilter: "blur(4px)",
            color: "#374151",
            fontSize: 9,
            fontWeight: 700,
            padding: "3px 8px",
            borderRadius: 999,
            letterSpacing: 0.5,
          }}
        >
          {b.category.toUpperCase()}
        </span>
        {soldOut && (
          <span
            style={{
              position: "absolute",
              bottom: 8,
              right: 8,
              background: "rgba(0,0,0,0.55)",
              color: "#fff",
              fontSize: 9,
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: 999,
            }}
          >
            SOLD OUT
          </span>
        )}
      </div>
      <div style={{ padding: "14px 16px" }}>
        <h3
          style={{
            fontFamily: "'Josefin Sans',sans-serif",
            fontSize: 13.5,
            fontWeight: 700,
            color: "#111827",
            marginBottom: 6,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {b.title}
        </h3>
        <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 10 }}>
          {b.trips}
        </div>
        <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: "#6B7280" }}>
            {b.claimed}/{b.items} claimed
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: barColor }}>{pct}%</span>
        </div>
        <div
          style={{
            background: "#F3F4F6",
            borderRadius: 999,
            height: 4,
            overflow: "hidden",
            marginBottom: canClaim ? 12 : 0,
          }}
        >
          <div style={{ width: `${pct}%`, height: "100%", background: barColor, borderRadius: 999 }} />
        </div>
        {canClaim && !soldOut && (
          // Wrapper stops the card's open-on-click so the CTA claims instead of
          // navigating (PrimaryBtn's onClick takes no event).
          <div onClick={(e) => e.stopPropagation()}>
            <PrimaryBtn
              size="sm"
              onClick={() => {
                const firstAvailable = b.products.find((p) => p.claimed < p.qty)
                if (firstAvailable) onClaimItem?.(b.id, firstAvailable.name)
                else open()
              }}
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "center",
                background: "#C81E62",
                boxShadow: "0 2px 8px rgba(200,30,98,0.35)",
              }}
            >
              Claim an item
            </PrimaryBtn>
          </div>
        )}
      </div>
    </div>
  )
}


