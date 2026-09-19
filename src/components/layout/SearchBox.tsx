import { useState } from "react"
import { Package, ShoppingBasket, UserRound } from "lucide-react"
import type { Tab, BatchType } from "@/types"
import { CREAM } from "@/constants/theme"

export default function SearchBox({
  batches,
  onNavigate,
  onBatchSelect,
  onSellerSelect,
}: {
  batches?: BatchType[]
  onNavigate?: (tab: Tab) => void
  onBatchSelect?: (id: number) => void
  onSellerSelect?: (name: string) => void
}) {
  const [searchQ, setSearchQ] = useState("")
  const [searchOpen, setSearchOpen] = useState(false)

  return (
    <div
      className="kargo-search-wrap flex-1 max-w-lg mx-auto"
      style={{ position: "relative" }}
    >
      <div
        style={{
          background: CREAM,
          border: "1px solid #E5E7EB",
          borderRadius: 8,
        }}
        className="kargo-search flex items-center gap-2 px-3 py-2"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <circle cx="7" cy="7" r="5" stroke="#9CA3AF" strokeWidth="1.5" />
          <path
            d="M11 11l3 3"
            stroke="#9CA3AF"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        <input
          aria-label="Search batches, products, and sellers"
          value={searchQ}
          onChange={(e) => {
            setSearchQ(e.target.value)
            setSearchOpen(e.target.value.length > 0)
          }}
          placeholder="Search batches, products, sellers…"
          style={{
            background: "transparent",
            fontSize: 13,
            color: "#374151",
            outline: "none",
            width: "100%",
          }}
          className="placeholder:text-gray-400"
        />
      </div>
      {searchOpen && searchQ && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            background: "#fff",
            border: "1px solid #E5E7EB",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
            zIndex: 50,
            overflow: "hidden",
            marginTop: 4,
          }}
        >
          <div
            style={{
              padding: "8px 12px",
              fontSize: 11,
              fontWeight: 700,
              color: "#9CA3AF",
              letterSpacing: 0.5,
              borderBottom: "1px solid #F3F4F6",
            }}
          >
            RESULTS FOR "{searchQ}"
          </div>
          {(() => {
            const q = searchQ.toLowerCase()
            const allBatches = batches || []
            const batchResults = allBatches
              .filter((b) => b.title.toLowerCase().includes(q))
              .slice(0, 3)
            const productResults: {
              name: string
              batchId: number
              batchTitle: string
            }[] = []
            for (const b of allBatches) {
              for (const p of b.products) {
                if (
                  p.name.toLowerCase().includes(q) &&
                  productResults.length < 3
                ) {
                  productResults.push({
                    name: p.name,
                    batchId: b.id,
                    batchTitle: b.title,
                  })
                }
              }
            }
            const sellerSet = new Set<string>()
            const sellerResults: string[] = []
            for (const b of allBatches) {
              if (
                b.seller.toLowerCase().includes(q) &&
                !sellerSet.has(b.seller) &&
                sellerResults.length < 3
              ) {
                sellerSet.add(b.seller)
                sellerResults.push(b.seller)
              }
            }
            const hasAny =
              batchResults.length ||
              productResults.length ||
              sellerResults.length
            if (!hasAny)
              return (
                <div
                  style={{
                    padding: "14px",
                    fontSize: 13,
                    color: "#9CA3AF",
                    textAlign: "center",
                  }}
                >
                  No results found.
                </div>
              )
            return (
              <>
                {batchResults.length > 0 && (
                  <>
                    <div
                      style={{
                        padding: "6px 14px 2px",
                        fontSize: 10,
                        fontWeight: 700,
                        color: "#9CA3AF",
                        letterSpacing: 0.5,
                      }}
                    >
                      BATCHES
                    </div>
                    {batchResults.map((b) => (
                      <div
                        key={b.id}
                        onClick={() => {
                          setSearchOpen(false)
                          setSearchQ("")
                          if (onBatchSelect) {
                            onBatchSelect(b.id)
                          } else {
                            onNavigate && onNavigate("Batches")
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        aria-label={`Open batch ${b.title}`}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            setSearchOpen(false)
                            setSearchQ("")
                            if (onBatchSelect) {
                              onBatchSelect(b.id)
                            } else {
                              onNavigate && onNavigate("Batches")
                            }
                          }
                        }}
                        style={{
                          padding: "9px 14px",
                          fontSize: 13,
                          color: "#374151",
                          cursor: "pointer",
                          borderBottom: "1px solid #F9FAFB",
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                        onMouseEnter={(e) =>
                          ((e.currentTarget as HTMLElement).style.background =
                            "#F9FAFB")
                        }
                        onMouseLeave={(e) =>
                          ((e.currentTarget as HTMLElement).style.background =
                            "")
                        }
                      >
                        <Package size={14} aria-hidden="true" /> {b.title}
                      </div>
                    ))}
                  </>
                )}
                {productResults.length > 0 && (
                  <>
                    <div
                      style={{
                        padding: "6px 14px 2px",
                        fontSize: 10,
                        fontWeight: 700,
                        color: "#9CA3AF",
                        letterSpacing: 0.5,
                      }}
                    >
                      PRODUCTS
                    </div>
                    {productResults.map((p, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          setSearchOpen(false)
                          setSearchQ("")
                          if (onBatchSelect) {
                            onBatchSelect(p.batchId)
                          } else {
                            onNavigate && onNavigate("Batches")
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        aria-label={`Open product ${p.name} in ${p.batchTitle}`}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            setSearchOpen(false)
                            setSearchQ("")
                            if (onBatchSelect) {
                              onBatchSelect(p.batchId)
                            } else {
                              onNavigate && onNavigate("Batches")
                            }
                          }
                        }}
                        style={{
                          padding: "9px 14px",
                          fontSize: 13,
                          color: "#374151",
                          cursor: "pointer",
                          borderBottom: "1px solid #F9FAFB",
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                        onMouseEnter={(e) =>
                          ((e.currentTarget as HTMLElement).style.background =
                            "#F9FAFB")
                        }
                        onMouseLeave={(e) =>
                          ((e.currentTarget as HTMLElement).style.background =
                            "")
                        }
                      >
                        <ShoppingBasket size={14} aria-hidden="true" /> {p.name}{" "}
                        <span style={{ fontSize: 11, color: "#9CA3AF" }}>
                          in {p.batchTitle}
                        </span>
                      </div>
                    ))}
                  </>
                )}
                {sellerResults.length > 0 && (
                  <>
                    <div
                      style={{
                        padding: "6px 14px 2px",
                        fontSize: 10,
                        fontWeight: 700,
                        color: "#9CA3AF",
                        letterSpacing: 0.5,
                      }}
                    >
                      SELLERS
                    </div>
                    {sellerResults.map((s, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          setSearchOpen(false)
                          setSearchQ("")
                          if (onSellerSelect) {
                            onSellerSelect(s)
                          } else {
                            onNavigate && onNavigate("Batches")
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        aria-label={`Open seller ${s}`}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            setSearchOpen(false)
                            setSearchQ("")
                            if (onSellerSelect) {
                              onSellerSelect(s)
                            } else {
                              onNavigate && onNavigate("Batches")
                            }
                          }
                        }}
                        style={{
                          padding: "9px 14px",
                          fontSize: 13,
                          color: "#374151",
                          cursor: "pointer",
                          borderBottom: "1px solid #F9FAFB",
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                        onMouseEnter={(e) =>
                          ((e.currentTarget as HTMLElement).style.background =
                            "#F9FAFB")
                        }
                        onMouseLeave={(e) =>
                          ((e.currentTarget as HTMLElement).style.background =
                            "")
                        }
                      >
                        <UserRound size={14} aria-hidden="true" /> {s}
                      </div>
                    ))}
                  </>
                )}
              </>
            )
          })()}
        </div>
      )}
    </div>
  )
}
