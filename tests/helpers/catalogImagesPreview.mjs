// Local demo only: never reads .env files, credentials, or the live database.
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const server = await createServer({
  root,
  cacheDir: ".vite/catalog-image-preview",
  configFile: false,
  envDir: false,
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "offline-image-audit",
      enforce: "pre",
      transformIndexHtml: {
        order: "pre",
        handler(html) {
          return html.replace(/src="\/src\/main\.tsx(?:\?[^"]*)?"/, 'src="/__catalog-audit.tsx"');
        },
      },
      resolveId(id) {
        if (id === "\0offline-image-client") return id;
        if (id === "/__catalog-audit.tsx") return "\0catalog-audit.tsx";
      },
      load(id) {
        if (id === "\0catalog-audit.tsx")
          return `
        import React, { useState } from "react";
        import { createRoot } from "react-dom/client";
        import Home from "/src/features/batches/BuyerHome.tsx";
        import Page from "/src/features/batches/BatchPage.tsx";
        import { BATCHES_INIT } from "/src/data/batches.ts";
        import "/src/index.css";
        const noop = () => {};
        function Audit() {
          const [category, setCategory] = useState("All");
          const [date, setDate] = useState("All");
          const [selected, setSelected] = useState(null);
          const props = {batches:BATCHES_INIT,claims:[],toPay:[],waitlist:[],setClaims:noop,
            setToPay:noop,setWaitlist:noop,setBatches:noop,refreshData:async()=>{},
            role:"Buyer",user:{name:"Offline audit",email:"",role:"Buyer"},
            onSellerClick:noop,onBack:()=>setSelected(null)};
          return React.createElement("main", {style:{maxWidth:1200,margin:"0 auto",padding:24}},
            selected ? React.createElement(Page, {...props, batch:selected}) :
            React.createElement(Home, {batches:BATCHES_INIT, category, date,
              onCategoryChange:setCategory, onDateChange:setDate,
              onOpenBatch:setSelected, onToggleReaction:noop, reactionPending:new Set()}));
        }
        createRoot(document.getElementById("root")).render(React.createElement(Audit));
      `;
        if (id === "\0offline-image-client")
          return `
        export const isSupabaseConfigured = false;
        export const supabase = null;
        export function requireSupabase() { throw new Error("Offline image audit: database access disabled"); }
      `;
      },
    },
  ],
  resolve: {
    alias: [
      { find: /^@\/lib\/supabase$/, replacement: "\0offline-image-client" },
      { find: "@", replacement: root + "src" },
    ],
  },
  server: { host: "127.0.0.1", port: 8457, strictPort: true },
});
await server.listen();
console.log("Offline image preview: http://127.0.0.1:8457/?preview=original&tab=Batches");
