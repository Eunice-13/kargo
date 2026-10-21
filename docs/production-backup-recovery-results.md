# Production backup and recovery results

**2026-10-21: Usable encrypted application-data backup verified. Production deployment remains NO-GO pending service-level recovery checks and deployment prerequisites.**

## Completed and verified

Existing work was resumed without restarting the export or database restoration. The authoritative snapshot is `exports/recovery-attempt-4`, completed **2026-10-21 08:54:01 UTC (16:54 PHT)** inside:

`/Volumes/KINGSTON/KARGO-Recovery/Production-Backup-2026-10-21.sparsebundle`

The separate disposable recovery target is `kargo-restore-20261021-db`, with its data inside:

`/Volumes/KINGSTON/KARGO-Recovery/Restore-Drill-2026-10-21.sparsebundle`

- Both approved APFS images conclusively passed AES-256 verification, private permissions and authenticated reopening. Native disk-image recognition is checked alongside fixed cipher/key-size metadata; unsupported metadata is not treated as encryption failure or accepted without evidence. Sparsebundle bands are 8 MiB, compatible with KINGSTON's FAT32 per-file limit.
- All listed artifacts and all Storage objects passed checksum verification in each of the three preserved completed export attempts. Attempt 4 includes the custom-format database dump, roles without passwords, database inventory, protected Vault recovery material, manifests and object files.
- **50 application/Auth/Storage/migration-history tables match the snapshot**, including **38 batches, 97 reservations/orders, 71 payments, 17 Auth users and all 26 migration-history entries**. Schema, RLS, functions, triggers and constraints were included in the database restore. Catalog checks match the captured baseline: 14 ordinary public tables, all with RLS enabled; 59 public/Auth/Storage policies; 89 public constraints; 21 noninternal triggers.
- The apparent order mismatch was floating-point text formatting: production uses `extra_float_digits=0`. Normalized comparisons confirm every order column matches, including delivery coordinates. Generated totals are consistent. No records were altered to make comparisons pass.
- **All 27 Storage files across seven buckets (12,817,747 bytes)** were copied from the existing backup into the encrypted restore environment and independently checksum-verified. Original object IDs, keys, versions and ownership metadata match the snapshot. Private payment proofs remain protected inside the encrypted images; copied files are owner-only.
- Both Vault secrets decrypt to the source snapshot digest using protected recovery material.
- Recovery was isolated: no published database ports, internal Docker network, encrypted bind-mounted data, disabled cron execution and disabled pg_net worker targeting. The restored postgres role is not a superuser. Existing local validation databases were not reset or restored.

Transient cron/pg_net response-log reproduction is excluded from the application-data recovery gate. It does not block usability of this backup; no additional work was spent reproducing those logs.

Detailed evidence is retained inside the encrypted restore image at `workdir/final-backup-verification.json`, with supporting table, order, Storage and catalog checks. The immutable backup manifest retains its original export-time “not-yet-restored” status; the later recovery evidence records the completed verification. The old worker's blocked status is historical, caused by the resolved formatting mismatch.

## Secured final state and disk usage

The exact disposable restore container was stopped successfully. Both encrypted images were unmounted without force, and the credential-holder session acknowledged shutdown. Reopening requires the owner's existing passphrases. No passphrases or database passwords were committed or printed.

Allocated usage measured before final shutdown:

| Image | Allocated usage |
| --- | --- |
| Backup | 70 MiB (73,400,320 bytes) |
| Restore drill | 456.31 MiB (478,478,336 bytes) |

These figures include preserved earlier attempts and can change slightly with final filesystem metadata writes. Existing images and unrelated KINGSTON files were preserved.

## Remaining deployment blockers and limitations

1. **Operational restore validation remains incomplete.** Storage bytes and database metadata are recovered, but files have not been rehydrated into a running Storage HTTP backend. Restored Auth sign-in and service-level private-file access have not been tested. Database recovery and file integrity are verified; complete hosted-service disaster recovery is not yet established.
2. Verify hosted Vercel project/team, production branch, environment and previous stable deployment; pin a reviewed immutable release commit containing the validated seven-migration bundle.
3. Immediately before any approved deployment, refresh read-only schema/history drift checks and ensure the recovery snapshot covers the deployment boundary. This snapshot does not cover writes after its capture. Database and Storage were exported sequentially, rather than under a shared cross-service transaction; their captured object mappings and recovered bytes match.
4. Keep the documented migration/forward-recovery runbook and explicit production deployment approval as release gates. No managed PITR restore window has been verified. Both images currently reside on one physical drive, so they do not provide independent offsite redundancy.

The encrypted backup-file and application-data recovery checks are satisfied. The full operational recovery/deployment gate remains open as described above. No new infrastructure or unrelated application changes were introduced to extend this drill.

## Checks and production safety

This resumed task verified existing artifact checksums, database fingerprints, Vault decryption, Storage recovery and catalog/isolation evidence. It did not rerun unrelated application tests or builds. The disk-image verifier's earlier 20 passing regression/native tests are prior results, not newly executed tests. Documentation whitespace was checked separately.

Production data, schema, permissions, migration history, passwords and Storage objects were not modified. No Smart Combined Delivery production migration, restoration, Vercel deployment or production smoke-test write was performed.
