import { useState, useEffect, useLayoutEffect, useRef } from "react"
import { ArrowLeft } from "lucide-react"
import { INDIGO, CORAL } from "@/constants/theme"
import { PrimaryBtn } from "@/components/shared"
import type { Role } from "@/types"

// ─── Onboarding spotlight ─────────────────────────────────────────────────────
export const TOUR_STEPS = [
  {
    selector: "[data-spotlight='batches-tab']",
    headline: "Welcome Home to Kargo 👋",
    copy: "Browse pasabuy batches from sellers and find items you want to claim.",
  },
  {
    selector: "[data-spotlight='claims-tab']",
    headline: "My Claims",
    copy: "Review the items you have claimed and see which ones are ready to pay.",
  },
  {
    selector: "[data-spotlight='dashboard-tab']",
    headline: "Dashboard",
    copy: "Check your active claims, deadlines, and order status at a glance.",
  },
  {
    selector: "[data-spotlight='payments-tab']",
    headline: "Payment History",
    copy: "Review your payments and deadlines, and upload a receipt for an order that needs payment.",
  },
]
const SELLER_TOUR_STEPS = [
  {
    selector: "[data-spotlight='dashboard-tab']",
    headline: "Dashboard",
    copy: "Track your claims, pending payments, waitlist positions, and upcoming deadlines.",
  },
  {
    selector: "[data-spotlight='batches-tab']",
    headline: "Batches",
    copy: "Create and manage your pasabuy batches and the items available to buyers.",
  },
  {
    selector: "[data-spotlight='claims-tab']",
    headline: "Orders",
    copy: "Review the orders buyers have placed for your batches and manage their status.",
  },
  {
    selector: "[data-spotlight='payments-tab']",
    headline: "Payments",
    copy: "Review completed payments and transaction details for your orders.",
  },
]

