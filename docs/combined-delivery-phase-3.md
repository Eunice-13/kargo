# Smart Combined Delivery — Phase 3

Implemented seller review and one-time shared shipping fee assignment. Combined
payment submission, verification, fulfillment and countdown resumption remain
outside this phase. No migration has been applied to live Supabase.

## Behavior and decisions

- Orders Received includes a responsive combined-delivery request list. Review
  shows the buyer, batch, payment method, original product quantities and item
  amounts, and confirmed destination/pin. The existing shared Modal handles
  keyboard focus, Escape and responsive sizing.
- Sellers can approve or reject pending requests (optional rejection reason,
  maximum 500 characters). Approval moves to `awaiting_shipping_fee`; a separate
  save assigns one nonnegative PHP fee with at most two decimal places, including
  a legitimate zero fee, and moves to `shipping_fee_set`.
- Approved and fee-assigned groups retain active membership. Rejected requests
  release membership, leaving the existing individual seller-shipping flow intact.
- Every initial approval and fee assignment revalidates the actual batch UUID,
  buyer, seller/batch ownership, confirmed destination and exact saved address/pin,
  delivery fulfillment, payment method, active unpaid status, no payment history,
  pending shipping, original item amount and original paused deadline snapshots.
  The only membership exemption is the group's own active membership. Batch names
  and nearby coordinates never establish compatibility.
- Seller mutations authenticate active seller ownership, share the buyer's
  advisory lock, lock member orders in sorted order, then lock the group. No new
  client table-write permission, auth exception or client-controlled bypass exists.
- The shipping fee exists only on the group. Individual order totals, shipping
  fees, quantities and inventory allocations are never changed. Existing guards
  continue rejecting individual fee/payment writes for all active members.
- Exact retries return the existing decision/fee without duplicate notifications
  or audit events. A saved fee cannot be overwritten. Concurrent button submission
  is guarded in the UI; authoritative serialization is in the RPC transaction.
- Buyer request details show the shared fee once and sum original item snapshots
  plus that one fee. Compact horizontal product cards retain their layout and
  disabled Pay Now behavior. The existing payment-help popout explains the new
  fee-assigned hold accurately.
- Notifications use the existing in-app table, category, target and dedupe scheme.

**Deadline assumption:** Starting a countdown before combined payment exists
would consume a buyer's time without a way to pay. Therefore member deadlines
stay paused throughout Phase 3, with their original remaining budgets unchanged.
Fee assignment records the shortest original remaining budget in
`payment_window_seconds` for later integration. It does not create a live payment
deadline, reset reservation time or enable payment. Phase 4 must explicitly define
and implement atomic activation/resumption together with the payable workflow.

## Files changed in Phase 3

- `src/features/combined-delivery/SellerCombinedDelivery.tsx`: seller list, review
  dialog, approval/rejection/fee UI, loading/errors and mutation guards.
- `src/features/combined-delivery/index.ts`: public seller feature export.
- `src/features/combined-delivery/CombinedDeliveryRequestDialog.tsx`: buyer approved
  and fee-assigned states; group summary with one shared fee.
- `src/features/combined-delivery/requestEligibility.ts`: prioritize active approved
  groups when associating requests with individual product cards.
- `src/features/claims/MyClaims.tsx`: mount seller feature and supply fee-assigned
  context to the existing payment help popout.
- `src/features/claims/PendingPaymentCard.tsx`: compact approved/fee-assigned labels;
  item amount remains separate from the shared group fee.
- `src/features/claims/PendingPaymentHint.tsx`: accurate fee-assigned explanation;
  unchanged default explanation and interaction for ordinary reservations.
- `src/services/combinedDelivery.ts`: seller read and mutation RPC wrappers.
- `src/types/combinedDelivery.ts`: Phase-3 states, fee metadata and seller DTO.
- `supabase/migrations (to update profile database name)/202610210002_combined_delivery_seller_review.sql`:
  additive Phase-3 migration and private eligibility validator.
- `supabase/rollbacks/202610210002_combined_delivery_seller_review.sql`: guarded
  rollback; refuses approved groups rather than deleting their financial history.
- `supabase/tests/combined_delivery_seller_review.sql`: SQL integration scenarios.
- `scripts/test-combined-delivery-db.mjs`: run Phase-3 migration, suite and rollback
  alongside Phase-1/2 regression suites.
- `tests/combinedDeliveryRequestUi.test.mjs`: seller review, fee input and buyer/seller
  single-fee summaries.
- This report.

## Database changes and rollout

The migration extends the existing group/event state constraints, allows one
nonnegative group fee, and adds `approved_at`, `shipping_fee_set_at` and
`payment_window_seconds`. It replaces the group/member/audit triggers so approval
retains membership, adds a private group validator, and exposes only two new
seller RPCs: `seller_combined_delivery_requests()` and
`review_combined_delivery(uuid,text,text,numeric)`. Existing RLS and SELECT-only
client access remain intact. No order, inventory, payment or destination schema
changes are added in Phase 3. No new dependency is added.

Apply Phase 1, Phase 2, then Phase 3 in staging before deploying this frontend.
Roll back frontend and RPC changes together. The rollback refuses approved or
fee-assigned groups, retains audit history and restores Phase-1 trigger behavior;
it is not a destructive way to unwind live approvals.

Theme reuse: `--kargo-ink`, `--kargo-ink-soft`, `--kargo-muted`, `--kargo-line`,
`--kargo-surface`, `--kargo-focus`, existing Card/Modal/PrimaryBtn/SecondaryBtn
components and existing Tailwind status utilities. No new palette or hex values.

## Validation

- **80 JS/TS and component-render tests pass**, including existing eligibility,
  buyer requests, pending cards, expiry, claim/order payment and verification
  state regressions.
- **All three SQL integration suites pass**, with all migrations and unused-state
  rollbacks executed against the temporary embedded PostgreSQL/PGlite fixture.
  Phase 3 covers unauthorized actors, rejection/retries, batch reassignment,
  upstream seller/status/shipping/method/address/deadline changes before approval
  and fee assignment, invalid fees, repeat fee saves, one-fee accounting, retained
  active membership, deduplicated audits/notifications, individual payment/fee
  guards, and unchanged reservation rows and original time budgets.
- `npm run typecheck` and `npm run build` pass.
- `git diff --check` passes.
- `npm run format:check` passes all changed/new checked files except
  `MyClaims.tsx`. Its committed HEAD version also fails the same formatter;
  unrelated whole-file reformatting was deliberately avoided.
- No separate lint script is configured in this repository.

Reproduce SQL checks using the temporary test dependency described in the Phase-2
report and `node scripts/test-combined-delivery-db.mjs` with `KARGO_PGLITE_MODULE`.
Run the eight relevant JS/TS test files with Node's test runner, including
`combinedDeliveryRequestUi.test.mjs` (which uses an SSR-only Modal adapter).

Remaining verification: no live migration/deployment, real simultaneous-session
race test, full production Supabase schema/PostgREST validation, browser keyboard
interaction test or desktop/mobile visual inspection was performed. Responsive
classes and component output are verified in code/render tests; that is not a
claim of browser visual QA. Existing individual payment processing and seller
verification code are unchanged. Phase 4 has not been implemented.
