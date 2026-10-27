import { useEffect, useState } from "react";
import { ShieldCheck, TriangleAlert } from "lucide-react";

import { Modal, PrimaryBtn, SecondaryBtn } from "@/components/shared";
import { adminApi } from "@/services";

import type { AdminInvite } from "../adminTypes";

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

// The consent gate for a granted admin account. It appears on sign-in while the
// invitation is unanswered, which is the only time the account can see it:
// is_admin() stays false until admin_accept_invite() runs, so nothing in the
// console is reachable before this decision.
//
// Closing the modal (X / Escape / backdrop) is "decide later": the invitation
// stays pending and the modal returns on the next sign-in. No accidental
// consent, no accidental decline.
export default function AdminInviteModal({
  onDismiss,
  onResolved,
}: {
  onDismiss: () => void;
  onResolved: (accepted: boolean) => void;
}) {
  const [invite, setInvite] = useState<AdminInvite | null>(null);
  const [confirmingDecline, setConfirmingDecline] = useState(false);
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Attribution is a nice-to-have: if the lookup fails we still show the consent
  // gate with generic copy rather than trapping the account behind a spinner.
  useEffect(() => {
    let alive = true;
    adminApi
      .getMyInvite()
      .then((row) => {
        if (alive) setInvite(row);
      })
      .catch(() => {
        if (alive) setInvite(null);
      });
    return () => {
      alive = false;
    };
  }, []);

  const accept = async () => {
    setBusy("accept");
    setError(null);
    try {
      await adminApi.acceptAdminInvite();
      onResolved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not accept the invitation.");
      setBusy(null);
    }
  };

  const decline = async () => {
    setBusy("decline");
    setError(null);
    try {
      await adminApi.declineAdminInvite();
      onResolved(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not decline the invitation.");
      setBusy(null);
      setConfirmingDecline(false);
    }
  };

  return (
    <Modal
      title="Admin invitation"
      variant="confirm"
      width={480}
      className="admin-modal"
      overlayClassName="admin-modal-overlay"
      onClose={busy ? () => {} : onDismiss}
    >
      <div className="admin-confirm">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span
            aria-hidden="true"
            style={{
              display: "grid",
              placeItems: "center",
              width: 44,
              height: 44,
              flex: "0 0 auto",
              borderRadius: 14,
              background: "#E0E7FF",
              color: "#191BA9",
            }}
          >
            <ShieldCheck size={22} />
          </span>
          <h2
            style={{
              margin: 0,
              fontFamily: "'Josefin Sans',sans-serif",
              fontSize: 19,
              fontWeight: 800,
              lineHeight: 1.3,
              color: "#171923",
            }}
          >
            You have been granted as an admin of KARGO
          </h2>
        </div>

        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "#475467" }}>
          Admins verify sellers, moderate batches, cancel orders, and override payments. Every admin
          has full access — there are no read-only admins. This takes effect the moment you accept.
        </p>

        <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: "#667085" }}>
          {invite?.grantedBy ? `Invited by ${invite.grantedBy}` : "Invited by a KARGO admin"}
          {invite?.grantedAt ? ` · ${fmtDate(invite.grantedAt)}` : ""}
        </p>

        {confirmingDecline ? (
          <div className="admin-callout admin-callout--danger" role="alert">
            <span className="admin-callout__icon" aria-hidden="true">
              <TriangleAlert size={16} />
            </span>
            <p>
              <strong>Decline admin access?</strong> This cancels the invitation — an admin has to
              invite you again if you change your mind. You keep your current access and nothing
              else changes.
            </p>
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: "#667085" }}>
            Close this and you can decide the next time you sign in.
          </p>
        )}

        {error && (
          <p role="alert" className="admin-form-error">
            {error}
          </p>
        )}

        <div className="admin-modal-footer">
          {confirmingDecline ? (
            <>
              <SecondaryBtn onClick={() => setConfirmingDecline(false)} disabled={busy !== null}>
                Keep invitation
              </SecondaryBtn>
              <SecondaryBtn
                style={{ borderColor: "#FECACA", background: "#FEF2F2", color: "#B91C1C" }}
                onClick={decline}
                disabled={busy !== null}
              >
                {busy === "decline" ? "Declining…" : "Yes, decline invitation"}
              </SecondaryBtn>
            </>
          ) : (
            <>
              <SecondaryBtn onClick={() => setConfirmingDecline(true)} disabled={busy !== null}>
                Decline
              </SecondaryBtn>
              <PrimaryBtn onClick={accept} loading={busy === "accept"} disabled={busy !== null}>
                Accept admin access
              </PrimaryBtn>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
