import type { Tab } from "@/types";
import { useNotifications } from "./NotificationsProvider";
import NotificationItem from "./NotificationItem";
export default function NotificationsPage({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  const { notifications, unreadCount, loading, hasMore, error, busy, loadMore, markRead } =
    useNotifications();
  return (
    <section
      className="mx-auto w-full max-w-4xl p-4 sm:p-6"
      aria-labelledby="notifications-heading"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 id="notifications-heading" className="text-lg font-semibold text-[var(--kargo-ink)]">
            Notifications
          </h1>
          <p className="text-xs text-[var(--kargo-muted)]">{unreadCount} unread</p>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            disabled={busy || loading}
            onClick={() => void markRead()}
            className="min-h-11 text-xs font-semibold text-[var(--kargo-navy)]"
          >
            Mark all read
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="mb-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="overflow-hidden rounded-xl border border-[var(--kargo-line)] bg-[var(--kargo-surface)]">
        {notifications.map((n) => (
          <NotificationItem
            key={n.id}
            notification={n}
            busy={busy || loading}
            onMarkRead={() => void markRead(n.id)}
            onOpen={() => {
              void markRead(n.id).then((ok) => {
                if (ok) onNavigate(n.tab);
              });
            }}
          />
        ))}
        {!loading && !error && notifications.length === 0 && (
          <p className="p-8 text-center text-sm text-[var(--kargo-muted)]">No notifications yet.</p>
        )}
        {loading && (
          <p role="status" className="p-4 text-center text-xs text-[var(--kargo-muted)]">
            Loading notifications…
          </p>
        )}
        {!loading && (hasMore || error) && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void loadMore()}
            className="min-h-11 w-full border-t border-[var(--kargo-line)] text-xs font-semibold text-[var(--kargo-navy)]"
          >
            {error ? "Try again" : "Load more notifications"}
          </button>
        )}
      </div>
    </section>
  );
}
