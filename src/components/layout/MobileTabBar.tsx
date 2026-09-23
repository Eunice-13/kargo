import { LayoutDashboard, Package, ClipboardList, Wallet, MoreHorizontal } from "lucide-react"
import type { Role, Tab } from "@/types"
import { INDIGO } from "@/constants/theme"

// Mobile-only bottom navigation (Task B5). Shows a small set of PRIMARY
// destinations with icon + text label (never icon-only), sized for comfortable
// thumb reach (>=44px targets). Secondary destinations (Settings, profile,
// logout, seller application) stay nested behind the "More" entry, which opens
// the existing profile menu in the header. Rendered only under the mobile
// breakpoint via the `.kargo-mobile-tabbar` class in index.css; the desktop top
// TabBar is untouched and hidden on mobile by the same stylesheet.
//
// The four primary tabs mirror the top TabBar's TABS. "My Claims" is relabelled
// per role, exactly like the top bar. A fifth "More" button surfaces the
// profile/settings entry point rather than adding a top-level tab for it.
const PRIMARY: { tab: Tab; icon: typeof LayoutDashboard }[] = [
  { tab: "Dashboard", icon: LayoutDashboard },
  { tab: "Batches", icon: Package },
  { tab: "My Claims", icon: ClipboardList },
  { tab: "Payments", icon: Wallet },
]

export default function MobileTabBar({
  active,
  setActive,
  role,
  onMore,
}: {
  active: Tab
  setActive: (t: Tab) => void
  role: Role
  onMore: () => void
}) {
  const labelFor = (tab: Tab) =>
    tab === "My Claims" ? (role === "Seller" ? "Orders" : "Claims") : tab

  return (
    <nav
      className="kargo-mobile-tabbar"
      aria-label="Primary"
      style={{
        background: "#fff",
        borderTop: "1px solid #E5E7EB",
        boxShadow: "0 -2px 12px rgba(0,0,0,0.06)",
      }}
    >
      {PRIMARY.map(({ tab, icon: Icon }) => {
        const on = active === tab
        return (
          <button
            key={tab}
            type="button"
            onClick={() => setActive(tab)}
            aria-current={on ? "page" : undefined}
            className="kargo-mobile-tab"
            style={{ color: on ? INDIGO : "#6B7280" }}
          >
            <Icon size={22} aria-hidden="true" strokeWidth={on ? 2.4 : 2} />
            <span style={{ fontWeight: on ? 700 : 500 }}>{labelFor(tab)}</span>
          </button>
        )
      })}
      <button
        type="button"
        onClick={onMore}
        className="kargo-mobile-tab"
        aria-label="More options: profile, settings, and account"
        style={{ color: "#6B7280" }}
      >
        <MoreHorizontal size={22} aria-hidden="true" />
        <span style={{ fontWeight: 500 }}>More</span>
      </button>
    </nav>
  )
}
