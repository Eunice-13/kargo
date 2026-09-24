import { useRef, useEffect } from "react"
import { createPortal } from "react-dom"
import type React from "react"

// Height of the sticky nav header — popups start below this so they never
// cover the nav bar (keep in sync with Header.tsx height).
const HEADER_HEIGHT = 56

export default function Modal({
  title,
  onClose,
  children,
  width = 480,
  topOffset = HEADER_HEIGHT,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
  width?: number
  topOffset?: number
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useRef(`modal-title-${Math.random().toString(36).slice(2, 9)}`).current
  const triggerElRef = useRef<HTMLElement | null>(null)

  // Remember what had focus before the modal opened, and restore it on close.
  useEffect(() => {
    triggerElRef.current = document.activeElement as HTMLElement | null
    return () => {
      triggerElRef.current?.focus?.()
    }
  }, [])

  // Lock the background page from scrolling while the modal is open, so nothing
  // behind the popup moves. Restore the previous overflow on close.
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  // Move focus into the dialog on mount.
  useEffect(() => {
    const node = dialogRef.current
    if (!node) return
    const focusable = node.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    )
    ;(focusable[0] || node).focus()
  }, [])

  // Escape-to-close and a Tab focus trap scoped to this dialog.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== "Tab") return
      const node = dialogRef.current
      if (!node) return
      const focusable = Array.from(
        node.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null)
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener("keydown", handleKeyDown, true)
    return () => document.removeEventListener("keydown", handleKeyDown, true)
  }, [onClose])

  return createPortal(
    <div
      className="fi"
      style={{
        // Portaled to document.body so `position: fixed` resolves against the
        // viewport, not the transform-animated app wrapper (.pu). The overlay
        // starts below the configured nav header so a popup never covers it, and
        // centers the dialog within the area beneath it.
        position: "fixed",
        top: topOffset,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        boxSizing: "border-box",
        zIndex: 1000,
        backdropFilter: "blur(2px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="si"
        style={{
          background: "#fff",
          borderRadius: 12,
          width: "100%",
          maxWidth: width,
          maxHeight: `calc(100dvh - ${topOffset + 32}px)`,
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          padding: 28,
          outline: "none",
          boxSizing: "border-box",
        }}
      >
        <div className="flex items-center justify-between mb-5" style={{ flexShrink: 0 }}>
          <h3
            id={titleId}
            style={{
              fontFamily: "'Plus Jakarta Sans',sans-serif",
              fontSize: 17,
              fontWeight: 700,
              color: "#111827",
            }}
          >
            {title}
          </h3>
          <button
            type="button"
            aria-label={`Close ${title}`}
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
        {/* Only the content scrolls; the header and the dialog stay put. */}
        <div style={{ overflowY: "auto", flex: "1 1 auto", minHeight: 0, marginRight: -4, paddingRight: 4 }}>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
