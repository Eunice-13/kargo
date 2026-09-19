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
          <SecondaryBtn style={{ marginTop: 8 }}>
            Change Photo
          </SecondaryBtn>
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
            style={{ fontSize: 12, color: GREEN, fontWeight: 600 }}
          >
            ✓ Changes saved!
          </span>
        )}
        <PrimaryBtn onClick={saveProfile}>Save Changes</PrimaryBtn>
      </div>
    </div>
  )
}
