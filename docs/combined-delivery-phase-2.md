# Smart Combined Delivery — Phase 2: Buyer Request Workflow

Phase 2 is implemented in the repository, not deployed to the linked database.
Seller review/approval, shared shipping-fee assignment and combined payments are
not implemented or enabled. The Phase-1 fee/state constraints remain in force.

## Buyer experience

- Existing compact horizontal Pending Payments cards and their individual
  product, quantity, amount and ordinary payment actions are preserved.
- If at least two reservations pass all non-address eligibility checks and
  have exactly the same saved pin/full address, offer **Request Combined
  Delivery** above the list. Suggestions never submit or bind anything.
- The shared modal lists actual seller/batch/method, products, quantities,
  individual amounts, selected item subtotal and shipping-fee-pending status.
- Buyers can select a subset when more than two reservations are eligible and
  switch between compatible contexts. Cross-batch options are separate; no
  seller override, name comparison or scheduling exception exists.
- Confirm Request stays disabled until at least two eligible items are selected
  and the buyer explicitly confirms the saved pin and full address, including
  unit/building details. Changing selection resets confirmation.
- Pending member cards display **Combined delivery requested** instead of a
  duplicate waiting label. View request opens the same accessible shared modal
  showing all original member products and amounts.
- A buyer can cancel a pending request. This releases membership, not inventory
  or reservations. It preserves the original shipping-review pause and budget.
- Rejected/cancelled/invalidated requests remain viewable as history. Rejected
  cards show the rejection label; details show the reason when present. No
  rejection action is introduced here; Phase 3 owns seller review.
- Existing Pending Payments pagination/show-all behavior remains unchanged.
- Successful mutations and browser focus reload authoritative candidates and
  request history. No optimistic fake group, fee or combined payment is shown.
- Without configured Supabase the new feature is hidden; it does not invent
  demo request persistence. Missing migrations/network errors produce an
  unobtrusive retry message rather than enabling unsafe actions.

## Strict eligibility and destination confirmation

The existing Phase-1 eligibility and strict batch helpers remain authoritative.
Every member must belong to the same buyer, seller and exact database batch ID,
use delivery with the same reserved payment method, and be active/unpaid with
no payment history, finalized fee (including zero), other group, or correction.
The original paused time budget must remain positive.

Phase-2 suggestions also compare the exact saved latitude, longitude and full
address. No coordinate rounding, proximity, fuzzy text, batch-name matching or
URL expansion is used. Coordinates alone are insufficient. Different non-null
confirmed destination IDs never merge, even if their text/pins appear equal.

For legacy orders lacking a destination ID, the buyer explicitly confirms the
same existing snapshot. The submit RPC checks the echoed pin/address against
EVERY selected order again, then creates/binds one buyer-owned immutable
Phase-1 destination inside the request transaction. It does not repin an order
or rewrite its address. URL-only or incomplete addresses require the existing
individual correction flow first. Changed confirmed snapshots stay ineligible.

This confirmation establishes shared destination identity; it is not postal
address validation or a promise that the seller can fulfill the shipment.
The seller's compatibility review remains required in Phase 3.

## Server transaction and notifications

`request_combined_delivery`:

1. Requires an active buyer, explicit destination confirmation, valid original
   pin/address and two or more distinct owned reservation IDs.
2. Takes a transaction advisory lock per buyer, then locks owned orders in
   sorted ID order. Calls the centralized V1 batch assertion under product/batch
   locks, and rechecks seller, method, destination and every eligibility reason.
3. Returns the same existing pending group for an exact retry (including
   reversed selection order), without duplicating a destination, members,
   audit events or notification. Overlapping active requests are rejected.
4. Applies a one-minute cooldown when reusing reservations from a recent
   request to reduce cancellation/rejection spam. Disjoint requests, exact
   idempotent retries and cancellation remain available immediately. This is a
   request rate limit, not a new reservation deadline.
5. Confirms the destination, then runs the full Phase-1 eligibility RPC again
   inside the same transaction before inserting the group and all memberships.
6. Creates one group-level seller notification using the existing notification
   table/dedupe pattern and the My Claims target. Emails are left for Phase 4;
   no new mail template or notification service is introduced here.

`cancel_combined_delivery_request` locks the same buyer/orders/group context,
accepts only the owning buyer while pending, and is idempotent after cancellation.
The existing group audit trigger releases memberships and records cancellation.
It creates one deduplicated seller cancellation notification.

Neither RPC changes quantity, item amount, reservation status, fees, expiry or
pause timestamps. Existing allocation, expiration, waitlist and payment logic
remain intact. Phase-1 table guards continue blocking individual shipping,
address, deadline or payment changes while a request is active. Buyers can
cancel first to return to individual shipping handling. Seller review controls
will be implemented only after Phase 3 is approved.

