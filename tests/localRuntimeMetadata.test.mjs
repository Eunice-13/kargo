import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  symlinkSync,
  chmodSync,
  realpathSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  verifyWorkdir,
  verifyLocalTarget,
  localSupabaseConfig,
  identity,
  apiOrigin,
  databaseOrigin,
} from "../scripts/local-staging/isolation.mjs";
import { runtimeFixture, localKey } from "./fixtures/localRuntime.mjs";
function fixture() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "kargo-runtime-")),
    evidence = runtimeFixture();
  for (const sub of [
    "app",
    "empty-env",
    "supabase/.temp/start-secrets/supabase_edge_runtime_kargo-local-staging/env",
    "supabase/.branches",
  ])
    mkdirSync(path.join(dir, sub), { recursive: true, mode: 0o700 });
  const file =
    "supabase/.temp/start-secrets/supabase_edge_runtime_kargo-local-staging/env/docker.env";
  const env =
    evidence.containers.find((c) => c.Name.includes("edge_runtime")).Config.Env.join("\n") + "\n";
  for (const [name, text] of [
    ["supabase/config.toml", localSupabaseConfig],
    ["supabase/.temp/cli-latest", "v2.121.0"],
    ["supabase/.branches/_current_branch", "main"],
    ["runtime-inspection.private.json", JSON.stringify(evidence)],
    [file, env],
  ])
    writeFileSync(path.join(dir, name), text, { mode: 0o600 });
  return { dir, file: path.join(dir, file), evidence };
}
test("accepts only locally inspected CLI state, without loading its env into process.env", () => {
  const f = fixture();
  try {
    const before = process.env.SUPABASE_URL;
    assert.equal(verifyWorkdir(f.dir), realpathSync(f.dir));
    assert.equal(process.env.SUPABASE_URL, before);
  } finally {
    rmSync(f.dir, { recursive: true, force: true });
  }
});
for (const [name, mutate] of [
  [
    "linked project",
    (f) => writeFileSync(path.join(f.dir, "supabase/.temp/project-ref"), "production"),
  ],
  [
    "pooler connection",
    (f) => writeFileSync(path.join(f.dir, "supabase/.temp/pooler-url"), "postgresql://production"),
  ],
  [
    "production URL",
    (f) =>
      writeFileSync(
        f.file,
        readFileSync(f.file, "utf8").replace(
          "http://kong:8000",
          "https://leylmztbknmlwnwgvaud.supabase.co",
        ),
      ),
  ],
  [
    "injected credentials",
    (f) =>
      writeFileSync(
        f.file,
        readFileSync(f.file, "utf8") + "SUPABASE_SECRET_KEY=sb_secret_foreign\n",
      ),
  ],
  [
    "duplicate keys",
    (f) => writeFileSync(f.file, readFileSync(f.file, "utf8") + "SUPABASE_URL=http://kong:8000\n"),
  ],
  ["malformed env", (f) => writeFileSync(f.file, "no-equals\n")],
  [
    "missing env field",
    (f) => writeFileSync(f.file, readFileSync(f.file, "utf8").split("\n").slice(1).join("\n")),
  ],
  [
    "stale evidence",
    (f) => {
      f.evidence.verifiedAt = "2000-01-01T00:00:00Z";
      writeFileSync(
        path.join(f.dir, "runtime-inspection.private.json"),
        JSON.stringify(f.evidence),
      );
    },
  ],
  ["nonprivate secrets", (f) => chmodSync(f.file, 0o644)],
  [
    "secret symlink",
    (f) => {
      const text = readFileSync(f.file);
      rmSync(f.file);
      writeFileSync(path.join(f.dir, "other"), text);
      symlinkSync(path.join(f.dir, "other"), f.file);
    },
  ],
  [
    "ambiguous branch",
    (f) => writeFileSync(path.join(f.dir, "supabase/.branches/_current_branch"), "production"),
  ],
])
  test(`rejects unsafe CLI metadata: ${name}`, () => {
    const f = fixture();
    try {
      mutate(f);
      assert.throws(() => verifyWorkdir(f.dir));
    } finally {
      rmSync(f.dir, { recursive: true, force: true });
    }
  });
test("rejects a forged matching key even when the inspection has that key", () => {
  const e = runtimeFixture(),
    bad = localKey.slice(0, -3) + "bad";
  e.containers.find((c) => c.Name.includes("edge_runtime")).Config.Env = e.containers
    .find((c) => c.Name.includes("edge_runtime"))
    .Config.Env.map((l) => (l.startsWith("SUPABASE_ANON_KEY=") ? `SUPABASE_ANON_KEY=${bad}` : l));
  assert.throws(() =>
    verifyLocalTarget(
      {
        environment: "local-staging",
        projectId: identity,
        apiUrl: apiOrigin,
        databaseUrl: databaseOrigin,
        anonKey: bad,
      },
      e,
    ),
  );
});
