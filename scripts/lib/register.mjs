// Installs the `@/` path-alias resolver for plain node runs. Used as
//   node --experimental-strip-types --import ./scripts/lib/register.mjs <file>
// Dev/test tooling only — the app itself resolves the alias through Vite.
import { register } from "node:module"
import { pathToFileURL } from "node:url"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, "..", "..")

process.env.KARGO_ROOT ??= root

register(pathToFileURL(path.join(here, "alias-hook.mjs")).href)
