// Optional embedded PostgreSQL runner; no runtime dependency is added to KARGO.
// Install @electric-sql/pglite in a temporary directory, then set
// KARGO_PGLITE_MODULE to its dist/index.js absolute path (see Phase-2 notes).
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const location = process.env.KARGO_PGLITE_MODULE;
if (!location)
  throw new Error(
    "Set KARGO_PGLITE_MODULE to the temporary @electric-sql/pglite dist/index.js path.",
  );
const { PGlite } = await import(pathToFileURL(path.resolve(location)).href);
const db = new PGlite();
try {
  for (const file of [
    "supabase/tests/fixtures/combined_delivery_minimal_schema.sql",
    "supabase/migrations (to update profile database name)/202610200002_combined_delivery_foundations.sql",
    "supabase/migrations (to update profile database name)/202610210001_combined_delivery_buyer_requests.sql",
    "supabase/migrations (to update profile database name)/202610210002_combined_delivery_seller_review.sql",
    "supabase/migrations (to update profile database name)/202610210003_combined_delivery_recovery.sql",
    "supabase/migrations (to update profile database name)/202610210004_combined_delivery_batch_integrity.sql",
    "supabase/tests/combined_delivery_foundations.sql",
    "supabase/tests/combined_delivery_buyer_requests.sql",
    "supabase/tests/combined_delivery_seller_review.sql",
    "supabase/tests/combined_delivery_recovery.sql",
    "supabase/tests/combined_delivery_batch_integrity.sql",
    "supabase/tests/fixtures/combined_delivery_payment_schema.sql",
    "supabase/migrations (to update profile database name)/202610210005_combined_delivery_payments.sql",
    "supabase/migrations (to update profile database name)/202610230001_combined_payment_method_compatibility.sql",
    "supabase/tests/combined_delivery_payments.sql",
    "supabase/rollbacks/202610210005_combined_delivery_payments.sql",
    "supabase/rollbacks/202610210004_combined_delivery_batch_integrity.sql",
    "supabase/rollbacks/202610210003_combined_delivery_recovery.sql",
    "supabase/rollbacks/202610210002_combined_delivery_seller_review.sql",
    "supabase/rollbacks/202610210001_combined_delivery_buyer_requests.sql",
    "supabase/rollbacks/202610200002_combined_delivery_foundations.sql",
  ]) {
    try {
      await db.exec(await readFile(path.join(root, file), "utf8"));
      if (file.endsWith("combined_delivery_minimal_schema.sql")) {
        const shippingMigration = await readFile(
          path.join(
            root,
            "supabase/migrations (to update profile database name)/202610180001_tracking_and_buyer_shipping.sql",
          ),
          "utf8",
        );
        const shippingRpc = shippingMigration.slice(
          shippingMigration.indexOf("create or replace function public.set_order_shipping_fee("),
          shippingMigration.indexOf(
            "create or replace function public.request_location_correction(",
          ),
        );
        await db.exec(shippingRpc);
        const loadFunction = async (filename, name) => {
          const source = await readFile(
            path.join(root, "supabase/migrations (to update profile database name)", filename),
            "utf8",
          );
          const start = source.indexOf(`create or replace function public.${name}(`);
          if (start < 0) throw new Error(`Missing existing function ${name}`);
          const end = source.indexOf("$$;", source.indexOf("as $$", start)) + 3;
          await db.exec(source.slice(start, end));
        };
        await loadFunction("202609260002_waitlist_offers_rpcs.sql", "available_stock");
        await loadFunction("202609260002_waitlist_offers_rpcs.sql", "place_order_for_buyer");
        await loadFunction("202610010008_waitlist_claim_priority.sql", "offer_to_next_waitlist");
        await loadFunction("202610180001_tracking_and_buyer_shipping.sql", "sweep_expirations");
        await db.exec(
          "revoke all on function public.set_order_shipping_fee(uuid, numeric) from public; grant execute on function public.set_order_shipping_fee(uuid, numeric) to authenticated;",
        );
      }
      if (file.endsWith("combined_delivery_payment_schema.sql")) {
        const source = await readFile(
          path.join(
            root,
            "supabase/migrations (to update profile database name)/202610180001_tracking_and_buyer_shipping.sql",
          ),
          "utf8",
        );
        await db.exec(
          source.slice(
            source.indexOf("create or replace function public.submit_order_payment("),
            source.indexOf("create or replace function public.sweep_expirations("),
          ),
        );
      }
      console.log(`PASS ${file}`);
    } catch (error) {
      console.error(`FAIL ${file}: ${error.message}\n${error.detail ?? ""}\n${error.where ?? ""}`);
      process.exitCode = 1;
      break;
    }
  }
} finally {
  await db.close();
}
