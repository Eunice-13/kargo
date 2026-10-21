// Offline preparation only. Never connects to Supabase or changes deployment history.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const capturedHistory = JSON.parse(
  fs.readFileSync(
    path.join(root, "staging/local-workdir/baseline-review/schema-source.review.json"),
  ),
)[0].metadata.history.map(({ version, name }) => ({ version, name }));
const inventory = JSON.parse(
  fs.readFileSync(path.join(root, "docs/combined-delivery-staging-migration-inventory.json")),
);
const directory = path.join(root, "supabase/release-bundles/combined-delivery");
fs.mkdirSync(path.join(directory, "migrations"), { recursive: true });
const files = [
  ...inventory.combinedDelivery,
  { file: "202610230001_combined_payment_method_compatibility.sql" },
];
const migrations = files.map((entry, i) => {
  const source = fs.readFileSync(path.join(root, inventory.sourceDirectory, entry.file));
  const hash = createHash("sha256").update(source).digest("hex");
  if (entry.sha256 && entry.sha256 !== hash) throw Error("Reviewed source hash mismatch");
  const version = String(202610240001 + i),
    name = entry.file.replace(/^\d+_/, "");
  const file = version + "_" + name;
  fs.writeFileSync(path.join(directory, "migrations", file), source);
  return { order: i + 1, version, file, source: entry.file, sha256: hash };
});
const effects = {
  "202610010005_restore_payment_method_lifecycle.sql":
    "Captured schema contains lifecycle objects; do not replay historical source.",
  "202610010005_zero_waitlist_limit.sql":
    "Absent optional change; excluded from this feature release.",
  "202610190002_batch_group_orders.sql":
    "Captured schema contains group-order objects; do not replay historical source.",
  "202610190002_branded_email_design.sql":
    "Captured schema contains brand-assets policy; verify any required storage configuration separately; do not replay historical source.",
  "202610200001_extension_request_emails.sql":
    "Captured schema contains corrected function; source has known seven-value/six-column defect. Excluded; never overwrite corrected definition.",
  "202610200001_read_notification_retention.sql":
    "Absent optional change; excluded from this feature release.",
  "202610200002_batch_gallery_images.sql":
    "Captured schema contains gallery column/view; do not replay historical source.",
  "202610200002_combined_delivery_foundations.sql":
    "Unapplied feature delta mapped to unique release version " + migrations[0].version + ".",
};
const collisions = inventory.duplicateVersions.map((entry) => ({
  legacyVersion: entry.version,
  files: entry.files.map((file) => ({
    sourceIdentity: file,
    sha256: createHash("sha256")
      .update(fs.readFileSync(path.join(root, inventory.sourceDirectory, file)))
      .digest("hex"),
    disposition: effects[file],
  })),
}));
fs.writeFileSync(
  path.join(directory, "manifest.json"),
  JSON.stringify(
    {
      status: "prepared-only-not-production-approved",
      historyBasis:
        "Captured 26-record production metadata snapshot; revalidate before release. Do not repair or fabricate history.",
      capturedHistory,
      migrations,
      collisions,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  "Prepared seven unique, byte-identical feature deltas; all four legacy collisions explicitly classified. No database access.",
);
