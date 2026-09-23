import { useEffect, useState } from "react"
import { BarChart3, Lock, Unlock, Search, FileText, ArrowRight, Star } from "lucide-react"
import type { ClaimRow, BatchType, SharedState, EntityId } from "@/types"
import { INDIGO, CORAL, AMBER, CAT_GRAD } from "@/constants/theme"
import { navIntent } from "@/state/navIntent"
import { Modal, Card, PrimaryBtn, SecondaryBtn, Avatar, CategoryIcon, Toggle, ShareButton, ExtensionRequestModal } from "@/components/shared"
import { sortSoldOutLast } from "./batchSort"
import FinancialSummaryModal from "./FinancialSummaryModal"
import BuyerRequestFormModal from "./BuyerRequestFormModal"
import ItemClaimModal from "./ItemClaimModal"
import SellerProfileModal from "./SellerProfileModal"
import SellerDirectoryPage from "./SellerDirectoryPage"
import BatchPage from "./BatchPage"
import { toggleBatchLock } from "./toggleBatchLock"
import { isSupabaseConfigured } from "@/lib/supabase"
import { kargoApi } from "@/services"

export const COLS = 3
export default function Batches({
  batches,
  setBatches,
  claims,
  setClaims,
  toPay,
  setToPay,
  role,
  user,
  setTab,
  waitlist,
  setWaitlist,
}: SharedState) {
  const [batchPage, setBatchPage] = useState<BatchType | null>(() => {
    const id = navIntent.batchId
    navIntent.batchId = null
    return id ? batches.find((b) => b.id === id) || null : null
  })
  const [waitlisted, setWaitlisted] = useState<Record<string, boolean>>({})
  const [claimedKeys, setClaimedKeys] = useState<Record<string, boolean>>({})
  const [catFilter, setCatFilter] = useState("All")
  const [dateFilter, setDateFilter] = useState("All")
  const [ratingFilter, setRatingFilter] = useState("All")
  const [showBuyerReqForm, setShowBuyerReqForm] = useState(false)
  const [sellerDir, setSellerDir] = useState(false)
  // Request Extension moved to the top of the Batches tab (3.7). A picker of
  // the buyer's extendable claims → the shared ExtensionRequestModal.
  const [showExtPicker, setShowExtPicker] = useState(false)
  const [extTarget, setExtTarget] = useState<ClaimRow | null>(null)
  const extendableClaims = claims.filter(
    (c) => c.status === "Pending" && !c.extensionRequested,
  )
  const submitExtension = async (hours: number, reason: string) => {
    if (!extTarget) return
    if (isSupabaseConfigured) {
      try {
        await kargoApi.requestOrderExtension(String(extTarget.id), hours, reason)
      } catch (error) {
        alert(error instanceof Error ? error.message : "Unable to request extension.")
        return
      }
    }
    setClaims((prev) =>
      prev.map((c) => (c.id === extTarget.id ? { ...c, extensionRequested: true } : c)),
    )
    setExtTarget(null)
  }
  const [profile, setProfile] = useState<string | null>(() => {
    const n = navIntent.sellerName
    navIntent.sellerName = null
    return n
  })
  const [contact, setContact] = useState<BatchType | null>(null)
  const [claimTarget, setClaimTarget] = useState<{
    p: typeof batches[0]["products"][0]
    key: string
  } | null>(null)
  const [financialBatch, setFinancialBatch] = useState<BatchType | null>(null)
  const [profileClaimTarget, setProfileClaimTarget] = useState<{
    batch: BatchType
    product: BatchType["products"][0]
  } | null>(null)
  // Confirmation targets for consequential seller actions (#16)
  const [lockConfirm, setLockConfirm] = useState<BatchType | null>(null)

  // Seller-only state
  type ExtReq = {
    id: EntityId
    buyer: string
    product: string
    batch: string
    requestedAt: string
    status: "pending" | "approved" | "denied"
  }
  type BuyerReq = {
    id: EntityId
    buyer: string
    buyerFb?: string
    product: string
    batch: string
    message: string
    requestedAt: string
    replied: boolean
  }
  const [extensionRequests, setExtensionRequests] = useState<ExtReq[]>(isSupabaseConfigured ? [] : [
    {
      id: 1,
      buyer: "Carlo Reyes",
      product: "Laneige Lip Mask",
      batch: "Korea Haul",
      requestedAt: "Sep 9, 2026",
      status: "pending",
    },
    {
      id: 2,
      buyer: "Mia Santos",
      product: "SK-II Essence",
      batch: "Singapore Haul",
      requestedAt: "Sep 10, 2026",
      status: "pending",
    },
  ])
  const [buyerRequests, setBuyerRequests] = useState<BuyerReq[]>(isSupabaseConfigured ? [] : [
    {
      id: 1,
      buyer: "Trisha Lim",
      product: "Tokyo Banana (more qty?)",
      batch: "Japan Trip",
      message:
        "Hi! Can I order 3 pcs instead of the max of 2? Willing to pay extra shipping.",
      requestedAt: "Sep 8, 2026",
      replied: false,
    },
    {
      id: 2,
      buyer: "Paolo Cruz",
      product: "Custom request",
      batch: "Korea Haul",
      message:
        "Do you accept requests for Etude House products? Planning to order 5 pcs.",
      requestedAt: "Sep 9, 2026",
      replied: false,
    },
  ])
  // Seller request pop-ups (moved from inline bottom cards to top-of-tab buttons).
  const [showExtReqModal, setShowExtReqModal] = useState(false)
  const [showBuyerReqModal, setShowBuyerReqModal] = useState(false)
  // Confirmation target for extension approve/deny (#16)
  const [extConfirm, setExtConfirm] = useState<{
    req: ExtReq
    action: "approved" | "denied"
  } | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured || role !== "Seller") return
    kargoApi
      .loadSellerRequests()
      .then((data) => {
        setExtensionRequests(data.extensions)
        setBuyerRequests(data.buyerRequests)
      })
      .catch((error) => alert(error instanceof Error ? error.message : "Unable to load seller requests."))
  }, [role])

  const filtered = batches.filter((b) => {
    if (catFilter !== "All" && b.category !== catFilter) return false
    if (dateFilter !== "All") {
      const mm: Record<string, string> = {
        "May 2026": "May",
        "Jun 2026": "Jun",
        "Jul 2026": "Jul",
        "Aug 2026": "Aug",
        "Sep 2026": "Sep",
        "Oct 2026": "Oct",
      }
      if (!b.trips.includes(mm[dateFilter] || "")) return false
    }
    if (ratingFilter === "4.8+" && b.rating < 4.8) return false
    if (ratingFilter === "4.5+" && b.rating < 4.5) return false
    return true
  })

  const handleClaim = async (
    key: string,
    batch: BatchType,
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
    // Keep batch/product claim counts accurate immediately (2.3).
    setBatches((prev) =>
      prev.map((bt) =>
        bt.id !== batch.id
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
    const reserveHrs = batch.reserveHours || 48
    const claimId = Date.now()
    const expiresAt = new Date(Date.now() + reserveHrs * 3_600_000).toISOString()
    const newClaim: ClaimRow = {
      id: claimId,
      productId: product.dbId,
      product: product.name,
      batch: batch.title.replace("—", "—"),
      seller: batch.seller,
      qty: claimQty,
      amount: product.price * claimQty,
      status: "Pending",
      hours: reserveHrs,
      expiresAt,
    }
    setClaims((prev) => [newClaim, ...prev])
    const alreadyInToPay = toPay.some((t) => t.product === product.name)
    if (!alreadyInToPay) {
      setToPay((prev) => [
        {
          id: claimId,
          orderId: String(claimId),
          product: product.name,
          seller: batch.seller,
          sellerId: batch.sellerId,
          amount: product.price * claimQty,
          qty: claimQty,
          hours: reserveHrs,
          expiresAt,
        },
        ...prev,
      ])
    }
  }

  const handleProfileClaim = (batchId: number, productName?: string) => {
    const batch = batches.find((b) => b.id === batchId)
    // Target a specific item when a name is given (per-item claim from the
    // View-Shop panel); otherwise fall back to the first product.
    const product = productName
      ? batch?.products.find((p) => p.name === productName)
      : batch?.products[0]
    if (!batch || !product) return
    setProfile(null)
    setProfileClaimTarget({ batch, product })
  }

  // Confirmation modals for consequential seller actions (#16). Rendered in
  // every return branch so they work from the batch grid and the seller panels.
  const confirmModals = (
    <>
      {lockConfirm && (
        <Modal
          title={lockConfirm.locked ? "Unlock this batch?" : "Lock this batch?"}
          onClose={() => setLockConfirm(null)}
          width={420}
        >
          <p style={{ fontSize: 13, color: "#374151", marginBottom: 16 }}>
            {lockConfirm.locked ? (
              <>
                Unlocking <strong>{lockConfirm.title}</strong> reopens it so
                buyers can claim items again.
              </>
            ) : (
              <>
                Locking <strong>{lockConfirm.title}</strong> pauses new orders —
                buyers won't be able to claim items until you unlock it.
                Existing claims are not affected.
              </>
            )}
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <SecondaryBtn onClick={() => setLockConfirm(null)}>
              Cancel
            </SecondaryBtn>
            <PrimaryBtn
              onClick={() => {
                toggleBatchLock(setBatches, lockConfirm.id)
                setLockConfirm(null)
              }}
            >
              {lockConfirm.locked ? "Unlock Batch" : "Lock Batch"}
            </PrimaryBtn>
          </div>
        </Modal>
      )}
      {extConfirm && (
        <Modal
          title={
            extConfirm.action === "approved"
              ? "Approve this extension request?"
              : "Deny this extension request?"
          }
          onClose={() => setExtConfirm(null)}
          width={420}
        >
          <p style={{ fontSize: 13, color: "#374151", marginBottom: 16 }}>
            {extConfirm.action === "approved" ? (
              <>
                Approving gives <strong>{extConfirm.req.buyer}</strong> more
                time to pay for <strong>{extConfirm.req.product}</strong>. The
                buyer will be notified.
              </>
            ) : (
              <>
                Denying keeps the original deadline for{" "}
                <strong>{extConfirm.req.buyer}</strong>'s claim on{" "}
                <strong>{extConfirm.req.product}</strong>. The buyer will be
                notified.
              </>
            )}
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <SecondaryBtn onClick={() => setExtConfirm(null)}>
              Cancel
            </SecondaryBtn>
            <PrimaryBtn
              onClick={async () => {
                if (isSupabaseConfigured) {
                  try {
                    await kargoApi.decideOrderExtension(
                      String(extConfirm.req.id),
                      extConfirm.action === "approved",
                    )
                  } catch (error) {
                    alert(error instanceof Error ? error.message : "Unable to decide extension.")
                    return
                  }
                }
                setExtensionRequests((p) =>
                  p.map((r) =>
                    r.id === extConfirm.req.id
                      ? { ...r, status: extConfirm.action }
                      : r,
                  ),
                )
                setExtConfirm(null)
              }}
            >
              {extConfirm.action === "approved" ? "Approve" : "Deny"}
            </PrimaryBtn>
          </div>
        </Modal>
      )}
    </>
  )

  if (batchPage)
    return (
      <>
        <BatchPage
          batch={batches.find((b) => b.id === batchPage.id) ?? batchPage}
          role={role}
          user={user}
          batches={batches}
          claims={claims}
          setClaims={setClaims}
          toPay={toPay}
          setToPay={setToPay}
          onBack={() => setBatchPage(null)}
          onSellerClick={(name) => setProfile(name)}
          setBatches={setBatches}
          waitlist={waitlist}
          setWaitlist={setWaitlist}
        />
        {profile && (
          <SellerProfileModal
            seller={profile}
            batches={batches}
            onClose={() => setProfile(null)}
            onClaimFromProfile={handleProfileClaim}
            setTab={setTab}
            profileData={profile === user.name ? user : undefined}
            role={role}
          />
        )}
        {profileClaimTarget && (
          <ItemClaimModal
            batch={profileClaimTarget.batch}
            product={profileClaimTarget.product}
            onConfirm={(qty) => {
              handleClaim(
                `${profileClaimTarget.batch.id}-${profileClaimTarget.product.name}`,
                profileClaimTarget.batch,
                profileClaimTarget.product,
                qty,
              )
              setProfileClaimTarget(null)
            }}
            onClose={() => setProfileClaimTarget(null)}
          />
        )}
      </>
    )

  const BatchGrid = ({ batchList }: { batchList: BatchType[] }) => {
    // Sold-out batches sink to the bottom (3.3).
    const ordered = sortSoldOutLast(batchList)
    const gridRows: BatchType[][] = []
    for (let i = 0; i < ordered.length; i += COLS)
      gridRows.push(ordered.slice(i, i + COLS))
    return (
      <div className="space-y-0">
        {gridRows.map((row, rowIdx) => {
          return (
            <div key={rowIdx}>
              <div
                className="grid gap-5"
                style={{
                  gridTemplateColumns: "repeat(3,1fr)",
                  marginBottom: 20,
                }}
              >
                {row.map((b, i) => {
                  const pct = Math.round((b.claimed / b.items) * 100)
                  const grad = CAT_GRAD[b.category] || CAT_GRAD["Mixed"]
                  return (
                    <div
                      key={b.id}
                      className="fi"
                      style={{
                        animationDelay: `${(rowIdx * COLS + i) * 40}ms`,
                      }}
                    >
                      <div
                        style={{
                          background: "#fff",
                          border: `1px solid ${
                            b.locked ? "#FCA5A5" : "#E5E7EB"
                          }`,
                          borderRadius: 8,
                          overflow: "hidden",
                          boxShadow: b.locked
                            ? "0 0 0 1px #FCA5A5,0 1px 3px rgba(0,0,0,0.06)"
                            : "0 1px 3px rgba(0,0,0,0.06)",
                          transition: "transform 0.15s,box-shadow 0.15s",
                        }}
                        onMouseEnter={(e) => {
                          const el = e.currentTarget as HTMLDivElement
                          el.style.transform = "translateY(-2px)"
                          el.style.boxShadow = "0 6px 20px rgba(0,0,0,0.10)"
                        }}
                        onMouseLeave={(e) => {
                          const el = e.currentTarget as HTMLDivElement
                          el.style.transform = ""
                          el.style.boxShadow = b.locked
                            ? "0 0 0 1px #FCA5A5,0 1px 3px rgba(0,0,0,0.06)"
                            : "0 1px 3px rgba(0,0,0,0.06)"
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
                          <CategoryIcon category={b.category} size={40} color="rgba(255,255,255,.78)" />
                          {role === "Seller" ? (
                            <button
                              type="button"
                              aria-label={b.locked ? "Unlock batch" : "Lock batch"}
                              onClick={(e) => {
                                e.stopPropagation()
                                setLockConfirm(b)
                              }}
                              style={{
                                position: "absolute",
                                top: 8,
                                left: 8,
                                background: "rgba(255,255,255,0.92)",
                                border: "none",
                                borderRadius: 6,
                                width: 28,
                                height: 28,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer",
                                fontSize: 15,
                                boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
                              }}
                              title={b.locked ? "Unlock batch" : "Lock batch"}
                            >
                              {b.locked ? (
                                <Lock size={14} aria-hidden="true" style={{ color: "#991B1B" }} />
                              ) : (
                                <Unlock size={14} aria-hidden="true" style={{ color: "#374151" }} />
                              )}
                            </button>
                          ) : b.locked ? (
                            <span
                              style={{
                                position: "absolute",
                                top: 10,
                                left: 10,
                                background: "#FEE2E2",
                                color: "#991B1B",
                                fontSize: 9,
                                fontWeight: 700,
                                padding: "3px 8px",
                                borderRadius: 999,
                                letterSpacing: 0.5,
                              }}
                            >
                              <><Lock size={13} aria-hidden="true" /> LOCKED</>
                            </span>
                          ) : (
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
                          )}
                          {role === "Seller" && (
                            <span
                              style={{
                                position: "absolute",
                                top: 10,
                                right: 10,
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
                          )}
                          {role === "Buyer" && (
                            <span
                              style={{
                                position: "absolute",
                                top: 10,
                                right: 10,
                                background: "rgba(0,0,0,0.45)",
                                color: "#fff",
                                fontSize: 10,
                                fontWeight: 600,
                                padding: "3px 8px",
                                borderRadius: 999,
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              <Star size={11} aria-hidden="true" fill="#fff" /> {b.rating}
                            </span>
                          )}
                          {pct >= 90 && (
                            <span
                              style={{
                                position: "absolute",
                                bottom: 8,
                                right: 8,
                                background: CORAL,
                                color: "#fff",
                                fontSize: 9,
                                fontWeight: 700,
                                padding: "2px 8px",
                                borderRadius: 999,
                              }}
                            >
                              ALMOST FULL
                            </span>
                          )}
                          {rowIdx === 0 && i < COLS && (
                            <span
                              style={{
                                position: "absolute",
                                bottom: 8,
                                left: 8,
                                background: AMBER,
                                color: "#7A4800",
                                fontSize: 9,
                                fontWeight: 700,
                                padding: "2px 8px",
                                borderRadius: 999,
                              }}
                            >
                              TRENDING ✦
                            </span>
                          )}
                        </div>
                        <div style={{ padding: "14px 16px" }}>
                          <h3
                            style={{
                              fontFamily: "'Plus Jakarta Sans',sans-serif",
                              fontSize: 13.5,
                              fontWeight: 700,
                              color: "#111827",
                              marginBottom: 6,
                            }}
                          >
                            {b.title}
                          </h3>
                          <div className="flex items-center gap-1.5 mb-3">
                            <Avatar name={b.seller} size={18} />
                            <span style={{ fontSize: 11.5, color: "#6B7280" }}>
                              {b.seller}
                            </span>
                            <span style={{ fontSize: 11, color: "#D1D5DB" }}>
                              ·
                            </span>
                            <span style={{ fontSize: 11, color: "#9CA3AF" }}>
                              {b.trips}
                            </span>
                          </div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span style={{ fontSize: 11, color: "#6B7280" }}>
                              {b.claimed}/{b.items} claimed
                            </span>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color:
                                  pct > 85
                                    ? "#EF4444"
                                    : pct > 60
                                      ? AMBER
                                      : "#6B7280",
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
                              marginBottom: 12,
                            }}
                          >
                            <div
                              style={{
                                width: `${pct}%`,
                                height: "100%",
                                background:
                                  pct > 85
                                    ? "#EF4444"
                                    : pct > 60
                                      ? AMBER
                                      : INDIGO,
                                borderRadius: 999,
                                transition:
                                  "width 0.6s cubic-bezier(.22,1,.36,1)",
                              }}
                            />
                          </div>
                          {role === "Buyer" && b.locked ? (
                            <div
                              style={{
                                background: "#FEE2E2",
                                color: "#991B1B",
                                fontSize: 11,
                                fontWeight: 700,
                                padding: "7px 12px",
                                borderRadius: 6,
                                textAlign: "center",
                              }}
                            >
                              <><Lock size={14} aria-hidden="true" /> Not Accepting Orders</>
                            </div>
                          ) : (
                            <div style={{ display: "flex", gap: 6 }}>
                              <PrimaryBtn
                                style={{
                                  flex: 1,
                                  display: "flex",
                                  justifyContent: "center",
                                }}
                                onClick={() => setBatchPage(b)}
                                size="sm"
                              >
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                  View Items <ArrowRight size={13} aria-hidden="true" />
                                </span>
                              </PrimaryBtn>
                              {role === "Seller" && (
                                <SecondaryBtn
                                  size="sm"
                                  ariaLabel="View batch financial summary"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    setFinancialBatch(b)
                                  }}
                                >
                                  <BarChart3 size={15} aria-hidden="true" />
                                </SecondaryBtn>
                              )}
                              <ShareButton batchId={b.id} title={b.title} compact />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
                {row.length < COLS &&
                  Array.from({ length: COLS - row.length }).map((_, i) => (
                    <div key={`ph-${i}`} />
                  ))}
              </div>
            </div>
          )
        })}
        {batchList.length === 0 && (
          <div
            style={{
              padding: "60px 0",
              textAlign: "center",
              color: "#9CA3AF",
              fontSize: 13,
            }}
          >
            No batches match your filters.
          </div>
        )}
      </div>
    )
  }

  const FilterBar = () => (
    <div
      style={{
        background: "#fff",
        border: "1px solid #E5E7EB",
        borderRadius: 8,
        padding: "12px 16px",
      }}
      className="flex items-center gap-3 mb-6"
    >
      <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>
        Filter:
      </span>
      <select
        value={catFilter}
        onChange={(e) => {
          setCatFilter(e.target.value)
        }}
        style={{
          fontSize: 12,
          color: "#374151",
          border: "1px solid #E5E7EB",
          borderRadius: 6,
          padding: "5px 8px",
          background: "#fff",
          outline: "none",
          cursor: "pointer",
        }}
      >
        {[
          "All",
          "Food & Beauty",
          "Skincare",
          "Grocery & Snacks",
          "Beauty",
          "Luxury",
          "Mixed",
        ].map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
      <select
        value={dateFilter}
        onChange={(e) => {
          setDateFilter(e.target.value)
        }}
        style={{
          fontSize: 12,
          color: "#374151",
          border: "1px solid #E5E7EB",
          borderRadius: 6,
          padding: "5px 8px",
          background: "#fff",
          outline: "none",
          cursor: "pointer",
        }}
      >
        {[
          "All",
          "May 2026",
          "Jun 2026",
          "Jul 2026",
          "Aug 2026",
          "Sep 2026",
          "Oct 2026",
        ].map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
      <select
        value={ratingFilter}
        onChange={(e) => setRatingFilter(e.target.value)}
        style={{
          fontSize: 12,
          color: "#374151",
          border: "1px solid #E5E7EB",
          borderRadius: 6,
          padding: "5px 8px",
          background: "#fff",
          outline: "none",
          cursor: "pointer",
        }}
      >
        {["All", "4.5+", "4.8+"].map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
      <div className="flex-1" />
      {role === "Buyer" && (
        <SecondaryBtn onClick={() => setSellerDir(true)}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Search size={13} aria-hidden="true" /> Browse Sellers
          </span>
        </SecondaryBtn>
      )}
      {role === "Buyer" && (
        <SecondaryBtn onClick={() => setShowBuyerReqForm(true)}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <FileText size={13} aria-hidden="true" /> Request Item
          </span>
        </SecondaryBtn>
      )}
      <span style={{ fontSize: 12, color: "#9CA3AF" }}>
        {filtered.length} batch{filtered.length !== 1 ? "es" : ""} found
      </span>
    </div>
  )

  // Full-page seller directory
  if (sellerDir) {
    return (
      <>
        <SellerDirectoryPage
          batches={batches}
          onBack={() => setSellerDir(false)}
          onClaimItem={handleProfileClaim}
          role={role}
          user={user}
          onSellerSelect={(name) => {
            setProfile(name)
          }}
        />
        {profileClaimTarget && (
          <ItemClaimModal
            batch={profileClaimTarget.batch}
            product={profileClaimTarget.product}
            onConfirm={(qty) => {
              handleClaim(
                `${profileClaimTarget.batch.id}-${profileClaimTarget.product.name}`,
                profileClaimTarget.batch,
                profileClaimTarget.product,
                qty,
              )
              setProfileClaimTarget(null)
            }}
            onClose={() => setProfileClaimTarget(null)}
          />
        )}
      </>
    )
  }

  if (role === "Seller") {
    const myBatches = batches.filter((b) => b.seller === user.name)
    const pendingExtCount = extensionRequests.filter((r) => r.status === "pending").length
    const unrepliedBuyerCount = buyerRequests.filter((r) => !r.replied).length
    const myFiltered = myBatches.filter((b) => {
      if (catFilter !== "All" && b.category !== catFilter) return false
      if (dateFilter !== "All") {
        const mm: Record<string, string> = {
          "May 2026": "May",
          "Jun 2026": "Jun",
          "Jul 2026": "Jul",
          "Aug 2026": "Aug",
          "Sep 2026": "Sep",
          "Oct 2026": "Oct",
        }
        if (!b.trips.includes(mm[dateFilter] || "")) return false
      }
      if (ratingFilter === "4.8+" && b.rating < 4.8) return false
      if (ratingFilter === "4.5+" && b.rating < 4.5) return false
      return true
    })
    return (
      <div className="p-6">
        <h2
          style={{
            fontFamily: "'Plus Jakarta Sans',sans-serif",
            fontSize: 18,
            fontWeight: 800,
            color: "#111827",
            marginBottom: 4,
          }}
        >
          My Batches
        </h2>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 20,
          }}
        >
          <p style={{ fontSize: 13, color: "#9CA3AF", margin: 0 }}>
            Manage your pasabuy batches. Toggle lock to pause new orders.
          </p>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <SecondaryBtn size="sm" onClick={() => setShowExtReqModal(true)}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                Extension Requests
                {pendingExtCount > 0 && (
                  <span
                    style={{
                      background: "#EF4444",
                      color: "#fff",
                      fontSize: 10,
                      fontWeight: 700,
                      borderRadius: 999,
                      padding: "1px 6px",
                      lineHeight: 1.4,
                    }}
                  >
                    {pendingExtCount}
                  </span>
                )}
              </span>
            </SecondaryBtn>
            <SecondaryBtn size="sm" onClick={() => setShowBuyerReqModal(true)}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                Buyer Requests
                {unrepliedBuyerCount > 0 && (
                  <span
                    style={{
                      background: INDIGO,
                      color: "#fff",
                      fontSize: 10,
                      fontWeight: 700,
                      borderRadius: 999,
                      padding: "1px 6px",
                      lineHeight: 1.4,
                    }}
                  >
                    {unrepliedBuyerCount}
                  </span>
                )}
              </span>
            </SecondaryBtn>
          </div>
        </div>
        <FilterBar />
        {myBatches.length === 0 ? (
          <Card style={{ textAlign: "center", padding: "32px 24px" }}>
            <div style={{ fontSize: 14, color: "#9CA3AF", marginBottom: 12 }}>
              You haven't created any batches yet. Click '+ New Batch' to get
              started.
            </div>
          </Card>
        ) : (
          <BatchGrid batchList={myFiltered} />
        )}
        {/* Seller request pop-ups (opened from the header buttons above) */}
        {showExtReqModal && (
          <Modal
            title="Extension Requests"
            onClose={() => setShowExtReqModal(false)}
            width={480}
          >
            {extensionRequests.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  color: "#9CA3AF",
                  fontSize: 13,
                  padding: "16px 0",
                }}
              >
                No pending extension requests.
              </div>
            ) : (
              <div className="space-y-3">
                {extensionRequests.map((req) => (
                  <div
                    key={req.id}
                    style={{
                      border: "1px solid #E5E7EB",
                      borderRadius: 8,
                      padding: "12px 14px",
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "#111827",
                          }}
                        >
                          {req.buyer}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "#9CA3AF",
                            marginTop: 2,
                          }}
                        >
                          {req.product} · {req.batch}
                        </div>
                        <div style={{ fontSize: 11, color: "#9CA3AF" }}>
                          Requested {req.requestedAt}
                        </div>
                      </div>
                      {req.status === "pending" ? (
                        <div className="flex gap-2">
                          <PrimaryBtn
                            size="sm"
                            onClick={() =>
                              setExtConfirm({ req, action: "approved" })
                            }
                          >
                            Approve
                          </PrimaryBtn>
                          <button
                            onClick={() =>
                              setExtConfirm({ req, action: "denied" })
                            }
                            style={{
                              fontSize: 12,
                              color: "#EF4444",
                              fontWeight: 600,
                              background: "none",
                              border: "1px solid #EF4444",
                              borderRadius: 6,
                              padding: "4px 10px",
                              cursor: "pointer",
                            }}
                          >
                            Deny
                          </button>
                        </div>
                      ) : (
                        <span
                          style={{
                            background:
                              req.status === "approved" ? "#D4F5EA" : "#FEE2E2",
                            color:
                              req.status === "approved" ? "#0B7A59" : "#991B1B",
                            fontSize: 11,
                            fontWeight: 600,
                            padding: "3px 9px",
                            borderRadius: 999,
                          }}
                        >
                          {req.status === "approved" ? "Approved" : "Denied"}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Modal>
        )}
        {showBuyerReqModal && (
          <Modal
            title="Buyer Requests"
            onClose={() => setShowBuyerReqModal(false)}
            width={480}
          >
            {buyerRequests.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  color: "#9CA3AF",
                  fontSize: 13,
                  padding: "16px 0",
                }}
              >
                No buyer requests yet.
              </div>
            ) : (
              <div className="space-y-3">
                {buyerRequests.map((req) => (
                  <div
                    key={req.id}
                    style={{
                      border: "1px solid #E5E7EB",
                      borderRadius: 8,
                      padding: "12px 14px",
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Avatar name={req.buyer} size={20} />
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: "#111827",
                            }}
                          >
                            {req.buyer}
                          </span>
                          <span style={{ fontSize: 11, color: "#9CA3AF" }}>
                            · {req.batch}
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: "#374151",
                            lineHeight: 1.5,
                          }}
                        >
                          <strong>{req.product}</strong>
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "#6B7280",
                            marginTop: 3,
                            lineHeight: 1.5,
                          }}
                        >
                          {req.message}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "#9CA3AF",
                            marginTop: 4,
                          }}
                        >
                          {req.requestedAt}
                        </div>
                      </div>
                      {req.replied ? (
                        <span
                          style={{
                            background: "#D4F5EA",
                            color: "#0B7A59",
                            fontSize: 11,
                            fontWeight: 600,
                            padding: "3px 9px",
                            borderRadius: 999,
                            whiteSpace: "nowrap",
                          }}
                        >
                          Replied
                        </span>
                      ) : (
                        <SecondaryBtn
                          onClick={async () => {
                            if (isSupabaseConfigured) {
                              try {
                                await kargoApi.markBuyerRequestReplied(String(req.id))
                              } catch (error) {
                                alert(error instanceof Error ? error.message : "Unable to update request.")
                                return
                              }
                            }
                            if (req.buyerFb) {
                              window.open(req.buyerFb, "_blank", "noopener,noreferrer")
                            } else {
                              alert("This buyer hasn't added a contact link yet.")
                            }
                            setBuyerRequests((p) =>
                              p.map((r) =>
                                r.id === req.id ? { ...r, replied: true } : r,
                              ),
                            )
                          }}
                        >
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            Reply on FB <ArrowRight size={13} aria-hidden="true" />
                          </span>
                        </SecondaryBtn>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Modal>
        )}
        {showBuyerReqForm && (
          <BuyerRequestFormModal
            batches={batches}
            onClose={() => setShowBuyerReqForm(false)}
          />
        )}
        {profile && (
          <SellerProfileModal
            seller={profile}
            batches={batches}
            onClose={() => setProfile(null)}
            onClaimFromProfile={handleProfileClaim}
            setTab={setTab}
            profileData={profile === user.name ? user : undefined}
            role={role}
          />
        )}
        {profileClaimTarget && (
          <ItemClaimModal
            batch={profileClaimTarget.batch}
            product={profileClaimTarget.product}
            onConfirm={(qty) => {
              handleClaim(
                `${profileClaimTarget.batch.id}-${profileClaimTarget.product.name}`,
                profileClaimTarget.batch,
                profileClaimTarget.product,
                qty,
              )
              setProfileClaimTarget(null)
            }}
            onClose={() => setProfileClaimTarget(null)}
          />
        )}
        {financialBatch && (
          <FinancialSummaryModal
            batch={financialBatch}
            onClose={() => setFinancialBatch(null)}
          />
        )}
        {confirmModals}
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Request Extension — top of the Batches tab (3.7) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          background: "#EEF0FF",
          border: "1px solid #DDE0FF",
          borderRadius: 8,
          padding: "10px 14px",
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 12.5, color: "#374151" }}>
          Need more time to pay for a claim?
        </div>
        <SecondaryBtn
          size="sm"
          onClick={() => setShowExtPicker(true)}
          disabled={extendableClaims.length === 0}
        >
          Request Extension
        </SecondaryBtn>
      </div>
      <FilterBar />
      <BatchGrid batchList={filtered} />
      {showExtPicker && (
        <Modal
          title="Request an extension"
          onClose={() => setShowExtPicker(false)}
          width={440}
        >
          <div className="space-y-2">
            <p style={{ fontSize: 12.5, color: "#6B7280", marginBottom: 6 }}>
              Choose which claim you'd like more time to pay for.
            </p>
            {extendableClaims.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setExtTarget(c)
                  setShowExtPicker(false)
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  border: "1px solid #E5E7EB",
                  borderRadius: 8,
                  padding: "10px 12px",
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>
                  {c.product}
                </div>
                <div style={{ fontSize: 11, color: "#9CA3AF" }}>
                  {c.seller} · ₱{c.amount.toLocaleString()}
                </div>
              </button>
            ))}
          </div>
        </Modal>
      )}
      {extTarget && (
        <ExtensionRequestModal
          claim={extTarget}
          onSubmit={submitExtension}
          onClose={() => setExtTarget(null)}
        />
      )}
      {showBuyerReqForm && (
        <BuyerRequestFormModal
          batches={batches}
          onClose={() => setShowBuyerReqForm(false)}
        />
      )}
      {profile && (
        <SellerProfileModal
          seller={profile}
          batches={batches}
          onClose={() => setProfile(null)}
          onClaimFromProfile={handleProfileClaim}
          setTab={setTab}
          profileData={profile === user.name ? user : undefined}
          role={role}
        />
      )}
      {profileClaimTarget && (
        <ItemClaimModal
          batch={profileClaimTarget.batch}
          product={profileClaimTarget.product}
          onConfirm={() => {
            handleClaim(
              `${profileClaimTarget.batch.id}-${profileClaimTarget.product.name}`,
              profileClaimTarget.batch,
              profileClaimTarget.product,
            )
            setProfileClaimTarget(null)
          }}
          onClose={() => setProfileClaimTarget(null)}
        />
      )}
      {financialBatch && (
        <FinancialSummaryModal
          batch={financialBatch}
          onClose={() => setFinancialBatch(null)}
        />
      )}
      {confirmModals}
    </div>
  )
}