export default function Onboarding({
  onDone,
  role,
}: {
  onDone: () => void
  role: Role
}) {
  const tourSteps = role === "Seller" ? SELLER_TOUR_STEPS : TOUR_STEPS
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [dir, setDir] = useState<"l" | "r">("l")
  const [contentKey, setContentKey] = useState(0)
  const [tooltipPosition, setTooltipPosition] = useState<{
    left: number
    top: number
  } | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const updateRect = () => {
      const el = document.querySelector(tourSteps[step].selector) as HTMLElement | null
      setRect(el?.getBoundingClientRect() ?? null)
    }
    updateRect()
    window.addEventListener("resize", updateRect)
    window.addEventListener("orientationchange", updateRect)
    window.addEventListener("scroll", updateRect, true)
    return () => {
      window.removeEventListener("resize", updateRect)
      window.removeEventListener("orientationchange", updateRect)
      window.removeEventListener("scroll", updateRect, true)
    }
  }, [step, tourSteps])

  const tooltipW = Math.min(340, window.innerWidth - 24)

  useLayoutEffect(() => {
    const tooltip = tooltipRef.current
    if (!rect || !tooltip) {
      setTooltipPosition(null)
      return
    }
    const { width, height } = tooltip.getBoundingClientRect()
    const left = Math.max(
      12,
      Math.min(window.innerWidth - width - 12, rect.left + rect.width / 2 - width / 2),
    )
    const below = rect.bottom + PAD + 14
    const above = rect.top - PAD - 14 - height
    const placeBelow = below + height <= window.innerHeight - 12
    const preferredTop = placeBelow ? below : above
    const top = Math.max(12, Math.min(window.innerHeight - height - 12, preferredTop))
    setTooltipPosition({ left, top })
  }, [rect, step, contentKey, tooltipW])

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow
    const previousDocumentOverflow = document.documentElement.style.overflow
    document.body.style.overflow = "hidden"
    document.documentElement.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousDocumentOverflow
    }
  }, [])

  const go = (next: number, d: "l" | "r") => {
    setDir(d)
    setContentKey((k) => k + 1)
    setStep(next)
  }

  const PAD = 10
  const sx = rect ? Math.max(0, rect.left - PAD) : 0
  const sy = rect ? Math.max(0, rect.top - PAD) : 0
  const sw = rect ? Math.min(rect.width + PAD * 2, window.innerWidth - sx) : 0
  const sh = rect ? Math.min(rect.height + PAD * 2, window.innerHeight - sy) : 0
  const ringX = Math.max(0, sx - 4)
  const ringY = Math.max(0, sy - 4)
  const ringW = Math.min(sw + 8, window.innerWidth - ringX)
  const ringH = Math.min(sh + 8, window.innerHeight - ringY)
  const tooltipX = tooltipPosition?.left ?? 12
  const isLast = step === tourSteps.length - 1

  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 198 }} />
      <div
        style={{
          position: "fixed",
          zIndex: 199,
          pointerEvents: "none",
          top: sy,
          left: sx,
          width: sw,
          height: sh,
          borderRadius: 10,
          boxShadow: "0 0 0 9999px rgba(10,10,30,0.68)",
          transition:
            "top 0.3s ease-in-out,left 0.3s ease-in-out,width 0.3s ease-in-out,height 0.3s ease-in-out",
          opacity: rect ? 1 : 0,
        }}
      />
      {rect && (
        <div
          style={{
            position: "fixed",
            zIndex: 200,
            pointerEvents: "none",
            top: ringY,
            left: ringX,
            width: ringW,
            height: ringH,
            borderRadius: 14,
            border: `2px solid ${CORAL}`,
            animation: "ping 1.8s ease-out infinite",
            transition:
              "top 0.3s ease-in-out,left 0.3s ease-in-out,width 0.3s ease-in-out,height 0.3s ease-in-out",
          }}
        />
      )}
      {rect && (
        <div
          style={{
            position: "fixed",
            zIndex: 200,
            pointerEvents: "none",
            top: ringY,
            left: ringX,
            width: ringW,
            height: ringH,
            borderRadius: 14,
            border: `2px solid ${CORAL}`,
            animation: "ping 1.8s ease-out 0.7s infinite",
            transition:
              "top 0.3s ease-in-out,left 0.3s ease-in-out,width 0.3s ease-in-out,height 0.3s ease-in-out",
          }}
        />
      )}
      {rect && (
        <div
          ref={tooltipRef}
          className="onboarding-tour-tooltip"
          style={{
            position: "fixed",
            zIndex: 201,
            top: tooltipPosition?.top ?? 12,
            left: tooltipX,
            width: tooltipW,
            maxHeight: "calc(100dvh - 24px)",
            boxSizing: "border-box",
            overflowY: "auto",
            background: "#fff",
            borderRadius: 12,
            boxShadow: "0 12px 40px rgba(0,0,0,0.24)",
            border: "1px solid #E5E7EB",
            transition: "top 0.3s ease-in-out,left 0.3s ease-in-out",
            visibility: tooltipPosition ? "visible" : "hidden",
          }}
        >
          <div
            style={{
              height: 3,
              background: "#F3F4F6",
              borderRadius: "12px 12px 0 0",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                background: INDIGO,
                width: `${((step + 1) / tourSteps.length) * 100}%`,
                transition: "width 0.3s cubic-bezier(.22,1,.36,1)",
              }}
            />
          </div>
          <div style={{ padding: "16px 18px 14px" }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                {tourSteps.map((_, i) => (
                  <span
                    key={i}
                    className="onboarding-tour-step"
                    style={{
                      width: 8,
                      height: 8,
                      flex: "0 0 8px",
                      borderRadius: 999,
                      background: i === step ? INDIGO : "#E5E7EB",
                      transition: "all 0.3s cubic-bezier(.22,1,.36,1)",
                    }}
                  />
                ))}
              </div>
              <button
                onClick={onDone}
                style={{
                  fontSize: 11,
                  color: "#9CA3AF",
                  fontWeight: 600,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Skip tour
              </button>
            </div>
            <div key={contentKey} className={dir === "l" ? "pl" : "pr"}>
              <h3
                style={{
                  fontFamily: "'Josefin Sans',sans-serif",
                  fontSize: 16,
                  fontWeight: 800,
                  color: "#111827",
                  marginBottom: 6,
                }}
              >
                {tourSteps[step].headline}
              </h3>
              <p
                style={{
                  fontSize: 12.5,
                  color: "#6B7280",
                  lineHeight: 1.6,
                  marginBottom: 14,
                }}
              >
                {tourSteps[step].copy}
              </p>
            </div>
            <div className="flex items-center justify-between">
              <button
                onClick={() => go(step - 1, "r")}
                style={{
                  fontSize: 12,
                  color: "#9CA3AF",
                  fontWeight: 600,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  visibility: step === 0 ? "hidden" : "visible",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <ArrowLeft size={13} aria-hidden="true" /> Back
              </button>
              <PrimaryBtn
                onClick={() => (isLast ? onDone() : go(step + 1, "l"))}
                style={{
                  padding: "8px 20px",
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                {isLast ? (
                  "Get Started 🚀"
                ) : (
                  <>
                    Next{" "}
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                      <path
                        d="M3 6.5h7M8 4l2.5 2.5L8 9"
                        stroke="#fff"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </>
                )}
              </PrimaryBtn>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

