// Reproduces the reported crash: an analytics RPC whose payload does NOT match
// the frontend stage definitions (a deployed/older RPC that omits a stage key,
// returns an extra legacy stage, or has a non-finite count). Renders the REAL
// component against this mangled payload to prove it no longer crashes or emits
// NaN coordinates. Local-only, no DB — the response is fabricated in-process.
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));

// A payload shaped like the RPC but deliberately mismatched:
// - counts OMIT "incomplete" and "cancelled" entirely (missing keys)
// - one bucket has a non-finite count
// - includes a stray legacy "expired" key the frontend ignores
function mangled() {
  const stagesPartial = () => ({
    payment_confirmed: 2,
    preparing: 1,
    shipped: 1,
    in_transit: 0,
    delivered: 3,
    expired: 5,
  });
  const days = 14;
  const chart = Array.from({ length: days }, (_, i) => ({
    bucketStart: new Date(Date.UTC(2026, 9, 1 + i)).toISOString(),
    bucketEnd: new Date(Date.UTC(2026, 9, 2 + i)).toISOString(),
    counts: i === 3 ? { delivered: NaN, shipped: 2 } : stagesPartial(),
  }));
  return {
    period: "last_30_days",
    timezone: "Asia/Manila",
    startAt: chart[0].bucketStart,
    endAt: chart[days - 1].bucketEnd,
    grouping: "day",
    generatedAt: new Date().toISOString(),
    snapshot: "mangled",
    captureStartedAt: chart[0].bucketStart,
    historicalCoverage: "partial_evidence_only",
    countingRule: "first_recorded_entry_per_order_per_stage",
    totalEntries: 40,
    uniqueOrders: 12,
    stageTotals: stagesPartial(), // also missing incomplete/cancelled
    chart,
  };
}

const libId = "\0mismatch-supabase";
const server = await createServer({
  root,
  configFile: false,
  envFile: false,
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "kargo-mismatch",
      configureServer(vite) {
        vite.middlewares.use(async (req, res, next) => {
          if (req.url === "/__rpc" && req.method === "POST") {
            const chunks = [];
            for await (const c of req) chunks.push(c);
            const { fn } = JSON.parse(Buffer.concat(chunks).toString());
            res.setHeader("Content-Type", "application/json");
            if (fn === "admin_fulfillment_analytics")
              res.end(JSON.stringify({ data: mangled(), error: null }));
            else
              res.end(
                JSON.stringify({
                  data: {
                    generatedAt: new Date().toISOString(),
                    total: 0,
                    nextOffset: 0,
                    rows: [],
                  },
                  error: null,
                }),
              );
            return;
          }
          if (req.url === "/__preview") {
            const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="margin:0;background:#f5f7fb"><p style="font:12px system-ui;padding:8px;margin:0;background:#fde8e8">MANGLED payload (missing/NaN/legacy stage keys) · crash reproduction</p><div id="root"></div><script type="module" src="/__entry.tsx"></script></body></html>`;
            res.setHeader("Content-Type", "text/html");
            res.end(await vite.transformIndexHtml(req.url, html));
            return;
          }
          next();
        });
      },
      resolveId(s) {
        if (s === "@/lib/supabase" || s === libId) return libId;
        if (s === "/__entry.tsx") return "\0entry";
      },
      load(s) {
        if (s === libId)
          return `export const isSupabaseConfigured=true;export const supabase=null;export function requireSupabase(){return{rpc:async(fn,args)=>{const r=await fetch('/__rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fn,args})});return r.json();}}}`;
        if (s === "\0entry")
          return `import React from 'react';import{createRoot}from'react-dom/client';import Analytics from '/src/features/admin/AdminFulfillmentAnalytics.tsx';import '/src/index.css';createRoot(document.getElementById('root')).render(React.createElement('main',{style:{maxWidth:1400,margin:'auto',padding:'12px'}},React.createElement(Analytics)));`;
      },
    },
  ],
  resolve: {
    alias: [
      { find: "@/lib/supabase", replacement: libId },
      { find: "@", replacement: root + "src" },
    ],
  },
  server: { host: "127.0.0.1", port: 4790, strictPort: true },
  optimizeDeps: {
    noDiscovery: true,
    include: ["react", "react-dom/client", "lucide-react", "leaflet", "qrcode.react"],
  },
});
await server.listen();
console.log("Mismatch preview: http://127.0.0.1:4790/__preview");
process.on("SIGINT", async () => {
  await server.close();
  process.exit(0);
});
process.on("SIGTERM", async () => {
  await server.close();
  process.exit(0);
});
