import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import LogoMark from "./LogoMark";

export default function AuthLayout({
  children,
  page,
  condensed = false,
  onAdminAccess,
}: {
  children: ReactNode;
  page: "login" | "signup" | "reset";
  condensed?: boolean;
  onAdminAccess?: () => void;
}) {
  return (
    <main className={`auth-page auth-page--${page}${condensed ? " auth-page--condensed" : ""}`}>
      <aside className="auth-brand" aria-label="Kargo">
        <LogoMark size={250} inverse />
      </aside>
      <section className="auth-form-pane">
        {onAdminAccess && (
          <button
            type="button"
            className="auth-admin-corner-button"
            onClick={onAdminAccess}
            aria-label="Admin sign in or sign up"
            title="Admin access"
          >
            <ShieldCheck size={22} aria-hidden="true" />
          </button>
        )}
        <div className="auth-form-wrap">{children}</div>
      </section>
    </main>
  );
}
