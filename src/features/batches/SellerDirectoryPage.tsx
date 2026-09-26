import { useState } from "react"
import { ArrowLeft } from "lucide-react"
import type { BatchType, Role, UserInfo } from "@/types"
import { INDIGO } from "@/constants/theme"
import { Card, PrimaryBtn, Avatar, BIRBadge } from "@/components/shared"
import SellerShopPage from "./SellerShopPage"

export default function SellerDirectoryPage({
  batches,
  onBack,
  onSellerSelect,
  onClaimItem,
  role,
  user,
}: {
  batches: BatchType[]
  onBack: () => void
  onSellerSelect: (name: string) => void
  onClaimItem: (batchId: number, productName: string) => void
  role: Role
  user: UserInfo
}) {
  const [query, setQuery] = useState("")
  const [chip, setChip] = useState<"All" | "4.5+" | "Has Active Batch">("All")
  const [shopPage, setShopPage] = useState<string | null>(null)

  const sellerMap: Record<string, { batches: BatchType[]; rating: number }> = {}
  batches.forEach((b) => {
    if (!sellerMap[b.seller]) sellerMap[b.seller] = { batches: [], rating: 0 }
    sellerMap[b.seller].batches.push(b)
  })
  Object.values(sellerMap).forEach((s) => {
    s.rating = parseFloat(
      (
        s.batches.reduce((sum, b) => sum + b.rating, 0) / s.batches.length
      ).toFixed(1),
    )
  })

  const sellers = Object.entries(sellerMap).filter(([name, data]) => {
    if (query && !name.toLowerCase().includes(query.toLowerCase())) return false
    if (chip === "4.5+" && data.rating < 4.5) return false
    if (chip === "Has Active Batch" && !data.batches.some((b) => b.live))
      return false
    return true
  })

  if (shopPage) {
    return (
      <div>
        <div
          style={{
            background: "#fff",
            borderBottom: "1px solid #E5E7EB",
            padding: "10px 24px",
            display: "flex",
            alignItems: "center",
            gap: 8,
            position: "sticky",
            top: 88,
            zIndex: 30,
          }}
        >
          <button
            onClick={() => setShopPage(null)}
            style={{
              fontSize: 13,
              color: INDIGO,
              fontWeight: 600,
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            <ArrowLeft size={13} aria-hidden="true" style={{ display: "inline", marginRight: 4, verticalAlign: -2 }} />
          Back to Sellers
          </button>
          <span style={{ fontSize: 12, color: "#D1D5DB" }}>/</span>
          <span style={{ fontSize: 13, color: "#6B7280" }}>{shopPage}</span>
        </div>
        <div className="p-6">
          <SellerShopPage
            seller={shopPage}
            batches={batches}
            onClaimItem={onClaimItem}
            role={role}
            profileData={shopPage === user.name ? user : undefined}
          />
        </div>
      </div>
    )
  }

  return (
    <div>
      <div
        style={{
          background: "#fff",
          borderBottom: "1px solid #E5E7EB",
          padding: "10px 24px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          position: "sticky",
          top: 88,
          zIndex: 30,
        }}
      >
        <button
          onClick={onBack}
          style={{
            fontSize: 13,
            color: INDIGO,
            fontWeight: 600,
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          <ArrowLeft size={13} aria-hidden="true" style={{ display: "inline", marginRight: 4, verticalAlign: -2 }} />
          Back to Batches
        </button>
        <span style={{ fontSize: 12, color: "#D1D5DB" }}>/</span>
        <span style={{ fontSize: 13, color: "#6B7280" }}>Browse Sellers</span>
      </div>
      <div className="p-6">
        <div style={{ marginBottom: 20 }}>
          <h2
            style={{
              fontFamily: "'Josefin Sans',sans-serif",
              fontSize: 20,
              fontWeight: 800,
              color: "#111827",
              marginBottom: 4,
            }}
          >
            Seller Directory
          </h2>
          <p style={{ fontSize: 13, color: "#9CA3AF" }}>
            Browse verified pasabuy sellers and their active batches.
          </p>
        </div>
        <div
          style={{
            display: "flex",
            gap: 10,
            marginBottom: 16,
            alignItems: "center",
            flexWrap: "wrap" as const,
          }}
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by shop name…"
            style={{
              flex: 1,
              minWidth: 200,
              fontSize: 13,
              border: "1px solid #E5E7EB",
              borderRadius: 7,
              padding: "9px 12px",
              outline: "none",
              color: "#374151",
              fontFamily: "inherit",
            }}
            className="placeholder:text-gray-400"
          />
          {(["All", "4.5+", "Has Active Batch"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setChip(c)}
              style={{
                padding: "7px 14px",
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 999,
                border: `1px solid ${chip === c ? INDIGO : "#E5E7EB"}`,
                background: chip === c ? "#EEF0FF" : "#fff",
                color: chip === c ? INDIGO : "#6B7280",
                cursor: "pointer",
              }}
            >
              {c}
            </button>
          ))}
        </div>
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))" }}
        >
          {sellers.length === 0 && (
            <div
              style={{
                gridColumn: "1/-1",
                textAlign: "center",
                color: "#9CA3AF",
                fontSize: 13,
                padding: "40px 0",
              }}
            >
              No sellers found.
            </div>
          )}
          {sellers.map(([name, data]) => {
            const hasLive = data.batches.some((b) => b.live)
            return (
              <Card
                key={name}
                style={{ cursor: "pointer" }}
                className="hover:shadow-md transition-shadow"
              >
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "center",
                    marginBottom: 12,
                  }}
                >
                  <Avatar name={name} size={44} />
                  <div className="flex-1">
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        marginBottom: 2,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: "#111827",
                          fontFamily: "'Josefin Sans',sans-serif",
                        }}
                      >
                        {name}
                      </span>
                      {(name !== user.name || user.birState === "Verified") && <BIRBadge size={12} />}
                    </div>
                    <div style={{ fontSize: 12, color: "#6B7280" }}>
                       {data.rating} · {data.batches.length} batch
                      {data.batches.length !== 1 ? "es" : ""}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    marginBottom: 12,
                    flexWrap: "wrap" as const,
                  }}
                >
                  {Array.from(new Set(data.batches.map((b) => b.category)))
                    .slice(0, 3)
                    .map((cat) => (
                      <span
                        key={cat}
                        style={{
                          fontSize: 10,
                          background: "#F3F4F6",
                          color: "#6B7280",
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontWeight: 500,
                        }}
                      >
                        {cat}
                      </span>
                    ))}
                </div>
                <PrimaryBtn
                  style={{
                    width: "100%",
                    display: "flex",
                    justifyContent: "center",
                  }}
                  onClick={() => setShopPage(name)}
                >
                  View Shop
                </PrimaryBtn>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}

