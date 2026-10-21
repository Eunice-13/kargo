# Phase 4 concurrency preflight — original snapshot-safety findings

**Current status:** Phase 4 development and local validation are complete. See
[the Phase 4 implementation report](combined-delivery-phase-4.md) for payment
behavior, modified files, 16 new native payment cases, regression results and
remaining release gates. Full-schema Supabase staging is still required. No
production migration or deployment occurred; Phase 5 has not started. The older
findings and “not implemented” statements below are historical preflight records.

**Resolved locally in Phase 3.2:** All original eleven cases and sixteen additional
cases now pass against the corrective migration. The original failures below are
historical results, not the current audit result. See [the Phase 3.2 report](combined-delivery-phase-3-2.md)
for the correction, current validation, deployment limitations and approval gate.
Phase 4 has not been started.

Payment implementation was stopped under the user's explicit instruction:
“If any critical integrity issue is identified, stop implementation and report it.”
No Phase-4 payment code, schema migration or production data change was made.

## Summary

The original Phase-3.1 recovery audit still passes. Membership release, retained
shipping/correction pauses and original remaining budgets continue to pass the
four existing SQL suites.

New native PostgreSQL multi-session tests found a separate batch-integrity gap:
`guard_active_delivery_batch_identity()` depends on a snapshot-based `EXISTS`
query. A seller transaction using an older **REPEATABLE READ** snapshot can miss
a newly committed active group. Its batch update then commits, even though the
product belongs to that group. This violates the strict same-batch V1 invariant.

**Scope matters:** all nine tested races at the normal **READ COMMITTED** isolation
level passed. This report does not claim that the normal application transaction
path was shown to fail. The failing cases require an overlapping REPEATABLE READ
database transaction. The database guard does not currently enforce an isolation
restriction or otherwise make this mutation safe at that level.

## Reproduction

Both actors use separate native PostgreSQL connections. Product updates run under
the authenticated seller role with the existing product-owner policy. No trigger
is disabled and no direct group/membership write permission is granted.

### Race 1 — request creation versus a waiting batch update

1. Seller connection B starts a REPEATABLE READ transaction and establishes its
   snapshot before the request exists.
2. Buyer connection A creates a valid same-batch request and keeps its transaction
   open. Its eligibility checks hold product/batch `FOR SHARE` locks.
3. B attempts to move a reserved product into another seller-owned batch. The
   audit observes actual blocking with `pg_blocking_pids` — no fixed sleep is used
   to assume the ordering.
4. A commits. B's UPDATE continues, but its trigger query sees B's earlier snapshot
   without the new membership. The update is accepted and B commits.

Observed final state:

```json
{ "status": "pending_approval", "actual_batches": 2, "active_members": 2 }
```

### Race 2 — an older transaction spans approval and fee assignment

1. Seller connection B starts REPEATABLE READ and establishes an empty-membership
   snapshot.
2. Another connection completes the normal buyer request, seller approval and
   shared-fee assignment as separate committed operations.
3. B moves one reserved product to another seller-owned batch. Its older snapshot
   still cannot see the membership, so the UPDATE commits.

Observed final state:

```json
{
  "status": "shipping_fee_set",
  "shipping_fee": "125.50",
  "actual_batches": 2,
  "active_members": 2,
  "paused_members": 2
}
```

The 125.50 fee is test-fixture data, not a new application amount or calculation.

## Root cause and implications

The relevant function and product/batch triggers are in
`supabase/migrations (to update profile database name)/202610210003_combined_delivery_recovery.sql`.
The eligibility helper's `FOR SHARE` locks serialize competing row updates, but
waiting for that lock does not refresh a REPEATABLE READ transaction's snapshot.
The trigger's existence check can therefore return false after the group has
committed. Locking alone does not make that particular snapshot query authoritative.

The failure leaves a stale active group rather than partially committing a
payment. The RPC's later batch revalidation still rejects a stale group, and
Phase-3.1 participant recovery remains available. **No incorrect payment, duplicate
charge, lost inventory or missing payment proof was demonstrated.** Combined
payment functionality does not exist yet. Nevertheless, relying on the current
guard as a strict batch invariant would be unsafe for subsequent payment work.

The batch-owner mutation guard uses a similar snapshot-based pattern; that
analogous path should be reviewed in the correction. It was not separately
reproduced here, so this report does not claim a proven second owner-update defect.

## Required correction before payment work

