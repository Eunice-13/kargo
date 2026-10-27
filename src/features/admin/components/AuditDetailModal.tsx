import { Modal } from "@/components/shared";
import { ADMIN_ACTION_LABELS } from "@/constants/admin";
import type { AdminAuditRow } from "../adminTypes";

import { AdminEmptyText, AdminFact, AdminFactGrid, AdminModalSection } from "./AdminFacts";

const fmt = (iso: string) => new Date(iso).toLocaleString();

function StateRows({ state }: { state: Record<string, unknown> | null }) {
  if (!state || Object.keys(state).length === 0) {
    return <AdminEmptyText>No recorded values.</AdminEmptyText>;
  }
  return (
    <ul className="admin-state-list">
      {Object.entries(state).map(([k, v]) => (
        <li key={k}>
          <span>{k.replace(/_/g, " ")}</span>
          <strong>{String(v)}</strong>
        </li>
      ))}
    </ul>
  );
}

export default function AuditDetailModal({
  entry,
  onClose,
}: {
  entry: AdminAuditRow;
  onClose: () => void;
}) {
  return (
    <Modal
      title="Audit entry"
      variant="detail"
      width={580}
      className="admin-modal"
      overlayClassName="admin-modal-overlay"
      onClose={onClose}
    >
      <div className="space-y-5">
        <AdminModalSection title="What happened">
          <AdminFactGrid>
            <AdminFact label="When" value={fmt(entry.createdAt)} />
            <AdminFact label="Actor" value={entry.actorName || "—"} />
            <AdminFact label="Action" value={ADMIN_ACTION_LABELS[entry.action] ?? entry.action} />
            <AdminFact label="Target" value={entry.targetLabel ?? entry.targetType} />
          </AdminFactGrid>
        </AdminModalSection>

        {entry.reason && (
          <AdminModalSection title="Reason">
            <p className="admin-audit-reason">{entry.reason}</p>
          </AdminModalSection>
        )}

        <div className="admin-audit-diff">
          <AdminModalSection title="Before">
            <StateRows state={entry.beforeState} />
          </AdminModalSection>
          <AdminModalSection title="After">
            <StateRows state={entry.afterState} />
          </AdminModalSection>
        </div>

        <p className="admin-footer-note">
          Audit entries are immutable. They cannot be edited or deleted.
        </p>
      </div>
    </Modal>
  );
}
