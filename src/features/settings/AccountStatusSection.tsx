import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, RotateCcw, ShieldAlert, ShieldCheck } from "lucide-react";
import { CardSkeleton, SH } from "@/components/shared";
import { GREEN, INDIGO } from "@/constants/theme";
import { isSupabaseConfigured } from "@/lib/supabase";
import { kargoApi, type MyAccountStatus } from "@/services";
import type { UserInfo } from "@/types";

const fmtMoment = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";

const actionLabel = (action: string) =>
  action === "suspend_account"
    ? "Suspended"
    : action === "restore_account"
      ? "Restored"
      : action.replace(/_/g, " ");

// Read-only account moderation history. The restore notification deep-links
// here so "your account has been restored" lands on the when, the why, and who
// signed off on it — rather than a generic Settings page.
export default function AccountStatusSection({ user }: { user: UserInfo }) {
  const [data, setData] = useState<MyAccountStatus | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    setError("");
    try {
      setData(await kargoApi.loadMyAccountStatus());
    } catch {
      setError("We couldn't load your account history. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const status = data?.status ?? user.accountStatus ?? "active";
  // Prefer the audit trail; fall back to the profile columns for a restoration
  // recorded before the audit log existed (or if the RPC returns no history).
  const restoredEvent =
    data?.history.find((event) => event.action === "restore_account") ??
    (status === "active" && data?.changedAt
      ? {
          action: "restore_account",
          reason: data.reason,
          actorName: data.changedBy ?? "A KARGO admin",
          createdAt: data.changedAt,
        }
      : undefined);

  return (
    <div className="pr">
      <SH title="Account status" />
      <div className="space-y-5">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            aria-hidden="true"
            style={{
              display: "grid",
              placeItems: "center",
              width: 38,
              height: 38,
              borderRadius: 12,
              background: status === "active" ? "#E9FBF4" : "#FEF2F2",
              color: status === "active" ? GREEN : "#B91C1C",
            }}
          >
            {status === "active" ? <ShieldCheck size={20} /> : <ShieldAlert size={20} />}
          </span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--kargo-ink)" }}>
              {status === "active" ? "Active" : "Suspended"}
            </div>
            <div style={{ fontSize: 12, color: "var(--kargo-muted)" }}>
              {status === "active"
                ? "Your account is in good standing."
                : "You cannot use KARGO while suspended."}
            </div>
          </div>
        </div>

        {status === "active" ? (
          <div
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid #CDEFE0",
              background: "#F2FCF8",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 12.5,
                lineHeight: 1.6,
                color: "#0B7A59",
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
              }}
            >
              <CheckCircle2
                size={15}
                aria-hidden="true"
                style={{ flex: "0 0 auto", marginTop: 1 }}
              />
              <span>
                <strong>You have full access again.</strong> You can claim batches, pay for orders,
                manage your listings, and message sellers as usual. Nothing was deleted or changed
                while your account was suspended — your orders, batches, and history are exactly
                where you left them.
              </span>
            </p>
          </div>
        ) : (
          <div
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid #FAD4D4",
              background: "#FFF6F6",
            }}
          >
            <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: "#8A2C2C" }}>
              <strong>Why:</strong>{" "}
              {data?.reason ?? user.accountStatusReason ?? "No reason was recorded."}
              {data?.changedAt && (
                <>
                  <br />
                  <strong>Suspended on:</strong> {fmtMoment(data.changedAt)}
                  {data.changedBy ? ` by ${data.changedBy}` : ""}
                </>
              )}
              <br />
              Think this is a mistake? Email{" "}
              <a href="mailto:support@kargo.ph" style={{ color: INDIGO, fontWeight: 600 }}>
                support@kargo.ph
              </a>
              .
            </p>
          </div>
        )}

        {restoredEvent && (
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: ".06em",
                textTransform: "uppercase",
                color: "#9CA3AF",
                marginBottom: 6,
              }}
            >
              Last restoration
            </div>
            <div
              style={{
                display: "grid",
                gap: 8,
                padding: "12px 14px",
                borderRadius: 12,
                border: "1px solid var(--kargo-line)",
                background: "var(--kargo-surface)",
                fontSize: 13,
                color: "#374151",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <RotateCcw size={14} aria-hidden="true" style={{ color: GREEN }} />
                <strong>Restored on {fmtMoment(restoredEvent.createdAt)}</strong>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--kargo-muted)" }}>
                <strong style={{ color: "#374151" }}>Reason:</strong>{" "}
                {restoredEvent.reason ?? "No reason was recorded."}
              </div>
              <div style={{ fontSize: 12.5, color: "var(--kargo-muted)" }}>
                <strong style={{ color: "#374151" }}>Recorded by:</strong> {restoredEvent.actorName}
              </div>
            </div>
          </div>
        )}

        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: ".06em",
              textTransform: "uppercase",
              color: "#9CA3AF",
              marginBottom: 6,
            }}
          >
            History
          </div>

          {loading && <CardSkeleton />}

          {!loading && error && (
            <div role="alert" style={{ fontSize: 12.5, color: "#B91C1C" }}>
              {error}{" "}
              <button
                type="button"
                onClick={() => void load()}
                style={{
                  background: "none",
                  border: 0,
                  color: INDIGO,
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                Try again
              </button>
            </div>
          )}

          {!loading && !error && data && data.history.length === 0 && (
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--kargo-muted)" }}>
              No suspensions on record for this account.
            </p>
          )}

          {!loading && !error && data && data.history.length > 0 && (
            <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {data.history.map((event, index) => (
                <li
                  key={`${event.action}-${event.createdAt}-${index}`}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 12,
                    padding: "10px 0",
                    borderTop: index === 0 ? "none" : "1px solid var(--kargo-line)",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
                      {actionLabel(event.action)}
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--kargo-muted)", lineHeight: 1.5 }}>
                      {event.reason ?? "No reason was recorded."}
                    </div>
                    <div style={{ fontSize: 11.5, color: "#9CA3AF" }}>By {event.actorName}</div>
                  </div>
                  <div
                    style={{
                      flex: "0 0 auto",
                      fontSize: 11.5,
                      color: "var(--kargo-muted)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {fmtMoment(event.createdAt)}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {!loading && !error && !data && (
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--kargo-muted)" }}>
              Connect a KARGO account to see your full moderation history.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
