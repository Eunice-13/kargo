# Phase 4 — Combined payments and notifications

Phase 4 development is complete and locally validated. It adds one manual payment
proof for an approved combined delivery, atomic seller verification/rejection,
shared-deadline handling and deduplicated group notifications. Phase 5 has not
started. **No production migration, payment-record write or deployment occurred.**

Full-schema Supabase staging remains a mandatory release gate. The local results
below are not a production-readiness claim.

## Foundation review and staging attempt

Reviewed the Phase 3.2 report, its private identity pins, reservation revisions,
strict batch checks and Phase 3.1 recovery transitions before implementation.
The new migration is `202610210005_combined_delivery_payments.sql`, ordered after
`202610210004_combined_delivery_batch_integrity.sql`; earlier phase migrations
remain unchanged.

`npx supabase status` was attempted. The local CLI could not inspect a Supabase
stack because neither Docker nor Podman is installed. No isolated full-schema
remote staging environment was available. The linked production project was not
used as staging, and no production migration command was run. Development and
SQL/concurrency tests used disposable local PostgreSQL/PGlite databases only.

## Payment records and authoritative totals

The existing `payments` table remains the manual proof record. An optional
`combined_delivery_group_id` identifies combined proofs. Its required `order_id`
references one deterministic representative reservation for compatibility with
existing receipt/read infrastructure. This does not duplicate the payment.

`combined_delivery_payment_reservations` links that one proof to every included
reservation and retains each item subtotal. Composite foreign keys require the
payment and all linked memberships to belong to the same group. The candidate
projection includes these links when checking payment history, so nonrepresentative
reservations do not lose their proof history after recovery.

`combined_delivery_payment_accounts` stores the server-calculated subtotal, the
single group shipping fee, payment state and deadline. The payable total is a
PostgreSQL numeric generated value:

```text
sum(locked orders.total_amount) + group.shipping_fee
```

No shipping fee is copied onto individual reservations. Submission revalidates
reservation amounts against immutable member snapshots and the account total;
it requires the exact positive total, the reserved seller-defined active payment
method, a reference number and one uploaded receipt belonging to the buyer's
storage path. No gateway or automatic payment processing was added.

The existing positive-amount manual-payment rule is retained; this feature does
not introduce installments, partial verification or a zero-value payment policy.
Combined submissions require proof even for a cash-labelled method; the optional
modal setting affects only combined payments. Existing standalone cash behavior
is unchanged.

## Seller review and atomicity

The existing seller Payments review list includes one row per combined proof,
listing its products and quantities. It uses the existing receipt viewer,
verification controls and rejection deadline UI. Combined reviews route to
`review_combined_delivery_payment`; standalone reviews retain their original
implementation.

Verification confirms every linked reservation and records confirmation time in
one transaction. The group becomes `paid`, active memberships/pins are released,
and historical memberships, shared fee, proof links and events remain. Rejection
retains the old proof and links, reopens all members for payment, and applies the
seller's explicitly selected positive resubmission deadline, matching the existing
rejection policy. A new proof needs a new reference. The combined rejection flow
does not enter the standalone insufficient-payment action.

The standalone review RPC rejects combined proofs before acquiring its former
payment-first locks. A payment update guard also prevents a combined proof being
reviewed through a direct/legacy path. Standalone submission and verification are
exercised after the new migration in the SQL suite.

## Security and concurrency

All payment mutations authorize an active owning buyer or seller. They retain the
shared buyer advisory lock, then lock ordered reservations, group, product/batch
context, profiles, account and proof in that order. Eligibility remains strict V1:
same buyer, seller, exact batch ID, confirmed destination and compatible fulfillment
and payment state. Submitted or verified proofs cannot be invalidated.

A private transaction-ID context table authorizes the narrowly permitted internal
reservation transitions. It is not a client-settable custom setting. The context
and transition helpers have no PUBLIC/anon/authenticated/service_role access.
New ledger/link tables have participant-only read policies and no client write
grants. SECURITY DEFINER helpers have an empty search path.

Phase 3.2's immediate foreign keys remain authoritative. Under all reservation and
context locks, an internal payment transition removes its private pins, updates
only payment/deadline fields, then recreates pins against the new reservation
revision. No other session observes an unprotected committed interval. Failures
roll back revisions, pins, proofs, links, statuses and notices together. Old
REPEATABLE READ/SERIALIZABLE identity mutations remain blocked after activation
and submission.

