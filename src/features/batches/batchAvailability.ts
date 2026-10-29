import type { BatchType } from "@/types"
import { batchFormationDeadline } from "@/services/groupFormation"

type BatchLike = Pick<BatchType, "live" | "locked"> &
  Partial<Pick<BatchType, "endsOn">>

/** Last moment the batch accepts new claims, in milliseconds. */
export function batchOrderDeadline(endsOn?: string): number | null {
  if (!endsOn) return null
  try {
    return new Date(batchFormationDeadline(endsOn)).getTime()
  } catch {
    return null
  }
}

/**
 * A batch stops taking new orders when the seller locks/closes it, or when its
 * Philippine end date has passed. The server closes the same window: the
 * one-minute sweep flips expired batches to `locked`, and the claim and group
 * order functions refuse anything past the deadline. This helper exists so the
 * UI closes on the same beat instead of waiting up to a minute for the sweep —
 * and so a buyer never reaches "This batch has already closed".
 */
export function batchOrdersClosed(batch: BatchLike, now = Date.now()): boolean {
  if (batch.locked) return true
  if (!batch.live) return true
  const deadline = batchOrderDeadline(batch.endsOn)
  return deadline !== null && deadline <= now
}

/**
 * Every item in the batch is locked by the seller, so there is nothing left to
 * claim even though the batch itself still accepts orders. An empty batch is
 * not "all locked".
 */
export function batchAllItemsLocked(batch: Pick<BatchType, "products">): boolean {
  return (
    batch.products.length > 0 &&
    batch.products.every((product) => Boolean(product.locked))
  )
}

/**
 * What a batch CARD shows: closed (seller lock, passed end date) or with
 * nothing left to claim (every item locked). Cards for these batches go gray,
 * stop being tappable for buyers, and sink to the end of the list.
 *
 * Only cards use this. The batch page, claim and group-order dialogs keep
 * batchOrdersClosed(), because their copy says "closed on <date>", which would
 * be wrong for a batch that is still open but has every item locked.
 */
export function batchCardClosed(
  batch: Pick<BatchType, "live" | "locked" | "products"> & Partial<Pick<BatchType, "endsOn">>,
  now = Date.now(),
): boolean {
  return batchOrdersClosed(batch, now) || batchAllItemsLocked(batch)
}

/** True when the end date has actually passed (not merely locked or empty). */
export function batchEndDatePassed(endsOn?: string, now = Date.now()): boolean {
  const deadline = batchOrderDeadline(endsOn)
  return deadline !== null && deadline <= now
}

/** True only for the date-driven closure, so the seller is offered Re-open. */
export function batchClosedByDate(batch: BatchLike, now = Date.now()): boolean {
  if (!batch.live) return false
  const deadline = batchOrderDeadline(batch.endsOn)
  return deadline !== null && deadline <= now
}

/** "Oct 28, 2026" — the day the batch stopped taking orders. */
export function formatBatchEndDate(endsOn?: string): string {
  const deadline = batchOrderDeadline(endsOn)
  if (deadline === null) return ""
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeZone: "Asia/Manila",
  }).format(new Date(deadline))
}

/** Default new end date when a seller re-opens a closed batch: one week out. */
export function defaultReopenEndDate(now = Date.now()): string {
  const manila = new Date(now + 8 * 60 * 60 * 1000)
  manila.setUTCDate(manila.getUTCDate() + 7)
  return manila.toISOString().slice(0, 10)
}

/** Today's date in Philippine time, used to reject past reopen dates. */
export function todayInManila(now = Date.now()): string {
  return new Date(now + 8 * 60 * 60 * 1000).toISOString().slice(0, 10)
}
