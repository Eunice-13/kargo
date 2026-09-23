import { useState, useEffect } from "react"
import { Clock3, PackageCheck } from "lucide-react"
import type { WaitlistEntry } from "@/types"
import { INDIGO, CYAN_L } from "@/constants/theme"
import { Modal, ProductThumb, SecondaryBtn, PrimaryBtn } from "@/components/shared"
import { sortWaitlistUpcoming } from "@/data/waitlist"

// Ticking countdown against an absolute ISO deadline (the offer's expiry).
function OfferDeadline({ iso }: { iso: string }) {
  const target = new Date(iso).getTime()
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])
  const remaining = Math.max(0, Math.round((target - now) / 1000))
  const h = Math.floor(remaining / 3600)
  const m = Math.floor((remaining % 3600) / 60)
  const s = remaining % 60
  const label =
    h > 0
      ? `${h}h ${String(m).padStart(2, "0")}m`
      : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
  const urgent = remaining < 3600
  return (
    <span
      className="tabular-nums"
      style={{ fontWeight: 700, color: remaining === 0 || urgent ? "#EF4444" : "#B45309" }}
    >
      {remaining === 0 ? "expired" : label}
    </span>
  )
}

export default function WaitlistModal({
  entries,
  activeId,
  onSelect,
  onClose,
  onViewBatch,
  onRespond,
}: {
  entries: WaitlistEntry[]
  activeId: string | null
  onSelect: (id: string) => void
  onClose: () => void
  onViewBatch: (batchId: number) => void
  onRespond?: (entry: WaitlistEntry, accept: boolean) => void
}) {
  const sorted = sortWaitlistUpcoming(entries)
  const active =
    sorted.find((e) => e.id === activeId) ?? sorted[0] ?? null
  // Partial-match offers awaiting the buyer's decision get a prominent callout.
  const offers = sorted.filter((e) => e.status === "offered" && e.offerQuantity)
  const [busyId, setBusyId] = useState<string | null>(null)

  const respond = async (entry: WaitlistEntry, accept: boolean) => {
    if (!onRespond) return
    setBusyId(entry.id)
    try {
      await onRespond(entry, accept)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Modal title="Your Waitlist" onClose={onClose} width={520}>
      {sorted.length === 0 ? (
        <div style={{ fontSize: 13, color: "#6B7280" }}>
          You are not on any product waitlists yet. Join a sold-out item from a
          batch to see it here.
        </div>
      ) : (
        <div className="space-y-4">
          {offers.map((offer) => (
            <div
              key={`offer-${offer.id}`}
              style={{
                background: "#FFF7ED",
                border: "1px solid #FCD34D",
                borderRadius: 8,
                padding: "12px 14px",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#92400E",
                  marginBottom: 6,
                  letterSpacing: 0.3,
                  textTransform: "uppercase" as const,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <PackageCheck size={14} aria-hidden="true" /> Partial stock available
              </div>
              <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.6 }}>
                <strong>{offer.offerQuantity}</strong> of{" "}
                <strong>{offer.product}</strong> is available now — you asked for{" "}
                {offer.desiredQuantity}. Accept the partial amount or decline to
                pass it to the next buyer.
              </div>
              {offer.offerExpiresAt && (
                <div style={{ fontSize: 12, color: "#92400E", marginTop: 6 }}>
                  Responds needed within <OfferDeadline iso={offer.offerExpiresAt} />
                </div>
              )}
              <div className="flex gap-3" style={{ marginTop: 10 }}>
                <SecondaryBtn
                  style={{ flex: 1, justifyContent: "center", fontSize: 12 }}
                  onClick={() => respond(offer, false)}
                  disabled={busyId === offer.id}
                >
                  Decline
                </SecondaryBtn>
                <PrimaryBtn
                  style={{ flex: 1, justifyContent: "center", fontSize: 12 }}
                  onClick={() => respond(offer, true)}
                  disabled={busyId === offer.id}
                >
                  {busyId === offer.id ? "Working…" : `Accept ${offer.offerQuantity}`}
                </PrimaryBtn>
              </div>
            </div>
          ))}
          {active && (
            <div
              style={{
                background: CYAN_L,
                borderRadius: 8,
                padding: "12px 14px",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#0369A1",
                  marginBottom: 4,
                  letterSpacing: 0.3,
                  textTransform: "uppercase" as const,
                }}
              >
                Next up
              </div>
              <div className="flex items-center gap-3">
                <ProductThumb name={active.product} />
                <div className="flex-1">
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#111827",
                      fontFamily: "'Plus Jakarta Sans',sans-serif",
                    }}
                  >
                    {active.product}
                  </div>
                  <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
                    {active.batch} · {active.trips}
                  </div>
                </div>
                <div style={{ textAlign: "right" as const }}>
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 800,
                      color: INDIGO,
                      fontFamily: "'Plus Jakarta Sans',sans-serif",
                      lineHeight: 1,
                    }}
                  >
                    #{active.position}
                  </div>
                  <div style={{ fontSize: 11, color: "#6B7280", marginTop: 4 }}>
                    of {active.queueSize} waiting
                  </div>
                </div>
              </div>
              <SecondaryBtn
                onClick={() => onViewBatch(active.batchId)}
                style={{ marginTop: 10, width: "100%", justifyContent: "center" }}
              >
                View batch
              </SecondaryBtn>
            </div>
          )}
          <div style={{ fontSize: 12, fontWeight: 600, color: "#6B7280" }}>
            All waitlisted products
          </div>
          <div className="space-y-2">
            {sorted.map((entry) => {
              const isActive = active?.id === entry.id
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => onSelect(entry.id)}
                  aria-pressed={isActive}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    background: isActive ? "#EEF0FF" : "#fff",
                    border: `1px solid ${isActive ? "#C7CBFF" : "#E5E7EB"}`,
                    borderRadius: 8,
                    padding: "10px 12px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <Clock3
                    size={16}
                    aria-hidden="true"
                    style={{ color: isActive ? INDIGO : "#9CA3AF", flexShrink: 0 }}
                  />
                  <div className="flex-1">
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#111827",
                      }}
                    >
                      {entry.product}
                    </div>
                    <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 1 }}>
                      {entry.seller} · {entry.trips}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      color: INDIGO,
                      fontFamily: "'Plus Jakarta Sans',sans-serif",
                    }}
                  >
                    #{entry.position}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </Modal>
  )
}
