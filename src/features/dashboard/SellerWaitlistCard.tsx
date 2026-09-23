import { useState } from "react"
import { ChevronDown, ChevronUp, Users, ArrowUpRight, Check } from "lucide-react"
import type { SellerWaitlistGroup } from "@/types"
import { INDIGO, CYAN_L, GREEN } from "@/constants/theme"
import { Card, Avatar, PrimaryBtn } from "@/components/shared"

// Seller-facing waitlist: one row per product that has waiting buyers. Each row
// expands to reveal the ordered queue (join order) with a contact link where
// the buyer has one. Buyers never see this — they only see their own position.
export default function SellerWaitlistCard({
  groups,
  responseHours,
  onSaveResponseHours,
}: {
  groups: SellerWaitlistGroup[]
  responseHours: number
  onSaveResponseHours: (hours: number) => Promise<void> | void
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [hours, setHours] = useState(String(responseHours || 24))
  const [savingHours, setSavingHours] = useState(false)
  const [savedHours, setSavedHours] = useState(false)
  const dirty = Number(hours) > 0 && Number(hours) !== responseHours

  const saveHours = async () => {
    if (!dirty) return
    setSavingHours(true)
    try {
      await onSaveResponseHours(Math.max(1, Math.floor(Number(hours))))
      setSavedHours(true)
      setTimeout(() => setSavedHours(false), 2000)
    } finally {
      setSavingHours(false)
    }
  }

  return (
    <Card>
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: "#111827",
          fontFamily: "'Plus Jakarta Sans',sans-serif",
          marginBottom: 14,
          display: "flex",
          alignItems: "center",
          gap: 7,
        }}
      >
        <Users size={15} aria-hidden="true" /> Waitlisted Items
      </div>

      {/* Seller-configurable response window for partial-match offers. */}
      <div
        style={{
          background: "#F9FAFB",
          border: "1px solid #E5E7EB",
          borderRadius: 8,
          padding: "10px 12px",
          marginBottom: 14,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>
          Waitlist response window
        </div>
        <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2, marginBottom: 8 }}>
          How long a waitlisted buyer has to accept a partial-stock offer before
          it passes to the next person. Full-match offers are claimed
          automatically and are not affected.
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="number"
            min="1"
            max="168"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            style={{
              width: 72,
              fontSize: 13,
              border: "1px solid #E5E7EB",
              borderRadius: 7,
              padding: "7px 10px",
              outline: "none",
              color: "#374151",
            }}
          />
          <span style={{ fontSize: 12, color: "#6B7280" }}>hours</span>
          <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 8 }}>
            {savedHours && (
              <span
                style={{
                  fontSize: 11,
                  color: GREEN,
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                <Check size={12} aria-hidden="true" /> Saved
              </span>
            )}
            <PrimaryBtn size="sm" onClick={saveHours} disabled={!dirty || savingHours}>
              {savingHours ? "Saving…" : "Save"}
            </PrimaryBtn>
          </span>
        </div>
      </div>

      {groups.length === 0 ? (
        <div style={{ fontSize: 12.5, color: "#9CA3AF", padding: "8px 0" }}>
          No one is waitlisted on your items yet.
        </div>
      ) : (
        <div className="space-y-2">
          {groups.slice(0, 4).map((group) => {
            const open = openId === group.productId
            return (
              <div
                key={group.productId}
                style={{
                  border: "1px solid #E5E7EB",
                  borderRadius: 8,
                  overflow: "hidden",
                }}
              >
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : group.productId)}
                  aria-expanded={open}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    background: open ? "#F9FAFB" : "#fff",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#111827",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {group.product}
                    </div>
                    {group.batch && (
                      <div style={{ fontSize: 11, color: "#9CA3AF" }}>
                        {group.batch}
                      </div>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#0369A1",
                      background: CYAN_L,
                      borderRadius: 999,
                      padding: "2px 9px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {group.queue.length} waiting
                  </span>
                  <span style={{ color: "#9CA3AF", display: "flex" }}>
                    {open ? (
                      <ChevronUp size={16} aria-hidden="true" />
                    ) : (
                      <ChevronDown size={16} aria-hidden="true" />
                    )}
                  </span>
                </button>

                {open && (
                  <div
                    className="fi"
                    style={{ borderTop: "1px solid #E5E7EB", padding: "6px 12px 10px" }}
                  >
                    {group.queue.map((entry) => (
                      <div
                        key={`${group.productId}-${entry.position}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "7px 0",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            color: INDIGO,
                            width: 22,
                            flexShrink: 0,
                          }}
                        >
                          #{entry.position}
                        </span>
                        <Avatar name={entry.buyer} size={26} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 12.5,
                              fontWeight: 600,
                              color: "#111827",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {entry.buyer}
                          </div>
                          <div style={{ fontSize: 10.5, color: "#9CA3AF" }}>
                            wants ×{entry.desiredQuantity}
                          </div>
                        </div>
                        {entry.buyerFb ? (
                          <a
                            href={entry.buyerFb}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: INDIGO,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 3,
                              textDecoration: "none",
                              flexShrink: 0,
                            }}
                          >
                            Contact <ArrowUpRight size={12} aria-hidden="true" />
                          </a>
                        ) : (
                          <span style={{ fontSize: 10.5, color: "#B0B7C3", flexShrink: 0 }}>
                            No link
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          {groups.length > 4 && (
            <div style={{ fontSize: 11, color: "#9CA3AF", textAlign: "center", paddingTop: 2 }}>
              +{groups.length - 4} more waitlisted item{groups.length - 4 !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
