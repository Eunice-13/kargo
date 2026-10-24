import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";

// Mirrors the buyer/seller dashboard stat cards: gradient fill, colored top
// strip, icon in the top-right, large value, muted label, and a tinted
// sub-label. Cards become buttons when `onClick` is provided.
export default function AdminStatCard({
  icon: Icon,
  label,
  value,
  sub,
  background,
  accent,
  strip,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub: string;
  background: string;
  accent: string;
  strip: string;
  onClick?: () => void;
}) {
  const interactive = typeof onClick === "function";

  return (
    <article
      className={`admin-stat${interactive ? " admin-stat--interactive" : ""}`}
      style={{ background, "--admin-stat-strip": strip } as CSSProperties}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? `Open ${label}` : undefined}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                event.currentTarget.click();
              }
            }
          : undefined
      }
    >
      <Icon size={20} aria-hidden="true" style={{ color: accent }} />
      <strong>{value}</strong>
      <span>{label}</span>
      <small style={{ color: accent }}>{sub}</small>
    </article>
  );
}
