# Phase 6 — Pre-deployment validation gate

**Status: blocked at full-schema staging availability. Not approved for production.**

This validation attempt reviewed the Phase 5, Phase 4, Phase 3.2 and missing-batches
reports, the six feature migrations' dependency structure, and their rollback
guards. No application code, database schema, business record or configuration was
changed. This report is the only file added by Phase 6.

## Environment discovery — verified this attempt

- `.env.local`, `supabase/config.toml` and the linked-project metadata identify
  `leylmztbknmlwnwgvaud` as the connected KARGO project. No separate staging target
  is configured. This existing project is treated as production and was not used
  for testing.
- A read-only Supabase Management API `GET /v1/projects` succeeded with HTTP 200.
  The accessible projects were:

  | Project reference | Name | Reported status |
  | --- | --- | --- |
  | `leylmztbknmlwnwgvaud` | kargo | ACTIVE_HEALTHY |
  | `xgqzzjpmysoxkrqdiztn` | KARGO | INACTIVE |
  | `fzdgzouoygwmklvhgkut` | verify-ph | INACTIVE |

  Neither inactive project has been established as an isolated, full-schema KARGO
  staging environment. No project was resumed, provisioned or modified. The list
  establishes availability only within the configured account's access; it cannot
  rule out staging owned by another account.
- Docker and Podman are unavailable on PATH, so an isolated local Supabase stack
  is not available either. The temporary PostgreSQL/PGlite fixtures used in earlier
  phases are not full-schema Supabase staging and were not substituted here.
- Credentials were not printed, copied into this report or changed. Initial
  sandbox DNS failure was followed by the successful read-only network request.

Per the explicit instruction to stop if staging is unavailable, no migrations,
authenticated workflows or new automated test runs were performed after this
gate. Phase 6 validation is incomplete.

## Migration order and dependencies — static review only

All six files currently reside in
`supabase/migrations (to update profile database name)/`, **not** the conventional
`supabase/migrations/` location. Before using a migration command, establish a
reviewed staging migration bundle and reconcile recorded migration history with
the actual production schema. Do not blindly replay historical setup, seed or
repair migrations, and do not assume a default CLI push will discover this folder.

| Order | Migration | Required predecessor / purpose |
| --- | --- | --- |
| 1 | `202610200002_combined_delivery_foundations.sql` | Existing production baseline: profiles, batches/products, orders, payments, shipping/deadline fields and auth helpers. Adds destinations, group/member/event records, eligibility and guards. |
| 2 | `202610210001_combined_delivery_buyer_requests.sql` | Foundations; buyer candidate/request/cancellation RPCs and destination binding. |
| 3 | `202610210002_combined_delivery_seller_review.sql` | Buyer workflow; seller decisions, revalidation and single shared fee. |
| 4 | `202610210003_combined_delivery_recovery.sql` | Seller review; invalidation, membership/deadline recovery and identity guards. |
| 5 | `202610210004_combined_delivery_batch_integrity.sql` | Recovery; revision/composite identity keys, private active pins and immediate restrictive FKs. |
| 6 | `202610210005_combined_delivery_payments.sql` | All preceding files plus existing manual payment, expiry, storage and notification infrastructure; combined ledger/proof links, atomic review, notifications and sweep integration. |

The timestamp order matches these dependencies. This is not confirmation that the
files execute against the complete current production schema.

Important release characteristics confirmed from migration/rollback source:

- Batch-integrity and payment migrations use fail-fast exclusive `NOWAIT` locks;
  busy or inconsistent legacy state must fail, not be silently rewritten.
- Phase 4 captures existing predecessor function definitions and adapts the
  standalone sweep using an expected source fragment. Function signatures and the
  actual deployed sweep definition must be checked in full-schema staging.
- Phase 4 activates existing `shipping_fee_set` groups during migration, resuming
  their remaining deadline budgets and emitting ready notices. This requires a
  coordinated database/frontend release window, not an unattended schema-only
  rollout.
- Phase 4 rollback refuses **any activated account**, even before a proof exists.
  Earlier rollback scripts also enforce state/history guards. A successful unused
  local rollback does not establish that production downgrade will be possible.

No new critical defect was established by this limited static review. Full-schema
integrity, migration execution, RLS and authorization remain unverified here.

## Results and evidence boundaries

| Check | Phase 6 result |
| --- | --- |
| Required report review and migration dependency/rollback review | Completed as static review |
| Isolated full-schema Supabase staging | Unavailable; blocking |
| Migration execution, schema/RLS/triggers/FKs and restore rehearsal | Not run |
| Authenticated buyer/seller end-to-end flow and unauthorized actors | Not run |
| Receipt upload/signed access, realtime notices and scheduled expiry | Not run |
| Full-schema conflicting payment/invalidation/expiration operations | Not run |
| Fresh application tests, TypeScript, formatting and build | Not run because the staging gate requires stopping |
| Production changes or deployment | None |

