// No SQL/reset/start operation exists in this preparation-only tool.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyLocalTarget, verifyWorkdir, readRuntimeEvidence } from "./isolation.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
try {
  if (process.argv.length !== 2) throw new Error("No operations are accepted.");
  const workdir = verifyWorkdir(path.join(root, "staging/local-workdir"));
  verifyLocalTarget(
    JSON.parse(readFileSync(path.join(workdir, "target.local.json"), "utf8")),
    readRuntimeEvidence(workdir),
  );
  console.log("Offline local target checks passed; live service identity is not yet verified.");
} catch {
  console.error("Local staging is not ready. No connection or operation performed.");
  process.exitCode = 1;
}
