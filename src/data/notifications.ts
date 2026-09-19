// `icon` is a key into the ICON map rendered by NotificationsMenu (lucide-react
// components), and `tab` is the tab to navigate to when the notification is
// clicked (see #15/notifications-interactive: every notification should do
// something real, not just sit there).
export const NOTIF_BUYER = [
  {
    id: 1,
    icon: "check",
    text: "Your claim for Laneige Lip Mask has been reserved.",
    time: "2m ago",
    read: false,
    tab: "My Claims" as const,
  },
  {
    id: 2,
    icon: "clock",
    text: "Payment deadline in 4 hours for KitKat Sakura.",
    time: "1h ago",
    read: false,
    tab: "Payments" as const,
  },
  {
    id: 3,
    icon: "package",
    text: "Your order ORD-2026-0042 is now Preparing.",
    time: "3h ago",
    read: true,
    tab: "Orders" as const,
  },
  {
    id: 4,
    icon: "up",
    text: "You moved up to #2 on the Laneige Lip Mask waitlist.",
    time: "5h ago",
    read: true,
    tab: "My Claims" as const,
  },
  {
    id: 5,
    icon: "check",
    text: "Extension request approved by Maria Santos.",
    time: "Yesterday",
    read: true,
    tab: "My Claims" as const,
  },
]
export const NOTIF_SELLER = [
  {
    id: 1,
    icon: "bag",
    text: "New claim: Anna Cruz claimed Laneige Lip Mask ×1.",
    time: "5m ago",
    read: false,
    tab: "My Claims" as const,
  },
  {
    id: 2,
    icon: "clipboard",
    text: "Payment proof submitted by Ben Santos for SK-II Essence.",
    time: "30m ago",
    read: false,
    tab: "Payments" as const,
  },
  {
    id: 3,
    icon: "clock",
    text: "Carlo Reyes' reservation expires in 1 hour — Laneige Lip Mask.",
    time: "1h ago",
    read: false,
    tab: "Batches" as const,
  },
  {
    id: 4,
    icon: "up",
    text: "Waitlist slot opened for Tokyo Banana — Trisha Lim notified.",
    time: "3h ago",
    read: true,
    tab: "Batches" as const,
  },
  {
    id: 5,
    icon: "star",
    text: "New 5-star review from Jade Garcia on Japan Trip batch.",
    time: "Yesterday",
    read: true,
    tab: "Batches" as const,
  },
]
