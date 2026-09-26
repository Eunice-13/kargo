import { useState } from "react"
import { Check, Lock, Plus, Unlock } from "lucide-react"
import type { BatchType, Role } from "@/types"
import { INDIGO, CREAM, CYAN_L } from "@/constants/theme"
import { Card, PrimaryBtn, Avatar, ProductThumb, BIRBadge, Toggle } from "@/components/shared"
import ItemClaimModal from "@/features/batches/ItemClaimModal"
import { toggleBatchLock } from "@/features/batches/toggleBatchLock"

export default function BatchDetailPanel({
  batch,
  onClose,
  waitlisted,
  setWaitlisted,
  claimed,
  onClaim,
  role,
  setBatches,
  onSellerClick,
}: {
  batch: BatchType
  onClose: () => void
  waitlisted: Record<string, boolean>
  setWaitlisted: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  claimed: Record<string, boolean>
  onClaim: (
    key: string,
    batch: BatchType,
    product: typeof batch.products[0],
  ) => void
  role: Role
  setBatches?: React.Dispatch<React.SetStateAction<BatchType[]>>
  onSellerClick?: (name: string) => void
}) {
  const isLockedBuyer = batch.locked && role === "Buyer"
  const [claimTarget, setClaimTarget] = useState<{
    p: typeof batch.products[0]
    key: string
  } | null>(null)
  return (
    <Card style={{ border: `2px solid ${INDIGO}`, marginTop: 4 }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3
              style={{
                fontFamily: "'Josefin Sans',sans-serif",
                fontSize: 16,
                fontWeight: 700,
                color: "#111827",
              }}
            >
              {batch.title}
            </h3>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Avatar name={batch.seller} size={20} />
            <span
              style={{
                fontSize: 12,
                color: "#6B7280",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <button
                onClick={() => onSellerClick && onSellerClick(batch.seller)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: onSellerClick ? "pointer" : "default",
                  color: "#6B7280",
                  fontSize: 12,
                  fontWeight: 500,
                  padding: 0,
                  textDecoration: onSellerClick ? "underline" : "none",
                  textUnderlineOffset: 2,
                }}
              >
                {batch.seller}
              </button>
              <BIRBadge /> · {batch.rating === null ? "New seller" : batch.rating.toFixed(1)} · {batch.trips}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            color: "#9CA3AF",
            fontSize: 24,
            background: "none",
            border: "none",
            cursor: "pointer",
            lineHeight: 1,
            padding: "0 4px",
          }}
        >
          ×
        </button>
      </div>
      {isLockedBuyer && (
        <div
          style={{
            background: "#FEE2E2",
            border: "1px solid #FCA5A5",
            borderRadius: 8,
            padding: "12px 16px",
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Lock size={20} aria-hidden="true" />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#991B1B" }}>
              Not Accepting Orders
            </div>
            <div style={{ fontSize: 12, color: "#B91C1C", marginTop: 2 }}>
              The seller has temporarily locked this batch. Check back later.
            </div>
          </div>
        </div>
      )}
      <div className="grid gap-3">
        {batch.products.map((p, pIdx) => {
          const wKey = `${batch.id}-${p.name}`
          const cKey = `${batch.id}-${p.name}-claimed`
          const isClaimed = claimed[cKey]
          const soldOut = p.claimed >= p.qty && !isClaimed
          const almostGone = !soldOut && p.qty - p.claimed <= 2
          const full = soldOut
          return (
            <div
              key={p.name}
              style={{
                background: CREAM,
                border: "1px solid #EDE8E8",
                borderRadius: 8,
              }}
              className="p-3 flex items-center gap-4"
            >
              <ProductThumb name={p.name} />
              <div className="flex-1">
                <div
                  style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}
                >
                  {p.name}
                </div>
                <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
                  {isClaimed ? p.claimed + 1 : p.claimed}/{p.qty} claimed
                  {p.waitlist > 0 ? ` · ${p.waitlist} on waitlist` : ""}
                </div>
                <div
                  style={{
                    background: "#E5E7EB",
                    borderRadius: 999,
                    height: 3,
                    marginTop: 6,
                    overflow: "hidden",
                    width: 120,
                  }}
                >
                  <div
                    style={{
                      width: `${Math.min(100, ((isClaimed ? p.claimed + 1 : p.claimed) / p.qty) * 100)}%`,
                      height: "100%",
                      background: full ? "#9CA3AF" : INDIGO,
                      borderRadius: 999,
                      transition: "width 0.4s ease",
                    }}
                  />
                </div>
                {role !== "Seller" && (
                  <div className="flex items-center gap-1.5 mt-1.5">
                    {soldOut && (
                      <span
                        style={{
                          background: "#FEE2E2",
                          color: "#991B1B",
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "2px 7px",
                          borderRadius: 999,
                        }}
                      >
                        Sold Out
                      </span>
                    )}
                    {!soldOut && almostGone && (
                      <span
                        style={{
                          background: "#FEF3C7",
                          color: "#92400E",
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "2px 7px",
                          borderRadius: 999,
                        }}
                      >
                        Only {p.qty - p.claimed} left!
                      </span>
                    )}
                    {!soldOut && !isClaimed && waitlisted[wKey] && (
                      <span
                        style={{
                          background: CYAN_L,
                          color: "#0369A1",
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "2px 7px",
                          borderRadius: 999,
                        }}
                      >
                        Queue #{p.waitlist + 1}
                      </span>
                    )}
                  </div>
                )}
                {role === "Seller" && (
                  <div style={{ fontSize: 11, color: "#6B7280", marginTop: 4 }}>
                    {p.claimed} claimed · {p.waitlist} waitlisted
                  </div>
                )}
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#111827",
                  fontFamily: "'Josefin Sans',sans-serif",
                  minWidth: 70,
                  textAlign: "right",
                }}
              >
                ₱{p.price.toLocaleString()}
              </div>
              <div style={{ minWidth: 130 }}>
                {role === "Seller" ? (
                  <div className="flex items-center gap-2 justify-end">
                    <span style={{ fontSize: 11, color: "#6B7280" }}>
                      {p.locked ? <><Lock size={12} aria-hidden="true" /> Locked</> : <><Unlock size={12} aria-hidden="true" /> Open</>}
                    </span>
                    <Toggle
                      on={!p.locked}
                      label={`${p.locked ? "Unlock" : "Lock"} ${p.name}`}
                      onChange={() => {
                        if (setBatches) toggleBatchLock(setBatches, batch.id, pIdx)
                      }}
                    />
                  </div>
                ) : isClaimed ? (
                  <div
                    style={{
                      background: "#D4F5EA",
                      color: "#0B7A59",
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "6px 10px",
                      borderRadius: 6,
                      textAlign: "center",
                    }}
                  >
                    ✓ Added to Claims!
                  </div>
                ) : full ? (
                  <div>
                    <div
                      style={{
                        background: "#F3F4F6",
                        color: "#9CA3AF",
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "4px 10px",
                        borderRadius: 6,
                        textAlign: "center",
                        marginBottom: 4,
                      }}
                    >
                      Fully Claimed
                    </div>
                    {waitlisted[wKey] ? (
                      <div
                        style={{
                          background: CYAN_L,
                          color: "#0369A1",
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "4px 10px",
                          borderRadius: 6,
                          textAlign: "center",
                        }}
                      >
                        Queue #{p.waitlist + 1}
                      </div>
                    ) : (
                      <button
                        onClick={() =>
                          setWaitlisted((w) => ({ ...w, [wKey]: true }))
                        }
                        style={{
                          width: "100%",
                          background: "#fff",
                          border: `1px solid ${INDIGO}`,
                          color: INDIGO,
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "4px 10px",
                          borderRadius: 6,
                          cursor: "pointer",
                          transition: "background 0.15s",
                        }}
                      >
                        Join Waitlist
                      </button>
                    )}
                  </div>
                ) : isLockedBuyer ? (
                  <div
                    style={{
                      background: "#F3F4F6",
                      color: "#9CA3AF",
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "6px 10px",
                      borderRadius: 6,
                      textAlign: "center",
                    }}
                  >
                    <><Lock size={13} aria-hidden="true" /> Locked</>
                  </div>
                ) : (
                  <PrimaryBtn
                    size="sm"
                    style={{
                      width: "100%",
                      display: "flex",
                      justifyContent: "center",
                    }}
                    onClick={() => setClaimTarget({ p, key: cKey })}
                  >
                    Claim Item
                  </PrimaryBtn>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {claimTarget && (
        <ItemClaimModal
          batch={batch}
          product={claimTarget.p}
          onConfirm={() => {
            onClaim(claimTarget.key, batch, claimTarget.p)
            setClaimTarget(null)
          }}
          onClose={() => setClaimTarget(null)}
        />
      )}
    </Card>
  )
}

