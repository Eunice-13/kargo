# Phase 6.3 — Isolated local staging preparation

Later continuation: [runtime installation and current isolation blocker](combined-delivery-phase-6-3-runtime.md).
OrbStack and the local stack are now running; the historical disk-space blocker
below no longer describes current status. Baseline/migrations remain unapplied.

**Status: preparation completed in part; runtime installation/startup and full-schema
validation remain blocked. No combined-delivery migration was executed.**

## Runtime and machine checks

Read-only machine checks returned Apple M1 / MacBookPro17,1, 8 GiB RAM, macOS
26.5.1, and approximately **13 GiB available disk space**. No Docker-compatible
runtime was found. Homebrew is installed. Hardware memory/model reads needed a
sandbox escalation; no settings were changed.

Recommended runtime: **OrbStack**, an established Docker-compatible macOS runtime
recommended by the current [Supabase local CLI guide](https://supabase.com/docs/guides/local-development/cli/getting-started).
Its Apple Silicon support is documented in the
[OrbStack Docker documentation](https://docs.orbstack.dev/docker/).
The user's response approved OrbStack installation **after the disk-space check**.
The subsequent check still returned about 13 GiB free. Installation was deferred,
and no installer or container images were downloaded.

Freeing **25–30 GiB total available space** is a conservative working allowance for
images, database volumes, build output and swap, not a claimed official minimum.
The 8 GiB host memory is constrained for running the full stack together with the
IDE/browser; service resource use must be measured after startup. Do not silently
omit required services to declare full-schema validation complete. No files were
deleted to create space. The user should free at least roughly another 12 GiB to
reach the lower planning threshold; recheck actual free space before installation.

[OrbStack installation instructions](https://docs.orbstack.dev/quick-start) describe
Homebrew installation. Nothing was installed or launched here. No license terms
were accepted on the user's behalf. Hardware/OS characteristics match the relevant
Apple Silicon platform; actual runtime and image operation is not verified.

## Dedicated local workdir

Prepared an ignored, local-only workdir:

`staging/local-workdir/`

It contains:

- `app/`: source-only snapshot of the current `src` and a minimal HTML entry titled
  **KARGO — LOCAL STAGING**. No root environment, Vercel configuration, Git state,
  production credentials, linked Supabase metadata or migration directory copied.
- `supabase/config.toml`: distinct `kargo-local-staging` project, PostgreSQL major
  17, custom ports, no seed and no external SMTP configuration. This is prepared
  configuration; CLI parsing and live startup remain unverified.
- `empty-env/`: separate empty Vite environment directory.
- `home/` and `tmp/`: private locations for future scrubbed child processes.
- `target.local.json`: exact local endpoints and an **empty** anon key. No local
  credentials have been generated. It must fail verification until genuine local
  credentials and live identity verification are available.
- `baseline-review/`: restricted schema-only review material, outside migrations.

Proposed local ports: API 56421, database 56422, shadow database 56420, Studio
56423, mail sink 56424, application 56443. Application endpoints use literal
`127.0.0.1`, not a hostname resolved through DNS. Ports have not been bound, and
service port availability, container bindings and listener identity remain checks
for startup. The configured DB password is the local-only development placeholder
`postgres`, not a production password; do not expose it off-host.

Production `supabase/config.toml`, `.env.local`, Vite and Vercel configuration remain
unchanged. This snapshot is not automatically synchronized with later source edits.
The entire workdir is ignored by the previously prepared `staging/.gitignore`.

## Implemented isolation safeguards

New scripts under `scripts/local-staging/`:

- `isolation.mjs`: exact project/API/database endpoint checks; rejects production,
  alternate hostnames, connection overrides and unexpected ports. It requires an
  unexpired anon JWT carrying the local project identity. This inspects claims,
  **not a cryptographic signature**; real local Auth must validate the token and
  the local issuer/configuration must support that identity before launch.
- Workdir validation requires the exact reviewed local Supabase configuration,
  rejects root/app env files, linked metadata, migrations, seeds and relevant
  symlinks. Preparation deliberately exposes no migration/reset/test executor.
- Child process environment uses a fixed allowlist. It does not inherit production
  SUPABASE/VITE aliases, management tokens, proxy settings or NODE_OPTIONS. It does
  not redefine the agent's own HOME; it sets a dedicated child HOME only.
- `vite.config.mjs`: separate local-only app configuration. Uses `empty-env`, a
  non-VITE exposure prefix and explicit local client values. Production's Vite
  fallback rules are not imported. HTTP CSP limits browser connections to the app
  and explicit local API/realtime ports, blocks remote frames/forms/images/fonts
  and external scripts. Remote fonts/images may consequently be unavailable until
  reviewed local assets are supplied; this is not a complete visual test yet.
- `check.mjs`: offline checks only, no network or SQL.
- `run-app.mjs`: no forwarded CLI options; refuses launch without a target and a
  fresh independently reviewed local-service verification record. If those gates
  pass later, launches Vite with the scrubbed environment. No such record exists.
  The record is a procedural review gate, not an unforgeable security credential.

The future service verification must inspect actual container identities, local
port bindings, API/Auth/database health and absence of production upstreams.
Loopback alone is not proof against an intentional proxy/tunnel. None of these
scripts prevents a person bypassing them with direct tools. No claim of OS-wide
network isolation is made. Browser CSP is served by the guarded Vite server/preview;
serving the generated files through an arbitrary server would not preserve it.

## Schema-only baseline review preparation

Using the previously authorized production **read-only** inspection, collected
catalog definitions inside `BEGIN READ ONLY ... ROLLBACK`. No application function
was called and no application records were read. The private schema-source manifest
contains:

- All **26 migration version/name entries**, matching the Phase 6.2 observation.
  Production ledger records were not changed or copied into a local migration table.
- 195 public-table column definitions, enum labels and sequence configuration
  (no current sequence values/application state), three view definitions.
- 56 public function definitions/signatures/ACLs, including the corrected
  `request_order_extension()` definition.
- 89 constraints, index definitions, row triggers, 59 policy definitions, table
  RLS/ownership/ACL metadata and default privileges.
- Event-trigger definitions, including the previously unrepresented `ensure_rls`
  binding to `public.rls_auto_enable()`.

Private files include `schema-source.review.json`, a ledger-only metadata file,
`request_order_extension.review.sql` and `rls_auto_enable.review.sql`. These are
schema sources for review, **not an executable or completeness-verified baseline**.
The corrected function was preserved from the actual deployed definition instead
of copying the broken local seven-values/six-columns email INSERT. The RLS event
trigger must be reconciled with the managed local stack before recreating it to
avoid duplicating platform behavior. No original migration file was edited.

A credential/production-target literal scan found none of the listed secret/JWT/
connection-string/production-ref patterns in the manifest. This is a limited scan,
not a comprehensive secret audit; full definitions remain private, ignored and
mode 0600. No auth users, customer records, addresses, payment proofs, storage
objects, Vault values or production keys were copied.

A tracked, non-secret review summary and manifest SHA-256 are recorded in
`docs/combined-delivery-phase-6-3-baseline-review.json`. A complete pg_dump-equivalent
baseline still requires review of dependency ordering, managed Auth/Storage roles
and schemas, bucket configuration, grants/publications, local cron/mail isolation
and comparison against a running full local stack. No partial schema has been
presented as successful staging validation.

## Migration reconciliation

The four collisions remain as documented in Phase 6.2; originals are untouched:
202610010005 (payment lifecycle / zero waitlist), 202610190002 (group orders /
branded email), 202610200001 (extension email / retention), 202610200002 (gallery /
combined foundation). None is in the 26-entry production ledger.

Use the actual reviewed production baseline to account for already present objects,
not timestamp-order replay. Do not import the customer-specific repair migration
or replay absent optional changes merely because they share a version with a
present change. Preserve current production defaults, overloads and corrected
function bodies.

The proposed unique local-only mapping remains baseline 202610220001, followed by
feature copies 202610220002–202610220007 in dependency order: foundations, buyer,
seller, recovery, batch integrity, payments. These identifiers are a proposal;
**no executable migration copies, renames, moves, ledger repairs or application
were performed**. Local reconstructed history must remain explicitly distinct from
production history. The six feature migrations require the next approval before
execution.

## Verification results

| Check | Result |
| --- | --- |
| Local and existing hosted-target safety tests | **26/26 pass** |
| Child-process test for inherited Supabase/proxy/node injection variables | Pass; no matching variables visible |
| Production/alternate endpoint, wrong JWT role/ref, expired JWT rejection | Pass |
| Ambient env, linked metadata, migrations and altered local config rejection | Pass |
| Browser connection policy assertions | Pass; live browser enforcement not exercised |
| Actual prepared workdir shape | Pass |
| Placeholder target check | Correctly blocked with exit 1 |
| App launcher before readiness | Correctly blocked; no service started |
| Ignore rules for target and schema-review material | Pass |
| New JavaScript formatting and `git diff --check` | Pass |
| Production ledger metadata comparison | Same 26 version/name entries as Phase 6.2 |
| Runtime installation/container operation | Not performed; disk-space gate |
| Local schema completeness/RLS/functions/triggers after reconstruction | Not verified; no local database |
| Live service health/bindings/database identity | Not verified |
| Authenticated integration or combined-delivery migrations | Not run; next approval required |

Tests use synthetic JWT claims and filesystem fixtures only, without HTTP/database
clients or production connectivity. No application-wide build/test rerun was
needed for the preparation scripts; full Phase 6 regression and integration gates
remain outstanding.

## Files changed and remaining steps

Added source-controlled files:

- `scripts/local-staging/isolation.mjs`
- `scripts/local-staging/check.mjs`
- `scripts/local-staging/run-app.mjs`
- `scripts/local-staging/vite.config.mjs`
- `tests/localStagingIsolation.test.mjs`
- `docs/combined-delivery-phase-6-3-baseline-review.json`
- This report.

Prepared ignored local workdir/configuration/schema-review files as described above.
No existing application, production configuration or migration source was changed.

Next: the user needs to make sufficient disk space available (no deletion is
authorized). Once the condition is satisfied, the recorded OrbStack installation
approval remains valid. Install/verify that runtime, then validate the prepared CLI
configuration and loopback-only bindings before starting any local service. Do not
start the application until locally issued credentials and live service identity
pass verification. Complete baseline review and local schema comparison separately;
do not automatically execute the six feature migrations or authenticated workflows.

**No software installed, no services started, no production writes/configuration
changes, no production migration, no Vercel deployment and no combined-delivery
migration execution occurred. Phase 6.3 is not fully completed; runtime/startup and
baseline validation remain blocked.**
