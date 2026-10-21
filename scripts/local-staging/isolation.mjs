import { existsSync, lstatSync, readdirSync, realpathSync, readFileSync } from "node:fs";
import path from "node:path";
import { createHmac, timingSafeEqual } from "node:crypto";
import { verifyContainers } from "./container-safety.mjs";

export const identity = "kargo-local-staging";
export const apiOrigin = "http://127.0.0.1:56421";
export const databaseOrigin = "postgresql://postgres:postgres@127.0.0.1:56422/postgres";
export const localSupabaseConfig = `# LOCAL PREPARATION ONLY. No migrations or seed directory is present.
project_id = "kargo-local-staging"

[api]
enabled = true
port = 56421
schemas = ["public", "graphql_public"]
extra_search_path = ["public", "extensions"]

[db]
port = 56422
shadow_port = 56420
major_version = 17

[db.seed]
enabled = false

[studio]
enabled = true
port = 56423
api_url = "http://127.0.0.1"

[inbucket]
enabled = true
port = 56424

[auth]
enabled = true
site_url = "http://127.0.0.1:56443"
additional_redirect_urls = []
enable_signup = true

[auth.email]
enable_signup = true
enable_confirmations = false

[analytics]
enabled = false
`;

export function verifyLocalTarget(config, evidence) {
  if (
    !config ||
    config.environment !== "local-staging" ||
    config.projectId !== identity ||
    config.apiUrl !== apiOrigin ||
    config.databaseUrl !== databaseOrigin
  ) {
    throw new Error("Local target rejected: exact isolated loopback configuration required.");
  }
  verifyRuntimeEvidence(evidence);
  const edge = runtimeEnv(evidence, "edge_runtime");
  const auth = runtimeEnv(evidence, "auth");
  if (config.anonKey !== edge.SUPABASE_ANON_KEY || !auth.GOTRUE_JWT_SECRET)
    throw new Error("Key does not belong to the inspected local runtime.");
  let payload;
  try {
    const [header, body, signature] = config.anonKey.split(".");
    if (JSON.parse(Buffer.from(header, "base64url")).alg !== "HS256") throw Error();
    const expected = createHmac("sha256", auth.GOTRUE_JWT_SECRET)
      .update(`${header}.${body}`)
      .digest();
    const actual = Buffer.from(signature, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw Error();
    payload = JSON.parse(Buffer.from(config.anonKey.split(".")[1], "base64url").toString());
  } catch {
    throw new Error("Missing locally generated anon JWT.");
  }
  if (
    config.anonKey.split(".").length !== 3 ||
    payload.role !== "anon" ||
    payload.iss !== "supabase-demo" ||
    (payload.ref !== undefined && payload.ref !== identity) ||
    !Number.isFinite(payload.exp) ||
    payload.exp * 1000 <= Date.now()
  ) {
    throw new Error("Local anon JWT identity rejected.");
  }
  return config;
}

export function runtimeEnv(evidence, service) {
  const container = evidence.containers.find((c) => c.Name === `/supabase_${service}_${identity}`);
  if (!container) throw new Error("Required local container missing.");
  return Object.fromEntries(
    container.Config.Env.map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1)];
    }),
  );
}

export function verifyRuntimeEvidence(evidence) {
  if (
    !evidence ||
    !Number.isFinite(Date.parse(evidence.verifiedAt)) ||
    Date.now() - Date.parse(evidence.verifiedAt) < 0 ||
    Date.now() - Date.parse(evidence.verifiedAt) > 300000
  )
    throw new Error("Fresh local runtime inspection required.");
  verifyContainers(evidence.containers, evidence.network);
  if (evidence.containers.some((c) => c.State.Health && c.State.Health.Status !== "healthy"))
    throw new Error("Local service health is not ready.");
}

function safePath(file, directory = false, privateMode = false) {
  const stat = lstatSync(file);
  if (
    stat.isSymbolicLink() ||
    (directory ? !stat.isDirectory() : !stat.isFile()) ||
    (process.getuid && stat.uid !== process.getuid()) ||
    (privateMode ? (stat.mode & 0o077) !== 0 : (stat.mode & 0o022) !== 0)
  )
    throw new Error("Unsafe local metadata file permissions or type.");
}

export function readRuntimeEvidence(root) {
  const file = path.join(root, "runtime-inspection.private.json");
  safePath(file, false, true);
  const evidence = JSON.parse(readFileSync(file, "utf8"));
  verifyRuntimeEvidence(evidence);
  return evidence;
}

