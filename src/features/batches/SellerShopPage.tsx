import { useState } from "react"
import { ArrowRight, Star, ChevronDown, ChevronUp } from "lucide-react"
import type { BatchType } from "@/types"
import { INDIGO, CREAM, AMBER, CAT_GRAD } from "@/constants/theme"
import { Card, Avatar, ProductThumb, BIRBadge, CategoryIcon } from "@/components/shared"

export default function SellerShopPage({
  seller,
  batches,
  onBatchClick,
}: {
  seller: string
  batches: BatchType[]
  onBatchClick: (id: number) => void
}) {
  const sellerBatches = batches.filter((b) => b.seller === seller)
  const avgRating = sellerBatches.length
    ? (
        sellerBatches.reduce((s, b) => s + b.rating, 0) / sellerBatches.length
      ).toFixed(1)
    : "5.0"
  const totalItems = sellerBatches.reduce((s, b) => s + b.products.length, 0)
  const totalClaimed = sellerBatches.reduce((s, b) => s + b.claimed, 0)
  const totalAvail = sellerBatches.reduce((s, b) => s + b.items, 0)
  const rate =
    totalAvail > 0 ? Math.round((totalClaimed / totalAvail) * 100) : 0
  const [catFilter, setCatFilter] = useState("All")
  const [sortBy, setSortBy] = useState("Newest")
  // Accordion: only one batch card is expanded at a time (null = all collapsed).
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const toggleBatch = (id: number) =>
    setExpandedId((cur) => (cur === id ? null : id))
  const cats = [
    "All",
    ...Array.from(new Set(sellerBatches.map((b) => b.category))),
  ]

  const filtered = sellerBatches
    .filter((b) => catFilter === "All" || b.category === catFilter)
    .sort((a, b_) =>
      sortBy === "Most Claimed"
        ? b_.claimed - a.claimed
        : sortBy === "Ending Soonest"
          ? a.id - b_.id
          : b_.id - a.id,
    )

  return (
    <div
      className="grid gap-6"
      style={{ gridTemplateColumns: "1fr 300px", alignItems: "start" }}
    >
      {/* Left — items */}
      <div>
        <div
          style={{
            display: "flex",
            gap: 10,
            marginBottom: 16,
            flexWrap: "wrap" as const,
            alignItems: "center",
          }}
        >
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
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
            {cats.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
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
          <span style={{ fontSize: 12, color: "#9CA3AF", marginLeft: "auto" }}>
            {filtered.length} batch{filtered.length !== 1 ? "es" : ""}
          </span>
        </div>
        {filtered.length === 0 && (
          <div
            style={{
              textAlign: "center",
              color: "#9CA3AF",
              fontSize: 13,
              padding: "40px 0",
            }}
          >
            No batches match filters.
          </div>
        )}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: 16,
            alignItems: "start",
          }}
        >
        {filtered.map((b) => {
          const pct = Math.round((b.claimed / b.items) * 100)
          const grad = CAT_GRAD[b.category] || CAT_GRAD["Mixed"]
          const isExpanded = expandedId === b.id
          return (
            <div
              key={b.id}
              style={{ gridColumn: isExpanded ? "1 / -1" : "auto" }}
            >
              <div
                style={{
                  border: "1px solid #E5E7EB",
                  borderRadius: 10,
                  overflow: "hidden",
                }}
              >
                {/* Clickable preview region — toggles expand/collapse */}
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={isExpanded}
                  aria-label={`${isExpanded ? "Collapse" : "Expand"} ${b.title}`}
                  onClick={() => toggleBatch(b.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      toggleBatch(b.id)
                    }
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <div
                    style={{
                      height: 70,
                      background: grad,
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "0 16px",
                      position: "relative",
                    }}
                  >
                    <CategoryIcon category={b.category} size={28} color="#fff" />
                    <div className="flex-1" style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: "#fff",
                          fontFamily: "'Plus Jakarta Sans',sans-serif",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {b.title}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "rgba(255,255,255,0.8)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {b.trips}
                      </div>
                    </div>
                    <ChevronDown
                      size={20}
                      aria-hidden="true"
                      style={{
                        color: "#fff",
                        flexShrink: 0,
                        transition: "transform 0.2s ease",
                        transform: isExpanded ? "rotate(180deg)" : "none",
                      }}
                    />
                  </div>
                  <div style={{ padding: "10px 16px" }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span style={{ fontSize: 11, color: "#6B7280" }}>
                        {b.claimed}/{b.items} claimed
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color:
                            pct > 85 ? "#EF4444" : pct > 60 ? AMBER : INDIGO,
                        }}
                      >
                        {pct}%
                      </span>
                    </div>
                    <div
                      style={{
                        background: "#F3F4F6",
                        borderRadius: 999,
                        height: 4,
                        overflow: "hidden",
                        marginBottom: isExpanded ? 10 : 0,
                      }}
                    >
                      <div
                        style={{
                          width: `${pct}%`,
                          height: "100%",
                          background:
                            pct > 85 ? "#EF4444" : pct > 60 ? AMBER : INDIGO,
                          borderRadius: 999,
                        }}
                      />
                    </div>
                  </div>
                </div>
                {/* Collapsed affordance — "Check this batch" */}
                {!isExpanded && (
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label={`Check ${b.title}`}
                    onClick={() => toggleBatch(b.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        toggleBatch(b.id)
                      }
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 5,
                      padding: "10px 16px",
                      borderTop: "1px solid #F3F4F6",
                      background: CREAM,
                      color: INDIGO,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      fontFamily: "'Plus Jakarta Sans',sans-serif",
                    }}
                  >
                    Check this batch
                    <ChevronDown size={14} aria-hidden="true" />
                  </div>
                )}
                {/* Expanded content — AVAILABLE ITEMS + Claim button */}
                {isExpanded && (
                <div className="fi">
                <div style={{ borderTop: "1px solid #F3F4F6" }}>
                  <div
                    style={{
                      padding: "8px 16px",
                      background: CREAM,
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#374151",
                      letterSpacing: 0.5,
                    }}
                  >
                    AVAILABLE ITEMS
                  </div>
                  {b.products.map((p, pi) => {
                    const left = p.qty - p.claimed
                    const soldOut = left <= 0
                    return (
                      <div
                        key={pi}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "10px 16px",
                          borderTop: "1px solid #F9FAFB",
                        }}
                      >
                        <ProductThumb name={p.name} />
                        <div className="flex-1">
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: "#111827",
                            }}
                          >
                            {p.name}
                          </div>
                          <div style={{ fontSize: 11, color: "#9CA3AF" }}>
                            {p.claimed}/{p.qty} claimed
                            {p.waitlist > 0
                              ? ` · ${p.waitlist} on waitlist`
                              : ""}
                          </div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 800,
                              color: INDIGO,
                              fontFamily: "'Plus Jakarta Sans',sans-serif",
                            }}
                          >
                            ₱{p.price.toLocaleString()}
                          </div>
                          {soldOut ? (
                            <span
                              style={{
                                fontSize: 10,
                                color: "#EF4444",
                                fontWeight: 600,
                                background: "#FEE2E2",
                                borderRadius: 999,
                                padding: "1px 6px",
                              }}
                            >
                              Sold Out
                            </span>
                          ) : left <= 2 ? (
                            <span
                              style={{
                                fontSize: 10,
                                color: "#D97706",
                                fontWeight: 600,
                                background: "#FEF3C7",
                                borderRadius: 999,
                                padding: "1px 6px",
                              }}
                            >
                              Only {left} left!
                            </span>
                          ) : (
                            <span style={{ fontSize: 10, color: "#6B7280" }}>
                              {left} available
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div
                  style={{
                    padding: "10px 16px",
                    borderTop: "1px solid #E5E7EB",
                  }}
                >
                  <button
                    onClick={() => onBatchClick(b.id)}
                    style={{
                      width: "100%",
                      background: "#C81E62",
                      color: "#fff",
                      border: "none",
                      borderRadius: 8,
                      padding: "10px 0",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                      fontFamily: "'Plus Jakarta Sans',sans-serif",
                    }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      Claim from this batch <ArrowRight size={13} aria-hidden="true" />
                    </span>
                  </button>
                  <button
                    onClick={() => toggleBatch(b.id)}
                    style={{
                      width: "100%",
                      marginTop: 8,
                      background: "none",
                      color: "#6B7280",
                      border: "none",
                      padding: "4px 0",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                    }}
                  >
                    Collapse <ChevronUp size={14} aria-hidden="true" />
                  </button>
                </div>
                </div>
                )}
              </div>
            </div>
          )
        })}
        </div>
      </div>

      {/* Right — seller profile panel */}
      <div style={{ position: "sticky", top: 140 }} className="space-y-4">
        <Card>
          <div
            style={{
              textAlign: "center",
              paddingBottom: 12,
              borderBottom: "1px solid #F3F4F6",
              marginBottom: 12,
            }}
          >
            <Avatar name={seller} size={56} />
            <div
              style={{
                fontFamily: "'Plus Jakarta Sans',sans-serif",
                fontSize: 16,
                fontWeight: 800,
                color: "#111827",
                marginTop: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              {seller}
              <BIRBadge size={14} />
            </div>
            <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
              <Star size={11} aria-hidden="true" fill="#9CA3AF" /> {avgRating} · Member since Jan 2024
            </div>
          </div>
          <div
            style={{
              fontSize: 12,
              color: "#374151",
              background: CREAM,
              borderRadius: 8,
              padding: "8px 12px",
              marginBottom: 12,
              lineHeight: 1.5,
            }}
          >
            Trusted pasabuy seller. Linked Facebook account:{" "}
            <a
              href={`https://facebook.com/${seller.toLowerCase().replace(" ", ".")}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: INDIGO }}
            >
              facebook.com/{seller.toLowerCase().replace(" ", ".")}
            </a>
            <div
              style={{
                fontSize: 10,
                color: "#9CA3AF",
                marginTop: 4,
                fontStyle: "italic",
              }}
            >
              This is a credibility reference only — not a payment guarantee.
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              ["Completed", "47", "#0B7A59"],
              ["Cancelled", "2", "#EF4444"],
              ["Incomplete", "1", "#92400E"],
              ["Disputes", "0", "#6B7280"],
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
                    fontFamily: "'Plus Jakarta Sans',sans-serif",
                  }}
                >
                  {val}
                </div>
                <div
                  style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 500 }}
                >
                  {label}
                </div>
              </div>
            ))}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "#374151",
              background: "#EEF0FF",
              borderRadius: 8,
              padding: "8px 12px",
              marginTop: 10,
              lineHeight: 1.5,
            }}
          >
            94% of this seller's tracked transactions reached Completed. These
            numbers come from recorded transactions, not self-reported ratings.
          </div>
        </Card>
        <Card>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#374151",
              letterSpacing: 0.5,
              marginBottom: 8,
            }}
          >
            SHOP STATS
          </div>
          {[
            ["Total Batches", sellerBatches.length],
            ["Total Products", totalItems],
            ["Claim Rate", `${rate}%`],
          ].map(([label, val]) => (
            <div
              key={String(label)}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "5px 0",
                borderBottom: "1px solid #F9FAFB",
                fontSize: 12,
              }}
            >
              <span style={{ color: "#6B7280" }}>{label}</span>
              <span
                style={{
                  fontWeight: 700,
                  color: "#111827",
                  fontFamily: "'Plus Jakarta Sans',sans-serif",
                }}
              >
                {val}
              </span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}

