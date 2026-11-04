-- Stable pagination tiebreaker for the admin list RPCs.
--
-- These lists page with OFFSET/LIMIT and sort only by a timestamp (created_at,
-- submitted_at). When several rows share the exact same timestamp — common in
-- seed/demo data — PostgreSQL may order the ties differently per page, so a row
-- can appear on two pages (a visible duplicate) while another is skipped. Adding
-- the primary key as a final tiebreaker makes the order total and stable, so each
-- row lands on exactly one page.
--
-- admin_list_users already orders by (lower(display_name), id), so it is not
-- touched here.
--
-- This migration only rewrites the ORDER BY inside each function's body; nothing
-- else about the functions changes. No tables, columns, indexes, or data are
-- created or modified. It reads each function's current definition from the
-- catalog and patches it in place, so it always matches whatever version is live
-- and is safe to re-run.

do $$
declare
  -- function name -> [ (from_order_by, to_order_by), ... ]
  specs jsonb := jsonb_build_object(
    'admin_list_batches', jsonb_build_array(
      jsonb_build_array('order by b.created_at desc', 'order by b.created_at desc, b.id desc')
    ),
    'admin_list_orders', jsonb_build_array(
      jsonb_build_array('order by o.created_at desc', 'order by o.created_at desc, o.id desc')
    ),
    'admin_list_payments', jsonb_build_array(
      jsonb_build_array('order by pay.submitted_at desc', 'order by pay.submitted_at desc, pay.id desc')
    ),
    'admin_list_audit', jsonb_build_array(
      jsonb_build_array('order by a.created_at desc', 'order by a.created_at desc, a.id desc')
    ),
    'admin_list_combined_payments', jsonb_build_array(
      jsonb_build_array('order by g.created_at desc', 'order by g.created_at desc, g.id desc')
    )
  );
  fn text;
  pairs jsonb;
  pair jsonb;
  rec record;
  def text;
  patched text;
  n integer;
begin
  for fn, pairs in select * from jsonb_each(specs) loop
    -- Each list name resolves to exactly one function (same arg list across the app).
    for rec in
      select p.oid, pg_get_functiondef(p.oid) as src
      from pg_proc p
      join pg_namespace ns on ns.oid = p.pronamespace
      where ns.nspname = 'public' and p.proname = fn
    loop
      patched := rec.src;
      for pair in select * from jsonb_array_elements(pairs) loop
        -- Only rewrite the inner paged subquery's ORDER BY, never the
        -- jsonb_agg(... order by ...) output ordering, so target the exact
        -- clause text (which uses the table alias, not the aggregate alias).
        patched := replace(patched, pair->>0, pair->>1);
      end loop;
      -- Guard: never leave a double tiebreaker if run against an already-patched body.
      patched := replace(patched, ', b.id desc, b.id desc', ', b.id desc');
      patched := replace(patched, ', o.id desc, o.id desc', ', o.id desc');
      patched := replace(patched, ', pay.id desc, pay.id desc', ', pay.id desc');
      patched := replace(patched, ', a.id desc, a.id desc', ', a.id desc');
      patched := replace(patched, ', g.id desc, g.id desc', ', g.id desc');

      if patched is distinct from rec.src then
        execute patched;
      end if;
    end loop;
  end loop;
end $$;

notify pgrst, 'reload schema';
