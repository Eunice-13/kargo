// Local-only credential provisioning. Never imports Vite loadEnv or reads env files.
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  cleanEnvironment,
  verifyWorkdir,
  readRuntimeEvidence,
  runtimeEnv,
  verifyLocalTarget,
  identity,
  apiOrigin,
  databaseOrigin,
} from "./isolation.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.."),
  workdir = path.join(root, "staging/local-workdir");
try {
  if (process.argv.length !== 2) throw Error("No forwarded arguments accepted.");
  const inspection = spawnSync(
    process.execPath,
    [path.join(root, "scripts/local-staging/inspect-runtime.mjs")],
    { env: cleanEnvironment(workdir), encoding: "utf8" },
  );
  if (inspection.status !== 0) throw Error("Local runtime inspection failed.");
  verifyWorkdir(workdir);
  const evidence = readRuntimeEvidence(workdir),
    edge = runtimeEnv(evidence, "edge_runtime");
  const config = {
    environment: "local-staging",
    projectId: identity,
    apiUrl: apiOrigin,
    databaseUrl: databaseOrigin,
    anonKey: edge.SUPABASE_ANON_KEY,
  };
  verifyLocalTarget(config, evidence);
  for (const endpoint of ["/auth/v1/health", "/rest/v1/"]) {
    const response = await fetch(apiOrigin + endpoint, {
      headers: { apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}` },
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok)
      throw Error(`Local endpoint ${endpoint} rejected local credentials (${response.status}).`);
  }
  writeFileSync(path.join(workdir, "target.local.json"), JSON.stringify(config, null, 2) + "\n", {
    mode: 0o600,
  });
  writeFileSync(
    path.join(workdir, "server-credentials.local.json"),
    JSON.stringify({
      projectId: identity,
      apiUrl: apiOrigin,
      serviceRoleKey: edge.SUPABASE_SERVICE_ROLE_KEY,
    }),
    { mode: 0o600 },
  );
  writeFileSync(
    path.join(workdir, "service-verification.local.json"),
    JSON.stringify({
      projectId: identity,
      containerIdentityVerified: true,
      loopbackBindingsVerified: true,
      noProductionUpstreams: true,
      verifiedAt: new Date().toISOString(),
    }),
    { mode: 0o600 },
  );
  console.log(
    "Local Auth and REST accepted the inspected local key. Application credentials configured privately; no environment files loaded.",
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
