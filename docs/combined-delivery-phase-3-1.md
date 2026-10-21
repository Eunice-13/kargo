# Smart Combined Delivery — Phase 3.1 recovery

The previously failing preflight audit now passes in the embedded PostgreSQL
fixture. Phase 3.1 is implemented locally; no live migration was applied and
Phase 4 payment submission/verification was not started.

## Root cause and affected paths

Phase 3 allowed only `pending_approval` rejection/cancellation. Approved groups
could move forward to `shipping_fee_set`, but could not become `invalidated`.
Meanwhile, existing product UPDATE authorization allowed moving a product between
the seller's batches. Subsequent fee assignment correctly failed strict batch
validation, leaving active memberships that blocked standalone shipping updates.
The normal expiry sweep correctly skipped the legitimate shipping pauses, so it
could not release this group hold.

Eligibility can also become stale through batch seller ownership or account
permission changes, or through inconsistent legacy member/order data (buyer,
seller, status, address, method, fulfillment, shipping state, amount or deadlines).
Normal order field updates are already blocked for active members; FK/immutable
snapshot rules protect deletion and destination changes. This correction guards
the remaining batch identity mutations and provides explicit recovery for
already-stale requests. It does not weaken those existing protections.

## Recovery and permission policy

`invalidate_combined_delivery_request(uuid)`:

1. Requires an active owning buyer, or the group's active owning seller who still
   has selling permission. Other buyers/sellers and anonymous callers are refused.
2. Takes the existing buyer advisory transaction lock, member order locks in UUID
   order, and then the group lock, matching request/cancel/review lock ordering.
3. Stabilizes product/batch context with the existing `FOR SHARE` helper and takes
   account-context share locks outside the validation exception block. Failed
   eligibility assertions cannot roll these outer locks back prematurely.
4. Reuses authoritative strict V1 group validation. Recovery proceeds only when
   this validation proves the request ineligible. Unknown/internal errors still
   fail the operation instead of being treated as an invalid request.
5. Moves an active request to `invalidated`, preserves former fee/approval metadata,
   releases memberships, repairs the permitted standalone deadline/shipping state,
   appends one audit event and sends one deduplicated in-app notice per participant.
   All effects commit together or all roll back.

Repeated recovery of an already-invalidated group returns the existing record
without a second release, audit event, notification or timer change. Released
historical members are excluded from deadline repair, since they may already
belong to a different standalone or grouped context. Orders whose buyer or seller
no longer matches the group are not rewritten.

**Cancellation interpretation:** valid approved requests remain non-cancellable,
as in Phase 3. The existing buyer-cancel and seller-reject RPCs now route approved
requests to this same server-proven-ineligibility recovery operation. They cannot
cancel valid approved requests. Pending rejection/cancellation behavior is unchanged.
The UI labels this restricted operation **Check eligibility and recover**; it is
not a general approved-request cancellation permission.

The product `batch_id` and batch `seller_id` update guards prevent changes while
an active request references that context. Unrelated edits and ungrouped product
moves keep their existing authorization and behavior. Guards do not take order
or group locks while holding a product/batch update lock, avoiding a reversed
lock acquisition order against the request/review RPCs.

## Deadline restoration and inventory

Phases 1–3 did **not** introduce a separate group timer pause. They kept the
existing standalone shipping pause (`deadline_paused_at` plus shipping state)
and added a membership hold. Releasing membership therefore removes the group
hold without discarding a still-valid shipping pause. No new pause-reason column,
duration or deadline reset policy is introduced.

- Existing shipping-fee and location-correction pauses keep their original
  timestamps and remaining budgets. The ordinary standalone shipping-fee RPC can
  then resume each reservation using its existing rule.
- A legacy standalone-ready paused reservation resumes only when shipping does
  not apply, or its individual shipping state is `fee_set` with an individual fee.
  The rule is exactly `now() + greatest(expires_at - paused_at, 0)`.
- Missing individual shipping fees remain pending, even if legacy data mislabeled
  the state as `fee_set`; a former shared group fee is never copied or divided
  across individual orders. Known missing-fee states return to `waiting_for_seller`.
- Non-delivery reservations without an individual fee lose stale shipping-only
  waiting/correction labels so their existing standalone payment UI can work.
- Unknown/non-ready delivery pause states are kept conservatively. Already
  unpaused deadlines are not reset. Exhausted budgets resume with zero time;
  terminal reservation records are not rewritten or reopened.
- Recovery itself never deletes reservations, changes quantities/prices, releases
  allocated inventory or directly allocates waitlist stock. When a recovered
  deadline has genuinely expired, the existing sweep expires the reservation and
  calls the existing waitlist allocator normally.

Original member time/amount snapshots remain immutable. The invalidation event
also records the previous deadlines, pause states and remaining seconds of the
members actually recovered, together with actor, reason and former group fee.
The former fee remains historical and non-payable in the buyer/seller details.

## Files changed in Phase 3.1

Backend and database checks:

