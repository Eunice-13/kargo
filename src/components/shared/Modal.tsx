import { useRef, useEffect } from "react"
import type React from "react"

export default function Modal({
  title,
  onClose,
  children,
  width = 480,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
  width?: number
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

  return (
    <div
      className="fi"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
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
          width,
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          padding: 28,
          outline: "none",
        }}
      >
        <div className="flex items-center justify-between mb-5">
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
        {children}
      </div>
    </div>
  )
}
