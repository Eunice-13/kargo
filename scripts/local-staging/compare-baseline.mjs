import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { localSql, workdir } from "./database.mjs";
// Catalog-only capture statement retained from the authorized schema inspection.
const query = fs
  .readFileSync(new URL("./capture-schema.sql", import.meta.url), "utf8")
  .split("\n")
  .filter((l) => !l.includes("'history',"))
  .join("\n");
const actual = JSON.parse(localSql(query, "baseline-catalog-comparison"));
const source = JSON.parse(
  fs.readFileSync(path.join(workdir, "baseline-review/schema-source.review.json")),
)[0].metadata;
fs.writeFileSync(
  path.join(workdir, "baseline-review/local-schema.review.json"),
  JSON.stringify(actual),
  { mode: 0o600 },
);
const order = (rows, key) => [...rows].sort((a, b) => key(a).localeCompare(key(b)));
const strip = (s) => s?.replace(/\s+/g, "").trim();
const acl = (rows, owner, fn = false) =>
  [...(rows ?? (fn ? [`${owner}=X/${owner}`, `=X/${owner}`] : []))].sort();
const results = {};
function compare(name, expected, received) {
  try {
    assert.deepEqual(received, expected);
    results[name] = "pass";
  } catch {
    results[name] = "FAIL";
    fs.writeFileSync(
      path.join(workdir, `${name}-comparison.private.json`),
      JSON.stringify({ expected, received }, null, 2),
      { mode: 0o600 },
    );
  }
}
const logicalColumns = (rows) =>
  [...new Set(rows.map((c) => c.table))].sort().flatMap((table) =>
    rows
      .filter((c) => c.table === table)
      .sort((a, b) => a.position - b.position)
      .map((c, index) => ({ ...c, position: index + 1 })),
  );
compare("columns", logicalColumns(source.columns), logicalColumns(actual.columns));
compare(
  "enums",
  order(source.enums, (x) => x.type + ":" + x.position),
  order(actual.enums, (x) => x.type + ":" + x.position),
);
compare(
  "constraints",
  order(source.constraints, (x) => x.table + x.name),
  order(actual.constraints, (x) => x.table + x.name),
);
compare(
  "indexes",
  order(
    source.indexes.map((x) => ({ ...x, definition: strip(x.definition) })),
    (x) => x.name,
  ),
  order(
    actual.indexes.map((x) => ({ ...x, definition: strip(x.definition) })),
    (x) => x.name,
  ),
);
compare(
  "views",
  order(
    source.views.map((x) => ({ ...x, definition: strip(x.definition) })),
    (x) => x.name,
  ),
  order(
    actual.views.map((x) => ({ ...x, definition: strip(x.definition) })),
    (x) => x.name,
  ),
);
compare(
  "functions",
  order(
    source.functions.map((x) => ({
      ...x,
      definition: strip(x.definition),
      acl: acl(x.acl, x.owner, true),
    })),
    (x) => x.name + x.args,
  ),
  order(
    actual.functions.map((x) => ({
      ...x,
      definition: strip(x.definition),
      acl: acl(x.acl, x.owner, true),
    })),
    (x) => x.name + x.args,
  ),
);
compare(
  "tables",
  order(
    source.tables.map((x) => ({ ...x, acl: acl(x.acl, x.owner) })),
    (x) => x.name,
  ),
  order(
    actual.tables.map((x) => ({ ...x, acl: acl(x.acl, x.owner) })),
    (x) => x.name,
  ),
);
compare(
  "policies",
  order(
    source.policies.map((x) => ({ ...x, using: strip(x.using), check: strip(x.check) })),
    (x) => x.schema + x.table + x.name,
  ),
  order(
    actual.policies.map((x) => ({ ...x, using: strip(x.using), check: strip(x.check) })),
    (x) => x.schema + x.table + x.name,
  ),
);
const appTriggers = (a) =>
  a
    .filter(
      (t) =>
        t.schema === "public" ||
        (t.schema === "auth" && t.definition.includes("handle_new_auth_user")),
    )
    .map((x) => ({ ...x, definition: strip(x.definition) }));
compare(
  "app-triggers",
  order(appTriggers(source.triggers), (x) => x.definition),
  order(appTriggers(actual.triggers), (x) => x.definition),
);
compare(
  "default-privileges",
  order(
    source.default_privileges.map((x) => ({ ...x, acl: [...x.acl].sort() })),
    (x) => x.role + x.schema + x.type,
  ),
  order(
    actual.default_privileges
      .filter((x) =>
        source.default_privileges.some(
          (s) => s.role === x.role && s.schema === x.schema && s.type === x.type,
        ),
      )
      .map((x) => ({ ...x, acl: [...x.acl].sort() })),
    (x) => x.role + x.schema + x.type,
  ),
);
compare(
  "rls-event",
  source.event_triggers.find((x) => x.name === "ensure_rls"),
  actual.event_triggers.find((x) => x.name === "ensure_rls"),
);
console.log(JSON.stringify(results));
fs.writeFileSync(
  path.join(workdir, "baseline-comparison.local.json"),
  JSON.stringify({ results, checkedAt: new Date().toISOString() }),
  { mode: 0o600 },
);
if (Object.values(results).some((v) => v !== "pass")) process.exitCode = 1;
