// Snapshot only the verified local database. Briefly pause local API services to
// satisfy PostgreSQL's template-copy requirement; always resume them in finally.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { localSql, workdir } from "./database.mjs";
import { readRuntimeEvidence, cleanEnvironment } from "./isolation.mjs";
localSql("begin read only;select 1;rollback;", "clone-preflight");
const evidence = readRuntimeEvidence(workdir),
  db = evidence.containers.find((c) => c.Name === "/supabase_db_kargo-local-staging");
if (!db) throw Error("Identified local database required");
const paused = [];
function docker(args, input) {
  const r = spawnSync(
    "/Applications/OrbStack.app/Contents/MacOS/xbin/docker",
    [
      "--config",
      path.join(workdir, "home/.docker"),
      "--host",
      "unix:///Users/jennadee/.orbstack/run/docker.sock",
      ...args,
    ],
    { env: cleanEnvironment(workdir), input, encoding: "utf8", timeout: 60000 },
  );
  if (r.status !== 0) throw Error(r.stderr || "Local Docker operation failed");
  return r.stdout;
}
try {
  for (const container of evidence.containers.filter((c) => c.Id !== db.Id)) {
    docker(["pause", container.Id]);
    paused.push(container.Id);
  }
  console.log(
    docker(
      [
        "exec",
        "--interactive",
        "--user",
        "postgres",
        db.Id,
        "psql",
        "-X",
        "-U",
        "supabase_admin",
        "-d",
        "template1",
        "-v",
        "ON_ERROR_STOP=1",
        "-qAt",
      ],
      `select pg_terminate_backend(pid,10000) from pg_stat_activity where datname='postgres';\ncreate database kargo_fullschema_template template postgres;\ncomment on database kargo_fullschema_template is 'KARGO synthetic full-schema concurrency template; local-only';\n`,
    ),
  );
  console.log("Complete local database copied; application database records unchanged.");
} finally {
  for (const id of paused.reverse()) docker(["unpause", id]);
  // Terminated server connections can remain in paused clients' pools.
  // Refresh only local API services before subsequent Auth/REST tests.
  const clients = evidence.containers.filter((c) =>
    /^\/supabase_(auth|rest|storage|realtime)_kargo-local-staging$/.test(c.Name),
  );
  if (paused.length) docker(["restart", ...clients.map((c) => c.Id)]);
}
