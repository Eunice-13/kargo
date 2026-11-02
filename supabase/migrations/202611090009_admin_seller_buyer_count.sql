-- Surface the number of distinct buyers served by a seller in admin user details.
-- Keep buyerOrders for buyer accounts; sellerBuyers is the seller-facing metric.
create or replace function public.admin_get_user(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_confirmed public.order_status[] := array['payment_confirmed','preparing','completed']::public.order_status[];
  v_profile jsonb;
  v_recent jsonb;
  v_history jsonb;
begin
  perform public.admin_assert();

  select jsonb_build_object(
    'id', p.id,
    'name', p.display_name,
    'email', u.email,
    'bio', p.bio,
    'shopName', nullif(p.shop_name, ''),
    'avatarPath', p.avatar_path,
    'canSell', p.can_sell,
    'isAdmin', public.is_admin(p.id),
    'accountStatus', p.account_status,
    'accountStatusReason', p.account_status_reason,
    'createdAt', p.created_at,
    'updatedAt', p.updated_at,
    'lastSignInAt', u.last_sign_in_at,
    'buyerOrders', coalesce((select count(*) from public.orders o where o.buyer_id = p.id), 0),
    'sellerOrders', coalesce((select count(*) from public.orders o where o.seller_id = p.id), 0),
    'sellerBuyers', coalesce((select count(distinct o.buyer_id) from public.orders o where o.seller_id = p.id), 0),
    'sellerGmv30', coalesce((
      select sum(o.total_amount) from public.orders o
      where o.seller_id = p.id and o.status = any(v_confirmed)
        and coalesce(o.payment_confirmed_at, o.created_at) >= now() - interval '30 days'
    ), 0),
    'buyerSpend30', coalesce((
      select sum(o.total_amount) from public.orders o
      where o.buyer_id = p.id and o.status = any(v_confirmed)
        and coalesce(o.payment_confirmed_at, o.created_at) >= now() - interval '30 days'
    ), 0),
    'liveBatches', coalesce((
      select count(*) from public.batches b
      where b.seller_id = p.id and b.status = 'live'
    ), 0)
  )
  into v_profile
  from public.user_profiles p
  left join auth.users u on u.id = p.id
  where p.id = p_user_id;

  if v_profile is null then
    raise exception 'User not found' using errcode = 'P0002';
  end if;

  select coalesce(jsonb_agg(row_to_json(r) order by r.created_at desc), '[]'::jsonb)
    into v_recent
  from (
    select o.id, o.order_number, o.status, o.total_amount, o.created_at
    from public.orders o
    where o.buyer_id = p_user_id or o.seller_id = p_user_id
    order by o.created_at desc
    limit 5
  ) r;

  select coalesce(jsonb_agg(row_to_json(h) order by h.created_at desc), '[]'::jsonb)
    into v_history
  from (
    select id, actor_name, action, target_label, reason, created_at
    from public.admin_audit_log
    where target_type = 'user' and target_id = p_user_id::text
    order by created_at desc
    limit 10
  ) h;

  return v_profile
    || jsonb_build_object('recentOrders', v_recent, 'moderationHistory', v_history);
end;
$$;

revoke all on function public.admin_get_user(uuid) from public, anon;
grant execute on function public.admin_get_user(uuid) to authenticated;

notify pgrst, 'reload schema';
