import test from "node:test";
import assert from "node:assert/strict";
import { withLocalLedger, sqlLiteral } from "../scripts/local-staging/migration-sql.mjs";
test("ledger serialization preserves dollar quoting and JavaScript replacement metacharacters", () => {
  const source = "begin;\nselect $$literal $& $` $' and 'quotes'$$;\ncommit;\n";
  const result = withLocalLedger(source, "202610220002", "combined_delivery_foundations");
  assert.ok(result.startsWith(source.slice(0, source.lastIndexOf("commit;"))));
  const value = result.slice(
    result.indexOf("array[") + 6,
    result.indexOf("],\'combined_delivery_foundations"),
  );
  assert.equal(value, sqlLiteral(source));
  assert.ok(result.endsWith("commit;"));
});
test("rejects ambiguous migration identity and missing transaction terminator", () => {
  for (const args of [
    ["select 1", "202610220002", "test"],
    ["commit;", "production", "test"],
    ["commit;", "202610220002", "test');drop table x"],
  ])
    assert.throws(() => withLocalLedger(...args));
});
