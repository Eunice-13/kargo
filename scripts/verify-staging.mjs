// Offline target checks only. Never loads .env.local, connects, or executes SQL.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const productionRef = "leylmztbknmlwnwgvaud";

export function verifyStaging(config) {
  const fail = () => {
    throw new Error(
      "Staging configuration rejected; check the preparation guide. Credentials are not logged.",
    );
  };
  if (
    config.environment !== "staging" ||
    config.isolationApproved !== true ||
    config.schemaBaselineVerified !== true ||
    !/^[a-z]{20}$/.test(config.projectRef) ||
    config.projectRef === productionRef ||
    config.confirmedProjectRef !== config.projectRef
  )
    fail();
  let api, db;
  try {
    api = new URL(config.supabaseUrl);
    db = new URL(config.databaseUrl);
  } catch {
    fail();
  }
  if (
    api.href !== `https://${config.projectRef}.supabase.co/` ||
    api.username ||
    api.password ||
    db.protocol !== "postgresql:" ||
    db.hostname !== `db.${config.projectRef}.supabase.co` ||
    db.username !== "postgres" ||
    !db.password ||
    db.password.includes("REPLACE") ||
    db.port !== "5432" ||
    db.pathname !== "/postgres" ||
    db.hash ||
    db.search !== "?sslmode=verify-full" ||
    typeof config.publishableKey !== "string" ||
    !config.publishableKey.startsWith("sb_publishable_") ||
    config.publishableKey.includes("REPLACE")
  )
    fail();
  return { environment: "staging", projectRef: config.projectRef, host: api.hostname };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 3)
      throw new Error("Usage: node scripts/verify-staging.mjs staging/config.local.json");
    const result = verifyStaging(JSON.parse(readFileSync(process.argv[2], "utf8")));
    console.log(JSON.stringify(result));
    console.log(
      "Offline checks passed only. No connection or migration performed; this is not migration authorization.",
    );
  } catch (error) {
    // JSON/read errors can contain sensitive input, so never echo them.
    console.error(
      "Staging verification failed. Check the explicit config file and preparation guide.",
    );
    process.exitCode = 1;
  }
}
