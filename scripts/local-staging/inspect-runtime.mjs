// Read-only local Docker inspection. Never reads production env or invokes SQL.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { writeFileSync } from "node:fs";
import { cleanEnvironment } from "./isolation.mjs";
import { networkName, verifyContainers } from "./container-safety.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const workdir = path.join(root, "staging/local-workdir");
const docker = "/Applications/OrbStack.app/Contents/MacOS/xbin/docker";
const socket = "unix:///Users/jennadee/.orbstack/run/docker.sock";
function run(args) {
  const result = spawnSync(
    docker,
    ["--config", path.join(workdir, "home/.docker"), "--host", socket, ...args],
    {
      env: cleanEnvironment(workdir),
      encoding: "utf8",
      timeout: 30000,
      maxBuffer: 4 * 1024 * 1024,
    },
  );
  if (result.status !== 0)
    throw new Error("Local Docker inspection unavailable; no operation authorized.");
  return result.stdout;
}
try {
  if (process.argv.length !== 2) throw new Error("No arguments accepted.");
  const ids = run(["ps", "--all", "--filter", "name=kargo-local-staging", "--format", "{{.ID}}"])
    .trim()
    .split("\n")
    .filter(Boolean);
  if (!ids.length) throw new Error("Local services have not been created yet.");
  const containers = JSON.parse(run(["inspect", ...ids]));
  const network = JSON.parse(run(["network", "inspect", networkName]))[0];
  const result = verifyContainers(containers, network);
  writeFileSync(
    path.join(workdir, "runtime-inspection.private.json"),
    JSON.stringify({ containers, network, verifiedAt: new Date().toISOString() }),
    { mode: 0o600 },
  );
  console.log(
    JSON.stringify({
      ...result,
      health: containers.map((c) => ({
        name: c.Name,
        status: c.State.Health?.Status ?? c.State.Status,
      })),
    }),
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
