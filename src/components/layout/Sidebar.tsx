import { useState } from "react"
import { CreditCard, LayoutDashboard, Package, Plus } from "lucide-react"
import type { Role, Tab } from "@/types"

const NAV_ITEMS: Array<{ tab: Tab; label: string; icon: typeof LayoutDashboard }> = [
    { tab: "Dashboard", label: "Dashboard", icon: LayoutDashboard },
    { tab: "Batches", label: "Batches", icon: Package },
    { tab: "Payments", label: "Payments", icon: CreditCard },
]

export default function Sidebar({
    active,
    setActive,
    role,
    onNewBatch,
}: {
    active: Tab
    setActive: (tab: Tab) => void
    role: Role
    onNewBatch: () => void
}) {
    const [isExpanded, setIsExpanded] = useState(false)
    const collapseAfterNavigate = (callback: () => void) => {
        setIsExpanded(false)
        callback()
    }

    return (
        <aside
            className={`kargo-sidebar fixed left-0 top-0 h-screen z-50 flex flex-col${isExpanded ? " is-expanded" : ""}`}
            aria-label="Primary navigation"
            onMouseEnter={() => setIsExpanded(true)}
            onMouseLeave={() => setIsExpanded(false)}
        >
            <nav className="kargo-sidebar-nav">
                {NAV_ITEMS.map(({ tab, label, icon: Icon }) => {
                    const isActive = active === tab
                    return (
                        <button
                            key={tab}
                            type="button"
                            data-spotlight={`${tab.toLowerCase()}-tab`}
                            aria-current={isActive ? "page" : undefined}
                            aria-label={label}
                            title={label}
                            onClick={() => collapseAfterNavigate(() => setActive(tab))}
                            className={`kargo-sidebar-item${isActive ? " is-active" : ""}`}
                        >
                            <span className="kargo-sidebar-icon flex items-center justify-center p-2">
                                <Icon className="w-5 h-5" size={20} strokeWidth={isActive ? 2.4 : 2} aria-hidden="true" />
                            </span>
                            <span className="kargo-sidebar-label">{label}</span>
                        </button>
                    )
                })}
            </nav>
            {role === "Seller" && (
                <div className="kargo-sidebar-footer">
                    <button
                        type="button"
                        className="kargo-sidebar-item kargo-sidebar-new-batch"
                        onClick={() => collapseAfterNavigate(onNewBatch)}
                        aria-label="New Batch"
                        title="New Batch"
                    >
                        <span className="kargo-sidebar-icon flex items-center justify-center p-2">
                            <Plus className="w-5 h-5" size={20} strokeWidth={2.2} aria-hidden="true" />
                        </span>
                        <span className="kargo-sidebar-label">New Batch</span>
                    </button>
                </div>
            )}
        </aside>
    )
}