import type { ReactNode } from "react";

// Shared read-only fact grid used by every admin detail modal. A real <dl>
// keeps the label/value pairs meaningful to screen readers.
export function AdminFactGrid({ children }: { children: ReactNode }) {
  return <dl className="admin-facts">{children}</dl>;
}

export function AdminFact({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="admin-fact">
      <dt>{label}</dt>
      <dd className={mono ? "admin-fact__value admin-fact__value--mono" : "admin-fact__value"}>
        {value}
      </dd>
    </div>
  );
}

export function AdminModalSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="admin-modal-section">
      <div className="admin-modal-section__head">
        <h3>{title}</h3>
        {hint && <span>{hint}</span>}
      </div>
      {children}
    </section>
  );
}

export function AdminEmptyText({ children }: { children: ReactNode }) {
  return <p className="admin-empty-text">{children}</p>;
}
