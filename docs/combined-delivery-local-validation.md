# Local Supabase validation report

Follow-up: the payment schema mismatch below has been corrected and validated locally. See [the compatibility resolution report](combined-payment-schema-compatibility.md) for current results and remaining release gates. This document records the earlier investigation.

Status: **blocked; not ready for deployment**. Validation stopped at a full-schema combined-payment failure. No production migrations, production data changes, or deployment were performed.

## Isolation correction

The previous guard rejected the CLI's legitimate `.temp/start-secrets/.../env/docker.env` startup metadata and assumed the local anonymous JWT contained a project `ref`. The running CLI's legacy local token instead uses issuer `supabase-demo` and omits `ref`.

The correction permits only the exact CLI-generated directory structure and allowlisted metadata fields. It compares them with freshly inspected, identified local containers rather than loading the file into `process.env`. It checks private ownership/permissions, rejects symlinks and unknown or duplicate fields, validates container bindings/upstreams, verifies the anonymous JWT's signature against the running local Auth secret, and requires exact target/key agreement. An optional JWT project reference must match the local identity.

Unknown CLI versions/layouts, stale evidence, malformed metadata, forged credentials, linked projects, hosted URLs, ambiguous branches, and non-loopback targets remain rejected. Future CLI metadata changes require review rather than automatic acceptance.

Only local container credentials were written to ignored private files under `staging/local-workdir`. Production environment files were neither loaded nor overwritten. Child environments are scrubbed; the isolated Vite configuration uses an empty environment directory and explicit local browser credentials. Production Vite/Vercel configuration is unchanged.

Verified local endpoints: API `http://127.0.0.1:56421`, database port `56422`, Studio `56423`, mail sink `56424`; isolated app configuration binds `127.0.0.1:56443`. Local Auth health and REST requests succeeded with the running instance's key, with redirects forbidden. All 10 local containers remained running, and containers with configured health checks reported healthy. Application configuration and its isolated build were verified; an authenticated browser session and end-to-end network trace were not completed.

## Schema and migration validation

The schema-only baseline was reconstructed from previously captured authorized production metadata, without business records. Comparison passed for all 11 categories: columns, enums, constraints, indexes, views, functions/effective privileges, tables/RLS/ownership, policies, application triggers, default privileges, and the RLS event trigger. The corrected extension-email function and RLS event trigger were retained. Restore uses existing local administrative capabilities with scoped role changes; it does not disable security hooks.

The captured 26 production migration-history records remain unchanged. Original migration files were not moved, renamed, or edited. Local reconstruction uses a separate seven-entry ledger: baseline `202610220001`, followed by foundations, buyer requests, seller review, recovery, batch integrity, and payments as `202610220002`–`202610220007`. Source hashes and dependency order are checked, including on resume; no production migration-history repair was attempted.

All six feature migrations committed locally. The five foundation SQL suites passed against the reconstructed schema. The payment SQL suite failed during combined proof submission.

A validation-runner serialization defect initially altered dollar quoting in the locally stored foundation ledger text, without altering executed function definitions. All 14 foundation function bodies matched the source. The runner now uses a replacement callback; regression tests cover replacement metacharacters. Only the affected local ledger text was corrected, with its prior record retained in a local audit table. No production ledger was accessed or modified.

## Blocking payment defect

`supabase/migrations (to update profile database name)/202610210005_combined_delivery_payments.sql:342` inserts into `public.payments.seller_payment_method_id`. That column does not exist in the captured production schema, and the feature migration does not create it. PostgreSQL accepts the function definition but rejects its execution:

```text
ERROR: column "seller_payment_method_id" of relation "payments" does not exist
CONTEXT: public.submit_combined_delivery_payment(...) line 23
```

The earlier partial fixture, `supabase/tests/fixtures/combined_delivery_payment_schema.sql:9`, adds this column itself, masking the undeclared dependency. Full-schema baseline comparison confirms this is not an omitted baseline column.

The failed SQL suite rolled back its entire synthetic-data transaction. Read-only verification found zero users, profiles, batches, orders, payments, delivery groups, memberships, pins, and accounts. The local schema migrations remain installed for investigation. No partial payment submission survived.

No schema column or payment code was changed to bypass this failure. Resolve the authoritative payment-method storage contract first: determine whether a reviewed explicit migration should add the relationship or whether submission should use existing payment fields. Correct the fixture so it cannot manufacture an undeclared application dependency, then rerun full-schema payment validation before authenticated integration.

## Checks performed

| Check | Result |
| --- | --- |
| Isolation, runtime metadata, container safety, staging safety, migration serialization | 48 tests passed |
| TypeScript (`npm run typecheck`) | Passed |
| Formatting of local-staging scripts and affected guard/fixture tests | Passed; 16 files checked |
| Isolated production-mode Vite build | Passed; existing large-chunk warning emitted |
| Baseline catalog comparison | 11 categories passed |
| Feature migration application | Six committed locally |
| Foundation, buyer-request, seller-review, recovery, batch-integrity SQL suites | All five passed |
| Full-schema payment SQL suite | Failed: missing payment-method column |
| Failed-suite rollback | Verified; synthetic business/auth rows absent |
| Authenticated buyer/seller end-to-end payment workflow | Not run after integrity blocker |
| Full payment concurrency, rejection/resubmission, standalone-payment regression, notification integration | Not established by this run; blocked by payment schema mismatch |

The application build used the dedicated local snapshot/configuration, not the root production environment. Historical partial-schema/concurrency results are not a substitute for the blocked full-schema payment integration run. The complete application test suite was not rerun in this investigation.

## Files changed for this investigation

- Guard/configuration: `scripts/local-staging/isolation.mjs`, `inspect-runtime.mjs`, `check.mjs`, `run-app.mjs`, `vite.config.mjs`; new `configure-local.mjs`.
- Baseline/database validation: `scripts/local-staging/build-baseline.mjs`; new `database.mjs`, `capture-schema.sql`, `compare-baseline.mjs`, `migration-sql.mjs`, `validate-migrations.mjs`.
- Regression coverage: `tests/localStagingIsolation.test.mjs`, new `tests/localRuntimeMetadata.test.mjs`, `tests/localMigrationSql.test.mjs`, and `tests/fixtures/localRuntime.mjs`.
- This report. Private runtime credentials, schema evidence, logs, baseline SQL, and local application/build artifacts remain ignored under `staging/local-workdir`.

No product UI, payment feature implementation, original feature migration, or production configuration was changed in this investigation.

## Remaining release requirements

Resolve the payment-schema contract and rerun the failed suite first. Then complete authenticated synthetic buyer/seller workflows, payment concurrency/invalidation checks, authorization/RLS, deadlines, notifications, standalone-payment regression, and browser endpoint verification. The local PostgreSQL version is 17.11 versus captured production metadata's 17.6; account for platform/version differences in readiness review. The catalog comparison validates the captured application schema, not equivalence of every hosted platform service.

Production's existing 38 batch records were not copied, queried, altered, or reseeded during this run. Their current count was not reverified; preservation here means no production operations were performed. Deployment remains blocked and requires explicit approval after successful remaining validation.
