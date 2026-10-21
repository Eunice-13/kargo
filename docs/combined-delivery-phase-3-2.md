# Phase 3.2 — Snapshot-safe batch protection

Phase 3.2 is implemented and locally validated. All eleven original native
concurrency cases and sixteen additional cases pass. Phase 4 is not implemented.
No production migration was applied. Full-schema Supabase staging validation is
still outstanding; these results are not a production-readiness claim.

## Root cause

`guard_active_delivery_batch_identity()` used an `EXISTS` query over active
memberships. A REPEATABLE READ transaction established before group creation could
wait for the product's `FOR SHARE` lock, then continue using its original snapshot.
That snapshot did not contain the committed group. The trigger authorized a batch
move and allowed a cross-batch active group. Acquiring the lock did not refresh
the transaction snapshot. The batch-owner guard and reservation freeze guard used
similar snapshot-visible checks, so protecting only product reassignment would
leave alternative mutation paths.

## Database correction and proof of the invariant

Migration `202610210004_combined_delivery_batch_integrity.sql` adds private,
active-only `combined_delivery_batch_pins`. Each pin references:

- The existing immutable `(group_id, order_id)` membership.
- The actual product's composite `(id, batch_id)` key.
- The batch's composite `(id, seller_id)` key.
- The reservation's composite `(id, combined_delivery_revision)` key.

The membership trigger creates a pin using authoritative reservation/group records.
The existing eligibility validation still checks buyer, seller, exact batch UUID,
confirmed destination, fulfillment/payment compatibility and active unpaid state.
The existing group/member guards continue to protect immutable snapshots.

Immediate `ON UPDATE/DELETE RESTRICT` foreign keys make PostgreSQL enforce the
references across concurrent snapshots. A conflicting parent mutation either
fails its referential-integrity check or raises a serialization failure; it cannot
commit an invalid identity. A batch move that wins first makes the waiting request
fail validation or serialization. A group that wins first protects its identities.
The old friendly guards remain, but their snapshot-visible absence checks are no
longer the sole enforcement mechanism.

The hidden reservation revision increments on business-field changes, preserving
the existing freeze rule even if an old transaction cannot see the group. Changes
only to `updated_at` do not increment it. The generated `total_amount` is excluded
from the BEFORE-trigger comparison because its source price/quantity fields are
already covered and generated values are computed later. Migration backfill does
not rewrite business fields, timestamps, quantities, inventory or amounts.

Membership release deletes its pin in the same transaction. A failed release
rolls back both operations. Pins therefore protect active associations without
keeping released historical memberships tied to a product's current batch.
Historical shipping fees and reservation/event records remain intact.

## Locking, conflicts and authorization

Existing RPC lock order is retained: participant advisory lock, ordered
reservations, group, product/batch context and profiles. Pin inserts acquire
foreign-key key-share protection; they do not update shared product/batch revision
rows or introduce a new lock-upgrade cycle. A native test proves that requests
from two different buyers sharing products can both progress before either group
requires the other to commit. Parent identity updates conflict with these pins.

PostgreSQL 18.4 reports SQLSTATE `23001` for the tested RESTRICT conflicts; the
application also recognizes `23503` with the exact pin constraint, and handles
`40001`/`40P01` with fresh-whole-action retry guidance. It does not automatically
retry side effects. Aborted transactions must be rolled back, then eligibility
must be checked again in a fresh request. Tests reject arbitrary exceptions,
timeouts and deadlocks as success conditions.

The pin table has RLS enabled and no access for PUBLIC, anon, authenticated or
service_role. Its trigger function is SECURITY DEFINER with an empty search path
and revoked execution permissions. No public RPC or authorization grant was added.
Authenticated actors still use existing RLS and participant-authorized RPCs.

## Migration and rollback

The migration takes fail-fast `ACCESS EXCLUSIVE NOWAIT` locks, validates all
existing active groups and refuses orphaned active memberships before backfill.
A busy database requires a retry in a quiet migration window. Legacy-ineligible
groups require authorized Phase 3.1 recovery before the migration is retried;
they are not silently reassigned or rewritten. Validation and backfill commit
atomically with the schema changes.

The matching rollback refuses any active group, membership or pin. After requests
are safely released, it removes only Phase 3.2 metadata, restoring the previous
schema and its previous snapshot-safety limitation. Historical fee/event/member
records are preserved. Native tests cover backfill, refusal on legacy corruption,
recovery followed by successful migration, guarded rollback and reapplication.

## Original eleven native concurrency results

| Scenario                                                  | Result                  |
| --------------------------------------------------------- | ----------------------- |
| Duplicate buyer requests serialize to one group           | Pass                    |
| Conflicting shared fees cannot overwrite one another      | Pass                    |
| Recovery wins against shipping assignment atomically      | Pass                    |
| Valid fee assignment survives competing invalidation      | Pass                    |
| Simultaneous buyer/seller recovery releases once          | Pass                    |
| Request blocks conflicting product move at READ COMMITTED | Pass                    |
| Product move wins; request rejects different batches      | Pass                    |
| Request blocks individual shipping assignment             | Pass                    |
| Individual fee wins; request rejects finalized shipping   | Pass                    |
| REPEATABLE READ mutation versus request creation          | Pass; previously failed |
| Old snapshot versus approved, fee-assigned group          | Pass; previously failed |

