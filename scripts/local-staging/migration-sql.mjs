export const sqlLiteral = (value) => "'" + value.replaceAll("'", "''") + "'";
export function withLocalLedger(source, version, name) {
  if (!/^[0-9]{12}$/.test(version) || !/^[a-z_]+$/.test(name) || !/commit;\s*$/i.test(source))
    throw Error("Unexpected local migration identity or transaction.");
  // A callback is essential: replacement strings interpret $$, $&, $` and $'.
  return source.replace(
    /commit;\s*$/i,
    () =>
      `insert into supabase_migrations.schema_migrations values(${sqlLiteral(version)},array[${sqlLiteral(source)}],${sqlLiteral(name)});\ncommit;`,
  );
}
