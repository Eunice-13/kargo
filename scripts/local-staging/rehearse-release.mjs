// Destructive rehearsal is confined to a generated disposable local database.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { localSql, workdir, root } from "./database.mjs";
import { verifyLocalTarget, readRuntimeEvidence } from "./isolation.mjs";
localSql("begin read only;select 1;rollback;", "release-rehearsal-preflight");
const target = verifyLocalTarget(
  JSON.parse(readFileSync(path.join(workdir, "target.local.json"))),
  readRuntimeEvidence(workdir),
);
const u = new URL(target.databaseUrl);
const { default: pg } = await import(
  pathToFileURL("/private/tmp/kargo-native-pg/node_modules/pg/lib/index.js")
);
const cfg = {
  host: u.hostname,
  port: Number(u.port),
  user: decodeURIComponent(u.username),
  password: decodeURIComponent(u.password),
};
const admin = new pg.Client({ ...cfg, database: "postgres" });
await admin.connect();
assert.equal(
  (
    await admin.query(
      "select shobj_description(oid,'pg_database') as comment from pg_database where datname='kargo_fullschema_template'",
    )
  ).rows[0]?.comment,
  "KARGO synthetic full-schema concurrency template; local-only",
);
const database = "kargo_release_rehearsal_" + Date.now(),
  results = [];
await admin.query(`create database ${database} template kargo_fullschema_template`);
const client = new pg.Client({ ...cfg, database });
try {
  await client.connect();
  await client.query(
    `do $$ declare targets text;begin select string_agg(format('%I.%I',schemaname,tablename),',') into targets from pg_tables where schemaname='public';execute 'truncate table '||targets||',auth.users cascade';end $$;`,
  );
  for (const source of [
    "202610210005_combined_delivery_payments.sql",
    "202610210004_combined_delivery_batch_integrity.sql",
    "202610210003_combined_delivery_recovery.sql",
    "202610210002_combined_delivery_seller_review.sql",
    "202610210001_combined_delivery_buyer_requests.sql",
    "202610200002_combined_delivery_foundations.sql",
  ])
    await client.query(readFileSync(path.join(root, "supabase/rollbacks", source), "utf8"));
  const manifest = JSON.parse(
    readFileSync(path.join(root, "supabase/release-bundles/combined-delivery/manifest.json")),
  );
  for (const entry of manifest.migrations) {
    await client.query(
      readFileSync(
        path.join(root, "supabase/release-bundles/combined-delivery/migrations", entry.file),
        "utf8",
      ),
    );
    results.push(entry.file);
    console.log("PASS release migration", entry.file);
    if (entry.order === 5)
      for (const suite of [
        "foundations",
        "buyer_requests",
        "seller_review",
        "recovery",
        "batch_integrity",
      ]) {
        await client.query(
          readFileSync(path.join(root, `supabase/tests/combined_delivery_${suite}.sql`), "utf8"),
        );
        results.push("SQL " + suite);
        console.log("PASS full-schema SQL", suite);
      }
  }
  await client.query(
    readFileSync(path.join(root, "supabase/tests/combined_delivery_payments.sql"), "utf8"),
  );
  results.push("SQL payments");
  console.log("PASS full-schema SQL payments");
  writeFileSync(
    path.join(workdir, "release-rehearsal.local.json"),
    JSON.stringify(
      { database, passed: results, scope: "disposable clone of complete local Supabase schema" },
      null,
      2,
    ),
    { mode: 0o600 },
  );
} finally {
  await client.end();
  await admin.query(`drop database ${database} with (force)`);
  await admin.end();
}
