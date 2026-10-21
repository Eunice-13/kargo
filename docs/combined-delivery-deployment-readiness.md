# Smart Combined Delivery deployment readiness

Backup follow-up: [encrypted database and Storage recovery results](production-backup-recovery-results.md) verify application-data recovery; service-level recovery and operational release gates remain incomplete.

Production follow-up: see [the read-only production assessment and runbook](combined-delivery-production-runbook.md). Schema/history comparison passed, but production deployment is **NO-GO** until backup/recovery and other operational prerequisites are verified.

**Local validation is complete. No unresolved application security or data-integrity defect was found in this run. Production execution remains unapproved and conditional on the operational checks below.** No production database was contacted or changed, no real customer data was used, and nothing was deployed.

## Verified results

| Validation | Result |
| --- | --- |
| Real local Auth/REST/Storage workflow | 10 integration checkpoints passed |
| Full-schema foundation concurrency | 27 scenarios passed |
| Full-schema payment concurrency | 16 scenarios passed |
| Approval/shipping/recovery races with Phase 4 active | 24 additional scenario executions passed |
| Exact seven-file release bundle rehearsal | All seven migrations passed |
| Complete-schema SQL suites | All six passed |
| All application tests | 206 passed, zero failed/skipped |
| TypeScript | Passed |
| Changed validation files formatting and whitespace | Passed |
| Isolated production-mode Vite build | Passed; existing large-chunk warning remains |
| Final local service state | Ten containers running; configured health checks healthy |
| Disposable test database cleanup | Zero concurrency/rehearsal databases remain |
| Local account safety | Zero accounts outside synthetic `@kargo.test` addresses |

The 67 concurrency executions represent 43 distinct scenarios plus 24 repeated against active Phase 4; they are not 67 unique scenarios. All used complete-schema local Supabase database copies rather than the previous minimal fixture. Phase-specific foundation migration/rollback tests ran with Phase 4 removed only inside disposable copies. The 24 current-state races ran with Phase 4 installed, including resumed deadlines. Three historical migration scenarios were not repeated in current-state mode because their preceding migration state is required; they passed in foundation mode.

The release rehearsal copied the complete local database into a disposable database, removed synthetic rows only in that copy, reversed the feature migrations to the reconstructed application baseline, and applied the exact uniquely versioned release files in order. All five foundation SQL suites ran before Phase 4 and the payment suite ran after its compatibility correction. The rehearsal database was dropped afterward. The running application database was not reset or truncated.

The earlier full-schema catalog comparison established the application baseline against captured production metadata. The complete local database copy also retained the local platform schemas, functions, extensions and permissions. This is validation of local Supabase, not a claim that every hosted platform configuration or minor version is identical.

## Authenticated integration coverage

Dedicated synthetic accounts were created through local Auth administration and signed in with passwords to obtain real user sessions. Only fixture setup used local administrative SQL. Buyer/seller business operations used their individual bearer tokens through local REST, and the proof was an uploaded synthetic PNG through local Storage.

Verified:

- Buyer claims two products through the application's actual reservation RPC.
- Buyer and seller can read batches and the application's per-product `batch_catalog` projection.
- Buyer requests combined delivery; an unauthorized account cannot approve it.
- Seller approves and assigns one shared fee; the authoritative total is 950 items + 125.50 shipping = 1075.50.
- Reservations resume to the authoritative account deadline without retaining shipping pauses.
- Buyer uploads one proof and submits one payment; duplicate submission is rejected.
- Unrelated buyer cannot read the payment through RLS.
- Seller rejects proof, buyer retries with a new reference, and authorized seller verifies it.
- Both reservations become payment-confirmed and retain individual payment links; member shipping fees remain null.
- Buyer receives ready/submitted/rejected/verified notifications; seller receives submission notices; dedupe keys are unique.
- Inventory remains allocated once: the claimed product has 19 of its synthetic 20 units available.
- A standalone reservation accepts shipping assignment, proof submission and seller verification through the existing RPCs.
- Separate buyers exercise request rejection, pending-request cancellation and mixed-batch rejection. Cancelling a paid request is rejected. Tests respect the real request cooldown.

