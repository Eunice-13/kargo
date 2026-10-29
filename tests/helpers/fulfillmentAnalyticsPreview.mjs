// Disposable local UI verification against actual Phase 1 SQL, never production.
// Run: node tests/helpers/fulfillmentAnalyticsPreview.mjs
import { PGlite } from '@electric-sql/pglite';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../',import.meta.url));
const db = new PGlite();
await db.exec(`create role authenticated; create role anon; create schema auth;
create function auth.uid() returns uuid language sql as $$select '00000000-0000-0000-0000-000000000001'::uuid$$;
create function can_sell(uuid) returns boolean language sql as $$select true$$;
create function admin_assert() returns void language plpgsql as $$begin return; end$$;
create type order_status as enum('payment_pending','payment_submitted','insufficient_payment','payment_confirmed','preparing','completed','cancelled','expired','incomplete');
create table orders(id uuid primary key,order_number text,seller_id uuid,buyer_id uuid,status order_status,fulfillment_stage text,payment_confirmed_at timestamptz,completed_at timestamptz,created_at timestamptz default now(),tracking_number text);
create table notifications(recipient_id uuid,category text,message text,target_path text,context jsonb,dedupe_key text,created_at timestamptz default now());
create unique index notif_dedupe on notifications(recipient_id,dedupe_key) where dedupe_key is not null;
create table admin_audit_log(target_id text,target_type text,action text,after_state jsonb,created_at timestamptz);
insert into orders(id,order_number,status,fulfillment_stage,payment_confirmed_at,completed_at)
select ('00000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'LOCAL-'||n,
case when n%4=3 then 'completed'::order_status else 'preparing'::order_status end,
case n%4 when 0 then 'preparing' when 1 then 'shipped' when 2 then 'in_transit' else 'delivered' end,
now()-make_interval(days=>n%28,hours=>n%6+4),
case when n%4=3 then now()-make_interval(days=>n%28,hours=>n%6) end
from generate_series(1,60) n;
insert into notifications(context,dedupe_key,created_at)
select jsonb_build_object('order_id',o.id,'fulfillment_stage',s.stage),'fulfillment_'||s.stage||'_'||o.id,
o.payment_confirmed_at+make_interval(hours=>s.hour_offset)
from orders o cross join (values('preparing',1),('shipped',2),('in_transit',3)) s(stage,hour_offset)
where s.stage='preparing' or (s.stage='shipped' and o.fulfillment_stage in ('shipped','in_transit','delivered')) or (s.stage='in_transit' and o.fulfillment_stage in ('in_transit','delivered'));
create function admin_get_order(p_order_id uuid) returns jsonb language sql as $$
select jsonb_build_object('id',id,'orderNumber',order_number,'product','Local validation order','quantity',1,'amount',100,
'buyer','Local buyer','seller','Local seller','status',status,'createdAt',created_at,'paymentConfirmedAt',payment_confirmed_at,
'payments','[]'::jsonb,'auditHistory','[]'::jsonb,'groupOrderId',null) from orders where id=p_order_id $$;`);
for(const migration of ['202611040001_forward_only_fulfillment.sql','202611050001_no_cancel_after_payment.sql','202611060001_fulfillment_analytics.sql']) await db.exec(readFileSync(root+'supabase/migrations/'+migration,'utf8'));
const libId='\0local-analytics-supabase';
const server=await createServer({root,configFile:false,envFile:false,plugins:[react(),tailwindcss(),{
name:'local-analytics-database',
configureServer(vite) {
 vite.middlewares.use(async(req,res,next)=>{
  if(req.url==='/__analytics_rpc' && req.method==='POST') {
   const chunks=[];for await(const chunk of req)chunks.push(chunk);
   try {
    const {fn,args}=JSON.parse(Buffer.concat(chunks).toString());
    const allowed={admin_fulfillment_analytics:['p_period','p_start','p_end'],admin_fulfillment_orders:['p_period','p_start','p_end','p_stage','p_bucket','p_as_of','p_limit','p_offset','p_snapshot'],admin_get_order:['p_order_id']};
    if(!allowed[fn])throw Error('Read-only local validation endpoint');
    const keys=allowed[fn];const result=await db.query('select public.'+fn+'('+keys.map((_,i)=>'$'+(i+1)).join(',')+') as data',keys.map(k=>args[k]??null));
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:result.rows[0].data,error:null}));
   }catch(error){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:null,error:{message:error.message,code:error.code}}));}
   return;
  }
  if(req.url==='/__analytics_preview') {
   const html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head><body style="margin:0;background:#f5f7fb"><p style="font:12px system-ui;padding:10px 18px;margin:0;background:#def3fa">Local validation database · synthetic test records · no production connection</p><div id="root"></div><script type="module" src="/__analytics_entry.tsx"></script></body></html>`;
   res.setHeader('Content-Type','text/html');res.end(await vite.transformIndexHtml(req.url,html));return;
  }
  next();
 });
},
resolveId: function(source) { if(source==='@/lib/supabase'||source===libId)return libId;if(source==='/__analytics_entry.tsx')return '\0analytics-entry'; },
load: function(source) {
 if(source===libId)return `export const isSupabaseConfigured=true; export const supabase=null; export function requireSupabase(){return {rpc:async(fn,args)=>{const response=await fetch('/__analytics_rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fn,args})});return response.json();}}}`;
 if(source==='\0analytics-entry')return `import React from 'react';import{createRoot}from'react-dom/client';import Analytics from '/src/features/admin/AdminFulfillmentAnalytics.tsx';import '/src/index.css';createRoot(document.getElementById('root')).render(React.createElement('main',{style:{maxWidth:1400,margin:'auto',padding:'12px'}},React.createElement(Analytics)));`;
}
}],resolve:{alias:[{find:'@/lib/supabase',replacement:libId},{find:'@',replacement:root+'src'}]},server:{host:'127.0.0.1',port:4777,strictPort:true},optimizeDeps:{noDiscovery:true,include:['react','react-dom/client','lucide-react','leaflet','qrcode.react']}});
await server.listen();
console.log('Local database-backed preview: http://127.0.0.1:4777/__analytics_preview');
async function stop(){await server.close();await db.close();process.exit(0);}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
