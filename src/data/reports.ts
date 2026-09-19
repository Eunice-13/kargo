import type { ReportRow } from "@/types"

export const REPORTS_INIT: ReportRow[] = [
  {
    id: "RPT-001",
    order: "ORD-2026-0031",
    product: "Meiji Chocolate",
    seller: "Maria Santos",
    issue: "Item not as described",
    date: "Mar 25, 2026",
    status: "Resolved",
    description:
      "The chocolate arrived in good condition but had a different flavor variant than what was listed in the batch.",
  },
  {
    id: "RPT-002",
    order: "ORD-2026-0043",
    product: "Trader Joe's Snacks",
    seller: "Paolo Garcia",
    issue: "Late delivery",
    date: "May 15, 2026",
    status: "Under Review",
    description:
      "Order was supposed to arrive by May 10 but still hasn't been delivered.",
  },
  {
    id: "RPT-003",
    order: "ORD-2026-0028",
    product: "Paldo Bibimmyeon",
    seller: "Ana Reyes",
    issue: "Missing items",
    date: "Mar 1, 2026",
    status: "Open",
    description: "Ordered 4 packs but only 2 arrived in the package.",
  },
  {
    id: "RPT-004",
    order: "ORD-2026-0052",
    product: "SK-II Essence",
    seller: "Jade Bautista",
    issue: "Wrong item received",
    date: "Apr 20, 2026",
    status: "Under Review",
    description:
      "Received a different SK-II product — got the toner instead of the essence.",
  },
  {
    id: "RPT-005",
    order: "ORD-2026-0047",
    product: "85°C Pastries",
    seller: "Rico Santos",
    issue: "Seller unresponsive",
    date: "May 3, 2026",
    status: "Open",
    description:
      "Tried to contact seller multiple times about my order but no reply in 5 days.",
  },
  {
    id: "RPT-006",
    order: "ORD-2026-0031",
    product: "Meiji Chocolate",
    seller: "Maria Santos",
    issue: "Refund not processed",
    date: "Apr 1, 2026",
    status: "Resolved",
    description:
      "Requested a partial refund for damaged items but has not been processed after 2 weeks.",
  },
]
