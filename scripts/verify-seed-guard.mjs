// Confirms the cross-seed title guard actually fails when a title drifts.
// Uses node for the edit so the em-dash in batch titles survives.
import { readFileSync, writeFileSync, copyFileSync, unlinkSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { execFileSync } from "node:child_process"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const claimsPath = path.join(root, "src", "data", "claims.ts")
const backup = path.join(root, "src", "data", "claims.ts.bak-tmp")
copyFileSync(claimsPath, backup)

const original = readFileSync(claimsPath, "utf8")
const drifted = original.replace(
  'batch: "Japan Trip — March 2026"',
  'batch: "Japan Trip — Mar 2026"',
)
if (drifted === original) {
  console.error("could not introduce the drift; em-dash mismatch in the test edit")
  process.exit(2)
}
writeFileSync(claimsPath, drifted, "utf8")

try {
  execFileSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--import",
      "./scripts/lib/register.mjs",
      "scripts/check-batch-seed.mjs",
    ],
    { cwd: root, stdio: "pipe", encoding: "utf8" },
  )
  console.log("GUARD FAILED TO FIRE — a drifted title passed the check")
  process.exitCode = 1
} catch (error) {
  const out = `${error.stdout ?? ""}`
  const caught = /FAIL.*matches no batch title/.test(out)
  console.log(
    caught
      ? "ok    guard fires on a drifted title:\n      " +
          out
            .split("\n")
            .find((l) => l.includes("matches no batch title"))
            .trim()
      : "GUARD FIRED FOR THE WRONG REASON:\n" + out,
  )
  if (!caught) process.exitCode = 1
} finally {
  copyFileSync(backup, claimsPath)
  unlinkSync(backup)
}

// Confirm the file is back to the fixed state.
const restored = readFileSync(claimsPath, "utf8")
console.log(
  restored.includes('batch: "Japan Trip — Mar 2026"')
    ? "FAIL  claims.ts was not restored"
    : "ok    claims.ts restored",
)
if (restored !== original) process.exitCode = 1
