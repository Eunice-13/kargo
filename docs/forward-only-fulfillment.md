# Forward-Only Fulfillment Restriction

Once a Seller Fulfillment Board order advances to the next fulfillment stage, it
can never move backward — for sellers or admins, with no override. Enforcement
is layered, and the database layer is authoritative.

## Stages and valid transitions (unchanged)

Canonical forward path:

```
Payment Confirmed → Preparing → Shipped → (In Transit) → Delivered
```

- `Delivered` is terminal. `in_transit` is a legacy stage the UI no longer
  emits but the DB still ranks for existing rows.
- The one allowed "skip" is `Shipped → Delivered` (sellers may mark delivered
  directly without re-emitting in-transit).
- **Cancellation is NOT available from the board.** As of
  `202611050001_no_cancel_after_payment.sql`, once an order's payment is
  confirmed it can never be cancelled — by sellers or admins — at any
  fulfillment stage. The `Cancelled` column still exists only to *display*
  orders that were cancelled while unpaid (buyer self-cancel, seller delivery
  decline) and historical cancelled rows; it can no longer be *entered*. See
  "No cancellation after payment" below.

Stage ranks used by the backend guard: `payment_confirmed`=1, `preparing`=2,
`shipped`=3, `in_transit`=4, `delivered`/`completed`=5. "Forward" means
non-decreasing rank, advancing at most one rank except the `shipped→delivered`
exception.

## Enforcement layers

1. **UI gating** — `src/features/fulfillment/FulfillmentDetails.tsx` disables
   invalid `<select>` options and re-checks on change.
2. **Client helper** — `src/constants/fulfillmentTransitions.ts`
   (`canAdvanceFulfillment`, `FULFILLMENT_TRANSITION_MESSAGE`), also enforced in
   `src/features/fulfillment/useFulfillmentBoard.ts` (`move`).
3. **Database (authoritative)** —
   `supabase/migrations/202611040001_forward_only_fulfillment.sql`:
   - `set_fulfillment_status(uuid, text)` RPC: allow-list, owning-seller
     authorization (`seller_id = auth.uid() and can_sell(...)`), idempotent
     retry, enum/stage mapping, buyer notification.
   - `guard_forward_fulfillment()` `BEFORE UPDATE` row trigger
     (`zz_orders_forward_fulfillment` on `public.orders`): rejects backward
     moves, stage skips, terminal reopen, cancelling a delivered order, and any
     change to `completed_at` once set. The trigger fires on **all** updates,
     including admin/security-definer RPCs and indirect writes, and is revoked
     from `public`/`anon`/`authenticated` (trigger-only). This is the "no admin
     override" guarantee.

No admin override path exists by design. There is no RLS policy, role, or RPC
that bypasses the row trigger.

## Preserved behavior

- All fulfillment stages and valid forward transitions are unchanged.
- Payment workflow is untouched: before preparation starts (rank < 2), status
  may still oscillate among payment states (`payment_pending`,
  `payment_submitted`, `insufficient_payment`, `payment_confirmed`). The guard
  only locks progress once `preparing` (rank ≥ 2) is reached.
- Order history mechanisms (in-app `notifications`, queued `pending_emails`,
  `admin_audit_log`) are unchanged.
- `completed_at` is now immutable once set (fulfilled-total integrity).

## No cancellation after payment

Added in `supabase/migrations/202611050001_no_cancel_after_payment.sql`
(supersedes the cancellation branch of the forward-only work). Rule: **once
payment is confirmed, the order can never be cancelled, regardless of
fulfillment stage, with no admin override.**

"Payment confirmed" is identified by `orders.payment_confirmed_at IS NOT NULL`
(stamped once at confirmation, never cleared — the same canonical signal GMV
uses), with status ∈ {`payment_confirmed`, `preparing`, `completed`} as a
fallback for any legacy confirmed row missing the timestamp. This is
stage-independent by design, so a confirmed order that has advanced to
preparing/shipped/delivered is equally protected.

Enforcement, every cancellation path:

| Path | Actor | Behavior after this change |
|------|-------|----------------------------|
| `set_fulfillment_status(..., 'cancelled')` (seller board) | seller | `'cancelled'`/`'incomplete'` removed from the RPC allow-list → "Invalid fulfillment status". The board UI no longer offers a transition into `Cancelled` (`canAdvanceFulfillment`). |
| `admin_cancel_order` | admin | Rejects with "A confirmed order cannot be cancelled" when `payment_confirmed_at` is set or status ∈ {confirmed, preparing}. Completed/already-cancelled guards unchanged. No override. |
| `guard_forward_fulfillment` row trigger | any UPDATE (direct SQL, future RPCs, security-definer) | Rejects any transition into `cancelled`/`incomplete`/`expired` from a confirmed order. This is the authoritative, un-bypassable layer. |
| `cancel_order` (buyer self-cancel) | buyer | Unchanged — already gated to `status = 'payment_pending'`, i.e. never a confirmed order. |
| `decline_delivery_order` (seller decline) | seller | Unchanged — already gated to `status = 'payment_pending'`. |