## Additional native results

All sixteen additional cases pass:

- Older-snapshot mutation of an approved group at REPEATABLE READ and SERIALIZABLE (2).
- Product move wins; old request aborts, fresh retry revalidates, corrected fresh request succeeds at both levels (2).
- Product update versus approval and fee assignment at both levels (2).
- Old-snapshot transfer of a pinned batch to another seller (1).
- Recovery rollback restores pins before a waiting product mutation proceeds (1).
- An old snapshot after release fails conservatively; a fresh transaction succeeds (1).
- Different buyers concurrently pin the same products without lock upgrades (1).
- Migration backfills an approved, fee-assigned group without business/history changes (1).
- Migration refuses legacy corruption; Phase 3.1 recovery permits retry (1).
- Rollback refuses active groups, succeeds after release, and permits reapplication (1).
- Authenticated old-snapshot buyer locator edits cannot bypass the freeze at both levels (2).
- An old backend snapshot cannot reassign a grouped reservation to another product (1).

Scenarios use independent native PostgreSQL connections and disposable databases.
Blocking order is verified with `pg_blocking_pids`, not assumed using fixed sleeps.
Statement/lock timeouts bound failures. Rejected transactions are checked for
aborted state and rollback of earlier unrelated writes where applicable. Every
scenario checks pin/member/reservation consistency. Snapshot tests do not disable
the protection under test.

## Regression validation

- Five SQL suites pass: foundations, buyer requests, seller review, recovery and
  new batch integrity. The complete five-migration rollback chain passes.
- The original four-case Phase 3.1 recovery audit passes: seller rejection, buyer
  cancellation, buyer recovery and seller recovery after fee assignment.
- 85 application/render tests pass across nine relevant test files, including
  existing standalone payment/deadline states and three new error-handling tests.
- TypeScript checks and production build pass.
- No separate lint script is configured. Formatting validation retains only the
  pre-existing `src/features/claims/MyClaims.tsx` issue; it was not reformatted.

Legacy-corruption SQL fixtures explicitly remove private protection metadata as
the database owner before simulating pre-migration corruption. This represents
legacy data, not a path available to application roles. Their original recovery
assertions remain. Additional constraint tests disable only the older friendly
guard to exercise the new authoritative foreign keys directly.

## Files changed in Phase 3.2

- New migration and matching rollback:
  `supabase/migrations (to update profile database name)/202610210004_combined_delivery_batch_integrity.sql`,
  `supabase/rollbacks/202610210004_combined_delivery_batch_integrity.sql`.
- New SQL suite: `supabase/tests/combined_delivery_batch_integrity.sql`.
- Legacy-fixture updates: `supabase/tests/combined_delivery_foundations.sql`,
  `combined_delivery_buyer_requests.sql`, `combined_delivery_seller_review.sql`,
  `combined_delivery_recovery.sql`.
- Audit/runners: `scripts/test-combined-delivery-concurrency.mjs`,
  `scripts/test-combined-delivery-db.mjs`,
  `scripts/audit-combined-delivery-preflight.mjs`.
- Mutation conflict handling: `src/services/combinedDelivery.ts`,
  new `src/services/combinedDeliveryErrors.ts`,
  new `tests/combinedDeliveryErrors.test.ts`.
- This report and status annotations in
  `docs/combined-delivery-phase-4-preflight.md` and
  `docs/combined-delivery-phase-4-concurrency-preflight.md`.

The working tree includes earlier uncommitted phases; that does not make their
other files part of this correction. No UI, payment verification, shipping amount
calculation, inventory allocation or expiration policy was changed in Phase 3.2.
No project dependency was added.

## Environment, remaining risks and Phase 4 gate

The native tests use temporary PostgreSQL 18.4 under `/private/tmp/kargo-native-pg`.
The runner verifies its temporary data directory before DDL, accepts no production
URL, and drops its scenario/template databases in cleanup. The embedded SQL runner
uses temporary PGlite. Both load the actual migrations over a minimal schema
fixture and relevant real standalone shipping/expiration functions.

**Full-schema Supabase staging was unavailable.** Production PostgreSQL version,
complete auth/storage/extensions integration, real data migration volume and DDL
lock duration remain unverified. Staging must validate the migration against the
complete schema and target PostgreSQL version before deployment. The native test
server is stopped after validation. No live production migration, production data
write or production setting change was performed.

The reproduced snapshot-integrity blocker is resolved in local database tests;
no unresolved integrity failure remains in the exercised scenarios. This supports
reviewing Phase 4 implementation after user approval, but does not establish
production readiness or complete the missing staging gate. Phase 4 payment and
notification work has not begun. Await explicit approval before proceeding.
