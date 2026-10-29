import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, Users } from "lucide-react";
import type { BatchType } from "@/types";
import type { LeaderGroupOrder } from "@/types/leaderGroupOrder";
import { GroupOrderModal } from "@/features/batches";
import GroupOrderRow from "./GroupOrderRow";
import { groupProgress, toggleGroupDetails } from "./groupOrderProgress";
import "./myGroupOrders.css";
import { isSupabaseConfigured } from "@/lib/supabase";
import { loadLedGroupOrders } from "@/services/leaderGroupOrders";
import { groupCanManage, groupIsActive, sortLeaderGroups } from "./leaderGroupOrderPresentation";

export function GroupOrderList({
  groups,
  onOpen,
  onPay,
  initialExpandedId,
}: {
  groups: LeaderGroupOrder[];
  onOpen: (group: LeaderGroupOrder) => void;
  onPay?: (group: LeaderGroupOrder) => void;
  // Card to show expanded on first render (a notification points at it).
  initialExpandedId?: string | null;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(initialExpandedId ? [initialExpandedId] : []),
  );
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <ul className="group-shortcut-list">
      {sortLeaderGroups(groups, now).map((group) => (
        <GroupOrderRow
          key={group.id}
          group={group}
          now={now}
          expanded={expanded.has(group.id)}
          onOpen={() => onOpen(group)}
          onPay={onPay}
          onToggle={() =>
            setExpanded((current) =>
              toggleGroupDetails(
                current,
                group.id,
                window.matchMedia("(max-width: 767px)").matches,
              ),
            )
          }
        />
      ))}
    </ul>
  );
}
export default function MyGroupOrders({
  buyerId,
  batches,
  onOpenClaims,
  onUpdated,
  onBrowseGroups,
}: {
  buyerId?: string;
  batches: BatchType[];
  onOpenClaims: () => void;
  onUpdated: () => Promise<void>;
  onBrowseGroups?: () => void;
}) {
  const [groups, setGroups] = useState<LeaderGroupOrder[]>([]);
  const [selected, setSelected] = useState<LeaderGroupOrder | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const reload = useCallback(async () => {
    if (!buyerId || !isSupabaseConfigured) return;
    const current = ++generation.current;
    setLoading(true);
    setError("");
    try {
      const rows = await loadLedGroupOrders();
      if (current === generation.current) setGroups(rows.filter((g) => g.leaderId === buyerId));
    } catch {
      if (current === generation.current)
        setError("Unable to load your group orders. Please try again.");
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [buyerId]);
  useEffect(() => {
    void reload();
    return () => {
      generation.current++;
    };
  }, [reload]);
  const batch = selected ? batches.find((b) => b.dbId === selected.batchId) : undefined;
  if (!buyerId || !isSupabaseConfigured) return null;
  const activeCount = groups.filter((group) => groupIsActive(group)).length;
  const paymentCount = groups.filter((group) => groupProgress(group).payable).length;
  return (
    <section className="bdash-card mb-5" aria-label="My Group Orders" aria-busy={loading}>
      <div className="group-shortcut-heading">
        <div>
          <h2>My Group Orders</h2>
          <p>
            {loading && !groups.length ? (
              "Loading your group orders…"
            ) : error && !groups.length ? (
              "Group summaries unavailable."
            ) : (
              <>
                {activeCount} active {activeCount === 1 ? "group" : "groups"} · {paymentCount}{" "}
                {paymentCount === 1 ? "needs" : "need"} payment
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          className="group-shortcut-button group-shortcut-refresh"
          aria-label="Refresh group orders"
          disabled={loading}
          onClick={() => void reload()}
        >
          <RefreshCw size={18} aria-hidden="true" />
        </button>
      </div>
      {error && (
        <div role="alert" className="group-shortcut-empty">
          <p>{error}</p>
          <button
            type="button"
            className="group-shortcut-button"
            disabled={loading}
            onClick={() => void reload()}
          >
            Try again
          </button>
        </div>
      )}
      {loading && !groups.length ? (
        <div aria-label="Loading group orders" className="group-shortcut-skeletons">
          {[0, 1].map((index) => (
            <div key={index} className="group-shortcut-skeleton" />
          ))}
        </div>
      ) : groups.length ? (
        <GroupOrderList groups={groups} onOpen={setSelected} onPay={onOpenClaims} />
      ) : (
        !error && (
          <div className="group-shortcut-empty">
            <Users size={24} aria-hidden="true" />
            <p>No group orders yet.</p>
            {onBrowseGroups && (
              <button type="button" className="group-shortcut-button" onClick={onBrowseGroups}>
                Browse batches
              </button>
            )}
          </div>
        )
      )}
      {selected && !batch && (
        <div role="alert" className="mt-2 text-xs text-[var(--kargo-muted)]">
          This group’s batch is no longer available to your account. Your existing reservations are
          unchanged.
          <button type="button" className="ml-2 underline" onClick={() => setSelected(null)}>
            Dismiss
          </button>
        </div>
      )}
      {selected && batch && (
        <GroupOrderModal
          key={selected.id}
          batch={batch}
          groupOrderId={selected.id}
          readOnly={!groupCanManage(selected)}
          onClose={() => {
            setSelected(null);
            void reload();
          }}
          onOpenClaims={() => {
            setSelected(null);
            onOpenClaims();
          }}
          onCheckoutComplete={async () => {
            await onUpdated();
            await reload();
          }}
        />
      )}
    </section>
  );
}
