# Combined payment schema compatibility

Follow-up validation is complete locally; see [the final deployment readiness report](combined-delivery-deployment-readiness.md) for authenticated tests, full-schema concurrency, the reconciled release bundle and remaining operational gates.

The missing-column blocker is resolved locally. **Production deployment is still gated on authenticated end-to-end integration and release review. No production database operations or deployment were performed.**

## Root cause and design

This was a legacy-schema assumption in Phase 4, not a required missing relationship. `202610010003_remove_unused_contact_fulfillment_fields.sql` explicitly removed `payments.seller_payment_method_id`. The current standalone `submit_order_payment` stores the reservation-selected method in `payments.method_type`; it does not require a seller-method foreign key. Phase 4 incorrectly inserted the old column, while its partial fixture independently recreated it and masked the defect.

Reuse the existing `method_type` snapshot. Combined submission still validates the selected reservation/group method and locks an active method belonging to the correct seller. It no longer attempts to persist that method's internal ID. No new columns, tables, constraints, backfill, or duplicated payment information are needed. Historical payment labels remain independent of later seller-method lifecycle changes, consistent with standalone payments.

The new transactional migration, `202610230001_combined_payment_method_compatibility.sql`, replaces only `submit_combined_delivery_payment`. Its signature, security-definer/search-path configuration, ownership and existing grants remain intact. It removes only the legacy INSERT column and corresponding value. All validation, locks, authoritative amount calculation, proof ownership checks, payment links, atomic order transitions and notifications remain unchanged. The original six feature migrations are unchanged; apply this correction immediately after the payment migration, before exposing payment actions.

Existing relationships remain authoritative: `payments.combined_delivery_group_id` identifies the group; `combined_delivery_payment_reservations` links one payment to each member and snapshots each item subtotal, protected by composite foreign keys. The payment account holds the authoritative items subtotal plus exactly one group shipping fee. Member shipping fees are not copied or added again. Individual histories and records are retained.

## Local validation

The correction was applied only through the guarded local Docker database helper. Local history now has the reconstructed baseline, six feature migrations and correction `202610230001`. Resume verified existing source text instead of replaying migrations. Production's 26 captured migration-history records and original migration sources were not altered.

| Check | Result |
| --- | --- |
| Full-schema Supabase payment SQL suite | Passed, including standalone submission and verification |
| Correct totals, one shared fee, zero shipping | Passed |
| Proof ownership, payment/member association and invalid member FK | Passed |
| Wrong buyer/seller, inactive seller method, wrong method/amount | Rejected as expected |
| Duplicate submission, duplicate reference, rejection and new-reference retry | Passed |
| Atomic submission/verification rollback on injected notification failure | Passed |
| Deadline resume, expiry, recovery and history preservation | Passed |
| Actual authenticated-role buyer submission, unrelated-buyer RLS isolation, seller verification | Passed on full schema |
| Function privileges | Anonymous execution denied; authenticated execution allowed; security definer retained |
| Multi-session payment races | 16 passed in disposable native PostgreSQL fixture |
| Focused application compatibility, eligibility, request, error and isolation tests | 129 passed |
| TypeScript, changed-script formatting and whitespace checks | Passed |
| Isolated production-mode application build | Passed; large-chunk warning remains |

Concurrency tests cover duplicate submissions; submission/verification versus invalidation across read committed, repeatable read and serializable isolation; competing verification/rejection; failed proof rollback and retry; submission versus expiration; identity pins; and migration/standalone guards. They use the corrected explicit migration and corrected minimal fixture, **not the full-schema Supabase instance**. The temporary native cluster was stopped afterward; local Supabase remains running.

The full-schema test uses synthetic fixtures inside a rolled-back transaction. Final local counts were zero users, orders, payments and delivery groups. The legacy FK column remains absent. Real production rows were never copied, loaded, modified or reseeded. No production environment files were loaded or changed.

