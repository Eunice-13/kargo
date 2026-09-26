import { useState } from "react"
import { Search } from "lucide-react"
import type { BatchType, UserRating } from "@/types"
import { INDIGO } from "@/constants/theme"
import { Modal, SecondaryBtn, Avatar, BIRBadge, RatingDisplay, ratingFor } from "@/components/shared"
import SellerProfileModal from "@/features/batches/SellerProfileModal"

export default function SellerSearchModal({
  batches,
  ratings,
  onClose,
  onClaimFromProfile,
}: {
  batches: BatchType[]
  ratings: Record<string, UserRating>
  onClose: () => void
  onClaimFromProfile?: (batchId: number) => void
}) {
  const [query, setQuery] = useState("")
  const [chipFilter, setChip] = useState<"All" | "4.5+" | "Has Active Batch">(
    "All",
  )
  const [profile, setProfile] = useState<string | null>(null)

  // Ratings are read from the shared computed aggregate, not averaged from
  // per-batch scores.
  const sellerBatches = new Map<string, BatchType[]>()
  batches.forEach((b) => {
    if (!sellerBatches.has(b.seller)) sellerBatches.set(b.seller, [])
    sellerBatches.get(b.seller)!.push(b)
  })
  const sellerMap = Object.fromEntries(
    [...sellerBatches].map(([name, list]) => [
      name,
      {
        batches: list,
        rating: ratingFor(ratings, list.find((b) => b.sellerId)?.sellerId),
      },
    ]),
  )

  const sellers = Object.entries(sellerMap).filter(([name, data]) => {
    if (query && !name.toLowerCase().includes(query.toLowerCase())) return false
    if (chipFilter === "4.5+" && (data.rating.average ?? 0) < 4.5) return false
    if (chipFilter === "Has Active Batch" && !data.batches.some((b) => b.live))
      return false
    return true
  })

  return (
    <>
      <Modal title="Browse Sellers" onClose={onClose} width={640}>
        <div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by shop name…"
            style={{
              width: "100%",
              fontSize: 13,
              border: "1px solid #E5E7EB",
              borderRadius: 7,
              padding: "9px 12px",
              outline: "none",
              color: "#374151",
              fontFamily: "inherit",
              boxSizing: "border-box",
              marginBottom: 12,
            }}
            className="placeholder:text-gray-400"
          />
          <div className="flex gap-2 mb-4">
            {(["All", "4.5+", "Has Active Batch"] as const).map((c) => (
              <button
                key={c}
                onClick={() => setChip(c)}
                style={{
                  background: chipFilter === c ? INDIGO : "#fff",
                  color: chipFilter === c ? "#fff" : "#6B7280",
                  border: `1px solid ${chipFilter === c ? INDIGO : "#E5E7EB"}`,
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "4px 12px",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {c}
              </button>
            ))}
          </div>
          <div
            className="space-y-3"
            style={{ maxHeight: 360, overflowY: "auto" }}
          >
            {sellers.length === 0 && (
              <div
                style={{
                  textAlign: "center",
                  color: "#9CA3AF",
                  fontSize: 13,
                  padding: "24px 0",
                }}
              >
                No sellers found.
              </div>
            )}
            {sellers.map(([name, data]) => {
              const hasLive = data.batches.some((b) => b.live)
              return (
                <div
                  key={name}
                  style={{
                    border: "1px solid #E5E7EB",
                    borderRadius: 9,
                    padding: "12px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                  }}
                >
                  <Avatar name={name} size={40} />
                  <div className="flex-1">
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: "#111827",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      {name}
                      <BIRBadge />
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "#6B7280",
                        marginTop: 2,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        flexWrap: "wrap",
                      }}
                    >
                      <RatingDisplay summary={data.rating} subject="seller" />
                      <span>
                        · {data.batches.length} batch
                        {data.batches.length !== 1 ? "es" : ""}
                      </span>
                    </div>
                  </div>
                  <SecondaryBtn onClick={() => setProfile(name)}>
                    View Profile
                  </SecondaryBtn>
                </div>
              )
            })}
          </div>
        </div>
      </Modal>
      {profile && (
        <SellerProfileModal
          seller={profile}
          batches={batches}
          ratings={ratings}
          onClose={() => setProfile(null)}
          onClaimFromProfile={onClaimFromProfile}
        />
      )}
    </>
  )
}

