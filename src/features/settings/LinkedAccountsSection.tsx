import { useState } from "react"
import { Check, Eye, EyeOff, Link2, Plus, Trash2 } from "lucide-react"
import { PrimaryBtn } from "@/components/shared"
import { GREEN, INDIGO } from "@/constants/theme"

const PLATFORMS = ["Facebook", "Instagram", "TikTok", "Viber", "Messenger", "Website", "Other"]

export default function LinkedAccountsSection({
  links,
  setLinks,
  visibility,
  setVisibility,
  onSave,
  saved,
  saving,
}: {
  links: Record<string, string>
  setLinks: (links: Record<string, string>) => void
  visibility: Record<string, boolean>
  setVisibility: (visibility: Record<string, boolean>) => void
  onSave: () => void
  saved: boolean
  saving: boolean
}) {
  const [platform, setPlatform] = useState("TikTok")
  const available = PLATFORMS.filter((item) => !(item in links))

  const addPlatform = () => {
    const next = available.includes(platform) ? platform : available[0]
    if (next) {
      setLinks({ ...links, [next]: "" })
      setVisibility({ ...visibility, [next]: true })
    }
  }

  return (
    <div className="pr">
      <h3 style={{ fontFamily: "'Josefin Sans',sans-serif", fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 4 }}>
        Social & Contact Links
      </h3>
      <p style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 20 }}>
        Add the channels others can use to reach you. These are public profile references shown on your profile.
      </p>

      <div className="space-y-3">
        {Object.entries(links).map(([name, value]) => (
          <div key={name} style={{ border: "1px solid #E5E7EB", borderRadius: 10, padding: 14, display: "grid", gridTemplateColumns: "125px 1fr auto 34px", alignItems: "center", gap: 10 }}>
            <label htmlFor={`social-${name}`} style={{ fontSize: 13, fontWeight: 700, color: "#374151", display: "flex", alignItems: "center", gap: 6 }}>
              <Link2 size={14} color={INDIGO} aria-hidden="true" /> {name}
            </label>
            <input
              id={`social-${name}`}
              value={value}
              onChange={(event) => setLinks({ ...links, [name]: event.target.value })}
              placeholder={name === "Viber" ? "+63 9XX XXX XXXX" : `https://${name.toLowerCase()}.com/your-profile`}
              style={{ width: "100%", border: "1px solid #D1D5DB", borderRadius: 7, padding: "8px 10px", fontSize: 12, boxSizing: "border-box" }}
            />
            <button
              type="button"
              aria-pressed={visibility[name] !== false}
              onClick={() => setVisibility({ ...visibility, [name]: visibility[name] === false })}
              style={{ border: "1px solid #D1D5DB", background: visibility[name] === false ? "#F9FAFB" : "#EEF0FF", color: visibility[name] === false ? "#6B7280" : INDIGO, borderRadius: 7, padding: "7px 9px", fontSize: 11, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              {visibility[name] === false ? <EyeOff size={13} /> : <Eye size={13} />}
              {visibility[name] === false ? "Hidden" : "Public"}
            </button>
            <button
              type="button"
              aria-label={`Remove ${name}`}
              onClick={() => {
                setLinks(Object.fromEntries(Object.entries(links).filter(([key]) => key !== name)))
                setVisibility(Object.fromEntries(Object.entries(visibility).filter(([key]) => key !== name)))
              }}
              style={{ width: 32, height: 32, display: "grid", placeItems: "center", border: "none", borderRadius: 7, background: "#FEE2E2", color: "#991B1B", cursor: "pointer" }}
            >
              <Trash2 size={14} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>

      {available.length > 0 && (
        <div className="flex items-center gap-2 mt-4">
          <select
            value={available.includes(platform) ? platform : available[0]}
            onChange={(event) => setPlatform(event.target.value)}
            style={{ border: "1px solid #D1D5DB", borderRadius: 7, padding: "8px 10px", fontSize: 12, background: "white" }}
          >
            {available.map((item) => <option key={item}>{item}</option>)}
          </select>
          <button type="button" onClick={addPlatform} style={{ border: `1px solid ${INDIGO}`, background: "#EEF0FF", color: INDIGO, borderRadius: 7, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}>
            <Plus size={14} aria-hidden="true" /> Add link
          </button>
        </div>
      )}

      <div className="flex items-center justify-end gap-3 mt-6">
        {saved && <span style={{ fontSize: 12, color: GREEN, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}><Check size={13} /> Links saved!</span>}
        <PrimaryBtn onClick={onSave} disabled={saving}>{saving ? "Saving…" : "Save Links"}</PrimaryBtn>
      </div>
    </div>
  )
}