Partial unique indexes permit at most one pending or verified proof per group;
a separate group/reference index prevents reference reuse. Repeating the same
seller decision is idempotent, while competing different decisions cannot both
commit. Serialization/deadlock errors on buyer submission use fresh-whole-action
retry guidance; there is no automatic financial-side-effect retry.

## Deadlines, recovery and inventory

Waiting for approval/shipping retains its existing genuine shipping pause. Once
the shared fee is finalized, each reservation resumes with exactly its existing
remaining budget:

```text
now() + greatest(reservation_expires_at - deadline_paused_at, 0)
```

The group payment deadline is the earliest resumed reservation deadline, rather
than a new fixed duration. Individual reservation budgets and original immutable
member snapshots are retained. Pending proof review does not expire a reservation,
consistent with the existing standalone `payment_submitted` behavior.

The existing scheduled `sweep_expirations()` entry point now handles combined
accounts under the group lock order, then delegates to the original standalone
sweep with active memberships excluded. At the earliest deadline, the unpaid group
is invalidated and released atomically. Only individually due reservations expire
and invoke the existing waitlist allocator. Reservations with longer budgets return
to their genuine standalone shipping pause; they are not prematurely expired.
Repeated sweeps ignore closed accounts.

Participant-authorized recovery remains available for server-proven ineligible
unsubmitted/rejected groups. It releases membership/pins atomically and retains
remaining time, genuine standalone shipping waits, historical fees and proof links.
Valid approved groups still cannot be freely cancelled. Inventory quantities and
reservation identities are not recreated or reassigned by payment transitions.

## Notifications and UI

Existing `notifications` storage, unread handling and realtime delivery are reused.
Deterministic recipient/event/group-or-payment dedupe keys produce:

- One buyer notification when combined payment becomes ready.
- One buyer acknowledgement and one seller notice for each submitted proof.
- One buyer notification for verification or rejection of each proof.

Repeated fee assignment/review does not add duplicate notices. The former temporary
fee-assigned notice is replaced by the ready notice in the same fee transaction.
Existing generic per-reservation payment email triggers exclude combined records,
so they cannot describe only the representative item or send duplicate item-level
payment emails. Combined lifecycle notices in this phase are in-app notifications;
standalone email behavior is retained.

The compact horizontal Pending Payments card uses the existing Card, ProductThumb,
Countdown and button components and `pending-product-card` responsive classes.
It displays the seller, each included product/quantity, subtotal, one shared fee,
final amount, status and appropriate payment/details actions. Member cards are
suppressed only for actual active payable/reviewing groups, not by seller identity.
The existing payment modal, seller method loader and receipt upload are reused.
No new theme colors, dependencies or unrelated dashboard redesign were introduced.

## Validation results

| Check                                                                                          | Result                            |
| ---------------------------------------------------------------------------------------------- | --------------------------------- |
| Original Phase 3.2 native audit, before the Phase 4 migration                                  | 27/27 pass                        |
| Phase 4 native multi-session audit, with all six migrations                                    | 16/16 pass                        |
| SQL suites: foundations, requests, seller review, recovery, batch integrity, combined payments | 6/6 pass                          |
| Complete unused-state migration/rollback chain                                                 | Pass                              |
| Original four-case Phase 3.1 recovery audit                                                    | 4/4 pass                          |
| Application/render tests, `node --test --test-timeout=30000 tests/*.test.ts tests/*.test.mjs`  | 117/117 pass                      |
| `npm run typecheck`                                                                            | Pass                              |
| `npm run build`                                                                                | Pass                              |
| `git diff --check`                                                                             | Pass                              |
| Full-schema Supabase staging                                                                   | Unavailable; release gate remains |

The new native scenarios cover simultaneous submissions, invalidation versus
submission/verification at READ COMMITTED, REPEATABLE READ and SERIALIZABLE,
failed-invalidation-first ordering, conflicting verification/rejection, proof
rollback followed by another submission, expiration races, post-activation identity
pins, standalone-path rejection, existing fee-group migration activation and
refusal of destructive rollback. Real blocking is checked with `pg_blocking_pids`;
unexpected exceptions, lock timeouts and deadlocks do not count as success.