Notification delivery here means the existing in-app records as read by authenticated recipients. External email delivery, browser visual interactions and Vercel routing were not exercised; none is claimed as verified. Expiration, deadline recovery, inventory identity protections and waitlist-related regression paths were checked in the SQL suites and concurrency tests, not by waiting for production scheduling.

## Concurrency and migration safety

Covered competing requests, approvals, shipping assignments, recovery, individual shipping assignment, product/batch/seller mutations, snapshot isolation, membership pins, duplicate proof submission, verification versus rejection/invalidation, rollback of failed submission, expiration versus payment, standalone misuse and destructive-rollback guards. Conflicting operations were tested with independent database sessions and actual blocking checks, including repeatable read and serializable transactions.

To obtain a physical complete-schema template, only the verified local API containers were briefly paused and local database sessions terminated, then resumed. Two extension-worker sessions initially prevented copying; retrying with the local workers included allowed the snapshot. A subsequent Auth call exposed a stale terminated pool connection (`57P01`), not an application/schema defect. Restarting only the four local API services cleared it. The snapshot helper now refreshes those client pools after resuming. Final authenticated testing and health checks passed afterward.

The frozen local template `kargo_fullschema_template` remains available for repeat tests. Scenario and rehearsal clones were removed. Synthetic accounts, reservations and proofs from development runs remain local for inspection; they were never copied from production. Their tokens and detailed evidence are private ignored files under `staging/local-workdir`.

## Reconciled migration sequence

The reviewed release artifact is `supabase/release-bundles/combined-delivery`, with a manifest, seven byte-identical source copies and hash/order regression tests. It is a **delta bundle**, not a replacement production baseline or an instruction to push the root historical directory.

| Order | Unique release version | Delta |
| --- | --- | --- |
| 1 | `202610240001` | Combined delivery foundations |
| 2 | `202610240002` | Buyer requests |
| 3 | `202610240003` | Seller approval/shared shipping |
| 4 | `202610240004` | Invalidation/recovery |
| 5 | `202610240005` | Snapshot-safe batch identity protection |
| 6 | `202610240006` | Combined payments/notifications |
| 7 | `202610240007` | Payment-method schema compatibility |

All four historical duplicate-version pairs have explicit dispositions in the manifest:

| Historical version | Disposition |
| --- | --- |
| `202610010005` | Lifecycle objects already represented in captured schema: do not replay. Optional zero-limit change absent: excluded. |
| `202610190002` | Group-order objects and branding policy represented in captured schema: do not replay those historical files. Storage configuration needs its own release check. |
| `202610200001` | Preserve captured corrected extension-email function; do not replay the defective historical body. Optional notification-retention change absent: excluded. |
| `202610200002` | Gallery objects represented in captured schema: do not replay. Foundations mapped to unique release version `202610240001`. |

The original archive files and all 26 captured production history entries are preserved. No remote history repair, fabricated applied entry, renaming of deployed history or historical optional-feature replay occurred. Filename matching alone is not evidence an untracked historical file was wholly deployed. The manifest preserves that distinction and publishes only the intended feature deltas.

Before production execution, refresh authorized metadata/history comparisons: this manifest is reconciled against the captured snapshot, not a fresh production inspection. Confirm the seven reserved versions remain unused and the schema is unchanged. If drift or a partially deployed delta is found, stop and reconcile it; do not blindly replay or repair history. Do not copy the reconstructed local baseline or synthetic local ledger to production.

## Operational release prerequisites

These remain gates before production, rather than unresolved local application defects:

- Explicit user approval for the target, database migrations and application deployment.
- Current production identity, schema, migration ledger and version availability verified against the reviewed artifact; no unexpected objects or partial feature migrations.
- A verified database backup/PITR point and isolated restore rehearsal for that actual backup. The local schema/data snapshot rehearsal is not verification of production PITR or backup availability.
- Separate backup/restore coverage for Storage payment-proof objects; a database backup alone is insufficient.
- Review production Auth/Storage configuration, upload policies, scheduler/expiration entry points, notification configuration and application environment variables. Local PostgreSQL is 17.11 versus the captured production 17.6 metadata; account for platform/version differences.
- Review the final code and deployment artifact. No automated production executor was enabled.

