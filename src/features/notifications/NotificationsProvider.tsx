import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Role, Tab } from "@/types";
import { NOTIF_BUYER, NOTIF_SELLER } from "@/data/notifications";
import { isSupabaseConfigured } from "@/lib/supabase";
import { kargoApi } from "@/services";

export type NotificationItemData = {
  id: string | number;
  icon: string;
  text: string;
  time: string;
  unread: boolean;
  tab: Tab;
  // Optional destination inside the tab. A restore notice opens
  // Settings → Account status so the when/why is one tap away.
  intent?: "account-status";
};
const PAGE_SIZE = 20;
const tabs: Tab[] = [
  "Dashboard",
  "Batches",
  "My Claims",
  "Payments",
  "Orders",
  "Settings",
  "Notifications",
];
function destination(value: unknown): Tab {
  if (typeof value !== "string") return "Dashboard";
  const tab = tabs.find((tab) => tab.toLowerCase() === value.toLowerCase());
  if (tab) return tab;
  // Accept existing email-style target paths without navigating outside the app.
  try {
    const target = new URL(value, "https://kargo.local");
    return (
      tabs.find(
        (tab) =>
          tab.toLowerCase() ===
          (target.searchParams.get("tab") ?? target.pathname.slice(1)).toLowerCase(),
      ) ?? "Dashboard"
    );
  } catch {
    return "Dashboard";
  }
}
const Context = createContext<{
  notifications: NotificationItemData[];
  unreadCount: number;
  loading: boolean;
  hasMore: boolean;
  error: string;
  busy: boolean;
  loadMore: () => Promise<void>;
  markRead: (id?: string | number) => Promise<boolean>;
} | null>(null);

export default function NotificationsProvider({
  role,
  children,
}: {
  role: Role;
  children: ReactNode;
}) {
  const [notifications, setNotifications] = useState<NotificationItemData[]>(() =>
    isSupabaseConfigured
      ? []
      : (role === "Seller" ? NOTIF_SELLER : NOTIF_BUYER).map((n) => ({ ...n, unread: !n.read })),
  );
  const [unreadCount, setUnreadCount] = useState(
    () => notifications.filter((n) => n.unread).length,
  );
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [hasMore, setHasMore] = useState(isSupabaseConfigured);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fetching = useRef(false);
  const marking = useRef(false);
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
      const mapped: NotificationItemData[] = rows.map((n) => ({
        id: n.id,
        icon: n.category,
        text: n.message,
        time: new Date(n.created_at).toLocaleString(),
        unread: !n.read_at,
        tab: destination(n.target_path || n.context?.tab),
        intent: n.context?.account_status ? "account-status" : undefined,
      }));
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
  return (
    <Context.Provider
      value={{ notifications, unreadCount, loading, hasMore, error, busy, loadMore, markRead }}
    >
      {children}
    </Context.Provider>
  );
}
export function useNotifications() {
  const context = useContext(Context);
  if (!context) throw new Error("Notifications must be inside NotificationsProvider");
  return context;
}
