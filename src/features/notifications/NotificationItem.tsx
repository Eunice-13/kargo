import {
  Check,
  Clock3,
  Package,
  ArrowUp,
  ShoppingBasket,
  ClipboardList,
  Star,
  Bell,
  type LucideIcon,
} from "lucide-react";
import type { NotificationItemData } from "./NotificationsProvider";
const icons: Record<string, LucideIcon> = {
  check: Check,
  clock: Clock3,
  package: Package,
  up: ArrowUp,
  bag: ShoppingBasket,
  clipboard: ClipboardList,
  star: Star,
};
export default function NotificationItem({
  notification: n,
  onOpen,
  onMarkRead,
  busy,
  compact = false,
}: {
  notification: NotificationItemData;
  onOpen: () => void;
  onMarkRead?: () => void;
  busy: boolean;
  compact?: boolean;
}) {
  const Icon = icons[n.icon] ?? Bell;
  return (
    <div
      className="flex min-w-0 items-start gap-2.5 border-b border-gray-50 px-3.5 py-2.5"
      style={{ background: n.unread ? "#FAFBFF" : "#fff" }}
    >
      <span
        aria-hidden="true"
        className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${n.unread ? "bg-[var(--kargo-navy)]" : "bg-transparent"}`}
      />
      <Icon
        size={16}
        aria-hidden="true"
        className={`mt-0.5 shrink-0 ${n.unread ? "text-[var(--kargo-navy)]" : "text-gray-400"}`}
      />
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={onOpen}
          disabled={busy}
          aria-label={`${n.text}${n.unread ? " (unread)" : " (read)"}, go to ${n.tab}`}
          className="block w-full text-left focus-visible:outline-2 focus-visible:outline-[var(--kargo-focus)]"
        >
          <span
            className={`block break-words text-xs leading-snug text-gray-700 ${n.unread ? "font-medium" : "font-normal"} ${compact ? "line-clamp-2" : ""}`}
          >
            {n.text}
          </span>
          <span className="mt-0.5 block text-[11px] text-gray-400">{n.time}</span>
        </button>
        {!compact && (
          <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-[var(--kargo-muted)]">
            <span>{n.unread ? "Unread" : "Read"}</span>
            {n.unread && (
              <button
                type="button"
                disabled={busy}
                onClick={onMarkRead}
                className="min-h-11 px-2 font-semibold text-[var(--kargo-navy)] focus-visible:outline-2 focus-visible:outline-[var(--kargo-focus)]"
              >
                Mark as read
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
