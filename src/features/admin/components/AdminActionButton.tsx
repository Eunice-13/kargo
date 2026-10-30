import type { CSSProperties, ReactNode } from "react";
import {
  Ban,
  CircleCheck,
  CircleX,
  Eye,
  EyeOff,
  Flag,
  FlagOff,
  Lock,
  LockOpen,
  RotateCcw,
  UserCheck,
  UserMinus,
  X,
  type LucideIcon,
} from "lucide-react";

import { ADMIN_TONES } from "@/constants/admin";

export type AdminActionTone = "neutral" | "danger" | "success" | "warning" | "accent" | "pro";
export type AdminActionKind =
  | "dismiss"
  | "suspend"
  | "revokeSeller"
  | "revokeAccess"
  | "grantSeller"
  | "restoreAccount"
  | "lock"
  | "unlock"
  | "flag"
  | "unflag"
  | "hide"
  | "show"
  | "closeBatch"
  | "cancelOrder"
  | "verifyPayment"
  | "rejectPayment"
  | "override"
  | "reopen";

const ACTION_TONES = {
  neutral: {
    bg: "var(--kargo-surface)",
    border: "var(--kargo-line)",
    text: "var(--kargo-ink-soft)",
  },
  danger: {
    bg: ADMIN_TONES.danger.bg,
    border: ADMIN_TONES.danger.dot,
    text: ADMIN_TONES.danger.fg,
  },
  success: {
    bg: ADMIN_TONES.good.bg,
    border: ADMIN_TONES.good.dot,
    text: ADMIN_TONES.good.fg,
  },
  warning: {
    bg: ADMIN_TONES.warn.bg,
    border: ADMIN_TONES.warn.dot,
    text: ADMIN_TONES.warn.fg,
  },
  accent: {
    bg: ADMIN_TONES.admin.bg,
    border: ADMIN_TONES.admin.dot,
    text: ADMIN_TONES.admin.fg,
  },
  pro: {
    bg: ADMIN_TONES.pro.bg,
    border: ADMIN_TONES.pro.dot,
    text: ADMIN_TONES.pro.fg,
  },
} satisfies Record<AdminActionTone, { bg: string; border: string; text: string }>;

const ACTIONS: Record<AdminActionKind, { tone: AdminActionTone; icon: LucideIcon }> = {
  dismiss: { tone: "neutral", icon: X },
  suspend: { tone: "danger", icon: Ban },
  revokeSeller: { tone: "warning", icon: UserMinus },
  revokeAccess: { tone: "danger", icon: UserMinus },
  grantSeller: { tone: "success", icon: UserCheck },
  restoreAccount: { tone: "accent", icon: RotateCcw },
  lock: { tone: "neutral", icon: Lock },
  unlock: { tone: "accent", icon: LockOpen },
  flag: { tone: "warning", icon: Flag },
  unflag: { tone: "accent", icon: FlagOff },
  hide: { tone: "pro", icon: EyeOff },
  show: { tone: "accent", icon: Eye },
  closeBatch: { tone: "danger", icon: CircleX },
  cancelOrder: { tone: "danger", icon: Ban },
  verifyPayment: { tone: "success", icon: CircleCheck },
  rejectPayment: { tone: "danger", icon: CircleX },
  override: { tone: "warning", icon: RotateCcw },
  reopen: { tone: "warning", icon: RotateCcw },
};

const TONE_ICONS: Record<AdminActionTone, LucideIcon> = {
  neutral: X,
  danger: CircleX,
  success: CircleCheck,
  warning: Flag,
  accent: RotateCcw,
  pro: EyeOff,
};

export const adminActionTone = (action: AdminActionKind): AdminActionTone => ACTIONS[action].tone;

export default function AdminActionButton({
  children,
  action,
  tone = "neutral",
  size = "md",
  disabled = false,
  loading = false,
  onClick,
}: {
  children: ReactNode;
  action?: AdminActionKind;
  tone?: AdminActionTone;
  size?: "sm" | "md";
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
}) {
  const resolvedTone = action ? ACTIONS[action].tone : tone;
  const Icon = action ? ACTIONS[action].icon : TONE_ICONS[resolvedTone];
  const colors = ACTION_TONES[resolvedTone];

  return (
    <button
      type="button"
      className={`admin-action-button admin-action-button--${resolvedTone} admin-action-button--${size}`}
      disabled={disabled || loading}
      onClick={onClick}
      style={
        {
          "--admin-action-bg": colors.bg,
          "--admin-action-border": colors.border,
          "--admin-action-text": colors.text,
        } as CSSProperties
      }
    >
      {loading && <span className="admin-action-button__spinner" aria-hidden="true" />}
      {!loading && <Icon className="admin-action-button__icon" size={16} aria-hidden="true" />}
      {children}
    </button>
  );
}
