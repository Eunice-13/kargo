import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Role, Tab } from "@/types";
import { NOTIF_BUYER, NOTIF_SELLER } from "@/data/notifications";
import { isSupabaseConfigured } from "@/lib/supabase";
import { kargoApi } from "@/services";
import {
  requestAccountStatusSettings,
  requestAdminSection,
  requestBatchOpenByDbId,
  requestExtensionRequests,
  requestGroupOrders,
  requestRecordFocus,
} from "@/state/navIntent";
import NotificationDetailModal from "./NotificationDetailModal";
import {
  notificationFacts,
  resolveNotificationRoute,
  routeCue,
  type NotificationIntent,
  type NotificationRoute,
} from "./notificationRoute";
import type { NotificationItemData } from "./types";

export type { NotificationItemData } from "./types";

const PAGE_SIZE = 20;

const Context = createContext<{
  notifications: NotificationItemData[];
  unreadCount: number;
  loading: boolean;
  hasMore: boolean;
  error: string;
  busy: boolean;
  loadMore: () => Promise<void>;
  markRead: (id?: string | number) => Promise<boolean>;
  openNotification: (notification: NotificationItemData) => Promise<boolean>;
} | null>(null);

// `tab` is the page the intent is for. Record focus is tagged with it so only
// that page consumes the intent, even if the user is on another tab right now.
function applyIntent(tab: Tab, intent?: NotificationIntent) {
  if (!intent) return;
  if (intent.type === "batch") {
    requestBatchOpenByDbId(intent.id, intent.groupOrderId);
  } else if (intent.type === "extension-requests") {
    requestExtensionRequests();
  } else if (intent.type === "account-status") {
    requestAccountStatusSettings();
  } else if (intent.type === "admin-security") {
    requestAdminSection({ tab: "Security", subtab: "Audit log" });
  } else if (intent.type === "group-orders") {
    requestGroupOrders(intent.groupOrderId);
  } else if (intent.type === "record") {
    requestRecordFocus(tab, intent.target);
  }
}

export default function NotificationsProvider({
  role,
  onNavigate,
  onOpenAdminInvite,
  children,
}: {
  role: Role;
  onNavigate?: (tab: Tab) => void;
  onOpenAdminInvite?: () => void;
  children: ReactNode;
}) {
  const [notifications, setNotifications] = useState<NotificationItemData[]>(() =>
    isSupabaseConfigured
      ? []
      : (role === "Seller" ? NOTIF_SELLER : NOTIF_BUYER).map((n) => ({
          id: n.id,
          icon: n.icon,
          text: n.text,
          time: n.time,
          unread: !n.read,
          route: { kind: "page", tab: n.tab } as NotificationRoute,
          cue: routeCue(role, { kind: "page", tab: n.tab }),
          context: null,
        })),
  );
  const [unreadCount, setUnreadCount] = useState(
    () => notifications.filter((n) => n.unread).length,
  );
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [hasMore, setHasMore] = useState(isSupabaseConfigured);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<NotificationItemData | null>(null);
  const fetching = useRef(false);
  const marking = useRef(false);
  const opening = useRef(false);
  const offset = useRef(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  async function loadMore() {
    if (!isSupabaseConfigured || fetching.current) return;
    fetching.current = true;
    setLoading(true);
    setError("");
    try {
      const [rows, count] = await Promise.all([
        kargoApi.loadNotifications(offset.current, PAGE_SIZE),
        offset.current === 0 ? kargoApi.loadUnreadNotificationCount() : Promise.resolve(null),
      ]);
      if (!alive.current) return;
      const mapped: NotificationItemData[] = rows.map((n) => {
        const route = resolveNotificationRoute(role, n.target_path || n.context?.tab, n.context);
        return {
          id: n.id,
          icon: n.category,
          text: n.message,
          time: new Date(n.created_at).toLocaleString(),
          unread: !n.read_at,
          route,
          cue: routeCue(role, route),
          context: n.context,
        };
      });
      setNotifications((current) => [
        ...current,
        ...mapped.filter((n) => !current.some((existing) => existing.id === n.id)),
      ]);
      offset.current += rows.length;
      setHasMore(rows.length === PAGE_SIZE);
      if (count !== null) setUnreadCount(count);
    } catch {
      if (alive.current) setError("Unable to load notifications. Please try again.");
    } finally {
      fetching.current = false;
      if (alive.current) setLoading(false);
    }
  }
  useEffect(() => {
    void loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function markRead(id?: string | number) {
    if (marking.current || loading) return false;
    const item = notifications.find((n) => n.id === id);
    if (id !== undefined && !item?.unread) return true;
    marking.current = true;
    setBusy(true);
    setError("");
    try {
      if (isSupabaseConfigured)
        await kargoApi.markNotificationRead(id === undefined ? undefined : String(id));
      if (!alive.current) return false;
      setNotifications((current) =>
        current.map((n) => (id === undefined || n.id === id ? { ...n, unread: false } : n)),
      );
      setUnreadCount((count) => (id === undefined ? 0 : Math.max(0, count - 1)));
      return true;
    } catch {
      if (alive.current) setError("Unable to mark notifications as read. Please try again.");
      return false;
    } finally {
      marking.current = false;
      if (alive.current) setBusy(false);
    }
  }
  // The single entry point for both notification surfaces. It marks the item
  // read, then does exactly one thing: navigate (with at most one intent), open
  // the admin invite popup, or open the detail modal.
  async function openNotification(notification: NotificationItemData) {
    if (opening.current) return false;
    opening.current = true;
    try {
      const ready = await markRead(notification.id);
      if (!ready || !alive.current) return false;
      if (notification.route.kind === "page") {
        applyIntent(notification.route.tab, notification.route.intent);
        onNavigate?.(notification.route.tab);
      } else if (notification.route.kind === "invite") {
        onOpenAdminInvite?.();
      } else {
        setDetail(notification);
      }
      return true;
    } finally {
      opening.current = false;
    }
  }
  return (
    <Context.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        hasMore,
        error,
        busy,
        loadMore,
        markRead,
        openNotification,
      }}
    >
      {children}
      <NotificationDetailModal
        notification={detail}
        facts={detail ? notificationFacts(detail.context) : []}
        onClose={() => setDetail(null)}
      />
    </Context.Provider>
  );
}
export function useNotifications() {
  const context = useContext(Context);
  if (!context) throw new Error("Notifications must be inside NotificationsProvider");
  return context;
}
