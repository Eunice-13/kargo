# Phase 6.2 — Read-only schema investigation and local staging feasibility

Investigation only. No production DDL/DML, migration-history repair, installation,
service start, local configuration change, migration rename/move or deployment was
performed. Only this report was added to the repository. Local Supabase staging
is feasible in principle but is **not available or validated on this Mac yet**.

## Inspection method and scope

Authorized metadata queries used the configured project's Management API database
query endpoint, each wrapped in `BEGIN READ ONLY` and `ROLLBACK`. HTTP 201 is this
endpoint's success response, not evidence that data was written. Queries inspected
system catalogs, information_schema, migration version/name metadata and cron
name/schedule/active metadata. They did not execute application functions or select
application rows, auth users, addresses, payment objects, cron command bodies,
Vault values, credentials or migration statement/rollback payloads.

Schema metadata and the two targeted function definitions were kept in restricted
mode-0600 temporary files outside the repository for comparison. No complete
schema export or customer-data export was performed. Credentials were read from
existing local secret storage and were not printed or changed. The inspected
project was `leylmztbknmlwnwgvaud`, the existing production target.

## Verified production findings

- PostgreSQL **17.6**. Earlier native tests used PostgreSQL 18.4, so they do not
  establish compatibility with the actual target version.
- Public schema: **14 ordinary tables, three views, 56 function signatures,
  89 constraints and 42 indexes**. All 14 public tables have RLS enabled; none has
  FORCE RLS enabled. All inspected public constraints are marked validated.
  These facts do not prove policies or authorization are correct.
- Inspected 21 non-internal row-trigger definitions across public/auth/storage,
  and 59 policies across those schemas. Representative policies restrict orders
  and payments to participants, buyer proof insertion to the owning buyer, and
  receipt upload paths to the authenticated user's folder. Seller receipt reads
  join payment to reservation ownership. These were definition checks, not real
  JWT/RLS integration tests.
- `user_profiles` exists; no inspected public function source still references
  `public.profiles`. Signup/profile and shipping/payment triggers are present.
- Existing unrelated multi-buyer `group_orders` tables and functions are present.
  They must be preserved separately from Smart Combined Delivery.
- **No Smart Combined Delivery tables** (`delivery_destinations`, combined group,
  pin or payment tables) exist, and the inspected order/payment columns do not
  include `delivery_destination_id`, `combined_delivery_revision` or
  `combined_delivery_group_id`. This is consistent with undeployed feature SQL.
- Installed extensions: plpgsql 1.0, pg_stat_statements 1.11, uuid-ossp 1.1,
  pgcrypto 1.3, supabase_vault 0.3.1, pg_cron 1.6.4, pg_net 0.20.4.
- Three active cron jobs: expiry sweep, pending-email worker and payment-deadline
  reminders, each every minute. No notification-retention cleanup job/function/
  retention index was found. Do not infer the local retention migration is deployed.
- Payments belong to the `supabase_realtime` publication. Managed auth/storage/
  realtime, extensions, Vault, cron/net and GraphQL schemas are present.

No batch or other application rows were queried or counted in this phase. The
historical 38-batch count was not freshly verified; this investigation made no
changes to those records.

## Deployed history versus local files

`supabase_migrations.schema_migrations` exists. Only its `version` and `name`
fields were selected. It has **26 recorded entries**: the 25 local migrations from
`202609200001_initial_kargo_schema` through
`202609300007_reopen_mia_sk_ii_payment`, plus
`202610180001_tracking_and_buyer_shipping`.

There are **21 other non-combined-delivery local files without an exact matching
version/name ledger entry**, as well as the six undeployed feature files. Absence
from the ledger does not establish that a file's SQL never ran: the current
schema contains many effects from these files (profile rename, payment-method
lifecycle, group orders, media/gallery and email infrastructure). The existing
Management API apply script does not maintain CLI migration history. The metadata
cannot establish which actor/tool applied each change or in what historical order.

A whitespace-insensitive function-body comparison against all historical local
function candidates, allowing the documented profiles rename, matched **54 of 56
production signatures** to a local body. This is a limited source fingerprint
check, not semantic or whole-schema equivalence: it ignores whitespace, does not
compare grants/default arguments, and does not mean the latest filename wins.
For example, production waitlist functions match `202610010004` rather than the
later zero-limit/priority replacements. Production's waitlist_limit default is
NULL, not the zero default in the later local file. Both old two-argument and newer
shipping-aware `claim_batch_product` overloads exist and must be accounted for.

