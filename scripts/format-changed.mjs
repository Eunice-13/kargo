import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { extname, join } from "node:path";

const root = process.cwd();
const check = process.argv.includes("--check");
const listOnly = process.argv.includes("--list");
const supportedExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsonc",
  ".jsx",
  ".md",
  ".mjs",
  ".ts",
  ".tsx",
]);
const ignoredPrefixes = [
  ".agents/",
  ".claude/",
  ".figma/",
  ".kiro/",
  "src/imports/",
  "supabase/.temp/",
  "supabase/email-templates/",
];

function gitFiles(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean);
}

const candidates = new Set([
  ...gitFiles(["diff", "--name-only", "--diff-filter=ACMR", "-z"]),
  ...gitFiles(["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"]),
  ...gitFiles(["ls-files", "--others", "--exclude-standard", "-z"]),
]);

const files = [...candidates]
  .map((file) => file.replaceAll("\\", "/"))
  .filter((file) => supportedExtensions.has(extname(file).toLowerCase()))
  .filter((file) => !ignoredPrefixes.some((prefix) => file.startsWith(prefix)))
  .filter((file) => existsSync(join(root, file)))
  .sort();

if (files.length === 0) {
  console.log("No changed files to format.");
  process.exit(0);
}

if (listOnly) {
  console.log(files.join("\n"));
  process.exit(0);
}

console.log(`${check ? "Checking" : "Formatting"} ${files.length} changed file(s).`);
const executable = join(
  root,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "oxfmt.cmd" : "oxfmt",
);
const result = spawnSync(executable, [...(check ? ["--check"] : []), ...files], {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
