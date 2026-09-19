import { useRef, useState } from "react"
import { Check } from "lucide-react"
import { Avatar, PrimaryBtn, SecondaryBtn } from "@/components/shared"
import { GREEN } from "@/constants/theme"
import type { UserInfo } from "@/types"

type ProfileSectionProps = {
  user: UserInfo
  firstName: string
  setFirstName: (v: string) => void
  lastName: string
  setLastName: (v: string) => void
  email: string
  setEmail: (v: string) => void
  bio: string
  setBio: (v: string) => void
  saved: boolean
  saveProfile: () => void
}

export default function ProfileSection({
  user,
  firstName,
  setFirstName,
  lastName,
  setLastName,
  email,
  setEmail,
  bio,
  setBio,
  saved,
  saveProfile,
}: ProfileSectionProps) {
  const photoRef = useRef<HTMLInputElement>(null)
  const [photoName, setPhotoName] = useState<string | null>(null)
  return (
    <div className="pr">
      <h3
        style={{
          fontFamily: "'Plus Jakarta Sans',sans-serif",
          fontSize: 16,
          fontWeight: 700,
          color: "#111827",
          marginBottom: 20,
        }}
      >
        Profile
      </h3>
      <div className="flex items-center gap-5 mb-6">
        <Avatar name={user.name || "User"} size={64} />
        <div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "#111827",
              fontFamily: "'Plus Jakarta Sans',sans-serif",
            }}
          >
            {user.name || "—"}
          </div>
          <div style={{ fontSize: 13, color: "#9CA3AF" }}>
            {user.email || "—"} · Member since{" "}
            {new Date().toLocaleDateString("en-PH", {
              month: "long",
              year: "numeric",
            })}
          </div>
          <input
            ref={photoRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) setPhotoName(f.name)
            }}
          />
          <div className="flex items-center gap-2" style={{ marginTop: 8 }}>
            <SecondaryBtn onClick={() => photoRef.current?.click()}>
              Change Photo
            </SecondaryBtn>
            {photoName && (
              <span
                className="fi"
                style={{
                  fontSize: 12,
                  color: GREEN,
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Check size={13} aria-hidden="true" /> {photoName} selected
              </span>
            )}
          </div>
        </div>
      </div>
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: "1fr 1fr" }}
      >
        {[
          ["First Name", firstName, setFirstName],
          ["Last Name", lastName, setLastName],
        ].map(([label, val, set]) => (
          <div key={label as string}>
            <label
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#374151",
                display: "block",
                marginBottom: 4,
              }}
            >
              {label as string}
            </label>
            <input
              value={val as string}
              onChange={(e) =>
                (set as (v: string) => void)(e.target.value)
              }
              style={{
                width: "100%",
                fontSize: 13,
                border: "1px solid #E5E7EB",
                borderRadius: 7,
                padding: "8px 12px",
                outline: "none",
                color: "#374151",
                boxSizing: "border-box",
              }}
            />
          </div>
        ))}
        <div className="col-span-2">
          <label
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#374151",
              display: "block",
              marginBottom: 4,
            }}
          >
            Email
          </label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: "100%",
              fontSize: 13,
              border: "1px solid #E5E7EB",
              borderRadius: 7,
              padding: "8px 12px",
              outline: "none",
              color: "#374151",
              boxSizing: "border-box",
            }}
          />
        </div>
        <div className="col-span-2">
          <label
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#374151",
              display: "block",
              marginBottom: 4,
            }}
          >
            Bio
          </label>
          <textarea
            rows={2}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell sellers a bit about yourself…"
            style={{
              width: "100%",
              fontSize: 13,
              border: "1px solid #E5E7EB",
              borderRadius: 7,
              padding: "8px 12px",
              outline: "none",
              resize: "none",
              color: "#374151",
              fontFamily: "inherit",
              boxSizing: "border-box",
            }}
            className="placeholder:text-gray-400"
          />
        </div>
      </div>
      <div className="flex items-center justify-end gap-3 mt-5">
        {saved && (
          <span
            className="fi"
            style={{ fontSize: 12, color: GREEN, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}
          >
            <Check size={13} aria-hidden="true" /> Changes saved!
          </span>
        )}
        <PrimaryBtn onClick={saveProfile}>Save Changes</PrimaryBtn>
      </div>
    </div>
  )
}