- `supabase/migrations (to update profile database name)/202610210003_combined_delivery_recovery.sql`
- `supabase/rollbacks/202610210003_combined_delivery_recovery.sql`
- `supabase/tests/combined_delivery_recovery.sql`
- `supabase/tests/combined_delivery_foundations.sql`
- `supabase/tests/combined_delivery_seller_review.sql`
- `supabase/tests/fixtures/combined_delivery_minimal_schema.sql`
- `scripts/test-combined-delivery-db.mjs`
- `scripts/audit-combined-delivery-preflight.mjs`

Service and focused UI wiring:

- `src/services/combinedDelivery.ts`
- `src/features/combined-delivery/useBuyerDeliveryRequests.ts`
- `src/features/combined-delivery/BuyerCombinedDelivery.tsx`
- `src/features/combined-delivery/CombinedDeliveryRequestDialog.tsx`
- `src/features/combined-delivery/SellerCombinedDelivery.tsx`
- `src/features/claims/MyClaims.tsx` (only reservation refresh callbacks for recovery)
- `tests/combinedDeliveryRequestUi.test.mjs`
- This report and the status note in `docs/combined-delivery-phase-4-preflight.md`.

The migration adds no tables, order columns or payment relationships. It extends
one group financial-history constraint, adds two identity guards and one
participant-authorized RPC, and replaces the relevant lifecycle/audit RPCs.
Existing RLS and direct-write grants are unchanged. Rollback restores the prior
functions/constraint and refuses active requests or invalidated fee history rather
than removing their safety protections or erasing financial metadata.

Buyer/seller dialogs reuse existing buttons, modal and theme tokens. Recovery
refreshes the existing application data so restored standalone actions/timers do
not remain stale. The compact horizontal cards and existing payment handlers were
not redesigned. No dependency was added.

## Test results

- **82 application/render tests pass**, including strict eligibility, buyer request
  association, horizontal pending cards, individual payment/expiry regressions,
  restricted recovery UI and non-payable historical fee summaries.
- **All four SQL suites pass after all four migrations**, followed by the complete
  unused-state rollback chain. Earlier stale-batch tests now explicitly simulate
  pre-migration data by bypassing only the preventive test trigger; new guards
  are independently exercised using authenticated seller permissions in the audit.
- The **extended preflight audit passes all four scenarios**: seller rejection,
  buyer cancellation, buyer recovery and recovery after shared-fee assignment.
  It checks batch-mutation prevention, refusal to cancel valid groups, unchanged
  reservation rows/shipping pauses, released memberships, one event and one notice
  per participant. Assertions fail the process rather than silently accepting an
  unrecognized result.
- New SQL tests cover eligibility dimensions, actor authorization, repeated
  recovery, historical fee preservation, stale partial membership, individual
  budgets of 7 hours/130 minutes, correction pauses, standalone-ready resumption,
  missing individual fees, zero/already-expired budgets, and failed-transaction
  rollback after membership release and deadline repair.
- Expiry/waitlist tests execute the **real existing** `sweep_expirations`,
  `offer_to_next_waitlist`, `place_order_for_buyer` and `available_stock` functions
  loaded from their existing migrations. They verify that normal expiry, not
  invalidation, frees stock and that the existing allocator creates the next claim.
- `npm run typecheck` and `npm run build` pass. `git diff --check` passes.
- `npm run format:check` flags only the known pre-existing `MyClaims.tsx` baseline
  formatting issue. The committed HEAD version was also checked and fails; no
  unrelated whole-file reformat was performed. No separate lint script exists.

Reproduce the SQL/audit checks using the same temporary test dependency as Phase 3:

```sh
KARGO_PGLITE_MODULE=/private/tmp/kargo-combined-delivery-dbtest/node_modules/@electric-sql/pglite/dist/index.js node scripts/test-combined-delivery-db.mjs
KARGO_PGLITE_MODULE=/private/tmp/kargo-combined-delivery-dbtest/node_modules/@electric-sql/pglite/dist/index.js node scripts/audit-combined-delivery-preflight.mjs
```

## Remaining verification before Phase 4

The original recovery blocker is resolved in local tests. No additional functional
blocker was found during this correction. Apply the four migrations in order in
staging and validate the complete production schema/RLS before deployment.

Real simultaneous PostgreSQL sessions were **not** tested: this environment has
no PostgreSQL/psql/Docker runtime, and PGlite uses a single connection. SQL tests
prove rollback atomicity and sequential conflicting-operation/idempotency behavior;
they do not prove a live multi-session race result. Staging should race recovery
against fee assignment, repeated recovery, and a batch change during request
creation, and verify the same all-or-nothing outcome under normal READ COMMITTED
isolation. Deadlock/serialization errors must be retried as whole operations.

The component tests use the existing SSR-only modal adapter. Real desktop/mobile
visual checks and browser keyboard/touch interaction testing remain outstanding.
No live schema was changed. Combined payment submission/verification and Phase 4
remain unimplemented and require the user's review and approval.
