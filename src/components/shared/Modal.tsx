import {
  CircleHelp,
  FilePenLine,
  ScanSearch,
  TriangleAlert,
  X,
} from "lucide-react"
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react"
import { createPortal } from "react-dom"
import type React from "react"

const HEADER_HEIGHT = 56
const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export type ModalVariant = "form" | "confirm" | "danger" | "detail"

function inferVariant(title: string): ModalVariant {
  const value = title.toLowerCase()
  if (/cancel|decline|reject|deny/.test(value)) return "danger"
  if (/detail|preview|receipt|summary|profile|waitlist|requests|contact/.test(value))
    return "detail"
  if (/mark |lock|unlock|approve|do you have|review claim/.test(value))
    return "confirm"
  return "form"
}

const VARIANT_ICONS = {
  form: FilePenLine,
  confirm: CircleHelp,
  danger: TriangleAlert,
  detail: ScanSearch,
} satisfies Record<ModalVariant, typeof FilePenLine>

export function useDialogA11y(onClose: () => void) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    triggerRef.current = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const dialog = dialogRef.current
    const firstFocusable = dialog?.querySelector<HTMLElement>(FOCUSABLE)
    ;(firstFocusable || dialog)?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation()
        onCloseRef.current()
        return
      }
      if (event.key !== "Tab" || !dialogRef.current) return

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((element) => element.offsetParent !== null)
      if (!focusable.length) {
        event.preventDefault()
        dialogRef.current.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", handleKeyDown, true)
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true)
      document.body.style.overflow = previousOverflow
      triggerRef.current?.focus?.()
    }
  }, [])

  return dialogRef
}

export default function Modal({
  title,
  onClose,
  children,
  footer,
  width = 480,
  topOffset = HEADER_HEIGHT,
  variant,
  showTitle = true,
  showTitleIcon = true,
  className = "",
  overlayClassName = "",
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
  width?: number
  topOffset?: number
  variant?: ModalVariant
  showTitle?: boolean
  showTitleIcon?: boolean
  className?: string
  overlayClassName?: string
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const triggerElRef = useRef<HTMLElement | null>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isClosing, setIsClosing] = useState(false)
  const resolvedVariant = variant ?? inferVariant(title)
  const VariantIcon = VARIANT_ICONS[resolvedVariant]

  const requestClose = useCallback(() => {
    if (closeTimerRef.current) return
    setIsClosing(true)
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches
    closeTimerRef.current = setTimeout(onClose, reducedMotion ? 0 : 180)
  }, [onClose])

  useEffect(() => {
    triggerElRef.current = document.activeElement as HTMLElement | null
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
      triggerElRef.current?.focus?.()
    }
  }, [])

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  useEffect(() => {
    const node = dialogRef.current
    if (!node) return
    const firstFocusable = node.querySelector<HTMLElement>(FOCUSABLE)
    ;(firstFocusable || node).focus()
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation()
        requestClose()
        return
      }
      if (event.key !== "Tab" || !dialogRef.current) return

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((element) => element.offsetParent !== null)
      if (!focusable.length) {
        event.preventDefault()
        dialogRef.current.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", handleKeyDown, true)
    return () => document.removeEventListener("keydown", handleKeyDown, true)
  }, [requestClose])

  return createPortal(
    <div
      className={`fi kargo-modal-overlay${isClosing ? " is-closing" : ""} ${overlayClassName}`}
      style={{ top: topOffset }}
      onClick={(event) => {
        if (event.target === event.currentTarget) requestClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-variant={resolvedVariant}
        className={`si kargo-modal${isClosing ? " is-closing" : ""} ${className}`}
        style={{
          maxWidth: width,
          maxHeight: `calc(100dvh - ${topOffset + 32}px)`,
        }}
      >
        <header
          className={`kargo-modal__header${showTitle ? "" : " kargo-modal__header--title-hidden"}`}
        >
          {showTitle ? (
            <div className="kargo-modal__title-group">
              {title && showTitleIcon && (
                <span className="kargo-modal__title-icon" aria-hidden="true">
                  <VariantIcon size={18} />
                </span>
              )}
              {title ? (
                <h3 id={titleId}>{title}</h3>
              ) : (
                <span id={titleId} className="sr-only">
                  Dialog
                </span>
              )}
            </div>
          ) : (
            <span id={titleId} className="sr-only">
              {title || "Dialog"}
            </span>
          )}
          <button
            type="button"
            className="kargo-modal__close"
            aria-label={title ? `Close ${title}` : "Close dialog"}
            onClick={requestClose}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className="kargo-modal__body">
          <div className="kargo-modal__content">{children}</div>
        </div>
        {footer}
      </div>
    </div>,
    document.body,
  )
}
