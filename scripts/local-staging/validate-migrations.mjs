import { withLocalLedger } from "./migration-sql.mjs";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { localSql, workdir, root } from "./database.mjs";
const inventory = JSON.parse(
  fs.readFileSync(path.join(root, "docs/combined-delivery-staging-migration-inventory.json")),
);
const comparison = JSON.parse(
  fs.readFileSync(path.join(workdir, "baseline-comparison.local.json")),
);
if (Object.values(comparison.results).some((v) => v !== "pass"))
  throw Error("Full baseline comparison must pass first.");
const literal = (s) => "'" + s.replaceAll("'", "''") + "'";
const baseline = fs.readFileSync(path.join(workdir, "baseline-review/baseline.draft.sql"), "utf8");
const entries = [
  { version: "202610220001", name: "local_production_schema_baseline", source: baseline },
  ...inventory.combinedDelivery.map((entry, index) => {
    const source = fs.readFileSync(path.join(root, inventory.sourceDirectory, entry.file), "utf8");
    if (
      createHash("sha256").update(source).digest("hex") !== entry.sha256 ||
      !/commit;\s*$/i.test(source)
    )
      throw Error("Migration checksum/transaction mismatch.");
    return {
      ...entry,
      version: String(202610220002 + index),
      name: entry.file.replace(/^\d+_/, "").replace(/\.sql$/, ""),
      source,
    };
  }),
  {
    version: "202610230001",
    name: "combined_payment_method_compatibility",
    source: fs.readFileSync(
      path.join(
        root,
        "supabase/migrations (to update profile database name)/202610230001_combined_payment_method_compatibility.sql",
      ),
      "utf8",
    ),
    file: "202610230001_combined_payment_method_compatibility.sql",
  },
];
entries[7].sha256 = createHash("sha256").update(entries[7].source).digest("hex");
localSql(
  `begin;create schema if not exists supabase_migrations;create table if not exists supabase_migrations.schema_migrations(version text primary key,statements text[],name text);commit;`,
  "initialize-local-ledger",
);
const existing = JSON.parse(
  localSql(
    "begin read only;select coalesce(json_agg(json_build_object('version',version,'name',name,'statements',statements) order by version),'[]'::json) from supabase_migrations.schema_migrations;rollback;",
    "verify-local-ledger",
  ),
);
for (let i = 0; i < existing.length; i++)
  if (
    existing[i].version !== entries[i]?.version ||
    existing[i].name !== entries[i]?.name ||
    existing[i].statements?.length !== 1 ||
    existing[i].statements[0] !== entries[i]?.source
  )
    throw Error("Local ledger drift or ambiguous migration history; refuse replay.");
if (!existing.length)
  localSql(
    `begin;insert into supabase_migrations.schema_migrations values('202610220001',array[${literal(baseline)}],'local_production_schema_baseline');commit;`,
    "register-local-baseline",
  );
const results = [];
function apply(entry) {
  if (!existing.some((x) => x.version === entry.version)) {
    const sql = withLocalLedger(entry.source, entry.version, entry.name);
    localSql(sql, `apply-${entry.name}`);
    console.log(`Local migration committed: ${entry.version} (${entry.file})`);
  } else console.log(`Verified already-applied local migration: ${entry.version}`);
  results.push({ source: entry.file, sha256: entry.sha256, localVersion: entry.version });
  fs.writeFileSync(
    path.join(workdir, "migration-validation.local.json"),
    JSON.stringify(results, null, 2),
    { mode: 0o600 },
  );
}
function suite(name) {
  localSql(
    fs.readFileSync(path.join(root, `supabase/tests/combined_delivery_${name}.sql`), "utf8"),
    `suite-${name}`,
  );
  console.log(`Full-schema SQL suite passed: ${name}`);
}
// Current foundation suites include Phase 3.2 pin/recovery regressions; run after all five foundation migrations.
for (const entry of entries.slice(1, 6)) apply(entry);
// Phase-3 suites assert pre-payment immutability; Phase 4 intentionally resumes deadlines.
// On resume with Phase 4 installed, run the payment-aware regression suite instead.
for (const name of existing.some((entry) => entry.version === "202610220007")
  ? []
  : ["foundations", "buyer_requests", "seller_review", "recovery", "batch_integrity"])
  suite(name);
apply(entries[6]);
apply(entries[7]);
suite("payments");
