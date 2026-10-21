# Phase 4 preflight — stopped on a foundation issue

**Current status:** Phase 5 UI polish and local regression testing are complete.
See [the Phase 5 completion report](combined-delivery-phase-5.md). The missing-batches
compatibility fix is preserved; 38 existing batch records remain. Full-schema
Supabase staging and authenticated integration tests remain release blockers.
No production migration or deployment occurred. The preflight findings below are
historical records.

**Current gate (Phase 3.2):** The snapshot-safety correction now passes all 27
native concurrency cases, including the original eleven. The recovery audit and
five SQL suites pass. See [the Phase 3.2 report](combined-delivery-phase-3-2.md).
Full-schema Supabase staging remains unavailable. Phase 4 is not implemented;
proceeding requires user approval. The findings below describe earlier preflight
results and are retained as historical context.

**Update:** The issue below was corrected locally in Phase 3.1. The extended
preflight audit now passes. See [the corrective report](combined-delivery-phase-3-1.md)
for recovery behavior, migration and remaining staging checks. The original
findings below are retained as historical context. Phase 4 is still not implemented.

Phase 4 is not implemented. The request explicitly requires stopping and reporting
unresolved Phase-1/2/3 issues that could compromise payment integrity. The audit
uncovered an unrecoverable stale-approved-group state affecting eligibility,
reservation deadlines and inventory release. No incorrect payment or duplicate
shipping charge was observed; the problem occurs before payment becomes possible.

## Reproduction and result

Using the actual Phase-1/2/3 migrations in the existing temporary embedded
PostgreSQL fixture:

1. Create two eligible reservations with one buyer/seller/batch/destination/method.
2. Submit a combined request and approve it as the owning seller.
3. As the authenticated owning seller, move one product to another batch owned by
   that seller. The existing product UPDATE policy permits this. The existing
   `prevent_started_product_unit_changes` trigger protects unit fields, not
   `batch_id`; no unit change is needed for this scenario.
4. Attempt shared fee assignment: correctly rejected with
   `Only reservations from the same Pasabuy batch can be combined.`
5. Attempt seller rejection: rejected with
   `Only pending requests can be rejected`.
6. Attempt buyer cancellation: rejected with
   `Only requests awaiting review can be cancelled`.

The group remains `awaiting_shipping_fee`, with two active members, two paused
reservation deadlines, and two actual batch UUIDs. There is no invalidation RPC.
The latest expiry sweep excludes paused reservations, so it does not resolve the
hold or release these reservations to the existing waitlist workflow.

This reproduction does not assert that the current UI offers product reassignment;
it uses an operation allowed by the existing authenticated database policy. The
SQL fixture mirrors that policy for this audit. A live Supabase instance was not
modified or tested.

## Source of the gap

- `202610210001_combined_delivery_buyer_requests.sql`: buyer cancellation permits
  only `pending_approval` (line 148).
- `202610210002_combined_delivery_seller_review.sql`: seller rejection permits
  only `pending_approval` (line 143); fee assignment revalidates batch eligibility
  and refuses the stale group (line 151).
- The same migration's group guard has no transition from `awaiting_shipping_fee`
  to `invalidated`, `rejected` or `cancelled`.
- `202610180001_tracking_and_buyer_shipping.sql`: expiry requires a null
  `deadline_paused_at` (line 452).
- `202609200001_initial_kargo_schema.sql`: product UPDATE policy permits updates
  within the owning seller's batches (line 682).

## Prerequisite correction

Add an authorized, atomic recovery/invalidation path for approved but unpaid
requests that become ineligible. It should revalidate under the existing locks,
release memberships, preserve reservation/financial history and original time
budgets, and notify the participants once. Define and test its interaction with
individual shipping and deadline/waitlist recovery; simply unpausing stale
historical timestamps would immediately expire legitimate paused reservations.
Retain strict same-batch validation; do not bypass the error or charge a stale
group. Also cover fee-assigned-but-unpaid stale groups in the recovery design.

This is a prerequisite foundation correction, not implemented as part of this
preflight because the user explicitly requested stopping before Phase 4 when a
foundation issue is found.

## Validation and files

Added only:

- `scripts/audit-combined-delivery-preflight.mjs`: isolated audit reproduction;
  intentionally exits 1 when the unrecoverable state is detected. All fixture
  mutations roll back in a disposable in-memory database.
- This report.

Reproduction command (uses the temporary dependency already used in Phase 3;
no application dependency or lockfile was added):

```sh
KARGO_PGLITE_MODULE=/private/tmp/kargo-combined-delivery-dbtest/node_modules/@electric-sql/pglite/dist/index.js node scripts/audit-combined-delivery-preflight.mjs
```

The existing three SQL suites and complete Phase-1/2/3 migration/unused-state
rollback chain still pass. Those suites did not cover recovery from an approved
request that becomes stale. The new audit exposes that coverage gap.

No application code, payment workflow, database migration, live data, existing
RLS policy or Phase-5 functionality was changed. No Phase-4 production build or
browser QA is claimed; Phase 4 was not implemented. Full-schema/staging validation
and simultaneous-session testing remain necessary for the eventual fix and
payment integration.
