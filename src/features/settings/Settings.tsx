import { useState, useEffect } from "react"
import { UserRound, Link2, Bell, Lock } from "lucide-react"
import type { SettingsSection, SharedState } from "@/types"
import { INDIGO } from "@/constants/theme"
import { Card } from "@/components/shared"
import ProfileSection from "./ProfileSection"
import LinkedAccountsSection from "./LinkedAccountsSection"
import NotificationsSection from "./NotificationsSection"
import { NOTIF_DEFAULT_STATE } from "./notifDefaults"
import SecuritySection from "./SecuritySection"
import { isSupabaseConfigured } from "@/lib/supabase"
import { kargoApi } from "@/services"

const SECTION_ICONS: Record<SettingsSection, typeof UserRound> = {
  Profile: UserRound,
  "Linked Accounts": Link2,
  Notifications: Bell,
  Security: Lock,
}

export default function Settings({ user, setUser, role }: SharedState) {
  const [section, setSection] = useState<SettingsSection>("Profile")
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>(user.socialLinks ?? (user.fb ? { Facebook: user.fb } : {}))
  const [socialVisibility, setSocialVisibility] = useState<Record<string, boolean>>(user.socialVisibility ?? {})
  // Preferences use an opt-out model: a key missing from the saved map means
  // "opted in". Seed defaults, then overlay whatever the profile has stored.
  const [notifs, setNotifs] = useState<Record<string, boolean>>({
    ...NOTIF_DEFAULT_STATE,
    ...(user.notificationPreferences ?? {}),
  })
  const [notifsSaved, setNotifsSaved] = useState(false)
  const [savingNotifs, setSavingNotifs] = useState(false)
  const [firstName, setFirstName] = useState(user.name.split(" ")[0] || "")
  const [lastName, setLastName] = useState(
    user.name.split(" ").slice(1).join(" ") || "",
  )
  const [email, setEmail] = useState(user.email || "")
  const [bio, setBio] = useState(user.bio || "")
  const [saved, setSaved] = useState(false)
  const [linksSaved, setLinksSaved] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingLinks, setSavingLinks] = useState(false)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState(user.avatarUrl)
  const sections: SettingsSection[] = [
    "Profile",
    "Linked Accounts",
    "Notifications",
    "Security",
  ]
  useEffect(() => {
    if (!sections.includes(section)) setSection("Profile")
  }, [role])

  const saveProfile = async () => {
    const newName = [firstName, lastName].filter(Boolean).join(" ") || user.name
    setSavingProfile(true)
    let savedAvatarUrl = user.avatarUrl
    if (isSupabaseConfigured) {
      try {
        await kargoApi.updateProfile({ displayName: newName, bio, email })
        if (avatarFile) savedAvatarUrl = await kargoApi.uploadProfileAvatar(avatarFile)
      } catch (error) {
        setSavingProfile(false)
        alert(error instanceof Error ? error.message : "Unable to save profile.")
        return
      }
    }
    setUser((u) => ({ ...u, name: newName, email, bio, avatarUrl: savedAvatarUrl || avatarPreview }))
    setAvatarFile(null)
    setSavingProfile(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const saveSocialLinks = async () => {
    const cleaned = Object.fromEntries(Object.entries(socialLinks).map(([key, value]) => [key, value.trim()]).filter(([, value]) => value))
    const cleanedVisibility = Object.fromEntries(Object.keys(cleaned).map((key) => [key, socialVisibility[key] !== false]))
    setSavingLinks(true)
    try {
      if (isSupabaseConfigured) await kargoApi.updateProfile({ socialLinks: cleaned, socialVisibility: cleanedVisibility })
      setSocialLinks(cleaned)
      setSocialVisibility(cleanedVisibility)
      setUser((current) => ({ ...current, socialLinks: cleaned, socialVisibility: cleanedVisibility, fb: cleaned.Facebook }))
      setLinksSaved(true)
      setTimeout(() => setLinksSaved(false), 2000)
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to save social links.")
    } finally {
      setSavingLinks(false)
    }
  }

  const saveNotifs = async () => {
    setSavingNotifs(true)
    try {
      if (isSupabaseConfigured) await kargoApi.updateProfile({ notificationPreferences: notifs })
      setUser((current) => ({ ...current, notificationPreferences: notifs }))
      setNotifsSaved(true)
      setTimeout(() => setNotifsSaved(false), 2000)
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to save notification preferences.")
    } finally {
      setSavingNotifs(false)
    }
  }

  return (
    <div className="p-6">
      <div className="grid gap-6" style={{ gridTemplateColumns: "220px 1fr" }}>
        <div>
          <Card className="!p-2">
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "#9CA3AF",
                padding: "6px 10px",
                letterSpacing: 1,
              }}
            >
              ACCOUNT
            </div>
            {sections.map((s) => (
              <button
                key={s}
                onClick={() => setSection(s)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: section === s ? 600 : 400,
                  color: section === s ? INDIGO : "#374151",
                  background: section === s ? "#EEF0FF" : "transparent",
                  border: "none",
                  cursor: "pointer",
                  gap: 8,
                  transition: "all 0.15s",
                }}
              >
                {(() => {
                  const Icon = SECTION_ICONS[s]
                  return <Icon size={15} aria-hidden="true" />
                })()}
                {s}
              </button>
            ))}
          </Card>
        </div>
        <Card>
          {section === "Profile" && (
            <ProfileSection
              user={user}
              firstName={firstName}
              setFirstName={setFirstName}
              lastName={lastName}
              setLastName={setLastName}
              email={email}
              setEmail={setEmail}
              bio={bio}
              setBio={setBio}
              saved={saved}
              saveProfile={saveProfile}
              avatarPreview={avatarPreview}
              avatarFileName={avatarFile?.name}
              onAvatarSelected={(file) => {
                setAvatarFile(file)
                setAvatarPreview(URL.createObjectURL(file))
              }}
              saving={savingProfile}
              sellerEnabled={Boolean(user.sellerEnabled)}
              onBirState={(birState) => setUser((current) => ({ ...current, birState }))}
            />
          )}
          {section === "Linked Accounts" && (
            <LinkedAccountsSection
              links={socialLinks}
              setLinks={setSocialLinks}
              visibility={socialVisibility}
              setVisibility={setSocialVisibility}
              onSave={saveSocialLinks}
              saved={linksSaved}
              saving={savingLinks}
            />
          )}
          {section === "Notifications" && (
            <NotificationsSection
              notifs={notifs}
              setNotifs={setNotifs}
              onSave={saveNotifs}
              saved={notifsSaved}
              saving={savingNotifs}
              role={role}
            />
          )}
          {section === "Security" && <SecuritySection />}
        </Card>
      </div>
    </div>
  )
}
