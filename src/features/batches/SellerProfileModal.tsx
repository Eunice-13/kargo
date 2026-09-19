import { useState } from "react"
import { Lock } from "lucide-react"
import type { BatchType, Tab } from "@/types"
import { INDIGO, CREAM, AMBER, CAT_GRAD } from "@/constants/theme"
import { Modal, Avatar, ProductThumb, BIRBadge, CategoryIcon } from "@/components/shared"
import BIRInfoModal from "./BIRInfoModal"

export default function SellerProfileModal({
  seller,
  batches,
  onClose,
  onClaimFromProfile,
  setTab: setAppTab,
}: {
  seller: string
  batches: BatchType[]
  onClose: () => void
  onClaimFromProfile?: (batchId: number) => void
  setTab?: (t: Tab) => void
}) {
  const [tab, setTab] = useState<"Shop" | "Reviews" | "About">("Shop")
  const [shopCat, setShopCat] = useState("All")
  const [shopSort, setShopSort] = useState("Newest")
  const [expandedBatch, setExpandedBatch] = useState<number | null>(null)
  const [showPast, setShowPast] = useState(false)
  const [showBIR, setShowBIR] = useState(false)
  const sellerBatches = batches.filter((b) => b.seller === seller)
  const avgRating = sellerBatches.length
    ? (
        sellerBatches.reduce((s, b) => s + b.rating, 0) / sellerBatches.length
      ).toFixed(1)
    : "5.0"
  const activeBatches = sellerBatches
    .filter((b) => !b.locked && (shopCat === "All" || b.category === shopCat))
    .sort((a, b) =>
      shopSort === "Most Claimed"
        ? b.claimed - a.claimed
        : shopSort === "Ending Soonest"
          ? a.id - b.id
          : b.id - a.id,
    )
  const pastBatches = sellerBatches.filter((b) => b.locked)
  const REVIEWS = [
    {
      buyer: "Trisha L.",
      rating: 5,
      comment:
        "Super responsive seller! Items arrived in perfect condition. Will definitely order again!",
    },
    {
      buyer: "Carlo R.",
      rating: 4,
      comment:
        "Good communication. Slight delay but overall satisfied with the service.",
    },
    {
      buyer: "Mia S.",
      rating: 5,
      comment:
        "My fave pasabuy seller. Always gives updates on ETA and packaging is amazing.",
    },
  ]
  const grad =
    CAT_GRAD[sellerBatches[0]?.category || "Mixed"] || CAT_GRAD["Mixed"]
  return (
    <Modal title="" onClose={onClose} width={600}>
      <div
        style={{
          margin: "-28px -28px 20px",
          borderRadius: "12px 12px 0 0",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: 90,
            background: grad,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <Avatar name={seller} size={52} />
          </div>
        </div>
        <div
          style={{
            background: "#fff",
            padding: "12px 24px 0",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: "'Plus Jakarta Sans',sans-serif",
              fontSize: 17,
              fontWeight: 800,
              color: "#111827",
              marginBottom: 2,
              display: "flex",
              alignItems: "center",
              gap: 8,
              justifyContent: "center",
            }}
          >
            {seller}
            <BIRBadge size={18} onClick={() => setShowBIR(true)} />
          </div>
          <div style={{ fontSize: 12, color: "#6B7280" }}>
             {avgRating} · {sellerBatches.length} batch
            {sellerBatches.length !== 1 ? "es" : ""}
          </div>
        </div>
      </div>
      <div className="flex gap-2 mb-4">
        {(["Shop", "Reviews", "About"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              background: tab === t ? INDIGO : "#fff",
              color: tab === t ? "#fff" : "#6B7280",
              border: `1px solid ${tab === t ? INDIGO : "#E5E7EB"}`,
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
              padding: "5px 14px",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "Shop" && (
        <div>
          {/* Overview strip */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              {
                label: "Active Batches",
                value: String(
                  sellerBatches.filter((b) => b.live).length ||
                    sellerBatches.length,
                ),
                icon: "✈️",
              },
              {
                label: "Products Available",
                value: String(
                  sellerBatches.reduce((s, b) => s + b.products.length, 0),
                ),
                icon: "📦",
              },
              {
                label: "Claim Rate",
                value: `${Math.round(
                  (sellerBatches.reduce((s, b) => s + b.claimed, 0) /
                    Math.max(
                      1,
                      sellerBatches.reduce((s, b) => s + b.items, 0),
                    )) *
                    100,
                )}%`,
                icon: "📈",
              },
            ].map((st) => (
              <div
                key={st.label}
                style={{
                  background: CREAM,
                  borderRadius: 8,
                  padding: "10px 12px",
                  textAlign: "center",
                  border: "1px solid #E5E7EB",
                }}
              >
                <div style={{ fontSize: 18 }}>{st.icon}</div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: "#111827",
                    fontFamily: "'Plus Jakarta Sans',sans-serif",
                  }}
                >
                  {st.value}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "#9CA3AF",
                    fontWeight: 500,
                    marginTop: 2,
                  }}
                >
                  {st.label}
                </div>
              </div>
            ))}
          </div>
          {/* Filter bar */}
          <div
            className="flex items-center gap-2 mb-4"
            style={{ flexWrap: "wrap" }}
          >
            <select
              value={shopCat}
              onChange={(e) => setShopCat(e.target.value)}
              style={{
                fontSize: 12,
                border: "1px solid #E5E7EB",
                borderRadius: 6,
                padding: "5px 8px",
                background: "#fff",
                outline: "none",
                color: "#374151",
              }}
            >
              {[
                "All",
                ...Array.from(new Set(sellerBatches.map((b) => b.category))),
              ].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <select
              value={shopSort}
              onChange={(e) => setShopSort(e.target.value)}
              style={{
                fontSize: 12,
                border: "1px solid #E5E7EB",
                borderRadius: 6,
                padding: "5px 8px",
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
          {/* Batch cards */}
          <div
            className="space-y-3"
            style={{ maxHeight: 360, overflowY: "auto" }}
          >
            {activeBatches.length === 0 && (
              <div
                style={{
                  textAlign: "center",
                  color: "#9CA3AF",
                  fontSize: 13,
                  padding: "16px 0",
                }}
              >
                No active batches.
              </div>
            )}
            {activeBatches.map((b) => {
              const pct = Math.round((b.claimed / b.items) * 100)
              const isExpanded = expandedBatch === b.id
              const grad = CAT_GRAD[b.category] || CAT_GRAD["Mixed"]
              return (
                <div
                  key={b.id}
                  style={{
                    border: `1px solid ${isExpanded ? INDIGO : "#E5E7EB"}`,
                    borderRadius: 10,
                    overflow: "hidden",
                    boxShadow: isExpanded ? `0 0 0 2px ${INDIGO}20` : "none",
                  }}
                >
                  <div
                    style={{
                      height: 70,
                      background: grad,
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "0 14px",
                    }}
                  >
                    <CategoryIcon category={b.category} size={28} color="#fff" />
                    <div className="flex-1">
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: "#fff",
                          fontFamily: "'Plus Jakarta Sans',sans-serif",
                        }}
                      >
                        {b.title}
                      </div>
                      <div
                        style={{ fontSize: 11, color: "rgba(255,255,255,0.8)" }}
                      >
                        {b.trips}
                      </div>
                    </div>
                  </div>
                  <div style={{ background: "#fff", padding: "10px 14px" }}>
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
                        marginBottom: 10,
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
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          setExpandedBatch(isExpanded ? null : b.id)
                        }
                        style={{
                          flex: 1,
                          fontSize: 12,
                          fontWeight: 600,
                          padding: "6px 0",
                          borderRadius: 7,
                          border: `1px solid ${INDIGO}`,
                          background: isExpanded ? "#EEF0FF" : "#fff",
                          color: INDIGO,
                          cursor: "pointer",
                        }}
                      >
                        {isExpanded ? "Hide Products ↑" : "View Products →"}
                      </button>
                      <button
                        onClick={() => {
                          onClaimFromProfile?.(b.id)
                          onClose()
                        }}
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          padding: "6px 12px",
                          borderRadius: 7,
                          border: "none",
                          background: INDIGO,
                          color: "#fff",
                          cursor: "pointer",
                          whiteSpace: "nowrap" as const,
                        }}
                      >
                        Claim →
                      </button>
                    </div>
                  </div>
                  {isExpanded && (
                    <div
                      style={{
                        borderTop: "1px solid #E5E7EB",
                        background: "#FAFAFA",
                      }}
                    >
                      {b.products.map((p, pi) => {
                        const soldOut = p.claimed >= p.qty
                        const onlyN = p.qty - p.claimed
                        return (
                          <div
                            key={pi}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              padding: "8px 0",
                              borderBottom: "1px solid #F3F4F6",
                            }}
                          >
                            <ProductThumb name={p.name} />
                            <div style={{ flex: 1 }}>
                              <div
                                style={{
                                  fontSize: 13,
                                  fontWeight: 600,
                                  color: "#111827",
                                }}
                              >
                                {p.name}
                              </div>
                              <div
                                style={{
                                  fontSize: 11,
                                  color: "#6B7280",
                                  marginTop: 1,
                                }}
                              >
                                {p.claimed}/{p.qty} claimed
                              </div>
                              {soldOut ? (
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    color: "#991B1B",
                                    background: "#FEE2E2",
                                    borderRadius: 999,
                                    padding: "1px 7px",
                                  }}
                                >
                                  Sold Out
                                </span>
                              ) : onlyN <= 3 ? (
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    color: "#92400E",
                                    background: "#FEF3C7",
                                    borderRadius: 999,
                                    padding: "1px 7px",
                                  }}
                                >
                                  Only {onlyN} left
                                </span>
                              ) : null}
                            </div>
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 700,
                                color: "#111827",
                                fontFamily: "'Plus Jakarta Sans',sans-serif",
                              }}
                            >
                              ₱{p.price.toLocaleString()}
                            </div>
                            {soldOut ? (
                              <button
                                onClick={() => {
                                  onClose()
                                  setAppTab && setAppTab("Batches")
                                }}
                                style={{
                                  fontSize: 11,
                                  fontWeight: 600,
                                  padding: "5px 10px",
                                  borderRadius: 6,
                                  border: "none",
                                  cursor: "pointer",
                                  background: INDIGO,
                                  color: "#fff",
                                  whiteSpace: "nowrap" as const,
                                }}
                              >
                                Join Waitlist
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  onClose()
                                  setAppTab && setAppTab("Batches")
                                }}
                                style={{
                                  fontSize: 11,
                                  fontWeight: 600,
                                  padding: "5px 10px",
                                  borderRadius: 6,
                                  border: "none",
                                  cursor: "pointer",
                                  background: "#C81E62",
                                  color: "#fff",
                                  whiteSpace: "nowrap" as const,
                                }}
                              >
                                Claim this Item
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
            {pastBatches.length > 0 && (
              <div>
                <button
                  onClick={() => setShowPast((v) => !v)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 10px",
                    background: "#F9FAFB",
                    border: "1px solid #E5E7EB",
                    borderRadius: 8,
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#6B7280",
                  }}
                >
                  <span>📦 Past & Locked Batches ({pastBatches.length})</span>
                  <span>{showPast ? "▲" : "▼"}</span>
                </button>
                {showPast && (
                  <div className="space-y-2 mt-2">
                    {pastBatches.map((b) => (
                      <div
                        key={b.id}
                        style={{
                          border: "1px solid #E5E7EB",
                          borderRadius: 8,
                          padding: "10px 14px",
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          opacity: 0.7,
                        }}
                      >
                        <CategoryIcon category={b.category} size={18} color={INDIGO} />
                        <div className="flex-1">
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: "#374151",
                            }}
                          >
                            {b.title}
                          </div>
                          <div style={{ fontSize: 11, color: "#9CA3AF" }}>
                            {b.trips} · {b.claimed}/{b.items} claimed
                          </div>
                        </div>
                        {b.locked && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 600,
                              color: "#9CA3AF",
                              background: "#F3F4F6",
                              borderRadius: 999,
                              padding: "2px 8px",
                            }}
                          >
                            <><Lock size={13} aria-hidden="true" /> Locked</>
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      {tab === "Reviews" && (
        <div className="space-y-3">
          {REVIEWS.map((r, i) => (
            <div
              key={i}
              style={{
                border: "1px solid #E5E7EB",
                borderRadius: 8,
                padding: "12px 14px",
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Avatar name={r.buyer} size={24} />
                <span
                  style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}
                >
                  {r.buyer}
                </span>
                <span style={{ fontSize: 12, color: AMBER }}>
                  {"".repeat(r.rating)}
                  {"☆".repeat(5 - r.rating)}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.5 }}>
                {r.comment}
              </div>
            </div>
          ))}
        </div>
      )}
      {tab === "About" && (
        <div className="space-y-4">
          <div
            style={{
              fontSize: 13,
              color: "#374151",
              lineHeight: 1.6,
              background: CREAM,
              borderRadius: 8,
              padding: "12px 14px",
            }}
          >
            Trusted pasabuy seller since 2024. I travel frequently to Japan,
            Korea, and Southeast Asia. I specialize in K-beauty, Japanese
            snacks, and luxury items at competitive prices. All items are 100%
            authentic with receipts upon request.
          </div>
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#374151",
                marginBottom: 8,
              }}
            >
              Social Accounts
            </div>
            <div className="space-y-2">
              {[
                {
                  bg: "#1877F2",
                  label: "Facebook",
                  icon: (
                    <span
                      style={{ color: "#fff", fontWeight: 800, fontSize: 13 }}
                    >
                      f
                    </span>
                  ),
                  url: `https://facebook.com/${seller.toLowerCase().replace(" ", ".")}`,
                },
                {
                  bg: "linear-gradient(135deg,#F58529,#DD2A7B,#8134AF)",
                  label: "Instagram",
                  icon: <span style={{ color: "#fff", fontSize: 11 }}>📷</span>,
                  url: `https://instagram.com/${seller.toLowerCase().replace(" ", "_")}.pasabuy`,
                },
                {
                  bg: "#000",
                  label: "TikTok",
                  icon: (
                    <span
                      style={{ color: "#fff", fontWeight: 800, fontSize: 13 }}
                    >
                      T
                    </span>
                  ),
                  url: `https://tiktok.com/@${seller.toLowerCase().replace(" ", "_")}`,
                },
              ].map((s) => (
                <a
                  key={s.label}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 12px",
                    border: "1px solid #E5E7EB",
                    borderRadius: 8,
                    textDecoration: "none",
                    color: "#374151",
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLElement).style.background =
                      "#F9FAFB")
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLElement).style.background = "")
                  }
                >
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: "50%",
                      background: s.bg,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {s.icon}
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#111827",
                      }}
                    >
                      {s.label}
                    </div>
                    <div style={{ fontSize: 11, color: INDIGO }}>{s.url}</div>
                  </div>
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: 12,
                      color: "#9CA3AF",
                    }}
                  >
                    ↗
                  </span>
                </a>
              ))}
            </div>
          </div>
          <button
            style={{
              fontSize: 11,
              color: "#EF4444",
              background: "none",
              border: "none",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            Report this Shop
          </button>
        </div>
      )}
      {showBIR && <BIRInfoModal onClose={() => setShowBIR(false)} />}
    </Modal>
  )
}

