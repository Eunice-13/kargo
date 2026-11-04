import type { ClaimRow, PayHistRow } from "@/types"

type CombinedInfo = { groupId: string; total: number; itemCount: number }

/**
 * Combined Delivery keeps one payment on a single child order while its
 * reservations name the other children. Index every member order id so the
 * dashboard can collapse them into one row.
 */
export function combinedByOrderId(
  payHistory: PayHistRow[],
): Map<string, CombinedInfo> {
  const map = new Map<string, CombinedInfo>()

  for (const payment of payHistory) {
    if (!payment.combinedDeliveryGroupId) continue

    const memberIds = (
      payment.reservationIds?.length
        ? payment.reservationIds
        : payment.orderId
          ? [String(payment.orderId)]
          : []
    ).map(String)

    for (const memberId of memberIds) {
      map.set(memberId, {
        groupId: payment.combinedDeliveryGroupId,
        total: payment.amount,
        itemCount: memberIds.length,
      })
    }
  }

  return map
}

function claimTime(claim: ClaimRow) {
  const iso = claim.createdAt ?? claim.expiresAt
  const time = iso ? new Date(iso).getTime() : NaN
  return Number.isFinite(time) ? time : 0
}

/**
 * Collapse each combined group into a single row (grouped by combined group
 * id, never seller + product, so a separate claim for the same product stays
 * independent). The representative row carries the combined total and an item
 * count, while its status comes from the member order / combined payment.
 */
export function collapseCombinedClaims(
  rows: ClaimRow[],
  payHistory: PayHistRow[],
): ClaimRow[] {
  const combined = combinedByOrderId(payHistory)
  const seenGroups = new Set<string>()

  const collapsed: ClaimRow[] = []

  for (const claim of [...rows].sort((a, b) => claimTime(b) - claimTime(a))) {
    const info = combined.get(String(claim.id))

    if (!info) {
      collapsed.push(claim)
      continue
    }

    if (seenGroups.has(info.groupId)) continue
    seenGroups.add(info.groupId)

    collapsed.push({
      ...claim,
      amount: info.total,
      combinedDeliveryGroupId: info.groupId,
      combinedItemCount: info.itemCount,
    })
  }

  return collapsed
}

/** Pending / Insufficient need action, so they lead the preview. */
export function claimNeedsAction(status: ClaimRow["status"]) {
  return status === "Pending" || status === "Insufficient Payment"
}

/** Collapsed rows with actionable claims first, then newest-first. */
export function claimPreview(rows: ClaimRow[], payHistory: PayHistRow[]) {
  const collapsed = collapseCombinedClaims(rows, payHistory)
  return [
    ...collapsed.filter((claim) => claimNeedsAction(claim.status)),
    ...collapsed.filter((claim) => !claimNeedsAction(claim.status)),
  ]
}
