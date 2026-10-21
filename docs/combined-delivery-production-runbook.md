# Smart Combined Delivery: production assessment and deployment runbook

Follow-up: [the completed backup and recovery report](production-backup-recovery-results.md) confirms encrypted database recovery and all Storage bytes. Service-level Auth/Storage recovery checks and deployment prerequisites remain open. The assessment findings below describe the earlier pre-backup state.

**Recommendation: NO-GO pending recovery verification and operational approvals.**

Assessment date: 2026-10-21. Project: `leylmztbknmlwnwgvaud`, region `ap-northeast-1`. This is an assessment and a future execution plan. **No production migration, deployment, smoke-test write, configuration change or restoration was executed. The subsequently authorized isolated local restore is documented in the linked recovery report.**

## Assessment findings

| Gate                                   | Evidence and result                                                                                                                                                                                                                                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production identity and health         | Management API identifies the expected project as `ACTIVE_HEALTHY`; database build `17.6.1.166`.                                                                                                                                                                                                              |
| Schema drift                           | No drift detected in the captured scope: columns, enums, sequences, views, function definitions/owners/grants, constraints, indexes, triggers, table RLS/ownership/grants, policies, default privileges and event triggers.                                                                                   |
| Supplemental permissions/configuration | Explicit column grants, public-schema ACL, extension versions, bucket configuration and sequence dependencies match the local-reconstruction source snapshot.                                                                                                                                                 |
| Baseline size                          | 14 ordinary public tables, all RLS enabled; 195 public columns, 56 public functions, 89 constraints, 42 indexes and 59 inspected public/auth/storage policies.                                                                                                                                                |
| Migration history                      | All 26 version/name pairs match the captured history. All seven reserved release versions are unused. No Combined Delivery schema delta is already present.                                                                                                                                                   |
| Scheduler metadata                     | Existing expiry sweep, email worker and deadline-reminder jobs remain active with every-minute schedules. No jobs were run or changed by this assessment.                                                                                                                                                     |
| Recovery                               | **Blocked:** backup API returned `pitr_enabled: false`, `backups: []`, `physical_backup_data: {}` and `walg_enabled: true`. There is no API-visible backup ID or verified restore window. WAL-G enablement alone is not proof of a usable recovery point.                                                     |
| Storage recovery                       | No independent object backup, retention record or restore evidence was supplied or verified. The receipt bucket remains private, but bucket privacy is not backup coverage.                                                                                                                                   |
| Hosted Vercel configuration            | Not verified. Local `vercel.json` only establishes SPA rewrites. There is no local `.vercel/project.json` link or available Vercel token in the inspected credential configuration. Hosted project/team, domain, environment variables, production branch and rollback deployment still require verification. |
| Immutable release                      | Not pinned: the working tree contains substantial uncommitted work. Current HEAD `a9bc8ff9abd9451441e17dffaa33659409d0f1ab` alone does not identify the locally validated feature changes.                                                                                                                    |

The main production catalog comparison covered 13 schema/version categories plus migration history and version availability. Supplemental comparisons covered five additional categories. Definitions were compared against the **captured production baseline used for local reconstruction**, not the feature-modified local database. This establishes no drift within that scope; it does not establish unchanged hosted Auth settings, secrets or Vercel configuration.

Management requests were GETs for project/backup metadata and catalog-only database queries inside `BEGIN READ ONLY` / `ROLLBACK`. The read-only transaction setting was verified as `on`. HTTP 201 is the Management API SQL success status, not a database-write indication. No application functions, migrations, cron commands, business rows, payment proofs or backup contents were read/executed. Existing management credentials were parsed as data in memory, never exported into application configuration or printed. Evidence is mode-0600 under ignored `staging/production-assessment`.

Production batch records were not queried, exported or modified. The historical count of 38 was not freshly re-counted. Do not assume it remains the correct total if legitimate new batches have since been created.

The release bundle's two hash/order/history tests passed again in this assessment. The prior local report records 206 passing application tests, six SQL suites, seven rehearsed release migrations and complete-schema concurrency/Auth validation; those application suites were not rerun as part of this read-only production assessment.

## Required remediation before GO

