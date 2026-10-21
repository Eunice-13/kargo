// Every query is executed inside the freshly inspected local DB container.
// No connection-string argument, linked-project lookup or environment loading exists.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, writeFileSync } from "node:fs";
import {
  cleanEnvironment,
  verifyWorkdir,
  readRuntimeEvidence,
  verifyLocalTarget,
} from "./isolation.mjs";
import { verifyContainers } from "./container-safety.mjs";
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const workdir = path.join(root, "staging/local-workdir");
export function localSql(sql, label = "query") {
  const inspect = spawnSync(
    process.execPath,
    [path.join(root, "scripts/local-staging/inspect-runtime.mjs")],
    { env: cleanEnvironment(workdir), encoding: "utf8" },
  );
  if (inspect.status !== 0) throw Error("Local runtime inspection failed; SQL refused.");
  verifyWorkdir(workdir);
  const evidence = readRuntimeEvidence(workdir);
  verifyLocalTarget(
    JSON.parse(readFileSync(path.join(workdir, "target.local.json"), "utf8")),
    evidence,
  );
  const { databaseContainer } = verifyContainers(evidence.containers, evidence.network);
  const result = spawnSync(
    "/Applications/OrbStack.app/Contents/MacOS/xbin/docker",
    [
      "--config",
      path.join(workdir, "home/.docker"),
      "--host",
      "unix:///Users/jennadee/.orbstack/run/docker.sock",
      "exec",
      "--interactive",
      "--user",
      "postgres",
      databaseContainer,
      "psql",
      "-X",
      "-U",
      "supabase_admin",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-qAt",
    ],
    {
      env: cleanEnvironment(workdir),
      encoding: "utf8",
      input: "set role postgres;\n" + sql,
      timeout: 60000,
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  if (result.status !== 0) {
    writeFileSync(
      path.join(workdir, `${label.replace(/[^a-z0-9-]/gi, "-")}.error.private.log`),
      result.stderr ?? "No stderr",
      { mode: 0o600 },
    );
    throw Error(
      `Local SQL failed (${label}); restricted diagnostic saved. No remote target is supported.`,
    );
  }
  return result.stdout.trim();
}
