# Combined Delivery release delta

Prepared artifact only. **Production execution is not approved.**

`manifest.json` maps seven byte-identical reviewed source migrations to unique
release versions `202610240001`–`202610240007`. Run the two bundle tests to verify
hashes, order and absence of accidental historical replay.

The original nonstandard migration directory is an archive of source history,
not a safe CLI push directory: it contains duplicate versions and changes already
represented by the captured production schema. The four collisions are classified
in this manifest. The captured 26-entry version/name list is evidence, not migration
records to insert or repair on production.

Do not copy the local reconstructed baseline into production. Do not push the
entire historical directory or invent applied records for its untracked changes.
This bundle contains only the seven feature deltas; unrelated absent optional
changes (notification retention and zero-limit behavior) remain excluded.

The exact bundle was rehearsed against a disposable complete-schema local copy.
Before execution, compare current production metadata/history to the captured
baseline, verify the target and backup/restore evidence, and obtain explicit
production approval. Apply only missing deltas in manifest order, recording their
real successful execution in the deployment ledger. If unexpected history or
object drift exists, stop instead of repairing history or blindly replaying SQL.

See `docs/combined-delivery-deployment-readiness.md` for validation, backup,
deployment and recovery requirements. The default project CLI configuration and
production history were not changed by preparing this artifact.
