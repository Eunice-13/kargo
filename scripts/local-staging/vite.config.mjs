// Used only by the isolated snapshot; the production Vite configuration is unchanged.
import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import {
  verifyWorkdir,
  verifyLocalTarget,
  browserPolicy,
  readRuntimeEvidence,
} from "./isolation.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export default defineConfig(() => {
  const workdir = verifyWorkdir(path.join(root, "staging/local-workdir"));
  const target = verifyLocalTarget(
    JSON.parse(readFileSync(path.join(workdir, "target.local.json"), "utf8")),
    readRuntimeEvidence(workdir),
  );
  return {
    root: path.join(workdir, "app"),
    envDir: path.join(workdir, "empty-env"),
    envPrefix: "KARGO_LOCAL_BROWSER_",
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(target.apiUrl),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(target.anonKey),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(target.anonKey),
    },
    plugins: [react(), tailwindcss()],
    resolve: { alias: { "@": path.join(workdir, "app/src") } },
    server: {
      host: "127.0.0.1",
      port: 56443,
      strictPort: true,
      headers: { "Content-Security-Policy": browserPolicy },
      fs: { allow: [path.join(workdir, "app"), path.join(root, "node_modules")] },
    },
    preview: {
      host: "127.0.0.1",
      port: 56443,
      strictPort: true,
      headers: { "Content-Security-Policy": browserPolicy },
    },
    build: { outDir: path.join(workdir, "dist"), emptyOutDir: true },
  };
});