function verifyCliMetadata(root) {
  const temp = path.join(root, "supabase/.temp");
  safePath(temp, true, true);
  if (readdirSync(temp).sort().join(",") !== "cli-latest,start-secrets")
    throw new Error("Unknown or linked CLI metadata rejected.");
  safePath(path.join(temp, "cli-latest"));
  if (readFileSync(path.join(temp, "cli-latest"), "utf8").trim() !== "v2.121.0")
    throw new Error("Unreviewed CLI version.");
  let dir = path.join(temp, "start-secrets");
  for (const child of [`supabase_edge_runtime_${identity}`, "env", "docker.env"]) {
    safePath(dir, true, true);
    if (readdirSync(dir).join(",") !== child) throw new Error("Unknown runtime metadata rejected.");
    dir = path.join(dir, child);
  }
  safePath(dir, false, true);
  const evidence = readRuntimeEvidence(root),
    edge = runtimeEnv(evidence, "edge_runtime");
  const expected = [
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_DB_URL",
    "SUPABASE_INTERNAL_PUBLISHABLE_KEY",
    "SUPABASE_INTERNAL_SECRET_KEY",
    "SUPABASE_INTERNAL_JWT_SECRET",
    "SUPABASE_JWKS",
    "SUPABASE_INTERNAL_HOST_PORT",
    "SUPABASE_INTERNAL_FUNCTIONS_CONFIG",
  ];
  const text = readFileSync(dir, "utf8");
  if (text.length > 65536 || text.includes("\0") || text.includes("\r"))
    throw new Error("Malformed runtime metadata.");
  const seen = new Set();
  for (const line of text.split("\n").filter(Boolean)) {
    const index = line.indexOf("="),
      key = line.slice(0, index),
      value = line.slice(index + 1);
    if (index < 1 || !expected.includes(key) || seen.has(key) || value !== edge[key])
      throw new Error("Runtime metadata does not match the verified local container.");
    seen.add(key);
  }
  if (seen.size !== expected.length) throw new Error("Incomplete runtime metadata.");
  verifyLocalTarget(
    {
      environment: "local-staging",
      projectId: identity,
      apiUrl: apiOrigin,
      databaseUrl: databaseOrigin,
      anonKey: edge.SUPABASE_ANON_KEY,
    },
    evidence,
  );
}

export function cleanEnvironment(workdir) {
  // Deliberate allowlist, never spread process.env (even NODE_OPTIONS/proxies).
  return {
    PATH: "/usr/bin:/bin:/usr/sbin:/sbin",
    HOME: path.join(workdir, "home"),
    TMPDIR: path.join(workdir, "tmp"),
    LANG: "en_US.UTF-8",
    CI: "true",
    DO_NOT_TRACK: "1",
  };
}

export function verifyWorkdir(workdir) {
  const root = realpathSync(workdir);
  const config = path.join(root, "supabase/config.toml");
  if (!existsSync(config) || readFileSync(config, "utf8") !== localSupabaseConfig)
    throw new Error("Unexpected local project configuration.");
  for (const dir of [root, path.join(root, "app"), path.join(root, "empty-env")]) {
    for (const name of readdirSync(dir)) {
      if (name.startsWith(".env") || name === ".git")
        throw new Error("Ambient environment or linked checkout rejected.");
    }
  }
  for (const relative of ["supabase/migrations", "supabase/seed.sql"]) {
    if (existsSync(path.join(root, relative)))
      throw new Error(
        "Linked state, migrations or seed files are not permitted in preparation mode.",
      );
  }
  if (existsSync(path.join(root, "supabase/.temp"))) verifyCliMetadata(root);
  const branches = path.join(root, "supabase/.branches");
  if (existsSync(branches)) {
    safePath(branches, true);
    if (readdirSync(branches).join(",") !== "_current_branch")
      throw new Error("Ambiguous local branch metadata.");
    safePath(path.join(branches, "_current_branch"));
    if (readFileSync(path.join(branches, "_current_branch"), "utf8").trim() !== "main")
      throw new Error("Unexpected local branch.");
  }
  for (const relative of ["app", "empty-env", "supabase", "supabase/config.toml"]) {
    if (lstatSync(path.join(root, relative)).isSymbolicLink())
      throw new Error("Workdir symlink rejected.");
  }
  return root;
}

export const browserPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: http://127.0.0.1:56421",
  "font-src 'self' data:",
  "connect-src 'self' http://127.0.0.1:56421 ws://127.0.0.1:56421 ws://127.0.0.1:56443",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
].join("; ");
