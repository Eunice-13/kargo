import { useRef } from "react"
import { UploadCloud, X } from "lucide-react"
import { INDIGO } from "@/constants/theme"

// Clear, clickable QR upload control (dashed dropzone + icon + label), with a
// preview once a file is chosen or when an existing QR is present. Replaces the
// bare, easy-to-miss <input type="file"> "Choose File" control.
export default function QrUploadField({
  file,
  setFile,
  currentUrl,
  label = "Payment QR Code",
}: {
  file: File | null
  setFile: (f: File | null) => void
  currentUrl?: string
  label?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const previewUrl = file ? URL.createObjectURL(file) : currentUrl

  return (
    <div>
      <label
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "#374151",
          display: "block",
          marginBottom: 5,
        }}
      >
        {label} <span style={{ color: "#9CA3AF", fontWeight: 400 }}>(optional)</span>
      </label>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />

      {previewUrl ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            border: "1px solid #E5E7EB",
            borderRadius: 8,
            padding: 10,
          }}
        >
          <img
            src={previewUrl}
            alt="Payment QR preview"
            style={{ width: 56, height: 56, borderRadius: 6, objectFit: "cover", border: "1px solid #E5E7EB" }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}>
              {file ? file.name : "Current QR"}
            </div>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: INDIGO,
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "2px 0 0",
              }}
            >
              Change image
            </button>
          </div>
          {file && (
            <button
              type="button"
              aria-label="Remove selected image"
              onClick={() => setFile(null)}
              style={{ border: "none", background: "none", cursor: "pointer", color: "#9CA3AF", padding: 4 }}
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            border: "2px dashed #C7CBD9",
            borderRadius: 8,
            background: "#F9FAFB",
            padding: "18px 12px",
            cursor: "pointer",
            color: "#6B7280",
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLElement
            el.style.borderColor = INDIGO
            el.style.background = "#EEF0FF"
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLElement
            el.style.borderColor = "#C7CBD9"
            el.style.background = "#F9FAFB"
          }}
        >
          <UploadCloud size={22} color={INDIGO} aria-hidden="true" />
          <span style={{ fontSize: 13, fontWeight: 600, color: INDIGO }}>
            Click to upload QR image
          </span>
          <span style={{ fontSize: 11, color: "#9CA3AF" }}>
            PNG or JPG — buyers scan this at checkout
          </span>
        </button>
      )}
    </div>
  )
}
