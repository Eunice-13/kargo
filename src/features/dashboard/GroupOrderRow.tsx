import { useId } from "react";
import { Check, ChevronDown, Users } from "lucide-react";
import type { LeaderGroupOrder } from "@/types/leaderGroupOrder";
import Avatar from "@/components/shared/Avatar";
import { groupMoney, groupProgress, groupSteps, groupTimeLeft } from "./groupOrderProgress";

export function OrderStepper({ step }: { step: number }) {
  return (
    <ol className="group-shortcut-stepper" aria-label="Order progress">
      {groupSteps.map((label, i) => (
        <li
          key={label}
          aria-current={i + 1 === step ? "step" : undefined}
          className={i + 1 < step ? "is-done" : i + 1 === step ? "is-current" : ""}
        >
          <span className="group-shortcut-step" aria-hidden="true">
            {i + 1 < step ? <Check size={14} /> : i + 1 === step ? <span /> : null}
          </span>
          <span>{label}</span>
        </li>
      ))}
    </ol>
  );
}
export function StatusChip({ group, now }: { group: LeaderGroupOrder; now: number }) {
  const progress = groupProgress(group, now);
  return (
    <span className={`group-shortcut-chip is-${progress.tone}`}>
      <span aria-hidden="true">●</span>
      {progress.label}
    </span>
  );
}
export function GroupOrderDetails({
  group,
  now,
  onOpen,
  onPay,
}: {
  group: LeaderGroupOrder;
  now: number;
  onOpen: () => void;
  onPay?: () => void;
}) {
  const progress = groupProgress(group, now),
    members = group.members ?? [];
  const remaining = group.paymentDeadline ? groupTimeLeft(group.paymentDeadline, now) : null;
  return (
    <div className="group-shortcut-details">
      <div>
        <h4>Group</h4>
        <div className="group-shortcut-members">
          <div className="group-shortcut-avatars">
            {members.slice(0, 4).map((member) => (
              <span key={member.id} title={member.name}>
                <Avatar name={member.name} size={32} />
              </span>
            ))}
            {members.length > 4 && (
              <span className="group-shortcut-overflow">+{members.length - 4}</span>
            )}
          </div>
          <span>
            {members.length} {members.length === 1 ? "member" : "members"}
          </span>
        </div>
        {group.ownItemCount != null && (
          <p>
            Your items · {group.ownItemCount} {group.ownItemCount === 1 ? "item" : "items"}
          </p>
        )}
        {group.ownSubtotal != null && (
          <>
            <strong className="group-shortcut-own-amount">{groupMoney(group.ownSubtotal)}</strong>
            <small>Item subtotal before group discount and shipping</small>
          </>
        )}
      </div>
      <div>
        <h4>Progress</h4>
        <OrderStepper step={progress.step} />
      </div>
      <div className="group-shortcut-next">
        <h4>Next</h4>
        <strong>{progress.title}</strong>
        <p>{progress.description}</p>
        {group.status === "payment_pending" && remaining && (
          <p
            className="group-shortcut-deadline"
            role="timer"
            aria-label="Time until payment deadline"
          >
            {remaining === "00:00:00" ? "Payment deadline passed" : `Due in ${remaining}`}
          </p>
        )}
      </div>
      <footer>
        <button type="button" className="group-shortcut-ghost" onClick={onOpen}>
          View group details
        </button>
        {["payment_pending", "payment_submitted", "payment_confirmed"].includes(group.status) &&
          onPay && (
            <button type="button" className="group-shortcut-button" onClick={onPay}>
              Open My Claims
            </button>
          )}
      </footer>
    </div>
  );
}
export default function GroupOrderRow({
  group,
  expanded,
  now,
  onToggle,
  onOpen,
  onPay,
}: {
  group: LeaderGroupOrder;
  expanded: boolean;
  now: number;
  onToggle: () => void;
  onOpen: () => void;
  onPay?: () => void;
}) {
  const id = useId(),
    progress = groupProgress(group, now);
  return (
    <li className="group-shortcut-card">
      <div className="group-shortcut-summary" onClick={onToggle}>
        <span className="group-shortcut-icon" aria-hidden="true">
          <Users size={23} />
        </span>
        <div className="group-shortcut-name">
          <h3>{group.batchTitle ?? "Batch unavailable"}</h3>
          <p>Seller: {group.sellerName ?? "Seller unavailable"}</p>
        </div>
        <StatusChip group={group} now={now} />
        <div className="group-shortcut-mini">
          <div aria-hidden="true">
            {groupSteps.map((label, i) => (
              <span key={label} className={i < progress.step ? "is-filled" : ""} />
            ))}
          </div>
          <span>
            {progress.step
              ? `Step ${progress.step} of 5 · ${groupSteps[progress.step - 1]}`
              : progress.label}
          </span>
        </div>
        <div className="group-shortcut-amount">
          {group.amount != null ? groupMoney(group.amount) : "Amount unavailable"}
          <small>
            {group.amountIsSubtotal || group.status === "forming" || group.shippingPending
              ? "Items subtotal"
              : "Group total"}
          </small>
        </div>
        <div className="group-shortcut-actions">
          {progress.payable && onPay && (
            <button
              type="button"
              className="group-shortcut-button is-primary"
              onClick={(event) => {
                event.stopPropagation();
                onPay();
              }}
              title="Continue to My Claims to pay this group"
            >
              Pay {groupMoney(group.amountRemaining!)}
            </button>
          )}
          <button
            type="button"
            aria-label={`${expanded ? "Hide details" : "Details"} for ${group.batchTitle ?? "unavailable batch"}`}
            aria-expanded={expanded}
            aria-controls={id}
            className="group-shortcut-button"
            onClick={(event) => {
              event.stopPropagation();
              onToggle();
            }}
          >
            {expanded ? "Hide details" : "Details"}
            <ChevronDown size={16} aria-hidden="true" className={expanded ? "is-expanded" : ""} />
          </button>
        </div>
      </div>
      <div
        id={id}
        className={`group-shortcut-panel ${expanded ? "is-open" : ""}`}
        inert={!expanded}
        aria-hidden={!expanded}
      >
        <div>
          <GroupOrderDetails group={group} now={now} onOpen={onOpen} onPay={onPay} />
        </div>
      </div>
    </li>
  );
}
