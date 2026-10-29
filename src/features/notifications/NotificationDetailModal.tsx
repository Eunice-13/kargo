import {
  ArrowUp,
  Bell,
  Check,
  ClipboardList,
  Clock3,
  Package,
  ShoppingBasket,
  Star,
  type LucideIcon,
} from "lucide-react";
import Modal from "@/components/shared/Modal";
import PrimaryBtn from "@/components/shared/PrimaryBtn";
import { INDIGO } from "@/constants/theme";
import type { NotificationFact } from "./notificationRoute";
import type { NotificationItemData } from "./types";

const ICONS: Record<string, LucideIcon> = {
  check: Check,
  clock: Clock3,
  package: Package,
  up: ArrowUp,
  bag: ShoppingBasket,
  clipboard: ClipboardList,
  star: Star,
};

// Fallback surface for a notification that no page can show (a removed group
// order, a waitlist offer with no UI, a seller-access change with a reason,
// a locked admin invite, legacy rows without a target). It shows the message in
// full, when it happened, and the human-meaningful fields from the row's
// context — never the raw ids.
export default function NotificationDetailModal({
  notification,
  facts,
  onClose,
}: {
  notification: NotificationItemData | null;
  facts: NotificationFact[];
  onClose: () => void;
}) {
  if (!notification) return null;
  const Icon = ICONS[notification.icon] ?? Bell;
  return (
    <Modal title="Notification details" width={470} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
            style={{ background: "#EEF2FB", color: INDIGO }}
          >
            <Icon size={18} />
          </span>
          <div className="min-w-0">
            <p className="text-sm leading-relaxed text-gray-800">{notification.text}</p>
            <p className="mt-1 text-xs text-[var(--kargo-muted)]">{notification.time}</p>
          </div>
        </div>

        {facts.length > 0 && (
          <dl className="space-y-2 rounded-xl border border-[var(--kargo-line)] p-3">
            {facts.map((fact) => (
              <div key={fact.label} className="flex justify-between gap-4 text-xs">
                <dt className="font-semibold text-gray-700">{fact.label}</dt>
                <dd className="text-right text-[var(--kargo-muted)]">{fact.value}</dd>
              </div>
            ))}
          </dl>
        )}

        <div className="flex justify-end pt-1">
          <PrimaryBtn onClick={onClose}>Close</PrimaryBtn>
        </div>
      </div>
    </Modal>
  );
}
