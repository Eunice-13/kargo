import { useEffect, useState } from "react"
import { ArrowUpRight, Info, MessageCircleOff } from "lucide-react"
import { CREAM } from "@/constants/theme"
import { isSupabaseConfigured, requireSupabase } from "@/lib/supabase"
import Modal from "./Modal"
import PrimaryBtn from "./PrimaryBtn"
import SecondaryBtn from "./SecondaryBtn"
import Avatar from "./Avatar"
import BatchActionDialog from "./BatchActionDialog"
import { resolveContactUrl } from "./contactLink"

// Contact redirect modal — replaces the old in-app chat. Opens the other
// party's real contact link (Facebook/IG/etc.) in a new tab, or shows a
// fallback when they have not added one yet.
export default function ContactModal({
  name,
  context,
  contactUrl,
  sellerId,
  onClose,
  batchDetail = false,
}: {
  name: string
  context?: string
  contactUrl?: string
  // Used only when the caller could not resolve a link (for example a shop
  // profile fetch that failed). Lets the modal read the public profile itself
  // instead of claiming the seller never added one.
  sellerId?: string
  onClose: () => void
  batchDetail?: boolean
}) {
  const [fetchedUrl, setFetchedUrl] = useState<string | undefined>(undefined)
  const [checking, setChecking] = useState(
    () => !contactUrl && Boolean(sellerId) && isSupabaseConfigured,
  )

  useEffect(() => {
    setFetchedUrl(undefined)
    if (contactUrl || !sellerId || !isSupabaseConfigured) {
      setChecking(false)
      return
    }

    let active = true
    setChecking(true)

    void (async () => {
      try {
        const { data, error } = await requireSupabase()
          .from("public_profiles")
          .select("social_links")
          .eq("id", sellerId)
          .maybeSingle()

        if (active && !error) {
          setFetchedUrl(
            resolveContactUrl((data?.social_links as Record<string, string>) ?? {}),
          )
        }
      } catch {
        // Leave the link unresolved; the modal then shows the empty state.
      } finally {
        if (active) setChecking(false)
      }
    })()

    return () => {
      active = false
    }
  }, [contactUrl, sellerId])

  const resolvedUrl = contactUrl ?? fetchedUrl

  if (batchDetail) {
    return (
      <BatchActionDialog title="Contact" onClose={onClose} className="batch-contact">
        <div className="batch-contact__seller">
          <Avatar name={name} size={44} />
          <div className="batch-contact__seller-copy">
            <strong>{name}</strong>
            {context && <span>Re: {context}</span>}
          </div>
        </div>

        {resolvedUrl ? (
          <>
            <p className="batch-contact__message">
              KARGO doesn't handle messages in-app. Continue the conversation through the contact
              link shared by {name}.
            </p>
            <div className="batch-contact__actions">
              <button
                type="button"
                className="batch-action-primary"
                onClick={() => {
                  window.open(resolvedUrl, "_blank", "noopener,noreferrer")
                  onClose()
                }}
              >
                Open contact link <ArrowUpRight size={14} aria-hidden="true" />
              </button>
            </div>
          </>
        ) : checking ? (
          <p className="batch-contact__message">Checking the seller's contact link…</p>
        ) : (
          <>
            <div className="batch-contact__empty">
              <MessageCircleOff size={30} aria-hidden="true" />
              <strong>This user hasn't added a contact link yet</strong>
              <span>Ask them to add a Facebook or other contact link in their profile settings.</span>
            </div>
            <div className="batch-contact__actions">
              <button type="button" className="batch-action-primary" onClick={onClose}>
                Done
              </button>
            </div>
          </>
        )}

        <p className="batch-contact__notice">
          <Info size={15} aria-hidden="true" />
          <span>
            Links open in a new tab. Verify the destination before sharing personal details.
          </span>
        </p>
      </BatchActionDialog>
    )
  }

  return (
    <Modal
      title="Contact"
      onClose={onClose}
      width={420}
      showTitleIcon={false}
      className="contact-modal"
    >
      <div className="space-y-4">
        <div
          style={{
            background: CREAM,
            borderRadius: 8,
            padding: "10px 14px",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Avatar name={name} size={36} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>
              {name}
            </div>
            {context && (
              <div style={{ fontSize: 11, color: "#9CA3AF" }}>Re: {context}</div>
            )}
          </div>
        </div>

        {resolvedUrl ? (
          <>
            <p style={{ fontSize: 12.5, color: "#6B7280", lineHeight: 1.5 }}>
              KARGO doesn't handle messages in-app. Continue the conversation on
              {name.split(" ")[0]}'s contact link.
            </p>
            <div className="flex gap-3">
              <SecondaryBtn
                onClick={onClose}
              >
                Close
              </SecondaryBtn>
              <PrimaryBtn
                style={{ display: "flex", alignItems: "center", gap: 5 }}
                onClick={() => {
                  window.open(resolvedUrl, "_blank", "noopener,noreferrer")
                  onClose()
                }}
              >
                Open contact link <ArrowUpRight size={14} aria-hidden="true" />
              </PrimaryBtn>
            </div>
          </>
        ) : checking ? (
          <p style={{ fontSize: 12.5, color: "#6B7280", lineHeight: 1.5 }}>
            Checking the seller's contact link…
          </p>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                gap: 8,
                padding: "8px 0",
                color: "#9CA3AF",
              }}
            >
              <MessageCircleOff size={30} aria-hidden="true" />
              <div style={{ fontSize: 13, color: "#374151", fontWeight: 600 }}>
                This user hasn't added a contact link yet
              </div>
              <div style={{ fontSize: 11.5, color: "#9CA3AF" }}>
                Ask them to add a Facebook or other contact link in their
                profile settings.
              </div>
            </div>
            <PrimaryBtn
              style={{ width: "100%", display: "flex", justifyContent: "center" }}
              onClick={onClose}
            >
              Done
            </PrimaryBtn>
          </>
        )}
      </div>
      <p style={{ fontSize: 10.5, color: "#B0B7C3", marginTop: 12, textAlign: "center" }}>
        Links open in a new tab. Verify the destination before sharing personal
        details.
      </p>
    </Modal>
  )
}