Two unmatched definitions were inspected directly:

1. **`request_order_extension(uuid, integer, text)` differs from local source.**
   Production combines the request text and reason into a single email-body value.
   Local `202610200001_extension_request_emails.sql` instead supplies separate
   request-text and reason values: seven expressions for the six specified
   `pending_emails` columns. That local body would fail when its email-enabled
   branch executes. This is a reconstruction/replay blocker; it was not executed
   or fixed here. Existing production has the corrected body. A later correction
   must be separately reviewed and tested rather than overwriting production with
   this local file.
2. **`public.rls_auto_enable()` and enabled event trigger `ensure_rls`** are present
   in production but absent from local migration definitions. The event trigger
   enables RLS for newly created public tables. Whether it was platform-generated
   or manually added was not established. Local reconstruction must explicitly
   account for it and other managed event triggers, not silently omit or duplicate
   platform-provided definitions.

The production standalone sweep contains the source fragment expected by Phase
4's guarded wrapper. That single compatibility check is positive evidence, not
proof that all full-schema migrations will execute successfully.

## Four version collisions and non-destructive resolution

None of these four version IDs is recorded in the production ledger. Individual
object evidence varies; matching objects do not establish whole-file provenance.

| Duplicate version | Local files / observed effects |
| --- | --- |
| `202610010005` | `restore_payment_method_lifecycle` and `zero_waitlist_limit`. Seller lifecycle fields/trigger/index exist. Zero-limit default is absent; current waitlist functions match the earlier 004 file. |
| `202610190002` | `batch_group_orders` and `branded_email_design`. Group-order objects and brand-assets storage policy exist. Bucket row contents were deliberately not read. |
| `202610200001` | `extension_request_emails` and `read_notification_retention`. Extension-email functions exist with the source difference above. Retention function/index/job are absent. |
| `202610200002` | `batch_gallery_images` and `combined_delivery_foundations`. Gallery column/view exist; combined-delivery foundations are absent. |

Recommended reconciliation, **proposed only**:

1. Preserve every original filename and all 26 production ledger entries. Do not
   issue remote `migration repair` or fabricate applied records.
2. Record a source-to-object/checksum mapping for baseline reconstruction. Mark
   absent optional changes (retention/zero-limit/priority) as absent, not implicitly
   applied because another file shares their timestamp. Preserve actual deployed
   overloads, policies, triggers, corrected definitions and defaults.
3. In a future isolated local workdir, use a reviewed schema-only production
   baseline with a new unique local migration ID. For illustration, reserve
   `202610220001_local_production_schema_baseline`; check for collisions again
   before finalizing. This local ledger describes reconstruction, not production
   deployment history. Keep the original 26-entry ledger as inspection evidence,
   not rows to import into local CLI history.
4. Assign unique **local bundle** IDs 202610220002 through 202610220007 to reviewed
   copies of the six feature deltas, preserving their source hashes/mapping and
   order: foundations → buyer requests → seller review → recovery → batch
   integrity → payments. Do not execute historical changes already in the baseline.
   Do not apply the original colliding gallery file again.
5. This is not a proposal to silently rename future production migrations. A later
   production rollout needs its own reviewed mapping of these still-unapplied
   feature files to unique IDs, reconciled with the unchanged production ledger.
   Reusing a validated content bundle requires hash and dependency checks.

No baseline or migration copies were created, renamed, moved or executed here.

## Local tools and operational feasibility

- Supabase CLI is installed as a project npm dependency, package version **2.121.0**,
  and `node_modules/.bin/supabase` exists. There is no standalone `supabase` on PATH.
- Running its `--version` entry point failed because its telemetry initializer tried
  writing outside the workspace to `~/.supabase/telemetry...`; the sandbox rejected
  that write. It was not retried with elevated filesystem permissions. The package
  version is verified, but a successful CLI invocation is not verified.
- No Docker executable was found on PATH, the common Homebrew/usr-local paths or
  the standard Docker.app executable paths. No Docker/Podman/OrbStack/Rancher app
  was found in the inspected /Applications and user Applications listings.
- No Docker daemon socket was found at /var/run/docker.sock, ~/.docker/run,
  ~/.colima/default or ~/.orbstack/run. This does not rule out a nonstandard/remote
  installation, but no operational local container runtime is available through
  the inspected configuration.
- No psql executable was found in the common Homebrew/usr-local paths. A compatible
  pg_dump/client toolchain must be verified before a schema export; future CLI
  containerized dump tooling is an alternative once the runtime is approved.

