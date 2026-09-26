import { useState } from "react"
import { Lock, ArrowLeft, Plane, Check, Link2, Star } from "lucide-react"
import type { ClaimRow, ToPayRow, BatchType, Role, UserInfo, WaitlistEntry } from "@/types"
import { INDIGO, CYAN_L, GREEN, AMBER, CAT_GRAD } from "@/constants/theme"
import { Card, PrimaryBtn, SecondaryBtn, Avatar, ProductThumb, BIRBadge, CategoryIcon, Toggle, ContactModal, ShareButton } from "@/components/shared"
import ItemClaimModal from "./ItemClaimModal"
import JoinWaitlistModal from "./JoinWaitlistModal"
import { toggleBatchLock } from "./toggleBatchLock"
import { isSupabaseConfigured } from "@/lib/supabase"
import { kargoApi } from "@/services"

export default function BatchPage({
  batch: batchProp,
  role,
  user,
  batches,
  claims,
  setClaims,
  toPay,
  setToPay,
  onBack,
  onSellerClick,
  setBatches,
  waitlist,
  setWaitlist,
}: {
  batch: BatchType
  role: Role
  user: UserInfo
  batches: BatchType[]
  claims: ClaimRow[]
  setClaims: React.Dispatch<React.SetStateAction<ClaimRow[]>>
  toPay: ToPayRow[]
  setToPay: React.Dispatch<React.SetStateAction<ToPayRow[]>>
  onBack: () => void
  onSellerClick: (name: string) => void
  setBatches: React.Dispatch<React.SetStateAction<BatchType[]>>
  waitlist: WaitlistEntry[]
  setWaitlist: React.Dispatch<React.SetStateAction<WaitlistEntry[]>>
}) {
  const batch = batches.find((b) => b.id === batchProp.id) ?? batchProp
  const [claimedKeys, setClaimedKeys] = useState<Record<string, boolean>>({})
  const [claimTarget, setClaimTarget] = useState<{
    p: typeof batch.products[0]
    key: string
  } | null>(null)
  const [waitlistTarget, setWaitlistTarget] = useState<{
    p: typeof batch.products[0]
    pIdx: number
  } | null>(null)
  const [contact, setContact] = useState(false)
  const pct = Math.round((batch.claimed / batch.items) * 100)
  const grad = CAT_GRAD[batch.category] || CAT_GRAD["Mixed"]
  const reserveHrs = batch.reserveHours || 48

  // Join a waitlist with the buyer's chosen quantity (from JoinWaitlistModal).
  const handleJoinWaitlist = async (
    p: typeof batch.products[0],
    pIdx: number,
    qty: number,
  ) => {
    if (isSupabaseConfigured) {
      if (!p.dbId) return
      try {
        await kargoApi.joinWaitlist(p.dbId, qty)
      } catch (error) {
        alert(error instanceof Error ? error.message : "Unable to join waitlist.")
        return
      }
    }
    setWaitlist((prev) => {
      if (
        prev.some(
          (e) =>
            (p.dbId && e.productId === p.dbId) ||
            (e.batchId === batch.id && e.product === p.name),
        )
      ) {
        return prev
      }
      const nextPos = p.waitlist + 1
      return [
        ...prev.map((e) =>
          e.batchId === batch.id && e.product === p.name
            ? { ...e, queueSize: nextPos, desiredQuantity: qty }
            : e,
        ),
        {
          id: p.dbId ?? `wl-${batch.id}-${p.name}`,
          productId: p.dbId,
          product: p.name,
          batchId: batch.id,
          batch: batch.title,
          seller: batch.seller,
          trips: batch.trips,
          position: nextPos,
          queueSize: nextPos,
          amount: p.price,
          desiredQuantity: qty,
          status: "waiting",
        },
      ]
    })
    setBatches((prev) =>
      prev.map((b) =>
        b.id !== batch.id
          ? b
          : {
              ...b,
              products: b.products.map((prod, i) =>
                i === pIdx ? { ...prod, waitlist: prod.waitlist + 1 } : prod,
              ),
            },
      ),
    )
  }
  const handleClaim = async (
    key: string,
    b: BatchType,
    product: typeof batch.products[0],
    qty: number = 1,
  ) => {
    const claimQty = Math.max(1, Math.floor(qty))
    if (isSupabaseConfigured) {
      if (!product.dbId) return
      try {
        await kargoApi.claimProduct(product.dbId, claimQty)
      } catch (error) {
        alert(error instanceof Error ? error.message : "Unable to claim this product.")
        return
      }
    }
    setClaimedKeys((c) => ({ ...c, [key]: true }))
    // Keep the batch/product claim counts accurate immediately (2.3) instead of
    // waiting for the next full data refresh.
    setBatches((prev) =>
      prev.map((bt) =>
        bt.id !== b.id
          ? bt
          : {
              ...bt,
              claimed: bt.claimed + claimQty,
              products: bt.products.map((prod) =>
                (product.dbId && prod.dbId === product.dbId) || prod.name === product.name
                  ? { ...prod, claimed: prod.claimed + claimQty }
                  : prod,
              ),
            },
      ),
    )
    const claimId = Date.now()
    const expiresAt = new Date(Date.now() + reserveHrs * 3_600_000).toISOString()
    setClaims((prev) => [
      {
        id: claimId,
        productId: product.dbId,
        product: product.name,
        batch: b.title,
        seller: b.seller,
        qty: claimQty,
        amount: product.price * claimQty,
        status: "Pending",
        hours: reserveHrs,
        expiresAt,
      },
      ...prev,
    ])
    if (!toPay.some((t) => t.product === product.name))
      setToPay((prev) => [
        {
          id: claimId,
          orderId: String(claimId),
          product: product.name,
          seller: b.seller,
          sellerId: b.sellerId,
          amount: product.price * claimQty,
          qty: claimQty,
          hours: reserveHrs,
          expiresAt,
        },
        ...prev,
      ])
  }

  return (
    <div className="p-6 fi" style={{ maxWidth: 900, margin: "0 auto" }}>
      {/* Breadcrumb + share */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingBottom: 16,
        }}
      >
        <button
          onClick={onBack}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            fontWeight: 600,
            color: INDIGO,
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            fontFamily: "'Josefin Sans',sans-serif",
          }}
        >
          <ArrowLeft size={14} aria-hidden="true" /> Back to Batches
        </button>
        <ShareButton batchId={batch.id} title={batch.title} label="Share batch" />
      </div>

      {/* Hero header */}
      <div
        style={{
          height: 180,
          background: grad,
          borderRadius: 12,
          display: "flex",
          alignItems: "flex-end",
          padding: 20,
          position: "relative",
          marginBottom: 24,
          overflow: "hidden",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%,-60%)",
            fontSize: 72,
            opacity: 0.18,
          }}
        >
          <CategoryIcon category={batch.category} size={44} color="#fff" />
        </span>
        {batch.locked && role === "Buyer" && (
          <span
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              background: "rgba(0,0,0,0.55)",
              color: "#fff",
              fontSize: 11,
              fontWeight: 700,
              padding: "4px 10px",
              borderRadius: 999,
            }}
          >
            <><Lock size={14} aria-hidden="true" /> Not Accepting Orders</>
          </span>
        )}
        <div>
          <h1
            style={{
              fontFamily: "'Josefin Sans',sans-serif",
              fontSize: 22,
              fontWeight: 800,
              color: "#fff",
              marginBottom: 4,
            }}
          >
            {batch.title}
          </h1>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span
              style={{
                background: "rgba(255,255,255,0.2)",
                color: "#fff",
                fontSize: 11,
                fontWeight: 600,
                padding: "3px 10px",
                borderRadius: 999,
              }}
            >
              {batch.category}
            </span>
            <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5 }}>
              <Plane size={12} aria-hidden="true" /> {batch.trips}
            </span>
            <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 12 }}>
               48h reservation window
            </span>
          </div>
        </div>
      </div>

      {batch.notes && (
        <div
          style={{
            background: "#fff",
            border: "1px solid #E5E7EB",
            borderRadius: 12,
            padding: "16px 18px",
            marginBottom: 24,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#9CA3AF",
              letterSpacing: 0.8,
              marginBottom: 8,
            }}
          >
            DESCRIPTION
          </div>
          <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
            {batch.notes}
          </p>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 300px",
          gap: 24,
          alignItems: "start",
        }}
      >
        {/* Left: products */}
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            <h2
              style={{
                fontFamily: "'Josefin Sans',sans-serif",
                fontSize: 16,
                fontWeight: 700,
                color: "#111827",
              }}
            >
              Items in this Batch
            </h2>
            {role === "Buyer" && (
              <SecondaryBtn onClick={() => setContact(true)}>
                Contact Seller
              </SecondaryBtn>
            )}
          </div>
          <div className="space-y-3">
            {batch.products.map((p, pIdx) => {
              const pKey = `${batch.id}-${pIdx}`
              const isClaimed = claimedKeys[pKey]
              // p.claimed is bumped by the claimed quantity on confirm, so it is
              // already authoritative — no extra manual offset needed.
              const left = p.qty - p.claimed
              const soldOut = left <= 0
              const waitEntry = waitlist.find(
                (e) =>
                  (p.dbId && e.productId === p.dbId) ||
                  (e.batchId === batch.id && e.product === p.name),
              )
              const onWaitlist = Boolean(waitEntry)
              return (
                <Card
                  key={pIdx}
                  style={{ display: "flex", alignItems: "center", gap: 14 }}
                >
                  <ProductThumb name={p.name} />
                  <div className="flex-1">
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: "#111827",
                        fontFamily: "'Josefin Sans',sans-serif",
                      }}
                    >
                      {p.name}
                    </div>
                    <div
                      style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}
                    >
                      {p.claimed}/{p.qty} claimed
                      {p.waitlist > 0 ? ` · ${p.waitlist} on waitlist` : ""}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                        marginTop: 5,
                        flexWrap: "wrap" as const,
                      }}
                    >
                      {soldOut && !isClaimed && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            color: "#EF4444",
                            background: "#FEE2E2",
                            borderRadius: 999,
                            padding: "2px 8px",
                          }}
                        >
                          Sold Out
                        </span>
                      )}
                      {!soldOut && left <= 2 && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            color: "#D97706",
                            background: "#FEF3C7",
                            borderRadius: 999,
                            padding: "2px 8px",
                          }}
                        >
                          Only {left} left!
                        </span>
                      )}
                      {isClaimed && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            color: GREEN,
                            background: "#D4F5EA",
                            borderRadius: 999,
                            padding: "2px 8px",
                          }}
                        >
                          <Check size={11} aria-hidden="true" style={{ display: "inline", verticalAlign: -1, marginRight: 2 }} />
                          Claimed
                        </span>
                      )}
                      {role !== "Seller" && onWaitlist && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            color: "#0369A1",
                            background: CYAN_L,
                            borderRadius: 999,
                            padding: "2px 8px",
                          }}
                        >
                          Queue #{waitEntry?.position ?? p.waitlist + 1}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" as const, flexShrink: 0 }}>
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 800,
                        color: INDIGO,
                        fontFamily: "'Josefin Sans',sans-serif",
                        marginBottom: 8,
                      }}
                    >
                      ₱{p.price.toLocaleString()}
                    </div>
                    {role === "Seller" ? (
                      <Toggle
                        on={!p.locked}
                        label={`${p.locked ? "Unlock" : "Lock"} ${p.name}`}
                        onChange={() => toggleBatchLock(setBatches, batch.id, pIdx)}
                      />
                    ) : batch.locked ? (
                      <span style={{ fontSize: 11, color: "#9CA3AF" }}>
                        <><Lock size={13} aria-hidden="true" /> Locked</>
                      </span>
                    ) : isClaimed ? (
                      <span
                        style={{ fontSize: 11, color: GREEN, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 3 }}
                      >
                        <Check size={12} aria-hidden="true" /> In Claims
                      </span>
                    ) : soldOut ? (
                      onWaitlist ? (
                        <span
                          style={{
                            fontSize: 11,
                            color: "#0369A1",
                            fontWeight: 600,
                          }}
                        >
                          On Waitlist
                        </span>
                      ) : (
                        <PrimaryBtn
                          size="sm"
                          onClick={() => setWaitlistTarget({ p, pIdx })}
                        >
                          Join Waitlist
                        </PrimaryBtn>
                      )
                    ) : (
                      <PrimaryBtn
                        size="sm"
                        onClick={() => setClaimTarget({ p, key: pKey })}
                        style={{
                          background: "#C81E62",
                          boxShadow: "0 2px 8px rgba(200,30,98,0.35)",
                        }}
                      >
                        Claim this item
                      </PrimaryBtn>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        </div>

        {/* Right: seller panel */}
        <div className="space-y-4">
          <Card>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#9CA3AF",
                letterSpacing: 0.8,
                marginBottom: 12,
              }}
            >
              SELLER
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                cursor: "pointer",
              }}
              onClick={() => onSellerClick(batch.seller)}
              role="button"
              tabIndex={0}
              aria-label={`View ${batch.seller}'s shop`}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  onSellerClick(batch.seller)
                }
              }}
            >
              <Avatar name={batch.seller} size={40} />
              <div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: "#111827",
                    fontFamily: "'Josefin Sans',sans-serif",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {batch.seller}
                  {batch.sellerBirVerified !== false && <BIRBadge verified />}
                </div>
                <div style={{ fontSize: 12, color: "#6B7280", display: "flex", alignItems: "center", gap: 4 }}>
                  <Star size={11} aria-hidden="true" fill="#9CA3AF" /> {batch.rating} · Tap to view shop
                </div>
              </div>
            </div>
            <div
              style={{
                marginTop: 12,
                padding: "10px 12px",
                background: "#EEF0FF",
                borderRadius: 8,
                display: "flex",
                gap: 8,
              }}
            >
              <Link2 size={16} aria-hidden="true" style={{ color: INDIGO, flexShrink: 0, marginTop: 1 }} />
              <div>
                <div
                  style={{ fontSize: 11, fontWeight: 600, color: "#374151" }}
                >
                  Linked Facebook account
                </div>
                <div style={{ fontSize: 11, color: INDIGO }}>
                  facebook.com/{batch.seller.toLowerCase().replace(" ", ".")}
                </div>
                <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 2 }}>
                  Credibility reference only — not a payment guarantee.
                </div>
              </div>
            </div>
          </Card>
          <Card>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#9CA3AF",
                letterSpacing: 0.8,
                marginBottom: 12,
              }}
            >
              BATCH PROGRESS
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 6,
              }}
            >
              <span style={{ fontSize: 12, color: "#6B7280" }}>
                {batch.claimed}/{batch.items} claimed
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: pct > 85 ? "#EF4444" : pct > 60 ? AMBER : INDIGO,
                }}
              >
                {pct}%
              </span>
            </div>
            <div
              style={{
                background: "#F3F4F6",
                borderRadius: 999,
                height: 6,
                overflow: "hidden",
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  width: `${pct}%`,
                  height: "100%",
                  background: pct > 85 ? "#EF4444" : pct > 60 ? AMBER : INDIGO,
                  borderRadius: 999,
                }}
              />
            </div>
            {[
              ["Items", String(batch.items)],
              ["Claimed", String(batch.claimed)],
              ["Remaining", String(batch.items - batch.claimed)],
              ["Rating", ` ${batch.rating}`],
            ].map(([k, v]) => (
              <div
                key={k}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "5px 0",
                  borderBottom: "1px solid #F3F4F6",
                }}
              >
                <span style={{ fontSize: 12, color: "#9CA3AF" }}>{k}</span>
                <span
                  style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}
                >
                  {v}
                </span>
              </div>
            ))}
          </Card>
        </div>
      </div>

      {claimTarget && (
        <ItemClaimModal
          batch={batch}
          product={claimTarget.p}
          onConfirm={(qty) => {
            handleClaim(claimTarget.key, batch, claimTarget.p, qty)
            setClaimTarget(null)
          }}
          onClose={() => setClaimTarget(null)}
        />
      )}

      {waitlistTarget && (
        <JoinWaitlistModal
          productName={waitlistTarget.p.name}
          batchTitle={batch.title}
          price={waitlistTarget.p.price}
          onConfirm={(qty) => {
            handleJoinWaitlist(waitlistTarget.p, waitlistTarget.pIdx, qty)
            setWaitlistTarget(null)
          }}
          onClose={() => setWaitlistTarget(null)}
        />
      )}
      {contact && (
        <ContactModal
          name={batch.seller}
          context={batch.title}
          contactUrl={batch.sellerFb}
          onClose={() => setContact(false)}
        />
      )}
    </div>
  )
}