The expanded SQL suite explicitly rejects fixtures that resurrect the removed column. Existing partial-schema runners now apply the versioned correction before payment tests. The full-schema runner skips pre-Phase-4 assertions on a Phase-4 resume: those older tests expect untouched deadlines, whereas Phase 4 intentionally resumes deadlines after shipping finalization. The payment-aware suite checks that behavior. The foundation and buyer-request suites also passed during this run; the earlier full five-foundation pass remains recorded in the prior report.

## Files changed

- New migration: `supabase/migrations (to update profile database name)/202610230001_combined_payment_method_compatibility.sql`.
- Corrected fixture: `supabase/tests/fixtures/combined_delivery_payment_schema.sql`.
- Expanded regression coverage: `supabase/tests/combined_delivery_payments.sql`.
- Migration/test ordering: `scripts/local-staging/validate-migrations.mjs`, `scripts/test-combined-delivery-db.mjs`, `scripts/test-combined-delivery-concurrency.mjs`.
- This report and a follow-up link in `docs/combined-delivery-local-validation.md`.

## Production migration and recovery plan

**Requires explicit production approval; none of these steps have been executed.**

Before release, verify a restorable production backup/PITR point, schema-only export and deployed migration ledger. Verify storage backup coverage for payment proofs separately from database backups. Demonstrate restore into an isolated environment, with access controls and protected retention. Reconfirm live schema compatibility from metadata under approved access; the current local baseline uses the previously captured snapshot.

Reconcile the four known migration-version collisions without changing deployed production history. The new correction version is unique among current local files, but its availability in deployed history must be reconfirmed before release. The authoritative migration-directory reconciliation remains a release prerequisite; do not blindly run all files from the nonstandard directory.

Execute verified missing feature migrations in dependency order: foundations → buyer requests → seller review → recovery → batch integrity → combined payments → method compatibility. Use reviewed unique deployment versions for the collided originals; retain the recorded source checksums and mapping. Do not apply the reconstructed local baseline or local synthetic ledger to production. If all six feature migrations are already installed, only the correction is required after metadata/source verification. Keep combined-payment submissions unavailable until both payment migrations complete; avoid introducing an interval where the old function is callable.

The correction changes no existing rows or types and adds no foreign key to validate/backfill. `CREATE OR REPLACE` preserves function identity and grants. Verify the new function definition, security settings and privileges; verify existing group/link foreign keys, unique indexes and RLS policies; compare pre/post record counts and financial aggregates without logging personal records. Confirm the original 38 batch records remain intact as part of an authorized release check. Run payment smoke tests only with approved synthetic accounts/data.

Suggested metadata validation (read-only):

```sql
select pg_get_functiondef('public.submit_combined_delivery_payment(uuid,text,numeric,text,text,text,text,text)'::regprocedure);
select has_function_privilege('anon','public.submit_combined_delivery_payment(uuid,text,numeric,text,text,text,text,text)','execute') as anon_execute,
       has_function_privilege('authenticated','public.submit_combined_delivery_payment(uuid,text,numeric,text,text,text,text,text)','execute') as buyer_execute;
select conname, pg_get_constraintdef(oid)
from pg_constraint where conrelid='public.combined_delivery_payment_reservations'::regclass;
```

Prefer forward recovery with a reviewed replacement function if a new issue occurs; do not revert to the known broken INSERT or drop payment/history structures. If necessary, pause combined submission through the established capability/release controls while preserving recorded proofs and reservations. Broader feature rollback is restricted once payments exist. Any production rollback, data repair or backup restore requires separate explicit approval and impact review.

## Remaining release gates

The original missing-column defect is resolved. Real Auth-login/browser/API buyer–seller integration, including Storage upload and notification delivery, remains unverified; database-role checks are not a substitute. Repeat concurrency validation against the full-schema Supabase environment, complete the remaining release regression checks, reconcile migration history/directory and confirm production backup/restore readiness before approval. Local PostgreSQL/platform version differences from the captured production snapshot remain relevant. No claim of production readiness is made.
