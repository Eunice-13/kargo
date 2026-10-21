# Production backup and recovery preparation

**Status: preparation complete; no backup or restore has been executed. Deployment remains NO-GO.** Read-only checks on 2026-10-21 still show no API-visible backup, no physical restore window and PITR disabled. WAL-G enablement is not recovery evidence. Schema/history still match the validated baseline; all seven release versions remain unused.

## Options and recommendation

| Option                       | Coverage / limitation                                                                                                                                                                                    | Approval needed                                                                     |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Supabase managed backup/PITR | Managed database recovery; requires a successful, available recovery point. Does not protect Storage file bytes. Current project exposes no point.                                                       | Any plan/add-on/configuration change and restore operation.                         |
| Supported logical export     | Portable database data + schema/roles, with explicit migration-history and managed-schema customization capture. Completeness must be demonstrated by restoration, not assumed from successful commands. | Production export, credentials, secure destination and resource/maintenance window. |
| Schema-only export           | Useful supplementary metadata; cannot recover reservations, payments or users.                                                                                                                           | Not an acceptable standalone backup.                                                |

**Recommended for this release:** a coordinated encrypted logical database export plus all Storage objects, followed by a restore drill in a separate protected sandbox. This avoids assuming a plan upgrade is available. For ongoing recovery, evaluate managed backups/PITR separately after owner approval. Supabase documents both managed recovery and manual export options. [Database backup guidance](https://supabase.com/docs/guides/platform/backups).

## Verified scope

Aggregate inspection confirmed **38 batches, 61 products, 97 reservations, 71 payments, 17 profiles and 17 Auth users**. These counts are planning checkpoints, not a backup snapshot. Export all related tables, including existing group orders, waitlist, expenses, notifications and queues; do not limit the backup to these six counts.

| Bucket             | Access  | Objects |
| ------------------ | ------- | ------- |
| `avatars`          | Public  | 0       |
| `batch-media`      | Public  | 4       |
| `bir-certificates` | Private | 3       |
| `brand-assets`     | Public  | 2       |
| `payment-qr`       | Public  | 1       |
| `payment-receipts` | Private | 15      |
| `profile-avatars`  | Public  | 2       |

Total: **27 objects**, with **12,817,747 bytes** recorded in object metadata. No filenames, file contents or customer identities were exported. Actual byte integrity has not been verified. Preserve empty-bucket configuration too.

## Database procedure — pending explicit approval

1. Approve the destination, encryption recipient/key custody, retention, operator and backup window. Use an encrypted volume or encrypted stream into private off-site storage; keep keys separately. No plaintext SQL, credentials, manifests or proofs in Git, shared folders or ordinary temporary files.
2. Confirm the production ref and TLS-verified connection using an authorized database credential. The existing Management API token does not establish dump/restore access. Avoid passwords in command arguments, history or logs; do not change credentials to obtain access without approval.
3. Create a coordinated recovery cut: approved quiescence of relevant application/admin writes, uploads/deletes and scheduled writes, or a reviewed snapshot/change-reconciliation mechanism. Independent dumps and a live object copy are **not automatically consistent**. Do not reset deadlines or alter business rules to make the backup easier.
4. Use the supported version-pinned export workflow to capture roles, application schema/data, required managed Auth/Storage data, complete `supabase_migrations` schema/data, sequences, RLS, functions, triggers, constraints, grants and custom managed-schema objects. Explicitly include the signup trigger, Storage policies and RLS event trigger. Do not blindly replay platform-owned objects into another platform version. The official workflow requires separate attention to migration history and Auth/Storage customizations. [CLI backup/restore procedure](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).
5. Capture recovery configuration separately: project/Auth settings, extension versions, cron definitions, publications, Edge Function source/version references and protected secret/key recovery references. Database data alone does not establish recoverability of hosting settings, role passwords or external encryption dependencies. Do not print or commit secret values.

Require successful exit statuses, encrypted artifact sizes, UTC start/end times, source identity/version, snapshot or maintenance-cut identity, table/history inventory and SHA-256 checksums in an encrypted manifest. Fail on partial exports, permission exclusions or unaccounted tables.

## Storage procedure — pending explicit approval

- Use an approved read credential with the supported Storage API or existing S3-compatible access. Creating S3 credentials or enabling protocol access requires separate approval; do not make private buckets public.
- Paginate every bucket/prefix. Copy all object bytes and preserve bucket/key mapping, relevant metadata and ownership information in the protected manifest. No delete, move or source-overwrite operations; use a new backup prefix rather than a destructive mirror.
- Compute SHA-256 from downloaded bytes and verify sizes. Do not treat an ETag as a guaranteed content hash. Encrypt private manifests too, since object paths may identify people or orders.
- At the agreed recovery cut, reconcile the object inventory with database Storage metadata and receipt/asset references. Repeat/check changes while the approved stable window is maintained; fail on missing or changed objects.

Supabase supports Storage API/CLI and S3-compatible download clients; database backup metadata is insufficient to recover file bytes. [Supported object download methods](https://supabase.com/docs/guides/storage/management/download-objects).

## Restore verification — separate approval required

Use a new protected target, **not production and not the existing synthetic-only local staging environment**. This drill processes real customer/Auth data and needs explicit data-handling approval. Block public access, production connections and outbound email/webhooks/cron/network calls **before** loading restored data. A restored cron definition must not call production while testing.

Verify decryption and artifact checksums first. Restore through the reviewed platform-compatible procedure with error-stop behavior; preserve user IDs, constraints, grants and all 26 original migration-history records. Restore object bytes through the supported Storage path, then check metadata/ownership and access behavior; uploading with an administrator must not silently change who can read private files.

Compare source-at-cut versus restored table inventories/counts and protected record/financial/reference checks. Verify all 38 source batches and relationships at that cut, inventory, reservations, payments, Auth/profile relationships, RLS and constraints. Match every object key/size/hash and its database reference. Test authentication/access with dedicated sandbox test identities, never customer credentials. Verify private proofs remain inaccessible to nonparticipants.

Record duration, errors, recovery-point time and achieved recovery objectives. Do not declare success if encryption keys, supported managed-schema restore behavior, file ownership or database/object consistency remain unresolved. Securely retain the evidence and handle sandbox cleanup under the approved retention policy.

## Deployment review and required inputs

- Vercel navigation reached `Login – Vercel`; browser inspection was then blocked by an open extension UI. Hosted environment, production branch/commit and rollback deployment remain unverified. User sign-in/browser availability or authorized read access is needed; no sign-in, settings change or deployment was performed.
- The release bundle still passes its two hash/order/history tests. Order remains foundations → buyer requests → seller review → recovery → batch integrity → payments → method compatibility (`202610240001`–`202610240007`). Original production history is unchanged.
- Follow [the production runbook](combined-delivery-production-runbook.md) for post-migration checks, Vercel release and forward recovery. Outstanding combined payments make destructive schema rollback unsafe; frontend rollback alone does not restore database state.

**Needed before execution:** your chosen/approved encrypted backup destination and encryption recipient, database and Storage read access supplied securely, an approved consistency window, a separate approved restore target with egress isolation, and explicit approval to export production data and later restore it there. Any paid managed-backup change needs its own approval.

**Remaining blockers:** no created/verified backup, no demonstrated restore or Storage consistency, no approved data destination/restore target, unverified hosted Vercel configuration and no pinned reviewed release commit. Production deployment remains prohibited. Only this plan and its runbook pointer were added; read-only evidence stays private and ignored.
