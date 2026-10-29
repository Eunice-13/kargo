import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, RefreshCw, Users } from "lucide-react";
import type { BatchType } from "@/types";
import type { LeaderGroupOrder } from "@/types/leaderGroupOrder";
import { Modal, PrimaryBtn, revealRecord } from "@/components/shared";
import { GroupOrderModal } from "@/features/batches";
import { isSupabaseConfigured } from "@/lib/supabase";
import { loadMyGroupOrders } from "@/services/leaderGroupOrders";
import { navIntent, requestRecordFocus, subscribeNavIntent } from "@/state/navIntent";
import { GroupOrderList } from "./MyGroupOrders";
import { groupCanManage, groupIsOngoing } from "./leaderGroupOrderPresentation";
import "./myGroupOrders.css";

// "My Group Orders" on the buyer's My Claims: every group the buyer leads or has
// joined. It is the buyer-side counterpart of the seller's Extension Requests
// button, so a member (not just the leader) can find their groups, see where
// each one stands, and open it. Notifications open it directly on one group.
export default function GroupOrdersLauncher({
  buyerId,
  batches,
  onUpdated,
  onBrowse,
}: {
  buyerId?: string;
  batches: BatchType[];
  onUpdated: () => Promise<void>;
  onBrowse?: () => void;
}) {
  const [groups, setGroups] = useState<LeaderGroupOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [selected, setSelected] = useState<LeaderGroupOrder | null>(null);
  const [pastOpen, setPastOpen] = useState(false);
  const generation = useRef(0);
  const revealedFor = useRef<string | null>(null);

  const reload = useCallback(async () => {
    if (!buyerId || !isSupabaseConfigured) return;
    const current = ++generation.current;
    setLoading(true);
    setError("");
    try {
      const rows = await loadMyGroupOrders();
      if (current === generation.current) setGroups(rows);
    } catch {
      if (current === generation.current) {
        setError("Unable to load your group orders. Please try again.");
      }
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [buyerId]);

  // Load once for the count on the button, and again whenever the modal opens.
  useEffect(() => {
    void reload();
    return () => {
      generation.current++;
    };
  }, [reload]);
  useEffect(() => {
    if (open) void reload();
  }, [open, reload]);

  // A notification can open this modal (on one group) while My Claims is
  // already showing, or before it has mounted.
  const consumeIntent = useCallback(() => {
    if (!navIntent.openGroupOrders) return;
    const focus = navIntent.groupOrdersFocusId;
    navIntent.openGroupOrders = false;
    navIntent.groupOrdersFocusId = null;
    revealedFor.current = null;
    setFocusId(focus);
    setSelected(null);
    setOpen(true);
  }, []);
  useEffect(() => {
    consumeIntent();
    return subscribeNavIntent(consumeIntent);
  }, [consumeIntent]);

  const { ongoing, past } = useMemo(() => {
    const now = Date.now();
    const sorted = [...groups].sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.id.localeCompare(b.id),
    );
    return {
      ongoing: sorted.filter((group) => groupIsOngoing(group, now)),
      past: sorted.filter((group) => !groupIsOngoing(group, now)),
    };
  }, [groups]);

  // Show the group a notification pointed at: open "Past groups" if it lives
  // there, then scroll to its card and highlight it once.
  useEffect(() => {
    if (!open || !focusId || selected) return;
    if (past.some((group) => group.id === focusId)) setPastOpen(true);
  }, [open, focusId, selected, past]);
  useEffect(() => {
    if (!open || selected || !focusId || loading) return;
    if (revealedFor.current === focusId) return;
    if (!groups.some((group) => group.id === focusId)) return;
    const timer = window.setTimeout(() => {
      const card = document.querySelector<HTMLElement>(
        `[data-group-card="${CSS.escape(focusId)}"]`,
      );
      if (card) {
        revealedFor.current = focusId;
        revealRecord(card);
      }
    }, 150);
    return () => window.clearTimeout(timer);
  }, [open, selected, focusId, loading, groups, pastOpen]);

  if (!buyerId || !isSupabaseConfigured) return null;

  const batch = selected ? batches.find((item) => item.dbId === selected.batchId) : undefined;
  const ledCount = ongoing.filter((group) => group.viewerRole === "leader").length;
  const joinedCount = ongoing.length - ledCount;
  // Counts mean nothing until the first load lands (or fails).
  const pending = !groups.length && (loading || Boolean(error));
  const closeAll = () => {
    setOpen(false);
    setSelected(null);
    setFocusId(null);
    setPastOpen(false);
  };
  // The leader is the buyer on the resulting order, so "open my claim" lands on
  // that group's row in the page behind this modal.
  const goToClaim = (group: LeaderGroupOrder) => {
    closeAll();
    requestRecordFocus("My Claims", { groupOrderId: group.id });
  };
  const listKey = `${focusId ?? "none"}:${groups.some((group) => group.id === focusId)}`;
  const showList = open && !(selected && batch);

  return (
    <>
      <button
        type="button"
        className="group-orders-trigger"
        aria-haspopup="dialog"
        aria-label={`My Group Orders${ongoing.length ? `, ${ongoing.length} active` : ""}`}
        onClick={() => {
          revealedFor.current = null;
          setFocusId(null);
          setOpen(true);
        }}
      >
        <span className="group-orders-trigger__icon" aria-hidden="true">
          <Users size={17} />
        </span>
        <span>
          <span className="group-orders-trigger__my">My </span>Group Orders
        </span>
        {ongoing.length > 0 && (
          <span className="group-orders-trigger__count" aria-hidden="true">
            {ongoing.length}
          </span>
        )}
      </button>

      {showList && (
        <Modal title="My Group Orders" variant="detail" width={720} onClose={closeAll}>
          <div className="group-orders-modal" aria-busy={loading}>
            <div className="group-orders-modal__summary">
              <dl className="group-orders-modal__stats">
                <div className="group-orders-stat">
                  <dt>Active</dt>
                  <dd>{pending ? "–" : ongoing.length}</dd>
                </div>
                <div className="group-orders-stat">
                  <dt>You lead</dt>
                  <dd>{pending ? "–" : ledCount}</dd>
                </div>
                <div className="group-orders-stat">
                  <dt>Joined</dt>
                  <dd>{pending ? "–" : joinedCount}</dd>
                </div>
              </dl>
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

            {selected && !batch && (
              <div role="alert" className="group-orders-modal__notice">
                This group&apos;s batch is no longer available to your account. Your existing
                reservations are unchanged.
                <button type="button" onClick={() => setSelected(null)}>
                  Dismiss
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
              <>
                {ongoing.length > 0 ? (
                  <section>
                    <h3 className="group-orders-modal__label">Active groups</h3>
                    <GroupOrderList
                      key={listKey}
                      groups={ongoing}
                      initialExpandedId={focusId}
                      onOpen={setSelected}
                      onPay={goToClaim}
                    />
                  </section>
                ) : (
                  <p className="group-orders-modal__quiet">
                    No active groups right now. Past groups are below.
                  </p>
                )}

                {past.length > 0 && (
                  <section className="group-orders-modal__past">
                    <button
                      type="button"
                      className="group-orders-modal__past-toggle"
                      aria-expanded={pastOpen}
                      aria-controls="group-orders-past"
                      onClick={() => setPastOpen((value) => !value)}
                    >
                      <span>
                        Past groups <small>{past.length}</small>
                      </span>
                      <ChevronDown
                        size={16}
                        aria-hidden="true"
                        className={pastOpen ? "is-expanded" : ""}
                      />
                    </button>
                    {pastOpen && (
                      <div id="group-orders-past">
                        <GroupOrderList
                          key={listKey}
                          groups={past}
                          initialExpandedId={focusId}
                          onOpen={setSelected}
                          onPay={goToClaim}
                        />
                      </div>
                    )}
                  </section>
                )}
              </>
            ) : (
              !error && (
                <div className="group-orders-empty">
                  <span className="group-orders-empty__icon" aria-hidden="true">
                    <Users size={26} />
                  </span>
                  <h3>No group orders yet</h3>
                  <p>
                    Join a friend&apos;s group with their invite link, or start one from a batch
                    that offers group orders.
                  </p>
                  {onBrowse && (
                    <PrimaryBtn
                      onClick={() => {
                        closeAll();
                        onBrowse();
                      }}
                    >
                      Browse batches
                    </PrimaryBtn>
                  )}
                </div>
              )
            )}
          </div>
        </Modal>
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
          onOpenClaims={() => goToClaim(selected)}
          onCheckoutComplete={async () => {
            await onUpdated();
            await reload();
          }}
        />
      )}
    </>
  );
}
