const footerGroups = [
  {
    title: "About Kargo",
    links: [
      // TODO: Replace placeholder routes when dedicated content pages are added.
      { label: "About Us", href: "/about" },
      { label: "Policies", href: "/policies" },
    ],
  },
  {
    title: "Customer Service",
    links: [
      // TODO: Replace placeholder routes when dedicated support pages are added.
      { label: "Help Centre", href: "/help" },
      { label: "Order Tracking", href: "/orders/tracking" },
      { label: "Contact Us", href: "/contact" },
    ],
  },
];

const socialLinks = [
  // TODO: Replace these placeholders with Kargo's official social profiles.
  { label: "Facebook", href: "#facebook", mark: "f" },
  { label: "Instagram", href: "#instagram", mark: "◎" },
  { label: "Twitter", href: "#twitter", mark: "" },
  { label: "YouTube", href: "#youtube", mark: "" },
];

import type { Role } from "@/types";

export default function Footer({ role }: { role?: Role }) {
  // Admins get a slim internal footer, not the marketing one.
  if (role === "Admin") {
    return (
      <footer
        className="kargo-footer kargo-footer--admin"
        style={{
          padding: "18px 24px",
          borderTop: "1px solid var(--kargo-line)",
          background: "var(--kargo-surface)",
          color: "var(--kargo-muted)",
          fontSize: 12,
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontWeight: 600 }}>KARGO Admin · Internal use only</span>
        <a href="mailto:kargoph2026@gmail.com" style={{ color: "var(--kargo-navy)", fontWeight: 600 }}>
          kargoph2026@gmail.com
        </a>
      </footer>
    );
  }

  return (
    <footer className="kargo-footer">
      <div className="kargo-footer__grid">
        {footerGroups.map((group) => (
          <section key={group.title}>
            <h2>{group.title}</h2>
            <nav aria-label={group.title}>
              {group.links.map((link) => (
                <a key={link.label} href={link.href}>
                  {link.label}
                </a>
              ))}
            </nav>
          </section>
        ))}
        <section>
          <h2>Follow Us</h2>
          <nav aria-label="Kargo social links">
            {socialLinks.map((link) => (
              <a key={link.label} href={link.href}>
                <span
                  className={`kargo-footer__social-mark${link.label === "Instagram" ? " kargo-footer__social-mark--instagram" : ""}`}
                  aria-hidden="true"
                >
                  {link.label === "Facebook" ? (
                    <svg viewBox="0 0 24 24" focusable="false">
                      <path d="M13.4 21v-8.2h2.8l.4-3.2h-3.2v-2c0-.9.3-1.5 1.6-1.5h1.7V3.2c-.3 0-1.3-.2-2.5-.2-2.5 0-4.2 1.5-4.2 4.3v2.3H7.2v3.2H10V21h3.4z" />
                    </svg>
                  ) : link.label === "Twitter" ? (
                    <svg viewBox="0 0 24 24" focusable="false">
                      <path d="M22 5.9a8 8 0 0 1-2.4.7 4.2 4.2 0 0 0 1.8-2.3 8.3 8.3 0 0 1-2.7 1 4.2 4.2 0 0 0-7.2 3.8 12 12 0 0 1-8.7-4.4 4.2 4.2 0 0 0 1.3 5.6 4.1 4.1 0 0 1-1.9-.5v.1a4.2 4.2 0 0 0 3.4 4.1 4.2 4.2 0 0 1-1.9.1 4.2 4.2 0 0 0 3.9 2.9A8.4 8.4 0 0 1 1.4 19a11.8 11.8 0 0 0 6.4 1.9c7.7 0 11.9-6.4 11.9-11.9v-.5A8.5 8.5 0 0 0 22 5.9z" />
                    </svg>
                  ) : link.label === "Instagram" ? (
                    <svg
                      viewBox="0 0 24 24"
                      focusable="false"
                      className="kargo-footer__instagram-icon"
                    >
                      <rect x="3" y="3" width="18" height="18" rx="5" />
                      <circle cx="12" cy="12" r="4" />
                      <circle className="kargo-footer__instagram-dot" cx="17.5" cy="6.8" r="1" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" focusable="false">
                      <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.6 3.6 12 3.6 12 3.6s-7.6 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.8.5 9.4.5 9.4.5s7.6 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.3 3.6-6.3 3.6Z" />
                    </svg>
                  )}
                </span>
                {link.label}
              </a>
            ))}
          </nav>
        </section>
      </div>
      <p>© 2026 Kargo. All Rights Reserved.</p>
    </footer>
  );
}