Historical evidence from the Phase 5 report, **not newly rerun Phase 6 results**:
156 application/render tests, six SQL suites, four recovery cases, 27 foundation
and 16 payment native concurrency cases passed; TypeScript and production build
passed. Those database tests used partial fixtures. Responsive component fixtures
were checked at 320/375/768/1440 pixels, not through authenticated staged payment
workflows. These results do not replace the required staging gate.

The historical formatting baseline consists of eight files: `MyClaims.tsx`,
`pendingPayments.css`, `PaymentSubmitModal.tsx`, `RejectPaymentModal.tsx`,
`SellerPaymentVerification.tsx`, `verifyTypes.ts`, `kargoApi.ts` and
`src/types/index.ts`. Phase 5 reports that unchanged HEAD copies also fail the
formatter. No separate lint script exists in `package.json`. This attempt made no
source-formatting changes and did not independently rerun that baseline check.

The missing-schema compatibility fix and Phase 5 availability handling were left
unchanged. Prior buyer/seller loader regressions cover narrow schema fallbacks and
propagation of unexpected errors. Their presence is not a fresh authenticated
buyer/seller staging verification.

The prior read-only count was **38 batch records**. Phase 6 did not recount or
compare production rows; it performed no business-data requests or writes.
Consequently no batch records were modified by this attempt, but a new row-level
production integrity comparison has not been performed. Count equality alone
would not prove every record's contents unchanged.

## Remediation and required staging setup

1. Provide or provision a specifically identified **non-production** Supabase
   project (or an isolated complete local Supabase stack). Confirm its reference,
   ownership, isolation from production and target PostgreSQL compatibility.
2. Establish the complete current schema and migration-history baseline, including
   auth roles/helpers, storage policies/buckets, extensions, triggers, views,
   functions, notification/realtime configuration and scheduled jobs. Use synthetic
   or appropriately sanitized data; never copy real receipt files or live auth
   secrets. Route email/other external side effects to test destinations.
3. Provide dedicated staged buyer, seller and unrelated-account identities with
   working test authentication, seller payment methods, synthetic stock/batches
   and receipt storage. Keep application staging credentials separate from the
   current `.env.local` production target.
4. Reconcile the nonstandard migration directory/history and create a reproducible
   migration/backup/restore procedure before execution. Validate only against the
   confirmed staging target.
5. Apply the six feature migrations in the order above. Check object definitions,
   grants/RLS with actual JWTs, PostgREST relationships/cache, legacy compatibility,
   migration locking/backfill and guarded rollback/recovery.
6. Execute the complete requested authenticated claim → request → approve → fee →
   proof → verification flow. Assert item totals plus exactly one fee, every
   reservation/history/inventory record, and recipient/event notification counts.
   Include rejection/resubmission, cancellation restrictions, all strict V1
   mismatches, unrelated actors, receipt ownership, deadline recovery, unequal
   expiry budgets, waitlist allocation and standalone payments.
7. Repeat independent-session concurrency tests against the full staged schema:
   duplicate submissions, conflicting reviews, payment versus invalidation/expiry,
   and stale-snapshot identity changes. Verify committed invariants and actual
   blocking; generic errors/timeouts are not passing outcomes.
8. Run application tests, SQL suites, recovery/concurrency audits, TypeScript,
   formatting and production build. Verify both roles' batch visibility with the
   schema present and controlled optional-schema failure fixtures; unexpected
   authorization/network errors must still surface. Record new results separately
   from historical baseline failures.

## Recommended release and backup strategy — not executed

After staging passes, obtain explicit deployment approval. Before any production
change, take protected, restorable database backups and document restoration of
storage objects, auth/configuration and scheduled jobs. Rehearse restoration in
isolation and agree acceptable recovery point/time and handling of transactions
created after backup. Record batch IDs and appropriate row fingerprints, not just
the count, for a read-only pre/post comparison of the original records.

Pin the tested application revision and migration checksums. Reconcile production
migration history and schema drift, schedule a quiet coordinated release, execute
only the reviewed outstanding migrations in dependency order, then release the
matching frontend and perform approved smoke checks. Preserve the narrow legacy
read compatibility path throughout. This is a recommendation, not authorization
or an executed deployment plan.

If migration fails before commit, preserve the error and confirm transaction
rollback before retrying; never bypass locks or validation. For unused feature
state only, test eligible rollback scripts in reverse order (6 → 1), respecting
every guard. Once accounts activate or financial/history state exists, prefer a
reviewed forward fix and existing authorized recovery. Do not force a downgrade,
disable constraints or delete records to satisfy rollback guards. A whole-database
restore requires a separately approved incident plan because it can discard
legitimate subsequent transactions; frontend rollback alone does not reverse
resumed deadlines or database changes.

Remaining release blockers are full-schema staging, authenticated integration,
full-schema concurrency/security testing, migration-history reconciliation and a
rehearsed backup/recovery plan. **No production migration, deployment, project
activation or real buyer/seller record modification was performed. Await explicit
approval before any production deployment.**
