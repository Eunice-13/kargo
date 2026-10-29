// LOCAL-ONLY preview: renders the REAL AdminFulfillmentAnalytics component and
// proxies its Supabase RPC calls to the running LOCAL Supabase Postgres
// container (supabase_db_kargo-local-staging) as the synthetic local admin.
// No production endpoint, credential, or network egress is used. The DB is the
// isolated local CLI container bound to 127.0.0.1 only.
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const CID = "supabase_db_kargo-local-staging";
const ADMIN = "621778d5-dd09-4f39-9df7-6303c4474b81";
const ALLOWED = {
  admin_fulfillment_analytics: ["p_period", "p_start", "p_end"],
  admin_fulfillment_orders: ["p_period", "p_start", "p_end", "p_stage", "p_bucket", "p_as_of", "p_limit", "p_offset", "p_snapshot"],
  admin_get_order: ["p_order_id"],
};

// Run one SQL statement in the local container as the admin (authenticated role
// + jwt sub claim), returning the single jsonb column as text.
function runLocal(fn, args) {
  return new Promise((resolve) => {
    const keys = ALLOWED[fn];
    // Build a parameterized-ish call with literal-safe casting via format().
    const params = keys.map((k) => {
      const v = args[k];
      if (v === null || v === undefined) return "null";
      if (typeof v === "number") return String(v);
      return "'" + String(v).replace(/'/g, "''") + "'";
    });
    const sql = `
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"${ADMIN}","role":"authenticated"}', true);
select coalesce((select public.${fn}(${params.join(",")}))::text, 'null');
rollback;
`;
    const p = spawn("docker", ["exec", "-i", "-u", "postgres", CID, "psql", "-X", "-U", "postgres", "-d", "postgres", "-qAt", "-v", "ON_ERROR_STOP=1"], { stdio: ["pipe", "pipe", "pipe"] });
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => {
      if (code !== 0) {
        // Surface the SQLSTATE/message like PostgREST would, so the UI error paths work.
        const m = err.match(/ERROR:\s*(.*)/);
        resolve({ data: null, error: { message: m ? m[1].trim() : err.trim().slice(0, 300), code: /40001/.test(err) ? "40001" : undefined } });
      } else {
        const last = out.trim().split("\n").filter(Boolean).pop() || "null";
        resolve({ data: last === "null" ? null : JSON.parse(last), error: null });
      }
    });
    p.stdin.write(sql);
    p.stdin.end();
  });
}

const libId = "\0local-live-supabase";
const server = await createServer({
  root, configFile: false, envFile: false,
  plugins: [react(), tailwindcss(), {
    name: "kargo-local-live",
    configureServer(vite) {
      vite.middlewares.use(async (req, res, next) => {
        if (req.url === "/__rpc" && req.method === "POST") {
          const chunks = []; for await (const c of req) chunks.push(c);
          const { fn, args } = JSON.parse(Buffer.concat(chunks).toString());
          if (!ALLOWED[fn]) { res.end(JSON.stringify({ data: null, error: { message: "not allowed" } })); return; }
          const result = await runLocal(fn, args);
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(result));
          return;
        }
        if (req.url === "/__preview") {
          const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="margin:0;background:#f5f7fb"><p style="font:12px system-ui;padding:8px 16px;margin:0;background:#def3fa">LOCAL isolated Supabase container · synthetic test data · 127.0.0.1 only</p><div id="root"></div><script type="module" src="/__entry.tsx"></script></body></html>`;
          res.setHeader("Content-Type", "text/html");
          res.end(await vite.transformIndexHtml(req.url, html));
          return;
        }
        next();
      });
    },
    resolveId(s) { if (s === "@/lib/supabase" || s === libId) return libId; if (s === "/__entry.tsx") return "\0entry"; },
    load(s) {
      if (s === libId) return `export const isSupabaseConfigured=true;export const supabase=null;export function requireSupabase(){return{rpc:async(fn,args)=>{const r=await fetch('/__rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fn,args})});return r.json();}}}`;
      if (s === "\0entry") return `import React from 'react';import{createRoot}from'react-dom/client';import Analytics from '/src/features/admin/AdminFulfillmentAnalytics.tsx';import '/src/index.css';createRoot(document.getElementById('root')).render(React.createElement('main',{style:{maxWidth:1400,margin:'auto',padding:'12px'}},React.createElement(Analytics)));`;
    },
  }],
  resolve: { alias: [{ find: "@/lib/supabase", replacement: libId }, { find: "@", replacement: root + "src" }] },
  server: { host: "127.0.0.1", port: 4788, strictPort: true },
  optimizeDeps: { noDiscovery: true, include: ["react", "react-dom/client", "lucide-react", "leaflet", "qrcode.react"] },
});
await server.listen();
console.log("LOCAL live preview: http://127.0.0.1:4788/__preview");
process.on("SIGINT", async () => { await server.close(); process.exit(0); });
process.on("SIGTERM", async () => { await server.close(); process.exit(0); });