Make batch identity protection safe against a stale snapshot: a conflicting
mutation must be rejected or produce a whole-transaction serialization failure.
The invariant must be coordinated with membership creation/release rather than
relying solely on a snapshot-based absence check. Alternatively, any supported
isolation restriction must be explicitly enforced and documented for all relevant
writers; it cannot be an unstated assumption.

Retain Phase-3.1's authorization, existing lock order, immutable financial/time
snapshots and recovery behavior. Rerun all eleven native cases and the existing
suites after the correction, then reassess the Phase-4 gate. No such correction
was silently implemented during this preflight.

## Test environment and results

A temporary native **PostgreSQL 18.4** installation was created under
`/private/tmp/kargo-native-pg`, with a private Unix socket and loopback-only listener.
No project dependency/lockfile was changed. The audit checks the server's data
folder before any DDL and accepts no production database connection URL.

Each native scenario creates an independent disposable database from a template,
uses three independent connections, and deletes its database afterward. The
schema is the existing combined-delivery test fixture plus all four actual
Phase-1/2/3/3.1 migrations and the real standalone shipping-fee RPC. This is native
multi-session validation, **not** a full Supabase staging environment. The latter
was not available; auth/storage/extension integration against a complete staging
schema remains unverified. Production server version/isolation settings were not
queried or changed.

| Native scenario                                                    | Result   |
| ------------------------------------------------------------------ | -------- |
| Concurrent duplicate requests produce one group                    | Pass     |
| Conflicting shared fees cannot overwrite one another               | Pass     |
| Recovery wins against fee assignment atomically                    | Pass     |
| Valid fee assignment survives a competing invalidation attempt     | Pass     |
| Simultaneous buyer/seller recovery releases memberships once       | Pass     |
| Request creation blocks conflicting product move at READ COMMITTED | Pass     |
| Product move wins; waiting request rejects different batches       | Pass     |
| Request creation blocks standalone shipping-fee assignment         | Pass     |
| Standalone fee wins; waiting request cannot acquire memberships    | Pass     |
| REPEATABLE READ batch mutation versus request creation             | **Fail** |
| Old snapshot changes an approved, fee-assigned group               | **Fail** |

The regression script intentionally exits 1 while these two failures remain.
The existing four embedded SQL suites, full unused-state migration/rollback chain
and original four-case recovery audit also pass. The 82 application/render tests,
TypeScript and production build pass for the unchanged application. Formatting
flags only the already-known `MyClaims.tsx` baseline issue; the new audit script
passes formatting. No separate lint script is configured.

## Reproducing the native audit

The native server was stopped after testing. All scenario/template databases were
removed. The temporary binaries remain available for reruns, without adding an
application dependency. On this Darwin arm64 environment they were prepared with:

```sh
npm install --prefix /private/tmp/kargo-native-pg --no-package-lock --ignore-scripts --no-audit --no-fund @embedded-postgres/darwin-arm64@18.4.0-beta.17 pg@8.16.3
```

The package's inspected `scripts/hydrate-symlinks.js` was run from its package
directory to restore bundled library links. Then its `native/bin/initdb` initialized
`/private/tmp/kargo-native-pg/cluster` as `kargo_test` with local trust authentication.
The private socket directory has mode 0700. Start the test instance with its
bundled `pg_ctl`, port 55439, socket `/private/tmp/kargo-native-pg/socket` and
`listen_addresses=127.0.0.1`, then run:

```sh
node scripts/test-combined-delivery-concurrency.mjs
```

The script verifies the temporary data-directory path, creates only databases
with its generated `kargo_audit_` prefix, and cleans them up in `finally`. It uses
only the temporary pg client module. Stop the instance afterward with its bundled
`pg_ctl -D /private/tmp/kargo-native-pg/cluster -m fast -w stop`.
Local shared-memory/socket permissions may require executing the native server
and test process outside the filesystem/network sandbox. Neither a Supabase CLI
production link nor production credentials are used.

## Files changed and completion status

- Added `scripts/test-combined-delivery-concurrency.mjs`.
- Added this report.
- Added the current-blocker note to `docs/combined-delivery-phase-4-preflight.md`.

No application/payment/shipping calculation code or migration was changed.
Phase 4 is **not implemented and not production-ready**. Further payment testing
(submission, verification, rejection, grouped notifications) cannot be claimed.
The two snapshot-isolation regressions must be resolved before proceeding under
the requested gate. No production migration was applied. Phase 5 was not started.
