import { Clock3 } from "lucide-react"
import type { WaitlistEntry } from "@/types"
import { INDIGO, CYAN_L } from "@/constants/theme"
import { Modal, ProductThumb, SecondaryBtn } from "@/components/shared"
import { sortWaitlistUpcoming } from "@/data/waitlist"

export default function WaitlistModal({
  entries,
  activeId,
  onSelect,
  onClose,
  onViewBatch,
}: {
  entries: WaitlistEntry[]
  activeId: string | null
  onSelect: (id: string) => void
  onClose: () => void
  onViewBatch: (batchId: number) => void
}) {
  const sorted = sortWaitlistUpcoming(entries)
  const active =
    sorted.find((e) => e.id === activeId) ?? sorted[0] ?? null

  return (
    <Modal title="Your Waitlist" onClose={onClose} width={520}>
      {sorted.length === 0 ? (
        <div style={{ fontSize: 13, color: "#6B7280" }}>
          You are not on any product waitlists yet. Join a sold-out item from a
          batch to see it here.
        </div>
      ) : (
        <div className="space-y-4">
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
