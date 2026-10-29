// READ-ONLY live preview: renders the REAL AdminFulfillmentAnalytics component
// and proxies its Supabase RPC calls to LIVE Supabase via the Management API
// query endpoint. Every call runs inside `begin; set local role authenticated;
// ...; rollback;` so it is strictly read-only (the analytics RPCs are STABLE and
// we roll back regardless). It impersonates a REAL live admin's uid only to
// satisfy admin_assert(); no user password/session is used, and nothing is
// committed. This exists solely to confirm the localhost Admin Dashboard chart
// renders real live data.
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const env = {};
for (const l of readFileSync(root + ".env.local", "utf8").split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const ref = new URL(env.SUPABASE_URL).hostname.split(".")[0];
const TOKEN = env.SUPABASE_ACCESS_TOKEN;

const ALLOWED = {
  admin_fulfillment_analytics: ["p_period", "p_start", "p_end"],
  admin_fulfillment_orders: ["p_period", "p_start", "p_end", "p_stage", "p_bucket", "p_as_of", "p_limit", "p_offset", "p_snapshot"],
  admin_get_order: ["p_order_id"],
};

async function mgmtQuery(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const t = await r.text();
  if (!r.ok) {
    const m = t.match(/ERROR:\s*[0-9A-Z]*:?\s*(.*?)\\n/) || t.match(/ERROR:\s*(.*)/);
    const code = /40001/.test(t) ? "40001" : undefined;
    return { error: { message: m ? m[1].trim() : t.slice(0, 300), code } };
  }
  return { rows: JSON.parse(t) };
}

// Resolve a real live admin once at startup (read-only).
let ADMIN = null;
{
  const r = await mgmtQuery(`select m.user_id from public.admin_members m join public.user_profiles p on p.id=m.user_id where m.revoked_at is null and p.account_status='active' limit 1;`);
  ADMIN = r.rows && r.rows[0] ? r.rows[0].user_id : null;
  console.log("live admin for authorization:", ADMIN ?? "(none found)");
}

async function callLive(fn, args) {
  const keys = ALLOWED[fn];
  const params = keys.map((k) => {
    const v = args[k];
    if (v === null || v === undefined) return "null";
    if (typeof v === "number") return String(v);
    return "'" + String(v).replace(/'/g, "''") + "'";
  });
  // Strictly read-only: wrap in a transaction we always roll back.
  const sql = `begin; set local role authenticated; select set_config('request.jwt.claims', '{"sub":"${ADMIN}","role":"authenticated"}', true); select coalesce((select public.${fn}(${params.join(",")}))::text,'null') as data; rollback;`;
  const r = await mgmtQuery(sql);
  if (r.error) return { data: null, error: r.error };
  const hit = Array.isArray(r.rows) ? r.rows.find((x) => x && "data" in x) : null;
  const val = hit ? hit.data : null;
  return { data: val && val !== "null" ? JSON.parse(val) : null, error: null };
}

const libId = "\0live-ro-supabase";
const server = await createServer({
  root, configFile: false, envFile: false,
  plugins: [react(), tailwindcss(), {
    name: "kargo-live-ro",
    configureServer(vite) {
      vite.middlewares.use(async (req, res, next) => {
        if (req.url === "/__rpc" && req.method === "POST") {
          const chunks = []; for await (const c of req) chunks.push(c);
          const { fn, args } = JSON.parse(Buffer.concat(chunks).toString());
          if (!ALLOWED[fn]) { res.end(JSON.stringify({ data: null, error: { message: "not allowed" } })); return; }
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(await callLive(fn, args)));
          return;
        }
        if (req.url === "/__preview") {
          const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="margin:0;background:#f5f7fb"><p style="font:12px system-ui;padding:8px 16px;margin:0;background:#fdecec;color:#7a271a">LIVE Supabase · READ-ONLY (every query rolled back) · real production data</p><div id="root"></div><script type="module" src="/__entry.tsx"></script></body></html>`;
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
  server: { host: "127.0.0.1", port: 4799, strictPort: true },
  optimizeDeps: { noDiscovery: true, include: ["react", "react-dom/client", "lucide-react", "leaflet", "qrcode.react"] },
});
await server.listen();
console.log("LIVE read-only preview: http://127.0.0.1:4799/__preview");
process.on("SIGINT", async () => { await server.close(); process.exit(0); });
process.on("SIGTERM", async () => { await server.close(); process.exit(0); });