Frontend: `AdminOrderDetailModal` hides the Cancel action and shows "Confirmed
orders cannot be cancelled" when payment is confirmed; `demoCancelOrder` mirrors
the backend. The seller board's confirm-cancel modal and the `Cancelled` move
mapping were removed.

## Dependencies GMV Phase 2 (Payment Integrity) MUST preserve

These are contracts the forward-only change relies on. Phase 2 payment
verification / cancellation work must not break them.

1. **Payment corrections stay below rank 2.** Payment verification may freely
   move an order among `payment_pending` / `payment_submitted` /
   `insufficient_payment` / `payment_confirmed` *as long as fulfillment has not
   started* (no `fulfillment_stage` set, status not `preparing`/`completed`).
   The guard treats `old_rank < 2` as the payment workflow's domain. Phase 2
   must keep all payment-state churn in this pre-preparation window.

2. **Never lower fulfillment rank from a payment path.** Once an order is at
   `preparing` or beyond, no payment-integrity operation (re-review, dispute,
   reversal) may set `status` back to a payment state or clear
   `fulfillment_stage`. Such an update now raises `Fulfillment cannot move
   backward`. If Phase 2 needs to flag a payment problem on an in-fulfillment
   order, it must use a separate column/flag or the `cancelled`/`incomplete`
   terminal branch — not a backward status move. (Proven by the regression test
   "privileged direct writes and indirect payment-style resets cannot reverse
   progress".)

3. **`completed_at` is immutable.** GMV realization uses `completed_at` for
   fulfilled totals and `coalesce(payment_confirmed_at, created_at)` for
   recognition (`202611020002_admin_gmv_realization.sql`). The guard rejects any
   change to `completed_at` once set. Phase 2 must not attempt to clear or
   rewrite it (e.g. on a refund); model reversals with a separate field.

4. **Confirmed orders are never cancellable.** Phase 2 payment-integrity work
   must NOT cancel a payment-confirmed order on a late payment dispute, chargeback,
   or reversal. The row trigger rejects any transition of a confirmed order into
   `cancelled`/`incomplete`/`expired`, and `admin_cancel_order` refuses with no
   override. Model a post-confirmation payment problem with a separate flag/column
   or a dedicated dispute/refund state — never by cancelling the order. Pre-payment
   cancellation (`cancel_order`, `decline_delivery_order`, gated to
   `payment_pending`) is the only cancellation Phase 2 may rely on.

5. **The row trigger is the single chokepoint.** Phase 2 must not add a
   `SECURITY DEFINER` function, role grant, or RLS policy that updates
   `public.orders` in a way that assumes it can move fulfillment backward. All
   order updates pass through `guard_forward_fulfillment()`; there is
   intentionally no bypass. New payment RPCs that touch `orders` should only
   mutate payment columns (`status` within payment states pre-preparation,
   `payment_confirmed_at`, payment metadata) and leave `fulfillment_stage` /
   `completed_at` to the fulfillment RPC.

## Tests

- `tests/forwardFulfillment.test.mjs` — ephemeral PGlite + SSR-rendered board,
  loads both `202611040001` and `202611050001`. Covers: client transition
  matrix (Cancelled unreachable), rendered-board option gating, every forward
  edge + optional in-transit + idempotent retries + notifications, every
  backward/skip RPC rejection, direct-SQL and payment-style reset rejection,
  admin security-definer bypass rejection, **confirmed orders non-cancellable by
  board RPC / direct SQL / security-definer admin move at every stage and via
  `payment_confirmed_at`**, delivered non-cancellable, `completed_at`
  immutability, **unpaid orders still cancellable**, authorization, and
  pre-preparation payment corrections still working.
- Regression: `orderPaymentState`, `paymentVerificationState`,
  `claimPaymentState`, `paymentReadCompatibility`, `notifications`,
  `claimExpiry`, `combinedDeliveryReleaseBundle`, `combinedDeliveryRequest`,
  `localMigrationSql` — all green. Notably "payment decisions do not reopen
  terminal orders" and "terminal seller orders are not reopened by historical
  payment attempts" confirm payment/fulfillment coexistence.

## Deployment

Not deployed. Apply `202611040001_forward_only_fulfillment.sql` in staging and
validate before production. Both functions are `create or replace` and the
migration performs no data backfill, so re-run is safe and existing orders are
untouched.
