// Generates private review SQL only. This script never connects or executes SQL.
import fs from "node:fs";
import { verifyWorkdir } from "./isolation.mjs";
verifyWorkdir("staging/local-workdir");
const dir = "staging/local-workdir/baseline-review";
const m = JSON.parse(fs.readFileSync(`${dir}/schema-source.review.json`))[0].metadata;
const s = JSON.parse(fs.readFileSync(`${dir}/supplement.review.json`))[0].metadata;
const completeness = JSON.parse(fs.readFileSync(`${dir}/completeness.review.json`))[0].metadata;
if (m.history.length !== 26) throw Error("Unexpected history");
if (
  completeness.inheritance_count ||
  completeness.operator_count ||
  completeness.rules ||
  completeness.nondefault_collations ||
  completeness.types.some((t) => t.kind !== "e" || t.acl !== null || t.owner !== "postgres") ||
  completeness.routine_kinds.some((r) => r.kind !== "f") ||
  completeness.table_options.some((t) => t.options !== null || t.replica_identity !== "d")
) {
  throw Error("Unrepresented schema capability requires review before reconstruction.");
}
const q = (x) => '"' + String(x).replaceAll('"', '""') + '"';
const lit = (x) => "'" + String(x).replaceAll("'", "''") + "'";
let sql = [
  "-- LOCAL ONLY reconstructed baseline; never run against a hosted database.",
  "begin;",
  "set local search_path=pg_catalog,public,extensions;",
  "set local check_function_bodies=off;",
];
for (const e of s.extensions.filter(
  (e) => !["plpgsql", "pg_stat_statements", "supabase_vault"].includes(e.name),
))
  sql.push(`create extension if not exists ${q(e.name)} with schema ${q(e.schema)};`);
const enums = new Map();
for (const e of m.enums) enums.set(e.type, [...(enums.get(e.type) || []), e]);
for (const [name, values] of enums)
  sql.push(
    `create type public.${q(name)} as enum (${values
      .sort((a, b) => a.position - b.position)
      .map((v) => lit(v.label))
      .join(",")});`,
  );
for (const seq of s.sequences)
  sql.push(
    `create sequence public.${q(seq.name)} as ${seq.type} start ${seq.start} minvalue ${seq.min} maxvalue ${seq.max} increment ${seq.increment} cache ${seq.cache} ${seq.cycle ? "cycle" : "no cycle"};`,
  );
for (const t of m.tables.filter((t) => m.columns.some((c) => c.table === t.name))) {
  const cols = m.columns
    .filter((c) => c.table === t.name)
    .sort((a, b) => a.position - b.position)
    .map((c) => {
      if (c.identity) throw Error("Identity requires explicit review");
      return `${q(c.name)} ${c.type}${c.generated ? ` generated always as (${c.default}) stored` : c.default ? ` default ${c.default}` : ""}${c.not_null ? " not null" : ""}`;
    });
  sql.push(`create table public.${q(t.name)} (\n${cols.join(",\n")}\n);`);
}
for (const c of [...m.constraints].sort(
  (a, b) =>
    Number(a.definition.startsWith("FOREIGN KEY")) - Number(b.definition.startsWith("FOREIGN KEY")),
))
  sql.push(
    `alter table ${c.table.includes(".") ? c.table : `public.${q(c.table)}`} add constraint ${q(c.name)} ${c.definition};`,
  );
const owned = new Set(
  m.constraints
    .filter((c) => /^(PRIMARY KEY|UNIQUE|EXCLUDE)/.test(c.definition))
    .map((c) => c.name),
);
for (const i of m.indexes) if (!owned.has(i.name)) sql.push(i.definition + ";");
for (const v of m.views)
  sql.push(
    `create view public.${q(v.name)}${v.options?.length ? ` with (${v.options.join(",")})` : ""} as ${v.definition.replace(/;\s*$/, "")};`,
  );
for (const f of m.functions) sql.push(f.definition + ";");
for (const t of m.tables) {
  sql.push(
    `alter ${s.sequences.some((x) => x.name === t.name) ? "sequence" : m.views.some((x) => x.name === t.name) ? "view" : "table"} public.${q(t.name)} owner to ${q(t.owner)};`,
  );
  if (t.rls) sql.push(`alter table public.${q(t.name)} enable row level security;`);
  if (t.force_rls) sql.push(`alter table public.${q(t.name)} force row level security;`);
}
for (const t of m.triggers.filter(
  (t) =>
    t.schema === "public" || (t.schema === "auth" && t.definition.includes("handle_new_auth_user")),
))
  sql.push(t.definition + ";");
