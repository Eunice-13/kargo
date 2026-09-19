import { useState, useEffect } from "react"
import { INDIGO, CORAL } from "@/constants/theme"
import { PrimaryBtn } from "@/components/shared"

// ─── Onboarding spotlight ─────────────────────────────────────────────────────
export const TOUR_STEPS = [
  {
    selector: "[data-spotlight='dashboard-tab']",
    headline: "Welcome to Kargo 👋",
    copy: "Your pasabuy command center. The Dashboard shows your active claims, deadlines, and order status at a glance.",
  },
  {
    selector: "[data-spotlight='batches-tab']",
    headline: "Claim items from batches",
    copy: "Sellers post trip batches here. Browse items, claim your slot before it fills up, and track status in real time.",
  },
  {
    selector: "[data-spotlight='payments-tab']",
    headline: "Pay before the countdown hits zero",
    copy: "All pending payments and deadlines are here. Upload your GCash or bank receipt to lock in your order.",
  },
  {
    selector: "[data-spotlight='role-toggle']",
    headline: "One account, two roles",
    copy: "Toggle to Seller mode to create your own pasabuy batch and manage buyers — no separate account needed.",
  },
]
export default function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [dir, setDir] = useState<"l" | "r">("l")
  const [contentKey, setContentKey] = useState(0)

  useEffect(() => {
    const el = document.querySelector(
      TOUR_STEPS[step].selector,
    ) as HTMLElement | null
    if (el) setRect(el.getBoundingClientRect())
  }, [step])

  const go = (next: number, d: "l" | "r") => {
    setDir(d)
    setContentKey((k) => k + 1)
    setStep(next)
  }

  const PAD = 10
  const sw = rect ? rect.width + PAD * 2 : 0
  const sh = rect ? rect.height + PAD * 2 : 0
  const sx = rect ? rect.left - PAD : 0
  const sy = rect ? rect.top - PAD : 0
  const tooltipW = 340
  const tooltipX = rect
    ? Math.max(
        12,
        Math.min(
          window.innerWidth - tooltipW - 12,
          rect.left + rect.width / 2 - tooltipW / 2,
        ),
      )
    : 0
  const tooltipY = rect ? sy + sh + 14 : 0
  const arrowX = rect ? rect.left + rect.width / 2 - tooltipX : tooltipW / 2
  const isLast = step === TOUR_STEPS.length - 1

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
            top: sy - 4,
            left: sx - 4,
            width: sw + 8,
            height: sh + 8,
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
            top: sy - 4,
            left: sx - 4,
            width: sw + 8,
            height: sh + 8,
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
          style={{
            position: "fixed",
            zIndex: 201,
            top: tooltipY,
            left: tooltipX,
            width: tooltipW,
            background: "#fff",
            borderRadius: 12,
            boxShadow: "0 12px 40px rgba(0,0,0,0.24)",
            border: "1px solid #E5E7EB",
            transition: "top 0.3s ease-in-out,left 0.3s ease-in-out",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -7,
              left: Math.max(14, Math.min(tooltipW - 24, arrowX - 7)),
              width: 14,
              height: 14,
              background: "#fff",
              transform: "rotate(45deg)",
              border: "1px solid #E5E7EB",
              borderRight: "none",
              borderBottom: "none",
            }}
          />
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
                width: `${((step + 1) / TOUR_STEPS.length) * 100}%`,
                transition: "width 0.3s cubic-bezier(.22,1,.36,1)",
              }}
            />
          </div>
          <div style={{ padding: "16px 18px 14px" }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                {TOUR_STEPS.map((_, i) => (
                  <div
                    key={i}
                    onClick={() => go(i, i > step ? "l" : "r")}
                    role="button"
                    tabIndex={0}
                    aria-label={`Go to tour step ${i + 1} of ${TOUR_STEPS.length}`}
                    aria-current={i === step ? "step" : undefined}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        go(i, i > step ? "l" : "r")
                      }
                    }}
                    style={{
                      width: i === step ? 16 : 6,
                      height: 6,
                      borderRadius: 999,
                      background: i === step ? INDIGO : "#E5E7EB",
                      transition: "all 0.3s cubic-bezier(.22,1,.36,1)",
                      cursor: "pointer",
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
                  fontFamily: "'Plus Jakarta Sans',sans-serif",
                  fontSize: 16,
                  fontWeight: 800,
                  color: "#111827",
                  marginBottom: 6,
                }}
              >
                {TOUR_STEPS[step].headline}
              </h3>
              <p
                style={{
                  fontSize: 12.5,
                  color: "#6B7280",
                  lineHeight: 1.6,
                  marginBottom: 14,
                }}
              >
                {TOUR_STEPS[step].copy}
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
                }}
              >
                ← Back
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

