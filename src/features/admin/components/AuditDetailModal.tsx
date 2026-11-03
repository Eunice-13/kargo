import { ArrowRight, Lock } from "lucide-react";

import { Avatar, Modal } from "@/components/shared";
import { ADMIN_ACTION_LABELS, toneForStatus } from "@/constants/admin";
import type { AdminAuditRow } from "../adminTypes";

import AdminBadge from "./AdminBadge";
import { AdminEmptyText } from "./AdminFacts";

const fmt = (iso: string) => new Date(iso).toLocaleString();

const STATE_TONE: Record<string, string> = { visible: "good", flagged: "warn", hidden: "danger" };
const show = (v: unknown) =>
  v === undefined || v === null
    ? "—"
    : typeof v === "object"
      ? JSON.stringify(v)
      : String(v).replace(/_/g, " ");

function ValueBadge({ value }: { value: unknown }) {
  if (value === undefined || value === null) {
    return <span className="admin-audit-change__none">—</span>;
  }
  const raw = typeof value === "object" ? "" : String(value);
  return <AdminBadge tone={STATE_TONE[raw] ?? toneForStatus(raw)} label={show(value)} />;
}

export default function AuditDetailModal({
  entry,
  onClose,
}: {
  entry: AdminAuditRow;
  onClose: () => void;
}) {
  const before = entry.beforeState ?? {};
  const after = entry.afterState ?? {};
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
  const changed = keys.filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k])).length;

  return (
    <Modal
      title="Audit entry"
      variant="detail"
      showTitleIcon={false}
      width={580}
      className="admin-modal admin-record-modal admin-audit-modal"
      overlayClassName="admin-modal-overlay admin-record-modal-overlay"
      onClose={onClose}
    >
      <div className="space-y-5">
        <div className="admin-detail-hero">
          <Avatar name={entry.actorName} size={52} />
          <div className="admin-detail-hero__identity">
            <h2>{entry.actorName || "—"}</h2>
            <p>{fmt(entry.createdAt)}</p>
          </div>
        </div>

        <dl className="admin-user-rows admin-audit-rows">
          <div>
            <dt>Action</dt>
            <dd>
              <AdminBadge tone="info" label={ADMIN_ACTION_LABELS[entry.action] ?? entry.action} />
            </dd>
          </div>
          <div>
            <dt>Target</dt>
            <dd className="admin-audit-rows__target">{entry.targetLabel ?? entry.targetType}</dd>
          </div>
          {entry.reason && (
            <div>
              <dt>Reason</dt>
              <dd>{entry.reason}</dd>
            </div>
          )}
        </dl>

        <section className="admin-modal-section">
          <div className="admin-modal-section__head">
            <h3>Changes</h3>
            {keys.length > 0 && (
              <span>
                {changed} field{changed === 1 ? "" : "s"} changed
              </span>
            )}
          </div>
          {keys.length === 0 ? (
            <AdminEmptyText>No recorded values.</AdminEmptyText>
          ) : (
            <div className="admin-audit-changes">
              <div className="admin-audit-changes__head" aria-hidden="true">
                <span />
                <span>Before</span>
                <span />
                <span>After</span>
              </div>
              {keys.map((k) => (
                <div key={k} className="admin-audit-change">
                  <span className="admin-audit-change__label">
                    {k.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())}
                  </span>
                  <ValueBadge value={before[k]} />
                  <ArrowRight
                    size={16}
                    aria-label="changed to"
                    className="admin-audit-change__arrow"
                  />
                  <ValueBadge value={after[k]} />
                </div>
              ))}
            </div>
          )}
        </section>

        <p className="admin-audit-immutable">
          <Lock size={14} aria-hidden="true" />
          <span>Audit entries are immutable. They cannot be edited or deleted.</span>
        </p>
      </div>
    </Modal>
  );
}
