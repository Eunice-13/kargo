import { AlertTriangle, Inbox, ShieldAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, EmptyState, PrimaryBtn } from "@/components/shared";

// Inline error card with Retry. Never blanks the page.
export function AdminErrorState({
  message,
  onRetry,
  accessDenied = false,
}: {
  message: string;
  onRetry?: () => void;
  accessDenied?: boolean;
}) {
  return (
    <Card>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <span style={{ color: accessDenied ? "#B42318" : "#B4690E", flex: "0 0 auto" }}>
          {accessDenied ? (
            <ShieldAlert size={20} aria-hidden="true" />
          ) : (
            <AlertTriangle size={20} aria-hidden="true" />
          )}
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, color: "var(--kargo-ink)", fontSize: 14 }}>
            {accessDenied ? "Admin access required" : "Couldn't load this view"}
          </div>
          <p style={{ color: "var(--kargo-muted)", fontSize: 13, margin: "4px 0 0" }}>{message}</p>
          {onRetry && !accessDenied && (
            <div style={{ marginTop: 12 }}>
              <PrimaryBtn size="sm" onClick={onRetry}>
                Retry
              </PrimaryBtn>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

// Thin admin wrapper over the shared EmptyState.
export function AdminEmptyState({
  title,
  message,
  icon = Inbox,
}: {
  title: string;
  message: string;
  icon?: LucideIcon;
}) {
  return <EmptyState icon={icon} title={title} message={message} />;
}
