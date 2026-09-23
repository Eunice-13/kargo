import { useRef, useState } from "react"
import { Lock, FileText, Clock3, CheckCircle2, AlertTriangle } from "lucide-react"
import type { BirState } from "@/types"
import { CREAM } from "@/constants/theme"
import { clientHasDetectableQr, runBirVerification } from "./birVerification"
import { isSupabaseConfigured } from "@/lib/supabase"
import { kargoApi } from "@/services"
import { BIRBadge } from "@/components/shared"

// Shared BIR Registration Seal Badge upload + verification UI. Used by both the
// Sign Up seller flow and the standalone "Apply to Become a Seller" modal so the
// copy, dropzone, and multi-stage pipeline stay identical in both places.
export default function BirVerifier({
  birState,
  setBirState,
}: {
  birState: BirState
  setBirState: (s: BirState) => void
}) {
  const birRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState("")

  const handleFile = async (file: File) => {
    setError("")
    setBirState("Uploading")
    // Client pre-check only — never grants access, just catches obviously
    // unreadable images before we send them down the pipeline.
    const hasQr = await clientHasDetectableQr(file)
    if (!hasQr) {
      setBirState("None")
      setError("We couldn't detect a QR code. Upload a clearer, correctly cropped badge and try again.")
      return
    }
    if (isSupabaseConfigured) {
      setBirState("Scanning")
      try {
        const outcome = await kargoApi.uploadBirBadge(file)
        setBirState(outcome.status === "verified" ? "Verified" : "None")
        if (outcome.status !== "verified") setError("We couldn't verify this badge. Check the image and try again.")
      } catch (uploadError) {
        setBirState("None")
        setError(uploadError instanceof Error ? uploadError.message : "Badge verification failed. Please try again.")
      }
      return
    }
    const outcome = await runBirVerification(file, (stage) =>
      setBirState(stage),
    )
    setBirState(outcome.status)
  }

  return (
    <div>
      {/* Instructions */}
      <div style={{ marginBottom: 10 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            fontSize: 13,
            fontWeight: 700,
            color: "#111827",
            fontFamily: "'Plus Jakarta Sans',sans-serif",
            marginBottom: 6,
          }}
        >
          <Lock size={15} aria-hidden="true" />
          BIR Registration Badge Verification
        </div>
        <ul
          style={{
            margin: 0,
            paddingLeft: 18,
            fontSize: 11.5,
            color: "#6B7280",
            lineHeight: 1.55,
          }}
        >
          <li>
            Please upload the standalone cropped image of your Registration Seal
            Badge containing your unique QR code.
          </li>
          <li>Do not upload your entire full-page COR.</li>
          <li>Ensure the QR code is clear and not blurry.</li>
          <li>
            Our system will instantly verify that your QR links to the official
            verify.bir.gov.ph domain. Counterfeit badges or altered links will
            result in immediate account suspension.
          </li>
        </ul>
      </div>

      <input
        ref={birRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
        }}
      />

      {/* Dropzone — unchanged visual style (dashed border, icon-in-center) */}
      {birState === "None" && (
        <div
          onClick={() => birRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label="Upload BIR Registration Seal Badge"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              birRef.current?.click()
            }
          }}
          style={{
            border: "2px dashed #D1D5DB",
            borderRadius: 8,
            padding: "18px 0",
            textAlign: "center",
            cursor: "pointer",
            background: CREAM,
          }}
        >
          <div
            style={{
              color: "#6B7280",
              marginBottom: 4,
              display: "flex",
              justifyContent: "center",
            }}
          >
            <FileText size={20} aria-hidden="true" />
          </div>
          <div style={{ fontSize: 12, color: "#6B7280" }}>
            Click to upload your Registration Seal Badge
          </div>
          <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
            Cropped badge image (PNG or JPG)
          </div>
        </div>
      )}

      {/* Pipeline progress — distinct message per stage */}
      {(birState === "Uploading" ||
        birState === "Scanning" ||
        birState === "Verifying") && (
        <div
          style={{
            border: "1px solid #E5E7EB",
            borderRadius: 8,
            padding: "14px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            color: "#374151",
            fontSize: 13,
          }}
        >
          <Clock3
            size={16}
            aria-hidden="true"
            className="animate-spin"
            style={{ flexShrink: 0, color: "#4F46E5" }}
          />
          <div>
            <div style={{ fontWeight: 600 }}>
              {birState === "Uploading"
                ? "Uploading badge…"
                : birState === "Scanning"
                  ? "Scanning QR code…"
                  : "Verifying badge domain…"}
            </div>
            <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
              Automated check · step{" "}
              {birState === "Uploading"
                ? "1"
                : birState === "Scanning"
                  ? "2"
                  : "3"}{" "}
              of 3
            </div>
          </div>
        </div>
      )}

      {/* Verified */}
      {birState === "Verified" && (
        <div
          style={{
            background: "#D4F5EA",
            border: "1px solid #6EE7B7",
            borderRadius: 8,
            padding: "12px 14px",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <CheckCircle2
            size={18}
            aria-hidden="true"
            style={{ color: "#0B7A59", flexShrink: 0 }}
          />
          <div style={{ fontSize: 12, fontWeight: 600, color: "#065F46" }}>
            Badge Verified — QR links to the official verify.bir.gov.ph domain.
            <div style={{ marginTop: 7 }}><BIRBadge size={15} /></div>
          </div>
        </div>
      )}

      {/* Flagged */}
      {error && (
        <div
          style={{
            background: "#FEE2E2",
            border: "1px solid #FCA5A5",
            borderRadius: 8,
            padding: "12px 14px",
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
          }}
        >
          <AlertTriangle
            size={18}
            aria-hidden="true"
            style={{ color: "#B91C1C", flexShrink: 0, marginTop: 1 }}
          />
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#991B1B" }}>
              Badge could not be verified
            </div>
            <div
              style={{
                fontSize: 11.5,
                color: "#B91C1C",
                marginTop: 3,
                lineHeight: 1.5,
              }}
            >
              {error}
            </div>
            <button
              type="button"
              onClick={() => {
                setError("")
                setBirState("None")
                birRef.current?.click()
              }}
              style={{
                marginTop: 8,
                fontSize: 11,
                fontWeight: 700,
                color: "#B91C1C",
                background: "none",
                border: "1px solid #FCA5A5",
                borderRadius: 6,
                padding: "4px 10px",
                cursor: "pointer",
              }}
            >
              Try a different image
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
