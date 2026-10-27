import { Card, SH } from "@/components/shared";

// Shared Phase-1 placeholder for admin tabs whose full UI lands in Phase 2+.
// Keeps the admin shell navigable and on-brand without faking data.
export default function AdminPlaceholder({
  title,
  subtitle,
  blurb,
}: {
  title: string;
  subtitle: string;
  blurb: string;
}) {
  return (
    <div className="p-6 admin-page">
      <SH title={title} />
      <p
        style={{
          marginTop: -8,
          marginBottom: 16,
          color: "var(--kargo-muted)",
          fontSize: 12,
        }}
      >
        {subtitle}
      </p>
      <Card>
        <p style={{ color: "var(--kargo-ink-soft)", fontSize: 13, lineHeight: 1.5 }}>{blurb}</p>
      </Card>
    </div>
  );
}
