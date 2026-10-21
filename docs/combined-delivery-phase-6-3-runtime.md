# Phase 6.3 runtime continuation — isolation gate blocked

The user's renewed authorization covered OrbStack installation after at least
25 GiB free space, local Supabase setup, then local migrations and authenticated
integration validation after successful isolation/baseline checks. Production
writes, migrations and deployment remain prohibited.

## Completed

- Initial disk check: 28,211,384 KiB available, approximately **26.9 GiB**; the
  25 GiB installation gate passed. After installing/downloading the stack,
  available space was approximately **17.2 GiB**. The reduction is local runtime
  and image storage; no files were deleted to make room.
- Installed **OrbStack 2.2.4 (21120)** through Homebrew. Opened first-run setup and
  selected Docker. No account sign-in, payment or agreement-acceptance action was
  performed by the agent. The engine reports **29.8.2**, and read-only OrbStack
  doctor checks pass (optional OrbStack bin directory PATH warning only).
- Supabase CLI **2.121.0** successfully runs using the isolated HOME and
  `SUPABASE_TELEMETRY_DISABLED=1`; no production credential environment is inherited.
- Created `kargo-local-staging-loopback` on the explicit local OrbStack Unix socket,
  with `com.docker.network.bridge.host_binding_ipv4=127.0.0.1` and the staging label.
- Started local Supabase only from `staging/local-workdir`, explicitly passing its
  workdir and staging network. No migration or seed directory was present.
- The registry initially returned HTTP 429 for PostgreSQL. Retrying the official
  image and its official Supabase GHCR mirror succeeded. Both report digest
  `sha256:b15d862126dd2dac02da524696ccfde2dcce2ceaee0a58973b2727befe492706`.
  No untrusted image source or health-check bypass was used.
- Final read-only inspection found **10 running local containers**: database,
  Auth, REST, Realtime, Storage, Kong, Studio, pg-meta, mail sink and Edge runtime.
  All configured Docker health checks report **healthy**; REST and Edge runtime
  report running without Docker health-check status. This is not an authenticated
  endpoint/integration result.
- Inspected container names/identities, network membership, published ports,
  staging volume names and environment values. Published ports are loopback-only;
  database maps to **127.0.0.1:56422**. No inspected hosted Supabase upstream was
  present. No application server was launched.

The containers and OrbStack are left running locally. They consume RAM/disk; no
production service was started, stopped or reconfigured.

## Stop condition — app preparation guard has not passed

The CLI legitimately created:

- `supabase/.temp/cli-latest`
- `supabase/.temp/start-secrets/`
- `supabase/.branches/_current_branch`

The earlier `verifyWorkdir()` guard rejects **every** `.temp` directory because it
was designed for the pre-start preparation phase. Consequently the application
check returns non-zero. Its configured anon key is also still deliberately empty;
local credentials have not been provisioned into the application target.

Live container isolation passed. The blocking check is a preparation-to-runtime
compatibility gap, not evidence that a production connection occurred. Nevertheless,
the user explicitly required stopping when environment-isolation checks fail.
The guard was **not disabled or broadened**, and no baseline, feature migration or
authenticated workflow was attempted after that check failed.

Next remediation: add a separately tested runtime lifecycle mode which permits
only independently verified local CLI-generated state and still rejects hosted
project-ref/pooler metadata, unknown files, symlinks and mismatched permissions.
Validate locally generated credential provenance and actual Auth acceptance before
populating the target; do not relax JWT ownership checks merely to accept an
arbitrary key. Then rerun all workdir/container/endpoint checks. Existing approval
for local migrations/integration remains conditional on these gates; no production
authorization is implied.

## Baseline preparation progressed, but not replay-validated

Authorized production inspection remained metadata/schema-only, with explicit
`BEGIN READ ONLY ... ROLLBACK`. No customer rows, auth users, receipt objects,
addresses or secret values were exported. Additional private metadata covers:

- Exact sequence configuration as strings, avoiding JavaScript bigint rounding.
- Eight column-level authenticated shipping UPDATE grants.
- Schema/default privileges and empty application-bucket configuration.
- Type ACL/ownership and unsupported-object completeness checks.

Additional checks found six public enum types with default ACLs owned by postgres,
56 function signatures, no public procedures/custom operators/inheritance,
nondefault collations or extra rules, and default table replica identities.

Added `build-baseline.mjs`, which **only generates private draft SQL**, never
connects or executes it. The draft uses deployed column/enum/sequence/view/
constraint/index/function definitions, ownership, table/function/column/schema
privileges, default privileges, policy definitions, the corrected extension-email
function, RLS event trigger, empty bucket settings and payment publication membership.
It rechecks function bodies after object creation in the draft. Unsupported schema
capabilities cause generation to fail rather than being silently omitted.

This is not a verified full-schema baseline: it has not been executed against the
local managed schemas, compared for exact grants/policies/objects, or exercised
with real local JWTs. Platform/event-trigger conflicts, dependency ordering and
local cron/mail setup still need validation. Production's **26 migration version/
name records** remain unchanged and retained as inspection evidence; no local or
production ledger records were written. All four collision originals and all six
feature migrations remain untouched/unexecuted.

The CLI selected PostgreSQL image **17.11.0.004**; production is PostgreSQL **17.6**
(linked metadata records image 17.6.1.166). Same-major local results would still
need an explicit version-difference assessment or exact-version rehearsal before
claiming production compatibility. No production-readiness claim is made.

## Checks run

| Check | Result |
| --- | --- |
| Full application/render test run | **182/182 pass** |
| Targeted isolation/container safety suites after additions | **33/33 pass** |
| TypeScript | Pass |
| Production build (compile only; no deployment or app launch) | Pass |
| New script formatting and `git diff --check` | Pass |
| OrbStack integration diagnostics | Pass, optional PATH warning |
| Supabase startup health checks | Pass |
| Actual local container/network inspection | Pass |
| Application workdir/credential readiness | **Blocked**, as above |
| Schema baseline replay/comparison | Not run |
| Feature migration execution and full-schema SQL/concurrency suites | Not run |
| Authenticated buyer/seller integration | Not run |

The application tests and targeted safety suites overlap; these counts must not
be added together. Seven container-safety tests were added after the 182-test run.
No existing formatting baseline was rewritten. Existing standalone application
code and missing-schema compatibility were not changed.

## Files added in this continuation

- `scripts/local-staging/build-baseline.mjs`
- `scripts/local-staging/container-safety.mjs`
- `scripts/local-staging/inspect-runtime.mjs`
- `tests/localContainerSafety.test.mjs`
- This report, plus a current-status link in the earlier Phase 6.3 report.

Private ignored workdir additions include schema supplements, `baseline.draft.sql`,
container inspection and restricted logs. Private workdir/review directories are
mode 0700, and credential-bearing logs/review files are mode 0600. They were not
committed or deployed.

**No production DDL/DML, configuration change, migration-history repair, customer
record modification, production migration or Vercel deployment occurred. No local
baseline or combined-delivery migration was applied. Work stopped at the requested
isolation gate; complete staging and authenticated validation remain blocked.**