A complete **local Supabase stack** requires an approved compatible container
runtime, working CLI, sufficient Docker resources/disk, unoccupied local ports,
PostgreSQL 17-compatible images/extensions, and the Auth, Storage, REST, Realtime
and other required service containers. A standalone PostgreSQL fixture cannot
replace it. No software was installed and no service was started. No hosted project
is needed if this local stack can be established and its platform differences are
validated.

## Recommended reconstruction strategy

**Use a reviewed schema-only baseline, retaining migration history as evidence.**
Current local migrations alone cannot be certified to reproduce the exact deployed
schema: the ledger is incomplete, function/default drift exists, an event trigger
is unrepresented, and one local email branch is invalid. Do not replay customer-
repair SQL or try to infer actual order solely from filename timestamps.

After approval for local tool/configuration setup:

1. Establish the isolated full Supabase stack and verify PostgreSQL 17 compatibility.
   Start with its managed auth/storage schemas rather than overwriting them from
   production. No real users, storage objects or Vault values should be imported.
2. Use the already authorized schema-only inspection/export scope to prepare a
   restricted application-DDL baseline, plus reviewed app policies/triggers on
   managed schemas, grants, extensions and event-trigger differences. No customer
   rows, auth hashes, roles/password dumps, receipt files, addresses, migration
   statement payloads or secret values. Review DDL for embedded credentials or
   customer-specific literals before using/sharing it. No complete dump was taken
   in this investigation.
3. Recreate empty bucket configuration and stage-only external integration settings
   separately. A schema-only dump does not contain bucket rows, cron job rows or
   platform settings. Existing local bucket declarations are candidates, not proof
   of deployed settings. Use a sanitized metadata manifest after further inspection.
4. Recreate scheduled definitions from reviewed source with external dispatch
   disabled/sink-routed until locally approved. Never copy production email/Vault
   keys or production worker destinations into local schedules.
5. Compare the baseline's tables, defaults, constraints, functions/signatures,
   triggers, RLS/grants, publication and managed-schema dependencies to the inspected
   production metadata; document intentional local service differences. Then apply
   feature deltas only after separate approval and test full JWT/RLS workflows with
   synthetic users/data. Production is not the test target.

## Environment isolation proposal — no changes made

`vite.config.ts` calls `loadEnv(mode, cwd, "")`, which includes `.env.local` even
for staging mode, accepts bare SUPABASE aliases, and can be overridden by inherited
process variables. Merely adding `.env.staging` is not a dependable isolation gate.

Use a separate local-staging checkout/workdir with no production `.env.local`,
no copied `supabase/.temp` linked-project state and a clearly different local
Supabase project ID. Supply local stack URL/keys explicitly from its status output.
Use a scrubbed test-launch environment, not ambient SUPABASE/VITE_SUPABASE values.
The browser must receive only the local publishable/anon key, never a server secret.

Proposed future local-mode guard should fail before startup/build unless the API
URL is an exact approved loopback HTTP origin and database connection is the
expected local port/DB with local credentials. Reject all supabase.co production
hosts and linked-project fallbacks, verify baseline fingerprints through that local
connection, and prevent test-browser requests to production hosts. Keep other
modes' behavior unchanged. Confirm the actual local services and unique project
identity too: loopback alone is not proof against a local tunnel/proxy.

Phase 6.1's existing verifier deliberately accepts only hosted direct TLS targets;
**it will reject local Supabase**. Do not weaken it or mark the hosted template
approved as a workaround. A separately reviewed local-only verifier/configuration
is needed. None was implemented or configured in this investigation.

## Remaining blockers and approval boundary

- Approve installing/configuring a local container runtime if one is not otherwise
  available, and approve starting its daemon and the local Supabase stack.
- Approve a separate local workdir/configuration and a local-only target guard.
- Reconcile drift and the local extension-email replay defect before generating
  an executable baseline/bundle. This finding does not authorize a production fix.
- Verify full-schema export completeness, empty storage configuration and managed
  service compatibility. Platform/Vault/mail settings cannot be inferred from SQL
  migration filenames alone.
- Keep Phase 6's full-schema migration, real JWT/RLS, proof, notification, expiry,
  rollback and concurrency validations as release blockers. No production readiness
  claim is made from catalog inspection.

Only metadata inspection/comparison and tool availability checks were performed.
No application tests/build were rerun because no runtime source changed. No local
configuration was modified, no services were started, no migration was executed,
and production data/history/configuration were preserved. Await explicit approval
before any local setup or execution step.