for (const p of m.policies)
  sql.push(
    `create policy ${q(p.name)} on ${q(p.schema)}.${q(p.table)} as ${p.permissive} for ${p.command} to ${p.roles.map((r) => (r === "public" ? "public" : q(r))).join(",")}${p.using ? ` using (${p.using})` : ""}${p.check ? ` with check (${p.check})` : ""};`,
  );
const perms = {
  a: "INSERT",
  r: "SELECT",
  w: "UPDATE",
  d: "DELETE",
  D: "TRUNCATE",
  x: "REFERENCES",
  t: "TRIGGER",
  m: "MAINTAIN",
  U: "USAGE",
  X: "EXECUTE",
  C: "CREATE",
};
function grants(acl, on) {
  for (const a of acl ?? []) {
    const match = a.match(/^([^=]*)=([^/]*)\/(.*)$/);
    if (!match) throw Error("Unsupported ACL");
    const role = match[1] ? q(match[1]) : "public";
    let last;
    for (const c of match[2]) {
      if (c === "*") {
        sql.push(`grant ${perms[last]} on ${on} to ${role} with grant option;`);
        continue;
      }
      if (!perms[c]) throw Error("Unknown ACL permission");
      sql.push(`grant ${perms[c]} on ${on} to ${role};`);
      last = c;
    }
  }
}
for (const t of m.tables) {
  const seq = s.sequences.some((x) => x.name === t.name);
  const on = `${seq ? "sequence" : "table"} public.${q(t.name)}`;
  sql.push(`revoke all on ${on} from public,anon,authenticated,service_role;`);
  grants(t.acl, on);
}
for (const f of m.functions) {
  const on = `function public.${q(f.name)}(${f.args})`;
  sql.push(
    `alter ${on} owner to ${q(f.owner)};`,
    `revoke all on ${on} from public,anon,authenticated,service_role;`,
  );
  grants(f.acl ?? ["=X/postgres"], on);
}
for (const col of s.column_privileges ?? [])
  for (const acl of col.acl) {
    if (acl !== "authenticated=w/postgres") throw Error("Unreviewed column ACL");
    sql.push(`grant update (${q(col.column)}) on public.${q(col.table)} to authenticated;`);
  }
for (const schema of s.schema_acl) {
  sql.push(`revoke all on schema ${q(schema.name)} from public,anon,authenticated,service_role;`);
  grants(schema.acl, `schema ${q(schema.name)}`);
}
for (const def of m.default_privileges) {
  const kind = { r: "tables", f: "functions", S: "sequences" }[def.type];
  if (!kind) throw Error("Unknown default ACL");
  const prefix = `alter default privileges for role ${q(def.role)}${def.schema ? ` in schema ${q(def.schema)}` : ""}`;
  if (!["postgres", "supabase_admin"].includes(def.role))
    throw Error("Unreviewed default privilege owner.");
  sql.push(`set local role ${q(def.role)};`);
  sql.push(`${prefix} revoke all on ${kind} from public,anon,authenticated,service_role;`);
  for (const acl of def.acl) {
    const x = acl.match(/^([^=]*)=([^/]*)\/(.*)$/);
    if (!x || x[2].includes("*")) throw Error("Unsupported default ACL");
    for (const letter of x[2])
      sql.push(`${prefix} grant ${perms[letter]} on ${kind} to ${x[1] ? q(x[1]) : "public"};`);
  }
}
sql.push("set local role postgres;");
for (const b of s.bucket_configuration)
  sql.push(
    `insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values(${lit(b.id)},${lit(b.name)},${b.public},${b.file_size_limit ?? "null"},${b.allowed_mime_types ? `array[${b.allowed_mime_types.map(lit).join(",")}]::text[]` : "null"}) on conflict(id) do nothing;`,
  );
// Native platform event triggers are supplied by local Supabase; only app-specific ensure_rls is recreated.
const evt = m.event_triggers.find((t) => t.name === "ensure_rls");
if (!evt) throw Error("Missing RLS event trigger");
sql.push(
  // Supautils authorizes postgres-owned event triggers with postgres-owned functions.
  // A superuser-owned event trigger cannot call this non-superuser-owned function.
  `create event trigger ensure_rls on ddl_command_end${evt.tags?.length ? ` when tag in (${evt.tags.map(lit).join(",")})` : ""} execute function public.rls_auto_enable();`,
);
sql.push(
  "do $$ begin if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='payments') then alter publication supabase_realtime add table public.payments; end if; end $$;",
);
// With all objects present, revalidate SQL-language bodies and PL/pgSQL syntax.
sql.push("set local check_function_bodies=on;");
for (const f of m.functions) sql.push(f.definition + ";");
sql.push("commit;");
fs.writeFileSync(`${dir}/baseline.draft.sql`, sql.join("\n\n") + "\n", { mode: 0o600 });
console.log(
  "Private baseline draft generated; not applied. Default privileges, platform objects and full-schema equality still require validation.",
);