The normal deadline sweep skips the already-paused members. Making/cancelling
requests never refreshes the original remaining-time budget, so repeated
requests cannot extend payment time after a fee is finalized.

## Files touched in Phase 2

- `src/features/combined-delivery/BuyerCombinedDelivery.tsx`: list controller,
  suggestion/error handling and modal wiring.
- `src/features/combined-delivery/useBuyerDeliveryRequests.ts`: loading, refresh,
  request/cancel mutations, duplicate-click and stale-response guards.
- `src/features/combined-delivery/CombinedDeliveryRequestDialog.tsx`: selection,
  explicit confirmation and pending/historical request detail views.
- `src/features/combined-delivery/requestEligibility.ts`: potential-request
  selection rules and per-order request lookup.
- `src/features/combined-delivery/index.ts`: public feature export.
- `src/features/claims/MyClaims.tsx`: focused buyer-list integration.
- `src/features/claims/PendingPaymentCard.tsx`: compact request status labels.
- `src/types/combinedDelivery.ts` and `src/services/combinedDelivery.ts`: typed
  Phase-2 request projection and RPC adapters.
- `supabase/migrations (to update profile database name)/202610210001_combined_delivery_buyer_requests.sql`:
  buyer request projection, transactional creation and cancellation.
- `supabase/rollbacks/202610210001_combined_delivery_buyer_requests.sql`:
  remove Phase-2 RPCs only after pending requests are resolved, retaining history.
- `tests/combinedDeliveryRequest.test.ts`, `tests/combinedDeliveryRequestUi.test.mjs`
  and `tests/fixtures/RenderModal.tsx`: eligibility and rendering regression tests.
- `supabase/tests/combined_delivery_buyer_requests.sql`,
  `supabase/tests/fixtures/combined_delivery_minimal_schema.sql` and
  `scripts/test-combined-delivery-db.mjs`: transactional database tests and an
  optional embedded PostgreSQL runner.
- `supabase/rollbacks/202610200002_combined_delivery_foundations.sql`: correct
  the destination-policy dependency order exposed by the new rollback test.
- This report. Phase-1 implementation and architecture notes remain separate.

## Validation and boundaries

Results: 77 relevant Node tests passed (selection, rendering, card and payment/
deadline regressions). Typecheck and production build passed. Both migration/SQL
test suites and the unused-deployment rollback chain passed in the embedded
PostgreSQL fixture. Changed/new files pass formatting except `MyClaims.tsx`; its
committed baseline also fails the repository formatter, so unrelated reformatting
was avoided. `git diff --check` passes. No separate lint script is configured.

Run JS/TS tests with Node's test runner. The rendering suite uses a minimal
Modal adapter for SSR, not a browser: it verifies initial confirmation state,
product/amount display, request status and historical rejection content. The
actual shared Modal provides the existing portal, keyboard focus and touch UI.

Database suites can be run on local Supabase after both migrations:

```sh
psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/combined_delivery_foundations.sql
psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/combined_delivery_buyer_requests.sql
```

A temporary, test-only PGlite installation was used to execute the actual SQL
migrations and both suites against an embedded PostgreSQL fixture. No application
dependency or lockfile was added. Reproduce without installing into KARGO:

```sh
npm install --prefix /private/tmp/kargo-combined-delivery-dbtest --no-package-lock --ignore-scripts --no-audit --no-fund @electric-sql/pglite
KARGO_PGLITE_MODULE=/private/tmp/kargo-combined-delivery-dbtest/node_modules/@electric-sql/pglite/dist/index.js node scripts/test-combined-delivery-db.mjs
```

The fixture mirrors the columns, permissions and expiry guards used by these
suites; it does not recreate every production migration. Both migrations and
their unused-deployment rollback chain are exercised. SQL tests cover ownership,
RLS, batch/destination/status/fee compatibility, duplicate retries, overlap,
atomic failure, unchanged inventory/timers, audits, notification deduplication,
owner-only cancellation and cooldown. The existing shipping-fee RPC is also
executed unchanged to verify it is blocked for active groups and resumes the original budget after
cancellation. Real simultaneous sessions, the PostgREST relationship projection and the complete live Supabase schema still need staging
validation. The UI has not been visually verified on desktop/mobile in a browser.

No migration was applied to live Supabase. Apply Phase 1 then Phase 2 only after
staging validation. Roll back the Phase-2 frontend together with its RPCs;
rollback refuses active pending requests so buyers cannot be stranded. No table
or reservation history is deleted. Do not proceed to Phase 3 without approval.