After approval: verify backups and target first; apply only verified missing deltas in manifest order with per-migration transactions and checksums, recording **new successfully executed versions** atomically in the existing migration ledger without changing existing entries. Confirm the deployed ledger's actual columns and runner compatibility before execution. Do not use CLI repair to make the old archive appear applied, and do not push its colliding files.

Keep combined functionality unavailable until all seven deltas, especially the compatibility correction, have completed. Deploy the approved application afterward, verify configuration, then smoke-test only approved synthetic accounts. Validate batch visibility, standalone payment behavior, authorizations, totals, member statuses, deadlines and notification deduplication. Preserve before/after counts and financial aggregates through read-only checks, without exporting customer records. The 38 original production batch records were not queried or modified in this run; verify their preservation during the authorized production preflight/release.

## Rollback and forward recovery

Migration failure must roll back its transaction and new ledger entry together; investigate before retrying. Existing schema/history and uploaded proofs must not be deleted to force a retry.

Before any feature activity, the reverse-order rollback scripts were rehearsed on empty disposable full-schema copies. Once requests or payments exist, their guards intentionally prevent unsafe destructive rollback; concurrency tests verified those protections. The compatibility correction should be forward-fixed if necessary, never reverted to the known broken legacy-column INSERT.

If a production issue occurs, stop new combined operations using reviewed operational controls, retain histories/proofs, and prefer a narrowly reviewed forward correction. An application rollback alone does not undo recorded combined payments or guarantee old-app compatibility with outstanding groups. Any data repair, reverse migration, restore or production configuration change requires explicit approval and an impact assessment. Restore database and Storage consistently if backup recovery is necessary.

## Checks, changes and reproducibility

Commands executed locally:

```sh
node scripts/local-staging/authenticated-validation.mjs
node scripts/test-combined-delivery-concurrency.mjs --full-schema
node scripts/test-combined-delivery-concurrency.mjs --full-schema --payments
node scripts/test-combined-delivery-concurrency.mjs --full-schema --current-phase-4
node scripts/local-staging/rehearse-release.mjs
node --test --experimental-strip-types --import ./scripts/lib/register.mjs tests/*.test.*
npm run typecheck
```

All network/database commands use the inspected local instance. The unit suite was run with a scrubbed environment; four existing Vite test harnesses now explicitly set `envFile: false`. An initial attempt to run against duplicated snapshot modules failed from mismatched fixture/React context identity; the corrected run uses consistent source paths and disables environment-file loading explicitly. No product code change was needed.

The build used the isolated Vite configuration and local credentials, not the production environment files. Changed validation files pass formatting; the broad formatting check still reports **171 files outside this task's changed validation files**. They were not mass-formatted. There is no separate lint script configured. The existing bundle-size warning remains; no UI/source bundle changes were introduced.

Files added/changed for this validation:

- New local tools: `authenticated-validation.mjs`, `prepare-concurrency-template.mjs`, `prepare-release-bundle.mjs`, `rehearse-release.mjs` under `scripts/local-staging`.
- Updated `scripts/test-combined-delivery-concurrency.mjs` for guarded complete-schema copies and active-Phase-4 races.
- Test environment isolation in `tests/appDataCompatibility.test.mjs`, `combinedDeliveryRequestUi.test.mjs`, `pendingPaymentCard.test.mjs`, `notifications.test.mjs`.
- New `tests/combinedDeliveryReleaseBundle.test.mjs` and the release artifact's seven SQL copies, manifest and README.
- This report and follow-up links in earlier reports. No product feature code, production environment or original historical migration was modified during this validation.

The concurrency driver reuses the previously installed temporary `pg` module under `/private/tmp/kargo-native-pg`; no new application dependency was installed. Reproduction requires that test tool or an equivalently reviewed local installation. `authenticated-validation.local.json`, `release-rehearsal.local.json` and the complete application-test log remain ignored local evidence. The frozen template must be refreshed deliberately if the source schema changes; do not treat an older snapshot as validation of later code.

**Assessment:** the previously outstanding local Auth, complete-schema concurrency and migration-sequence validation gates have passed. There is no newly identified feature defect requiring a production fix. This is a candidate for production approval after the operational prerequisites are satisfied, not an unconditional production-readiness or deployment claim. Wait for explicit approval before any production action.
