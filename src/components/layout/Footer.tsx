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
]

const socialLinks = [
  // TODO: Replace these placeholders with Kargo's official social profiles.
  { label: "Facebook", href: "#facebook", mark: "f" },
  { label: "Instagram", href: "#instagram", mark: "◎" },
  { label: "Twitter", href: "#twitter", mark: "X" },
  { label: "LinkedIn", href: "#linkedin", mark: "in" },
]

export default function Footer() {
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
                <span className="kargo-footer__social-mark" aria-hidden="true">
                  {link.mark}
                </span>
                {link.label}
              </a>
            ))}
          </nav>
        </section>
      </div>
      <p>© {new Date().getFullYear()} Kargo. All Rights Reserved.</p>
    </footer>
  )
}