1. Establish a **usable, owner-verified recovery point**. Either supply evidence of independent encrypted database and Storage backups, or separately approve the appropriate managed backup configuration and wait for a successful backup/restore window. No backup setting was enabled here. Do not infer a plan entitlement or an unavailable backup from `walg_enabled`.
2. Provide recovery evidence: backup identity/time, coverage, retention, integrity checks, authorized operator, documented restore route, and an isolated restore rehearsal or equivalent operator evidence for that actual backup. No restoration is authorized by this task. Do not download real customer backups to this local synthetic environment.
3. Verify the existing Vercel project/team, production domain/branch/build environment and a usable previous stable deployment. Do not create or link a new project silently.
4. Review and pin an immutable release commit/artifact containing the validated source and bundle. Re-run local release checks if its code differs from what was validated. Confirm Git automation cannot trigger deployment before database gates pass.
5. Obtain explicit approval for the exact production target, seven migration versions, maintenance approach, application deployment and synthetic production smoke-test data. Approval for this assessment is not deployment authorization.

The documented Supabase backup API supports inspecting available backup metadata, but this project's response did not identify a recovery point. [Backup listing API](https://supabase.com/docs/reference/api/v1-list-all-backups).

Database backup coverage does not include Storage object bytes; receipts require separate protection. A restore affects the whole restored database, so later reservations, payments and inventory changes need reconciliation. Confirm the chosen recovery route and downtime with its operator; none was tested on production here. [Supabase database backup guidance](https://supabase.com/docs/guides/platform/backups).

## Pre-deployment procedure — only after approval

Record these inputs in the release ticket: project ref/region, Vercel project/team/domain, immutable release SHA, previous stable deployment ID, backup/restore evidence, approved maintenance window, named migration/recovery operators and decision owner. Blank or mismatched inputs mean STOP.

- Re-run the same read-only schema/history comparison immediately before the window. Require the original 26 entries unchanged, all seven target versions unused and no partial feature objects. If another release has legitimately changed the baseline, re-review/rehearse against it rather than repairing history.
- Run `node --test tests/combinedDeliveryReleaseBundle.test.mjs`; verify all seven files against `manifest.json` SHA-256 values. Preserve the manifest and release SHA with the execution record.
- Complete the approved database and Storage backups, including receipt objects and relevant Auth/Storage/project configuration recovery instructions. Verify the newest recovery point actually covers the deployment boundary. Schema-only exports are insufficient for recovering payment/reservation data.
- Confirm restore rights and tooling without clicking Restore or invoking a restore endpoint. Agree recovery-time and acceptable-data-loss objectives; do not invent values from the API flags.
- Establish approved traffic/maintenance controls before touching SQL. Do not assume a feature flag exists. Prevent combined actions while the seven deltas are partially installed; coordinate existing background workers and concurrent deploys with the operator. Do not reset or extend reservation deadlines as a deployment workaround.
- Agree finite statement/lock timeouts and monitor long transactions. Migration 6 explicitly requests `ACCESS EXCLUSIVE ... NOWAIT` locks on reservation/payment/group/product tables. Normal reads or workers can conflict: a lock failure must abort the transaction and stop the run, not prompt blind retries or lock removal.
- If authorized, capture protected aggregate/count checkpoints before and after the window. Do not export customer records. Compare against the actual pre-window state, accounting for approved writes; do not use the historical 38 count as a destructive repair target.

## Exact migration order and tracking contract

Use only `supabase/release-bundles/combined-delivery/migrations`, in this order:

| Step | File                                                     |
| ---- | -------------------------------------------------------- |
| 1    | `202610240001_combined_delivery_foundations.sql`         |
| 2    | `202610240002_combined_delivery_buyer_requests.sql`      |
| 3    | `202610240003_combined_delivery_seller_review.sql`       |
| 4    | `202610240004_combined_delivery_recovery.sql`            |
| 5    | `202610240005_combined_delivery_batch_integrity.sql`     |
| 6    | `202610240006_combined_delivery_payments.sql`            |
| 7    | `202610240007_combined_payment_method_compatibility.sql` |

Each is a transaction. Verify the checksum and absence of its version immediately before execution. Record that migration's version, name and exact source in `supabase_migrations.schema_migrations` **inside the same transaction, before its final COMMIT**. Use explicit column names `(version, statements, name)` and preserve all existing rows. Production also has nullable `created_by`, `idempotency_key` and `rollback` columns; do not assume its ledger has only the three local-test columns. Have the operator review the exact transaction-wrapping runner and generated SQL before approving it. No production executor was created or enabled by this assessment.

For SQL-editor execution, the reviewed generated transaction must contain the unchanged migration DDL and its correctly quoted history INSERT before the final COMMIT; do not execute a file first and add its history in a later transaction. The existing local helper is local tooling, not blanket approval for production execution. Never interpolate secrets, alter source quoting or hand-edit the archived migrations to get past an error.

After every commit, verify exactly that new history entry and its expected objects. If a response is lost, inspect history and object definitions before deciding whether it committed. An existing matching version is a resume decision, not an instruction to replay it. A source/version mismatch is STOP.

Do not use `scripts/apply-migration.mjs` as an unreviewed deployment shortcut: its current flow does not record migration history. Do not blindly push the colliding historical directory, run migration repair, apply the reconstructed local baseline, or import the local synthetic ledger. These migrations are not generally replay-safe.

The four historical collisions stay classified by source identity/hash in the manifest: existing lifecycle/group-order/branding/gallery effects are not replayed; corrected extension-email code is preserved; unrelated absent zero-limit and retention deltas remain excluded. Only the unapplied foundations delta is re-versioned into this feature bundle. The original 26 deployed versions remain unchanged.

## Post-migration verification — before application release

Use metadata checks first, without executing mutation functions:

```sql
BEGIN READ ONLY;
SELECT version, name
FROM supabase_migrations.schema_migrations
ORDER BY version;

SELECT c.relname, c.relrowsecurity, pg_get_userbyid(c.relowner) AS owner
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
  AND (c.relname LIKE 'combined_delivery_%' OR c.relname = 'delivery_destinations');

SELECT conname, convalidated, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.combined_delivery_payment_reservations'::regclass;

SELECT pg_get_functiondef(
  'public.submit_combined_delivery_payment(uuid,text,numeric,text,text,text,text,text)'::regprocedure
);
SELECT has_function_privilege('anon',
  'public.submit_combined_delivery_payment(uuid,text,numeric,text,text,text,text,text)',
  'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated',
  'public.submit_combined_delivery_payment(uuid,text,numeric,text,text,text,text,text)',
  'EXECUTE') AS buyer_execute;
ROLLBACK;
```

Expected: original 26 history pairs preserved plus seven correct new entries; eight feature tables present; RLS/ACLs match the rehearsed schema; payment/member composite foreign keys validated; buyer RPC anonymous access false and authenticated access true. Compare the **entire** function/permission inventory with the rehearsed result, including internal helper/context-table access, rather than treating these sample checks as a complete security audit.

Verify the submission function uses the existing `payments.method_type` snapshot, retains seller-method validation and contains no INSERT dependency on `payments.seller_payment_method_id`. Verify the shared-fee account, partial unique indexes for open payments/references, proof/member links, batch identity pins, guarded standalone delegates and expiration wrapper. Existing standalone columns, individual histories and inventory relationships must remain intact.

Confirm existing scheduler metadata, private receipt-bucket configuration, relevant upload/read policies and notification triggers remain appropriate. Refresh/confirm PostgREST's schema cache through the approved platform mechanism if needed, then verify the actual RPC signatures; do not interpret missing schema-cache entries as a successful release. Do not disable RLS or grants to bypass a failing check.

## Vercel application deployment — separately approved action

The hosted settings below were **not verified** during this assessment and must be filled in before GO:

- Existing project/team, repository/root directory, production branch and canonical domain.
- Install/build command and output: match the repository lockfile/toolchain; application build is `npm run build` (`vite build`), output `dist`. `.mise.toml` specifies Node 22 and pnpm 10.34.3. Confirm a compatible actual Node patch level; Vite requires Node 20.19+ or 22.12+. [Vite requirements](https://vite.dev/guide/).
- Production `VITE_SUPABASE_URL` resolves to `https://leylmztbknmlwnwgvaud.supabase.co` and the publishable key belongs to that project. No local staging URL/key, server secret or management token may be embedded in browser variables. Check all `VITE_*` names; never reveal secret values in logs. Ensure `FIGMA_PUBLIC_URL` is not accidentally setting a Figma preview asset base for the standalone production site.
- Preserve the existing `vercel.json` SPA rewrite to `/index.html`. Confirm direct-route refresh and assets on the actual domain.

Only after all seven migrations and verification pass: trigger a Production deployment of the reviewed release commit in that existing project. If pushing/merging the production branch auto-deploys, do it only at this point. Record the resulting deployment ID/SHA and the prior stable ID. Use a production-environment candidate and controlled promotion if the verified project workflow supports it; never promote the localhost-built artifact or assume Preview variables become the correct production values. [Vercel promotion guidance](https://vercel.com/docs/deployments/promoting-a-deployment).

Validate domain, asset loading, configuration and runtime errors before opening the approved smoke-test window. Any new deployment or domain promotion remains a production change requiring approval.

## Buyer/seller smoke tests — approved synthetic data only

Use a dedicated test buyer, seller and nonparticipant account, with approved synthetic products/batches and a clearly synthetic proof. Confirm permission to create these records first. Never reuse a real customer's reservation, address, proof or payment, and never initiate a real money transfer.

1. Buyer and seller can see existing batch listings; errors are surfaced rather than misreported as empty data. Confirm intended read/unread notification behavior still works.
2. Buyer claims two eligible products from the same actual batch, seller and delivery destination. Check quantities and inventory allocation. Mixed-batch selection is rejected.
3. Buyer requests combined delivery; seller approves and sets one fee. Confirm resumed existing deadlines and items subtotal + exactly one shared fee. Verify compact cards/actions on desktop and mobile.
4. Buyer uploads one synthetic proof and submits one payment. Duplicate submission is rejected; nonparticipant cannot see/verify it. Inspect only the synthetic records when testing authorization.
5. Seller rejects and buyer retries with a new reference; seller verifies. All member reservations update together, payment links/history remain, inventory is not allocated twice, and participant notifications are delivered once per event.
6. Use separate eligible synthetic reservations/accounts for request rejection/cancellation and a standalone payment/verification. Respect real request cooldowns and existing deadline rules.
7. Confirm the scheduled expiration entry point remains operational through approved diagnostics. Do not advance clocks, force-expire real reservations or run destructive race tests in production. Concurrency/forced-failure suites stay isolated locally.

Record outcomes and synthetic IDs privately. Remove fixtures only through reviewed normal cleanup compatible with history retention; do not cascade-delete payment histories as a release shortcut.

## Failure response and recovery

| Situation                                           | Required response                                                                                                                                                                                                                          |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| SQL failure/lock conflict before commit             | Roll back that transaction; stop subsequent steps. Inspect history/object state and blocking work. Do not weaken locks, replay blindly or repair history.                                                                                  |
| Partial seven-step rollout, no application exposure | Keep combined actions unavailable. Identify committed versions exactly; prefer correcting and resuming approved deltas. Reverse-order schema rollback is permissible only after proving no feature activity and reviewing rollback guards. |
| New requests/proofs/payments already exist          | Preserve all records and proofs; stop new combined actions through approved controls. Prefer reviewed forward correction. Do not drop feature tables, reset statuses or bypass rollback guards.                                            |
| Application regression                              | Consider the recorded previous Vercel deployment only after checking compatibility with outstanding groups. Frontend rollback does not roll back database state or fix an integrity defect.                                                |
| Integrity loss requiring backup                     | Obtain separate restore authorization. Select the verified pre-incident recovery point, protect incident evidence and reconcile database/Storage/actual manual-payment records under operator control. No currently verified point exists. |

Vercel Instant Rollback reuses a prior deployment; it does not undo database writes or automatically update the old build's environment. Review its compatibility before using it. [Vercel rollback guidance](https://vercel.com/docs/instant-rollback).

For a separately approved database restoration, record what transactions after the recovery point would be lost and how manual payment confirmations will be reconciled. Coordinate maintenance, workers and notification dispatch before restoring. Recover proof bytes and their database metadata consistently; assess deadlines/inventory and queued notifications before resuming automation. Restore rights, downtime and recovery objectives are not verified by reading the backup API, and are not assumed here.

## Stop conditions and decision

STOP on any unverifiable backup/Storage recovery, unexpected schema/history drift, used or mismatched release version, checksum change, wrong project/key/domain/commit, incomplete maintenance controls, failed migration/lock, uncertain commit outcome, failed RLS/security check, duplicate charge, partial member update, lost inventory/history, unexpected deadline behavior or failing standalone/batch regression. Do not silently convert an authorization/network error into a missing-schema fallback.

**Current decision: NO-GO.** The live schema/history compatibility gate passed, but backup/restore evidence, hosted Vercel verification and an immutable approved release are outstanding. Supply those prerequisites and reassess; schema compatibility alone does not make deployment safe. All production changes, backup configuration changes, smoke-test writes and any restoration await explicit approval.

Only this runbook and a pointer in the local readiness report were added as tracked deliverables. Private assessment evidence remains ignored; no application source, migration, production environment or hosted configuration was changed.
