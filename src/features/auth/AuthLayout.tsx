import type { ReactNode } from "react"
import LogoMark from "./LogoMark"

export default function AuthLayout({
  children,
  page,
  condensed = false,
}: {
  children: ReactNode
  page: "login" | "signup"
  condensed?: boolean
}) {
  return (
    <main
      className={`auth-page auth-page--${page}${condensed ? " auth-page--condensed" : ""}`}
    >
      <aside className="auth-brand" aria-label="Kargo">
        <LogoMark size={page === "login" ? 190 : 170} inverse />
      </aside>
      <section className="auth-form-pane">
        <div className="auth-form-wrap">{children}</div>
      </section>
    </main>
  )
}
