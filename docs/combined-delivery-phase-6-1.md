# Phase 6.1 — Isolated staging preparation

Preparation is complete locally; no Supabase staging project has been created or
verified. No migration was moved or executed, no project was modified, and no
production records or storage objects were copied. Phase 6 validation remains
blocked. This guide prepares that validation; it does not authorize deployment.

## Configuration findings and migration authority

The configured and linked project is `leylmztbknmlwnwgvaud`, treated as production.
`supabase/config.toml` has that project ID and Edge Function auth configuration;
there is no separate staging configuration. Phase 6's read-only discovery found
only this project active and two others inactive. Neither inactive project is an
approved staging target; do not resume or repurpose either without authorization.

The repository's SQL source of record is currently
`supabase/migrations (to update profile database name)/`: it contains the initial
schema and subsequent changes, and the combined-delivery test runners explicitly
read from it. The standard Supabase CLI directory `supabase/migrations/` is absent.
The **actual deployed database and its migration history**, once reconciled with
these files, determine the authoritative applied baseline. A directory listing
cannot establish what has been applied remotely.

`scripts/apply-migration.mjs` reads `.env.local` and sends arbitrary SQL through the
Management API. It does not write Supabase CLI migration-history records. Its
comment claiming every migration is idempotent is false for these feature files
(which contain plain CREATE/ALTER statements). Do not use it for staging setup.
It has been left unchanged to avoid changing existing production tooling.

The attached `combined-delivery-staging-migration-inventory.json` records SHA-256
hashes of all six feature files and four duplicate timestamp versions:

- `202610010005`: restore payment-method lifecycle / zero waitlist limit.
- `202610190002`: batch group orders / branded email design.
- `202610200001`: extension emails / read-notification retention.
- `202610200002`: batch gallery / combined-delivery foundations.

These collisions prevent treating the folder as a clean CLI migration history.
Do not blindly move the folder, rename applied versions, run `db push`, or repair
remote history based solely on filenames.

### Reconciliation plan (requires database-history evidence)

1. With approved read-only access, inspect whether
   `supabase_migrations.schema_migrations` exists. If present, export its version
   and name metadata; restrict output to migration metadata, not application rows.
   If absent, document that fact rather than inventing applied versions. Review
   prior Management API application records and schema object definitions.
2. Compare each historical file to the deployed tables, columns, constraints,
   function definitions, policies and triggers. Record an applied / not-applied /
   superseded / data-repair classification and checksums. SQL stored inside
   function bodies must be checked after the profiles rename, not just FKs.
3. Resolve duplicate versions in a **reviewed new baseline plan**, with a mapping
   from original filename/hash to its disposition. Never relabel already-applied
   migrations or invoke migration repair without separate review and approval.
4. Prefer verified history reconstruction in a disposable full Supabase project.
   Exclude customer-specific repair DML from fixture setup, explicitly accounting
   for any schema changes in the same file. For example,
   `202609300007_reopen_mia_sk_ii_payment.sql` targets named customer/order data;
   it is not a general schema prerequisite and must not import or recreate it.
5. If a faithful replay cannot be demonstrated, produce a reviewed schema-only
   baseline of the existing application schema, then apply the six feature deltas.
   If some deltas are already present, stop and reconcile rather than reapplying.
6. Only after successful full-schema rehearsal and history review, propose moving
   or copying the reconciled staging bundle into a **separate staging workdir's**
   standard `supabase/migrations/`. Preserve the original files/checksums and update
   test references only through a separate reviewed change. Nothing was moved now.

## Complete-schema requirements

Migration replay is the preferred source, but completeness is **not established**.
Missing evidence includes the deployed migration ledger, object-level drift
comparison, target PostgreSQL version and out-of-band project configuration.
A managed Supabase project must supply its native auth/storage schemas, roles and
API services; the initial application migration alone is not a full Supabase stack.

Verify these dependencies before applying feature deltas:

| Dependency | Evidence / staging requirement |
| --- | --- |
| Authentication | Native `auth.users`, real JWTs and signup/profile triggers; final `user_profiles` rename and function references (`202610010007`, `202610010009`). Active buyer and eligible seller helpers. |
| Core records | Final batches, batch_products, orders, generated amounts, payments, payment enums, seller methods, notification dedupe keys, extension/waitlist/stock functions and separate preexisting group-order feature. |
| Shipping/deadlines | `202610180001_tracking_and_buyer_shipping.sql` and following delivery-pin/tracking fixes; final claim, payment guards/review and `sweep_expirations()` definitions. |
| Extensions | `pgcrypto`, `pg_cron`, `pg_net` (extensions schema); Vault capability used by email cron. Confirm extension versions/privileges on target. |
| Storage | Buckets and policies defined across initial/profile/media/email migrations, including private payment receipts. Bucket settings are rows/configuration, not captured by schema-only DDL. Create equivalent empty buckets; do not copy objects. |
| Scheduling/email | Cron job definitions, pending-email tables, Vault secret **names** and staging-specific values, test-only mail delivery. Never copy `vault.decrypted_secrets` or production provider credentials. |
| API/realtime | Grants/RLS, PostgREST relations/schema cache and exposed schemas, realtime publication membership (including payments), replica identity where required. |
| Edge/config | Existing function code/auth settings, redirect URLs, JWT configuration, rate limits and staging-only provider secrets. These are not all database migrations. No function deploy is authorized by this preparation. |

