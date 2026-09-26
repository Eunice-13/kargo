// Maps the project's `@/…` path alias onto `src/…` so plain node can import the
// TypeScript sources with --experimental-strip-types. Dev/test tooling only.
import { pathToFileURL, fileURLToPath } from "node:url"
import { statSync } from "node:fs"
import path from "node:path"

const root = process.env.KARGO_ROOT

const CANDIDATES = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]

function isFile(candidate) {
  try {
    return statSync(candidate).isFile()
  } catch {
    return false
  }
}

// Vite resolves extensionless relative imports ("../lib/foo"); plain node does
// not, so mirror that here too.
function withExtensions(target) {
  for (const ext of CANDIDATES) {
    const candidate = `${target}${ext}`
    if (isFile(candidate)) return candidate
  }
  return null
}

export function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const found = withExtensions(path.join(root, "src", specifier.slice(2)))
    if (found) return nextResolve(pathToFileURL(found).href, context)
  } else if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    context.parentURL?.startsWith("file:")
  ) {
    const found = withExtensions(
      path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier),
    )
    if (found) return nextResolve(pathToFileURL(found).href, context)
  }
  return nextResolve(specifier, context)
}