The SQL payment suite also checks exact/zero-shipping totals, buyer/seller
ownership, receipt ownership, reference reuse, rejection/resubmission history,
notification idempotency, full rollback on injected notice failures, unequal
reservation expiry budgets, activated recovery, private-helper permissions and
successful standalone payment submission/verification.

A temporary static rendering of the real combined card was inspected in Chrome
at desktop size and a 375-pixel mobile viewport. Ready, reviewing and rejected
states remained compact, with long product text wrapping. At mobile width the
page's scroll width equalled its 375-pixel client width; all cards' scroll widths
matched their client widths. The fixture and tab were removed and viewport reset.
This was a layout check, not an authenticated Supabase browser integration test.

An overlapping local Vite test/preview run encountered a shared dependency-cache
rename collision. The clean rerun completed all 117 tests. No unrelated test files
were modified to hide it.

There is no separate lint script. `npm run format:check` remains non-zero for seven
existing files: MyClaims, PaymentSubmitModal, RejectPaymentModal,
SellerPaymentVerification, verifyTypes, kargoApi and types/index. Running oxfmt
against unchanged HEAD copies confirms the same seven baseline failures. Existing
formatting was retained to avoid unrelated whole-file changes; new files and
modified audit scripts pass formatting.

## Files changed in Phase 4

Database:

- `supabase/migrations (to update profile database name)/202610210005_combined_delivery_payments.sql`
- `supabase/rollbacks/202610210005_combined_delivery_payments.sql`
- `supabase/tests/combined_delivery_payments.sql`
- `supabase/tests/fixtures/combined_delivery_payment_schema.sql`

Services/types:

- `src/services/kargoApi.ts`
- `src/services/combinedDelivery.ts`
- `src/types/combinedDelivery.ts`
- `src/types/index.ts`

Buyer/seller UI:

- `src/features/combined-delivery/CombinedPaymentCard.tsx` (new)
- `src/features/combined-delivery/BuyerCombinedDelivery.tsx`
- `src/features/combined-delivery/SellerCombinedDelivery.tsx`
- `src/features/combined-delivery/CombinedDeliveryRequestDialog.tsx`
- `src/features/claims/MyClaims.tsx`
- `src/features/payments/PaymentSubmitModal.tsx`
- `src/features/payments/RejectPaymentModal.tsx`
- `src/features/payments/SellerPaymentVerification.tsx`
- `src/features/payments/verifyTypes.ts`

Validation/documentation:

- `scripts/test-combined-delivery-db.mjs`
- `scripts/test-combined-delivery-concurrency.mjs` (`--payments` adds the Phase 4 mode)
- `scripts/audit-combined-delivery-preflight.mjs` (clarifies its foundation-only scope)
- `tests/combinedDeliveryRequestUi.test.mjs`
- `tests/fixtures/BrowserPaymentForm.tsx` (closed-card SSR boundary for the browser-only modal barrel)
- This report and current-status annotations in the two Phase 4 preflight reports.

Earlier phases are also uncommitted in this workspace. Their other files,
including prior PendingPaymentCard/PendingPaymentHint edits, were not rewritten by
Phase 4.

## Migration release and remaining blockers

The new migration takes fail-fast NOWAIT locks and revalidates existing fee-assigned
groups before activation. Backfill resumes their remaining payment budgets and
emits ready notices. Database/frontend rollout must therefore be coordinated in a
quiet, validated release window. The rollback refuses any activated account or
combined proof; it never discards resumed-deadline or financial history. After use,
recovery requires a reviewed forward migration rather than a destructive downgrade.

Native PostgreSQL 18.4 and embedded PGlite tests use the real migrations and
relevant existing payment/shipping/stock/expiry functions over a minimal fixture.
They do not validate the complete Supabase auth/storage/extensions schema or
PostgREST embedding. Before release, isolated full-schema staging must verify the
ordered migration chain and representative legacy data, the target PostgreSQL
version, RLS through real JWTs, receipt upload/signed viewing, embedded API relations,
realtime notification delivery, scheduled sweeps and the authenticated buyer/seller
browser flow. These are remaining release blockers, not completed checks.

No production migration was applied, no production payment records were modified,
and no deployment occurred. Phase 4 only is implemented. Await explicit user
approval before Phase 5.
