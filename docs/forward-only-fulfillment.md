# Forward-Only Fulfillment Restriction

Once a Seller Fulfillment Board order advances to the next fulfillment stage, it
can never move backward — for sellers or admins, with no override. Enforcement
is layered, and the database layer is authoritative.

## Stages and valid transitions (unchanged)

Canonical forward path:

```
Payment Confirmed → Preparing → Shipped → (In Transit) → Delivered
```

- `Cancelled` (and the DB-level `incomplete` / `expired`) is a terminal side
  branch reachable from any pre-delivery stage. It is not a delivery stage.
- `Delivered` is terminal. `in_transit` is a legacy stage the UI no longer
  emits but the DB still ranks for existing rows.
- The one allowed "skip" is `Shipped → Delivered` (sellers may mark delivered
  directly without re-emitting in-transit).

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

4. **Cancellation remains the terminal branch.** `cancel_order` /
   `admin_cancel_order` must route cancellation through status
   `cancelled`/`incomplete`/`expired`. These are terminal: the guard forbids
   reopening them and forbids cancelling an already-`delivered` order. Phase 2
   cancellation-on-payment-failure must respect that a delivered order cannot be
   cancelled.

5. **The row trigger is the single chokepoint.** Phase 2 must not add a
   `SECURITY DEFINER` function, role grant, or RLS policy that updates
   `public.orders` in a way that assumes it can move fulfillment backward. All
   order updates pass through `guard_forward_fulfillment()`; there is
   intentionally no bypass. New payment RPCs that touch `orders` should only
   mutate payment columns (`status` within payment states pre-preparation,
   `payment_confirmed_at`, payment metadata) and leave `fulfillment_stage` /
   `completed_at` to the fulfillment RPC.

## Tests

- `tests/forwardFulfillment.test.mjs` — ephemeral PGlite + SSR-rendered board.
  Covers: client transition matrix, rendered-board option gating, every forward
  edge + optional in-transit + idempotent retries + notifications, every
  backward/skip RPC rejection, direct-SQL and payment-style reset rejection,
  admin security-definer bypass rejection, cancellation terminality,
  delivered-cannot-be-cancelled / `completed_at` immutability, authorization,
  and pre-preparation payment corrections still working.
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
