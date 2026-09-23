import { useState } from "react"
import { Share2, Check } from "lucide-react"
import { INDIGO } from "@/constants/theme"
import { shareBatchLink } from "./shareLink"

// Share/Copy-link button for a batch (3.1). Visible to both buyers and sellers.
// Compact icon-only variant for grid cards; labelled variant for the batch page.
export default function ShareButton({
  batchId,
  title,
  compact = false,
  label = "Share",
}: {
  batchId: number | string
  title?: string
  compact?: boolean
  label?: string
}) {
  const [copied, setCopied] = useState(false)

  const onShare = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const result = await shareBatchLink(batchId, title)
    if (result === "copied") {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    }
  }

  if (compact) {
    return (
      // Icon-only on desktop; on phones (.kargo-sharebtn-compact rules) it grows
      // to a 44px labelled control so the action is discoverable and tappable.
      <button
        type="button"
        onClick={onShare}
        aria-label={`Share ${title ?? "batch"}`}
        title="Copy shareable link"
        className="kargo-sharebtn-compact"
        style={{
          width: 30,
          height: 30,
          display: "grid",
          placeItems: "center",
          gap: 6,
          borderRadius: 7,
          border: "1px solid #E5E7EB",
          background: "#fff",
          color: copied ? "#0B7A59" : "#6B7280",
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        {copied ? (
          <Check size={14} aria-hidden="true" />
        ) : (
          <Share2 size={14} aria-hidden="true" />
        )}
        {/* Hidden on desktop; revealed beside the icon on mobile via CSS. */}
        <span className="kargo-sharebtn-label">{copied ? "Copied" : "Share"}</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onShare}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12,
        fontWeight: 600,
        color: copied ? "#0B7A59" : INDIGO,
        background: copied ? "#D4F5EA" : "#EEF0FF",
        border: "none",
        borderRadius: 7,
        padding: "7px 12px",
        cursor: "pointer",
      }}
    >
      {copied ? (
        <>
          <Check size={14} aria-hidden="true" /> Link copied
        </>
      ) : (
        <>
          <Share2 size={14} aria-hidden="true" /> {label}
        </>
      )}
    </button>
  )
}
