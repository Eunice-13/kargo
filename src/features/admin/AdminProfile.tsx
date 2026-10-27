import { Modal, Avatar } from "@/components/shared";
import { SecuritySection } from "@/features/settings";
import type { UserInfo } from "@/types";

// Admin personal profile + account security, opened from the avatar menu.
// Governance (team, audit) lives in the Security tab, not here.
export default function AdminProfile({ user, onClose }: { user: UserInfo; onClose: () => void }) {
  const memberSince = user.memberSince
    ? new Date(user.memberSince).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
      })
    : null;

  return (
    <Modal
      title="My profile"
      variant="detail"
      width={520}
      className="admin-modal"
      overlayClassName="admin-modal-overlay"
      onClose={onClose}
    >
      <div className="space-y-5 admin-profile">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Avatar name={user.name || "Admin"} size={52} imageUrl={user.avatarUrl} />
          <div className="admin-profile__identity" style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--kargo-ink)" }}>
              {user.name || "KARGO Admin"}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--kargo-muted)" }}>{user.email}</div>
            <div
              style={{ fontSize: 11, color: "var(--kargo-navy)", fontWeight: 700, marginTop: 4 }}
            >
              Administrator · Internal use only
            </div>
          </div>
        </div>

        {memberSince && (
          <div style={{ fontSize: 12.5, color: "var(--kargo-muted)" }}>
            Member since {memberSince}
          </div>
        )}

        <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: 16 }}>
          <h3
            style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 800, color: "var(--kargo-ink)" }}
          >
            Account security
          </h3>
          <p style={{ fontSize: 11.5, color: "var(--kargo-muted)", margin: "0 0 12px" }}>
            Admin actions are logged with your name.
          </p>
          <SecuritySection />
        </div>
      </div>
    </Modal>
  );
}