### Safe schema-only export fallback (proposal, not performed)

Use an explicitly approved read-only production connection to export application
DDL only with a compatible `pg_dump`/Supabase schema-dump tool. Confirm tool flags
against the installed version before execution. Use schema-only mode, scoped
application/owned schemas, no row data, no auth users, no storage objects, no
passwords or role-password dumps. Preserve grants/policies and review ownership
mapping for the managed target. Obtain required policies/triggers on managed
storage/auth objects separately as reviewed definitions; do not overwrite the
managed auth/storage schemas with a raw production dump.

Keep the export outside Git with restricted permissions. Even DDL may embed
provider URLs, credentials in function definitions, customer-specific literals or
security-definer settings: inspect/redact it before sharing or loading. Collect
bucket configuration, cron definitions, extension inventory and platform settings
as a separate sanitized manifest. Never export Vault secret values, auth hashes,
customer rows or payment receipts. Recreate staging-only secrets and synthetic
accounts independently. Compare the resulting full staged schema against production
metadata and document all intentional differences. No export was executed here.

## Prepared local staging configuration and safeguards

Files:

- `staging/config.example.json`: placeholder configuration only.
- `staging/.gitignore`: ignores all local staging files except the example and
  ignore file, including exports, credentials, generated browser env and receipts.
- `scripts/verify-staging.mjs`: offline, fail-closed configuration validator.
- `tests/stagingSafety.test.mjs`: target-isolation regression tests.

After an approved project exists, copy the template to `staging/config.local.json`
and restrict its permissions (`chmod 600 staging/config.local.json`). Populate
only staging URL, direct database URL and publishable key. Confirm the project ref
independently in the dashboard; matching text alone is not proof of isolation.
Set `isolationApproved` only after authorization and `schemaBaselineVerified` only
after baseline reconciliation. Template defaults intentionally fail verification:

```sh
node scripts/verify-staging.mjs staging/config.local.json
```

The validator never loads `.env.local`, merges process credentials, connects to a
server or executes SQL. It rejects the known production ref, mismatched API/DB/ref,
non-HTTPS API URLs, database connection overrides, weak TLS and browser secret keys.
It permits only the exact approved hosted direct DB hostname with verify-full TLS.
Pooler/custom-domain/local configurations deliberately fail until independently
reviewed. A publishable key's actual project binding still needs a real staged API
check; opaque keys cannot be verified offline. A successful check is **not**
migration authorization and cannot stop someone bypassing it with other tools.

Before any future migration runner is authorized, it must consume only this explicit
validated config, confirm target ownership/ref via authenticated project metadata,
connect using TLS certificate verification, run a read-only identity/schema check
(e.g. database name/user/server version plus staged schema fingerprint), and compare
the expected baseline and migration ledger. A DB named `postgres` alone proves
nothing. Reject drift, unknown migrations, production hosts and unexpected refs;
never fall back to linked CLI state or `.env.local`. No migration runner is supplied
in Phase 6.1, so preparation tools have no SQL execution path.

### Application environment isolation

Vite's `loadEnv(mode, ..., "")` reads `.env.local` even with `--mode staging` and
accepts bare SUPABASE aliases. **Do not assume `vite --mode staging` isolates it.**
Use a separate clean staging checkout/workdir with no production `.env.local` and
no inherited SUPABASE/VITE_SUPABASE process variables. Supply only:

```dotenv
# STAGING ONLY — populate from the independently verified staging configuration
VITE_SUPABASE_URL=https://<approved-staging-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<staging-publishable-key>
```

Store that as an ignored local env file in the isolated checkout, never in this
production-connected workdir. Keep DB passwords, secret/service-role keys and
management tokens outside all VITE_ variables. Dedicated test-runner environment
should use KARGO_STAGING_PROJECT_REF / KARGO_STAGING_BUYER_* /
KARGO_STAGING_SELLER_* names in ignored local secret storage, not client build vars.
No actual account credentials have been provisioned.

`vercel.json` only defines SPA rewrites; it does not establish environment
separation. No Vercel project/env changes or deployment are part of this phase.

## Synthetic test-data plan (design only; not seeded)

Use run-specific identifiers and recorded created IDs. Never match or clean up
records by broad names. No real names, phone numbers, contact URLs, addresses,
receipts or credentials are needed.

