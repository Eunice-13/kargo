// Launch only after a separately reviewed local service-verification record exists.
// This tool has no migration, reset, Supabase-start or test execution operation.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  verifyLocalTarget,
  verifyWorkdir,
  cleanEnvironment,
  identity,
  readRuntimeEvidence,
} from "./isolation.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
try {
  if (process.argv.length !== 2) throw new Error("No forwarded arguments accepted.");
  const workdir = verifyWorkdir(path.join(root, "staging/local-workdir"));
  verifyLocalTarget(
    JSON.parse(readFileSync(path.join(workdir, "target.local.json"), "utf8")),
    readRuntimeEvidence(workdir),
  );
  const record = JSON.parse(
    readFileSync(path.join(workdir, "service-verification.local.json"), "utf8"),
  );
  if (
    record.projectId !== identity ||
    record.containerIdentityVerified !== true ||
    record.loopbackBindingsVerified !== true ||
    record.noProductionUpstreams !== true ||
    !Number.isFinite(Date.parse(record.verifiedAt)) ||
    Date.now() - Date.parse(record.verifiedAt) < 0 ||
    Date.now() - Date.parse(record.verifiedAt) > 300_000
  ) {
    throw new Error("Fresh independently reviewed service verification is required.");
  }
  const result = spawnSync(
    process.execPath,
    [
      path.join(root, "node_modules/vite/bin/vite.js"),
      "--config",
      path.join(root, "scripts/local-staging/vite.config.mjs"),
    ],
    { cwd: workdir, env: cleanEnvironment(workdir), stdio: "inherit" },
  );
  process.exitCode = result.status ?? 1;
} catch {
  console.error(
    "Local app launch blocked: target and fresh local service verification required. No service was started.",
  );
  process.exitCode = 1;
}
