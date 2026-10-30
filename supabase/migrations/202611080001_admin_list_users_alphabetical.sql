-- Sort the admin Users list alphabetically by display name (case-insensitive),
-- instead of newest-signup-first. Sort lives in the paginated subquery AND the
-- outer aggregation so pages stay stable and consistent. id breaks ties.
--
-- Batches are intentionally left ordered by creation date (newest first) in
-- admin_list_batches; this migration only changes the Users ordering.
--
-- CREATE OR REPLACE only; no schema or data change. Safe to re-run.
create or replace function public.admin_list_users(
  p_search text default null,
  p_role text default 'all',
  p_status text default 'all',
  p_limit integer default 25,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_confirmed public.order_status[] := array['payment_confirmed','preparing','completed']::public.order_status[];
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_total integer;
  v_rows jsonb;
begin
  perform public.admin_assert();

  select count(*) into v_total
  from public.user_profiles p
  left join auth.users u on u.id = p.id
  where
    (v_search is null
      or p.display_name ilike '%' || v_search || '%'
      or u.email ilike '%' || v_search || '%'
      or coalesce(p.shop_name, '') ilike '%' || v_search || '%'
      or p.id::text = v_search)
    and (p_role = 'all'
      or (p_role = 'admin' and public.is_admin(p.id))
      or (p_role = 'seller' and p.can_sell and not public.is_admin(p.id))
      or (p_role = 'buyer' and not p.can_sell and not public.is_admin(p.id)))
    and (p_status = 'all' or p.account_status::text = p_status);

  select coalesce(jsonb_agg(row_to_json(f) order by lower(f.name), f.id), '[]'::jsonb)
    into v_rows
  from (
    select
      p.id,
      p.display_name as name,
      u.email,
      nullif(p.shop_name, '') as "shopName",
      p.avatar_path as "avatarPath",
      p.can_sell as "canSell",
      public.is_admin(p.id) as "isAdmin",
      p.account_status as "accountStatus",
      p.created_at as "createdAt",
      p.updated_at as "updatedAt",
      u.last_sign_in_at as "lastSignInAt",
      coalesce((select count(*) from public.orders o where o.buyer_id = p.id), 0) as orders,
      -- Role-aware money metric (30d): sellers see what they sold; buyers see
      -- what they spent. Recognised at payment confirmation.
      case when p.can_sell then 'seller' else 'buyer' end as "gmvRole",
      coalesce((
        select sum(o.total_amount) from public.orders o
        where (case when p.can_sell then o.seller_id else o.buyer_id end) = p.id
          and o.status = any(v_confirmed)
          and coalesce(o.payment_confirmed_at, o.created_at) >= now() - interval '30 days'
      ), 0) as "gmv30"
    from public.user_profiles p
    left join auth.users u on u.id = p.id
    where
      (v_search is null
        or p.display_name ilike '%' || v_search || '%'
        or u.email ilike '%' || v_search || '%'
        or coalesce(p.shop_name, '') ilike '%' || v_search || '%'
        or p.id::text = v_search)
      and (p_role = 'all'
        or (p_role = 'admin' and public.is_admin(p.id))
        or (p_role = 'seller' and p.can_sell and not public.is_admin(p.id))
        or (p_role = 'buyer' and not p.can_sell and not public.is_admin(p.id)))
      and (p_status = 'all' or p.account_status::text = p_status)
    order by lower(p.display_name), p.id
    offset v_offset limit v_limit
  ) f;

  return jsonb_build_object(
    'rows', coalesce(v_rows, '[]'::jsonb),
    'total', coalesce(v_total, 0),
    'nextOffset', v_offset + v_limit
  );
end;
$$;

revoke all on function public.admin_list_users(text, text, text, integer, integer) from public, anon;
grant execute on function public.admin_list_users(text, text, text, integer, integer) to authenticated;