| Fixture | Purpose |
| --- | --- |
| Buyer A, Buyer B, unrelated signed-in actor | Ownership and cross-buyer denial; separate real Auth identities. |
| Seller A, Seller B, ineligible/suspended actor | Owner-only approval/review, seller eligibility and negative authorization. |
| Seller A Batch A and Batch B; Seller B Batch C | Same actual batch ID succeeds; same-name different IDs fail. Synthetic live/draft/closed variants. |
| Two products in Batch A | Example item totals: 2 × PHP 125 and 1 × PHP 300; subtotal PHP 550, one fee PHP 80, payable PHP 630. Values are test-only. |
| Buyer A destinations D1/D2, Buyer B destination D3 | Confirm full synthetic map/address snapshots through existing RPCs; same textual name never substitutes for identity. Use non-personal fictional labels/test coordinates. |
| Seller A active/inactive payment methods | Real seller-defined method IDs; rejection of wrong seller/inactive method. No real account details. |
| Eligible reservations | Claim through real buyer JWT/RPCs; unpaid, shipping pending, same buyer/seller/batch/destination/method. Assert stock allocations and original deadline budgets. |
| Ineligible reservations | Separate batches/sellers/buyers/addresses, incompatible methods, finalized standalone shipping, prior proof, cancelled/expired/paid state and existing active group. |
| Separate request groups | Pending approval, rejected, approved awaiting fee, ready, proof submitted, rejected/resubmitted, verified, stale/ineligible recovered and unequal-budget expiry scenarios. Build via public RPC transitions, not direct status writes. |
| Payment proof files | Locally generated image with TEST ONLY text, uploaded into staged buyer's real receipt path using their JWT. Another buyer's path/object and absent object must fail. |
| Standalone payments/waitlist | Untouched individual flow plus competing waitlist buyer, expiry allocation and extension regression cases. |

Create users through the staging Auth API/UI. Any privileged seller qualification
bootstrap must be explicitly scoped to the generated synthetic IDs and approved
as staged fixture setup. Thereafter exercise actual buyer/seller JWTs, RLS and
public RPCs; never use service-role credentials for assertions of user access.
Test anonymous and unrelated accounts too. Use staged/sink email routing; disable
external dispatch until reviewed and enable only staging endpoints. Test real
schedules in staging after confirming side-effect isolation. Synthetic fixture
cleanup is deferred to an approved stage-only plan; no production reseed or cleanup.

## Migration readiness and rollback limits

Feature order remains:

1. `202610200002_combined_delivery_foundations.sql`
2. `202610210001_combined_delivery_buyer_requests.sql`
3. `202610210002_combined_delivery_seller_review.sql`
4. `202610210003_combined_delivery_recovery.sql`
5. `202610210004_combined_delivery_batch_integrity.sql`
6. `202610210005_combined_delivery_payments.sql`

These are transactional, **not generally rerunnable/idempotent**. Use verified
applied-history/checksums, not blind retries after a lost connection. Phases 3.2/4
use exclusive NOWAIT locks and fail on incompatible legacy state. Pin FKs, revision
triggers, RLS and security-definer privileges require real full-schema validation.
Phase 4 depends on exact predecessor function signatures and a recognized sweep
source fragment; schema drift can intentionally abort migration. Fee-set groups
activate and resume deadlines during the migration; plan a coordinated quiet window.

Reverse-order rollback is only for states allowed by each script. Phase 4 refuses
any activated account or proof; Phase 3.2 refuses active groups/pins; older phases
protect histories too. Once used, prefer reviewed forward recovery, never delete
financial records or disable constraints to make downgrade succeed. Backups and
restoration must be rehearsed in staging before any later production approval.

## Results, boundary and exact next steps

No remote calls, provisioning, export, migration, account creation or deployment
were performed in this phase. Local validation results:

- `node --test tests/stagingSafety.test.mjs`: 12/12 pass.
- Placeholder example rejected with exit code 1, as intended.
- `git check-ignore`: local config, backup SQL and staging env files are ignored.
- New JavaScript files formatted with oxfmt; `git diff --check` passes.
- No application runtime files changed; application build, full SQL suites and
  authenticated integration tests were not run for this preparation-only change.

full-schema reconstruction, real JWT/RLS tests and live connection verification
remain unperformed. The existing 38 production batches and all real records were
untouched. Existing missing-schema compatibility and Combined Delivery code were
not changed.

**User action required:** authorize creation of a new isolated Supabase staging
project (including organization/region/cost), or identify an already approved
non-production project and authorize its setup. Also authorize read-only schema and
migration-history inspection/export from the current project if needed for baseline
reconciliation. Supply new staging credentials through local secret storage, not
chat or Git. Do not supply real customer data.

After that authorization, verify project identity, reconcile baseline/history,
create the isolated workdir, perform schema-only staging setup and synthetic Auth
bootstrap, then resume Phase 6's authenticated and concurrency validation. Production
migration/deployment approval remains a separate later decision. No project will be
created, resumed, repurposed or modified automatically.
