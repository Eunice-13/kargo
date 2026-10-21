import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  verifyLocalTarget,
  verifyWorkdir,
  cleanEnvironment,
  browserPolicy,
  identity,
  apiOrigin,
  databaseOrigin,
  localSupabaseConfig,
} from "../scripts/local-staging/isolation.mjs";

import { token, localKey, runtimeFixture } from "./fixtures/localRuntime.mjs";
const target = () => ({
  environment: "local-staging",
  projectId: identity,
  apiUrl: apiOrigin,
  databaseUrl: databaseOrigin,
  anonKey: localKey,
});
test("accepts exact local target and cryptographically verified runtime key", () =>
  assert.equal(verifyLocalTarget(target(), runtimeFixture()).apiUrl, apiOrigin));
for (const patch of [
  { apiUrl: "https://leylmztbknmlwnwgvaud.supabase.co" },
  { apiUrl: "http://localhost:56421" },
  { apiUrl: apiOrigin + "/redirect" },
  { databaseUrl: databaseOrigin + "?host=production.example" },
  { databaseUrl: databaseOrigin.replace("56422", "54322") },
  { projectId: "production" },
  { anonKey: token({ role: "service_role", ref: identity, exp: 9999999999 }) },
  { anonKey: token({ role: "anon", ref: "leylmztbknmlwnwgvaud", exp: 9999999999 }) },
  { anonKey: token({ role: "anon", ref: identity, exp: 1 }) },
])
  test(`rejects altered target ${JSON.stringify(Object.keys(patch))} ${JSON.stringify(patch).length}`, () =>
    assert.throws(() => verifyLocalTarget({ ...target(), ...patch }, runtimeFixture())));
test("process environment has no inherited secrets, proxy or node injection", () => {
  const previousSecret = process.env.SUPABASE_SECRET_KEY,
    previousProxy = process.env.HTTPS_PROXY;
  process.env.SUPABASE_SECRET_KEY = "synthetic";
  process.env.HTTPS_PROXY = "synthetic";
  const env = cleanEnvironment("/tmp/local-test");
  assert.deepEqual(
    Object.keys(env).sort(),
    ["CI", "DO_NOT_TRACK", "HOME", "LANG", "PATH", "TMPDIR"].sort(),
  );
  assert.equal(env.SUPABASE_SECRET_KEY, undefined);
  assert.equal(env.HTTPS_PROXY, undefined);
  if (previousSecret === undefined) delete process.env.SUPABASE_SECRET_KEY;
  else process.env.SUPABASE_SECRET_KEY = previousSecret;
  if (previousProxy === undefined) delete process.env.HTTPS_PROXY;
  else process.env.HTTPS_PROXY = previousProxy;
});
test("preparation workdir rejects linked state, env files and executable migration directory", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "kargo-isolation-"));
  try {
    for (const sub of ["app", "supabase", "empty-env"]) mkdirSync(path.join(dir, sub));
    writeFileSync(path.join(dir, "supabase/config.toml"), localSupabaseConfig);
    verifyWorkdir(dir);
    for (const file of [".env.local", "app/.env.production", "supabase/.temp"]) {
      writeFileSync(path.join(dir, file), "synthetic");
      assert.throws(() => verifyWorkdir(dir));
      rmSync(path.join(dir, file));
    }
    writeFileSync(
      path.join(dir, "supabase/config.toml"),
      localSupabaseConfig + '\nproject_id = "production"\n',
    );
    assert.throws(() => verifyWorkdir(dir));
    writeFileSync(path.join(dir, "supabase/config.toml"), localSupabaseConfig);
    mkdirSync(path.join(dir, "supabase/migrations"));
    assert.throws(() => verifyWorkdir(dir));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("browser policy limits connections to self and explicit local services", () => {
  const connect = browserPolicy.split("; ").find((x) => x.startsWith("connect-src"));
  assert.equal(
    connect,
    "connect-src 'self' http://127.0.0.1:56421 ws://127.0.0.1:56421 ws://127.0.0.1:56443",
  );
  assert.ok(browserPolicy.includes("form-action 'self'"));
});

test("scrubbed child process cannot see inherited production aliases or proxy settings", () => {
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      "console.log(JSON.stringify(Object.keys(process.env).filter(k=>/SUPABASE|PROXY|NODE_OPTIONS|VITE_/.test(k))))",
    ],
    { env: cleanEnvironment("/tmp/kargo-isolation-test"), encoding: "utf8" },
  );
  assert.equal(result.status, 0);
  assert.deepEqual(JSON.parse(result.stdout), []);
});
