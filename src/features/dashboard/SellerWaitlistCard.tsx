import { useState } from "react"
import { ArrowUpRight, Check, ChevronDown, ChevronUp, Users } from "lucide-react"
import type { SellerWaitlistGroup } from "@/types"
import { Avatar, Card, Modal, PrimaryBtn } from "@/components/shared"

function WaitlistGroups({
  groups,
  openId,
  onToggle,
}: {
  groups: SellerWaitlistGroup[]
  openId: string | null
  onToggle: (id: string) => void
}) {
  return (
    <div className="seller-waitlist-groups space-y-2">
      {groups.map((group) => {
        const open = openId === group.productId
        return (
          <div className="seller-waitlist-group" key={group.productId}>
            <button
              type="button"
              onClick={() => onToggle(group.productId)}
              aria-expanded={open}
              className="seller-waitlist-group__toggle"
            >
              <div>
                <strong>{group.product}</strong>
                {group.batch && <small>{group.batch}</small>}
              </div>
              <span className="seller-waitlist-count">
                {group.queue.length} waiting
              </span>
              {open ? (
                <ChevronUp size={16} aria-hidden="true" />
              ) : (
                <ChevronDown size={16} aria-hidden="true" />
              )}
            </button>

            {open && (
              <div className="seller-waitlist-queue fi">
                {group.queue.map((entry) => (
                  <div
                    className="seller-waitlist-entry"
                    key={`${group.productId}-${entry.position}`}
                  >
                    <span>#{entry.position}</span>
                    <Avatar name={entry.buyer} size={26} />
                    <div>
                      <strong>{entry.buyer}</strong>
                      <small>wants ×{entry.desiredQuantity}</small>
                    </div>
                    {entry.buyerFb ? (
                      <a href={entry.buyerFb} target="_blank" rel="noopener noreferrer">
                        Contact <ArrowUpRight size={12} aria-hidden="true" />
                      </a>
                    ) : (
                      <small>No link</small>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

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
  const [showAll, setShowAll] = useState(false)
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

  const toggleGroup = (id: string) => setOpenId((current) => (current === id ? null : id))

  return (
    <Card className="seller-waitlist-card">
      <div className="seller-waitlist-card__header">
        <h2><Users size={16} aria-hidden="true" /> Waitlisted Items</h2>
        {groups.length > 0 && (
          <button type="button" onClick={() => setShowAll(true)}>
            View All
          </button>
        )}
      </div>

      <div className="seller-waitlist-window">
        <strong>Waitlist response window</strong>
        <div>
          <input
            type="number"
            min="1"
            max="168"
            value={hours}
            onChange={(event) => setHours(event.target.value)}
            aria-label="Waitlist response hours"
          />
          <span>hours</span>
          <span className="seller-waitlist-save">
            {savedHours && <em><Check size={12} aria-hidden="true" /> Saved</em>}
            <PrimaryBtn size="sm" onClick={saveHours} disabled={!dirty || savingHours}>
              {savingHours ? "Saving…" : "Save"}
            </PrimaryBtn>
          </span>
        </div>
      </div>

      <div className="seller-waitlist-preview">
        {groups.length === 0 ? (
          <p className="seller-waitlist-empty">No one is waitlisted on your items yet.</p>
        ) : (
          <WaitlistGroups
            groups={groups.slice(0, 2)}
            openId={openId}
            onToggle={toggleGroup}
          />
        )}
      </div>

      {showAll && (
        <Modal
          title="All Waitlisted Items"
          onClose={() => setShowAll(false)}
          width={680}
          topOffset={92}
        >
          <div className="seller-waitlist-modal-list">
            <WaitlistGroups groups={groups} openId={openId} onToggle={toggleGroup} />
          </div>
        </Modal>
      )}
    </Card>
  )
}
