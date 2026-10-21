# Backup destinations and restore target — approval proposal

**Proposed only.** No production data was exported, no Storage objects were copied, no image/destination was created or mounted, no new services were started, and no database was modified. Inspection was limited to local capacity/security/resource metadata and a read-only production database-size query.

## Verified capacity and encryption

| Location                      | Available space    | Findings                                                                                                                                              |
| ----------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mac internal APFS Data volume | About **12.3 GiB** | FileVault **On**, APFS ownership enabled. Suitable for encrypted local storage in principle, but spare capacity is limited.                           |
| `/Volumes/KINGSTON`           | About **52.1 GiB** | Mounted USB drive, FAT32. Not an encrypted destination by itself; Unix permissions displayed on FAT32 are not durable cross-computer access controls. |

Recommend KINGSTON for both separate encrypted images below. Do **not** reformat or repartition the drive or modify existing files. FAT32 has a per-file size limit, so use a banded sparsebundle rather than a large single-file image. Local `hdiutil` supports APFS sparsebundles and AES-256 encryption. Apple documents encrypted disk images and grow-as-used sparsebundles. [Apple disk image guidance](https://support.apple.com/en-gb/guide/disk-utility/dskutl11888/mac).

No proposed image exists yet. Its actual encryption, permissions, correct password behavior, safe mounting and Docker bind-mount compatibility must be verified with an **empty-image test after approval**, before any production data is exported. FileVault alone does not establish that a future external backup is encrypted.

## Exact proposed paths

### Backup — retain independently of the drill

- Image: `/Volumes/KINGSTON/KARGO-Recovery/Production-Backup-2026-10-21.sparsebundle`
- Format: **AES-256 encrypted, APFS, 2 GiB virtual capacity**, growing as used.
- Mount: `/Volumes/KARGO-Backup-20261021`
- Export/manifest directory: `/Volumes/KARGO-Backup-20261021/exports`

Use a strong owner-controlled passphrase, kept separately from the drive; no passphrase in scripts, logs, Git or automatic Keychain storage without approval. Complete and verify the backup, detach it, then mount it read-only when using it as the restore source. Do not let restore processes overwrite the backup.

### Disposable restore — a different image and environment

- Image: `/Volumes/KINGSTON/KARGO-Recovery/Restore-Drill-2026-10-21.sparsebundle`
- Format: **separately encrypted APFS, 8 GiB virtual capacity**, growing as used.
- Mount: `/Volumes/KARGO-Restore-20261021`
- Workdir/configuration: `/Volumes/KARGO-Restore-20261021/workdir`
- PostgreSQL data/WAL: `/Volumes/KARGO-Restore-20261021/data/postgres`
- Storage files: `/Volumes/KARGO-Restore-20261021/data/storage`
- Private temporary files/logs: `/Volumes/KARGO-Restore-20261021/tmp` and `/Volumes/KARGO-Restore-20261021/private-logs`
- New project/container namespace: `kargo-restore-20261021`
- New internal Docker network: `kargo-restore-20261021-isolated`
- Proposed localhost endpoints: API `127.0.0.1:57421`, database `127.0.0.1:57422`; reserve `57420`, `57423`, `57424`, `57443` for shadow/optional tooling only if needed.

The proposed image parent and mountpoints do not exist. Those ports had no listening TCP processes during inspection; recheck before startup. Verify drive identity/UUID and paths again before creation, and stop rather than overwrite an existing path.

This target is distinct from production and the existing `kargo-local-staging` validation stack at ports `56421`–`56424`, its data volumes and its frozen database template. The generic CLI `--workdir` flag alone is **not** sufficient isolation: it does not prove customer data stays out of default Docker volumes.

If KINGSTON is unavailable, the alternative backup-image location is `/Users/jennadee/Library/Application Support/KARGO-Recovery/Production-Backup-2026-10-21.sparsebundle`. Its verified parent is owner-restricted and the disk is FileVault-protected. This alternative is **not selected** and would require separate approval/capacity review; do not silently fall back to it.

## Export and restore size estimate

Read-only source-size inspection measured:

- Whole production database allocation: **63,245,459 bytes ≈ 60.3 MiB**.
- Public/Auth/Storage/migration-history table allocations excluding indexes: about **1.3 MiB**; with indexes about **3.5 MiB**. Other platform/system allocation accounts for much of the database total.
- Latest Storage inventory: **27 objects, 12,817,747 bytes ≈ 12.2 MiB**. This is metadata-reported size, not a verified download.

Logical export size cannot be derived exactly from physical allocation. For planning, budget **256 MiB for database/configuration exports plus 32 MiB for Storage/metadata**; roughly **300 MiB before encryption/filesystem overhead**. These are conservative allowances, not guaranteed bounds or measured artifacts. Compression, expansion of stored values and changes since inspection remain unknown. Stop and reassess if those allowances are exceeded.

The proposed 2 GiB backup and 8 GiB restore capacities provide headroom on the external drive without allocating all 10 GiB immediately. They do not guarantee sufficient runtime resources. Existing Docker images occupy about 7.1 decimal GB and can be reused only after checking their versions; new images/caches could still consume internal disk space.

The Mac has **8 GiB RAM**; Docker reports about **3.9 GiB** available, with the existing ten containers using about **1.1 GiB** in aggregate at inspection. Start only required restore services, with bounded resources, after approval. Do not stop/restart the validation stack or increase OrbStack limits without additional approval. If memory, space or external-volume file-sharing tests fail, stop.

## Protection required before import

- Enforce owner-restricted APFS directories (`0700`) and private files (`0600` where applicable), with service-specific PostgreSQL ownership limited to its new data directory. Verify ownership enforcement inside the mounted images, not the outer FAT32 mode display.
- Keep proofs, identity certificates, Auth data, object-name manifests, dumps and diagnostic details inside encrypted mounts. No previews, public links, plaintext ordinary temp files or customer details in terminal output. Check indexing, automatic backups and logging for unintended plaintext copies before import.
- Bind all database and object-data paths explicitly to the new restore image. Audit container mounts before loading data. Stop if the setup would place customer data in default named volumes or another path not approved here.
- Use fresh local service/JWT credentials and a scrubbed environment. Never load production `.env.local` into the restore services or weaken the existing validation guard. Restored Vault/cron material must not become live service configuration.
- Isolate the new network from production, the internet and the old validation network; allow only approved localhost access. Prove outbound denial before import. Keep restored cron jobs, email dispatch, webhooks and Edge workers inert before restored data can activate them.
- Keep the backup detached or read-only during the drill. SHA-256 manifests and the restore checks described in [the backup plan](production-backup-recovery-plan.md) establish integrity separately from encryption. No file-integrity or restore-success claim is made yet.

Encryption protects data at rest, not from authorized administrators or Docker administrators while mounted. The two images share one physical drive; they are separate environments, not independent copies against drive failure.

## What could be affected by an approved drill

| Resource                                                                                                  | Planned effect                                                                                                                                                                                                                    |
| --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New `KARGO-Recovery` directory and two images on KINGSTON                                                 | Created and grown only within these new paths; no existing drive files removed/changed.                                                                                                                                           |
| New mountpoints, workdir, data, private logs and temp files above                                         | Created; restore modifies only its disposable database/files. Backup becomes read-only after verification.                                                                                                                        |
| Existing OrbStack installation/VM disk                                                                    | Shared engine metadata, cached images and resource use may grow. Runtime logs must be controlled so customer data does not spill outside approved encrypted paths. Actual container mounts/logging must be audited before import. |
| Existing validation containers, database, volumes, network and `staging/local-workdir`                    | No planned reset, restore, stop, restart or configuration changes. Resource contention is possible; stop the drill if it affects them.                                                                                            |
| Repository source, release migrations, Git history, root Supabase config and production environment files | No planned changes. This proposal is documentation only.                                                                                                                                                                          |
| Production Supabase, Storage and Vercel                                                                   | Only the separately approved read/export operations; no production writes, migrations, restore or deployment.                                                                                                                     |

No external-drive file sharing, empty-image mount test or second-stack startup has been performed. A full supported restore procedure still requires actual approved database/Storage export credentials, compatibility verification and a coordinated recovery cut. Approval of paths alone must not be interpreted as permission to export data or restore it.

## Approval requested

Confirm the **two exact KINGSTON image paths and mountpoints**, then specify which operations you authorize:

1. Create/mount and verify the empty encrypted images and new isolated restore configuration, without production data.
2. Export production database/Storage contents into the approved backup image during an agreed consistency window.
3. Restore only into the specified disposable local target and verify recovery.

Only item 1 can validate the proposed destination mechanics. Items 2 and 3 process real private data and need explicit approval; passphrase entry/key custody and secure credentials must also be arranged. None of these operations is authorized or executed by this proposal. No production migrations or deployment are included.
