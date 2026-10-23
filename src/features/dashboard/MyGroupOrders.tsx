import { useCallback, useEffect, useRef, useState } from "react";
import { Users } from "lucide-react";
import type { BatchType } from "@/types";
import type { LeaderGroupOrder } from "@/types/leaderGroupOrder";
import { GroupOrderModal } from "@/features/batches";
import SecondaryBtn from "@/components/shared/SecondaryBtn";
import { isSupabaseConfigured } from "@/lib/supabase";
import { loadLedGroupOrders } from "@/services/leaderGroupOrders";
import {
  groupCanManage,
  groupStatusLabels,
  sortLeaderGroups,
} from "./leaderGroupOrderPresentation";

export function GroupOrderList({
  groups,
  onOpen,
}: {
  groups: LeaderGroupOrder[];
  onOpen: (group: LeaderGroupOrder) => void;
}) {
  return (
    <ul className="divide-y divide-[var(--kargo-line)]">
      {sortLeaderGroups(groups).map((group) => {
        const due = group.status === "forming" ? group.formationDeadline : group.paymentDeadline;
        return (
          <li
            key={group.id}
            className="flex min-w-0 flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
          >
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-[var(--kargo-ink)] [overflow-wrap:anywhere]">
                {group.batchTitle ?? "Batch unavailable"}
              </h3>
              <p className="mt-1 text-xs text-[var(--kargo-muted)]">
                {groupStatusLabels[group.status] ?? group.status}
                {due && Number.isFinite(Date.parse(due)) && (
                  <span>
                    {" "}
                    · {group.status === "forming" ? "Formation deadline" : "Payment deadline"}:{" "}
                    {new Date(due).toLocaleString("en-PH", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                )}
              </p>
            </div>
            <div className="shrink-0 self-start sm:self-auto">
              <SecondaryBtn
                onClick={() => onOpen(group)}
                ariaLabel={`${groupCanManage(group) ? "Manage" : "View"} group for ${group.batchTitle ?? "unavailable batch"}`}
              >
                {groupCanManage(group) ? "Manage Group" : "View Group"}
              </SecondaryBtn>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
export default function MyGroupOrders({
  buyerId,
  batches,
  onOpenClaims,
  onUpdated,
}: {
  buyerId?: string;
  batches: BatchType[];
  onOpenClaims: () => void;
  onUpdated: () => Promise<void>;
}) {
  const [groups, setGroups] = useState<LeaderGroupOrder[]>([]);
  const [selected, setSelected] = useState<LeaderGroupOrder | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
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
  if (!groups.length && !error) return null;
  return (
    <section className="bdash-card mb-5" aria-label="My Group Orders" aria-busy={loading}>
      <div className="bdash-section-head">
        <h2 className="flex items-center gap-2">
          <Users size={16} aria-hidden="true" />
          My Group Orders
        </h2>
        <button
          type="button"
          className="bdash-viewall"
          disabled={loading}
          onClick={() => void reload()}
        >
          Refresh
        </button>
      </div>
      {error && (
        <p role="alert" className="mb-2 text-xs text-[var(--kargo-muted)]">
          {error}
        </p>
      )}
      <GroupOrderList groups={groups} onOpen={setSelected} />
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
