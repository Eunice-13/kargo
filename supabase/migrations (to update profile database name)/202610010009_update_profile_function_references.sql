-- Renaming a table updates tracked dependencies, but not SQL/PLpgSQL bodies
-- stored as strings. Repair the current definitions (including auth helpers
-- and the signup trigger) without restoring obsolete logic from old migrations.
do $$
declare
  target record;
begin
  if to_regclass('public.user_profiles') is null then
    raise exception 'Expected public.user_profiles; apply the profile rename migration first';
  end if;

  for target in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_language l on l.oid = p.prolang
    where n.nspname = 'public'
      and p.prokind = 'f'
      and l.lanname in ('sql', 'plpgsql')
      and p.prosrc ~ '\mpublic\.profiles\M'
  loop
    -- CREATE OR REPLACE preserves function identity, ownership and grants;
    -- pg_get_functiondef retains security mode, search_path and other settings.
    execute regexp_replace(
      pg_get_functiondef(target.oid),
      '\mpublic\.profiles\M',
      'public.user_profiles',
      'g'
    );
  end loop;
end;
$$;

notify pgrst, 'reload schema';
