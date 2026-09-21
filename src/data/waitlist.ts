import type { WaitlistEntry } from "@/types"

export const WAITLIST_INIT: WaitlistEntry[] = [
  {
    id: "wl-laneige",
    product: "Laneige Lip Mask",
    batchId: 2,
    batch: "Korea Haul — April 2026",
    seller: "Ana Reyes",
    trips: "Apr 3–12, 2026",
    position: 3,
    queueSize: 5,
    amount: 950,
  },
  {
    id: "wl-pastries",
    product: "85°C Pastries",
    batchId: 8,
    batch: "Taiwan Finds — July 2026",
    seller: "Rico Santos",
    trips: "Jul 20–28, 2026",
    position: 1,
    queueSize: 1,
    amount: 560,
  },
  {
    id: "wl-skii",
    product: "SK-II Essence",
    batchId: 9,
    batch: "Singapore Haul — Aug 2026",
    seller: "Jade Bautista",
    trips: "Aug 20–27, 2026",
    position: 2,
    queueSize: 4,
    amount: 4800,
  },
]

export function tripStartMs(trips: string): number {
  const iso = trips.match(/(\d{4}-\d{2}-\d{2})/)
  if (iso) {
    const t = new Date(`${iso[1]}T00:00:00`).getTime()
    return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t
  }
  const monthDay = trips.match(/^([A-Za-z]{3})\s+(\d+)/)
  const year = trips.match(/(\d{4})/)
  if (monthDay && year) {
    const t = Date.parse(`${monthDay[1]} ${monthDay[2]}, ${year[1]}`)
    return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t
  }
  return Number.MAX_SAFE_INTEGER
}

export function sortWaitlistUpcoming(entries: WaitlistEntry[]): WaitlistEntry[] {
  return [...entries].sort((a, b) => {
    const byTrip = tripStartMs(a.trips) - tripStartMs(b.trips)
    if (byTrip !== 0) return byTrip
    return a.position - b.position
  })
}
