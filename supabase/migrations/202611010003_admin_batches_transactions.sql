-- ============================================================================
-- KARGO Admin — Phase 3: Batch moderation + Transactions RPCs
-- ============================================================================
-- Depends on 202611010001 (is_admin, admin_audit, admin read RLS) and the
-- LATEST batch_catalog from 202610270001_group_formation_expiration.sql, whose
-- column list is reproduced verbatim below (plus two appended moderation
-- columns) so the client's select("*") keeps working.
--
-- Scope: batch moderation (flag/hide/lock/close), a hidden-claim guard, admin
-- read/write RPCs for batches, orders, payments, and a read-only combined
-- payments view that degrades gracefully when the combined-delivery schema is
-- absent. Apply via the Supabase SQL editor.
-- ============================================================================

-- ─── 1. Moderation enum + columns ───────────────────────────────────────────

do $$
begin
  if not exists (select 1 from pg_type where typname = 'batch_moderation') then
    create type public.batch_moderation as enum ('visible', 'flagged', 'hidden');
  end if;
end
$$;

alter table public.batches
  add column if not exists moderation_status public.batch_moderation not null default 'visible',
  add column if not exists moderation_reason text,
  add column if not exists moderated_by uuid references public.user_profiles(id) on delete set null,
  add column if not exists moderated_at timestamptz;

create index if not exists batches_moderation_status_idx
  on public.batches (moderation_status);

-- ─── 2. Hidden-batch claim guard (covers every claim path + direct inserts) ──

create or replace function public.guard_order_hidden_batch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hidden boolean;
begin
  select (b.moderation_status = 'hidden')
    into v_hidden
  from public.batch_products bp
  join public.batches b on b.id = bp.batch_id
  where bp.id = new.batch_product_id;

  if coalesce(v_hidden, false) then
    raise exception 'This batch is not available' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists orders_guard_hidden_batch on public.orders;
create trigger orders_guard_hidden_batch
  before insert on public.orders
  for each row execute function public.guard_order_hidden_batch();

-- ─── 3. Rebuild batch_catalog with moderation (hidden only visible to owner) ─
-- Column list mirrors 202610270001 exactly, with moderation_status and
-- moderation_reason appended at the end (client uses select("*")).

create or replace view public.batch_catalog with (security_barrier = true) as
select
  b.id as batch_id,
  b.title as batch_title,
  b.status as batch_status,
  b.starts_on,
  b.ends_on,
  b.category,
  b.reservation_hours,
  b.notes,
  b.cover_path as batch_cover_path,
  b.group_orders_enabled,
  b.group_discount_type,
  b.group_discount_value,
  b.group_discount_min_subtotal,
  b.seller_id,
  seller.display_name as seller_name,
  bp.id as product_id,
  bp.name as product_name,
  bp.image_path as product_image_path,
  bp.selling_unit,
  bp.pieces_per_box,
  bp.base_price,
  bp.markup,
  bp.selling_price,
  bp.quantity_total,
  bp.is_locked as product_locked,
  (select coalesce(sum(x.quantity_total), 0::bigint)
     from public.batch_products x where x.batch_id = b.id) as batch_total_items,
  ((select coalesce(sum(o.quantity), 0::bigint)
      from public.orders o
      join public.batch_products x on x.id = o.batch_product_id
     where x.batch_id = b.id
       and o.status = any (array['payment_pending'::public.order_status,'payment_submitted'::public.order_status,'insufficient_payment'::public.order_status,'payment_confirmed'::public.order_status,'preparing'::public.order_status,'completed'::public.order_status]))
   + (select coalesce(sum(c.quantity), 0::bigint)
        from public.group_order_commitments c
        join public.group_orders g on g.id = c.group_order_id
        join public.batch_products x on x.id = c.batch_product_id
       where x.batch_id = b.id and g.status = 'forming'::text
         and public.group_formation_deadline(g.batch_id) > clock_timestamp())) as batch_claimed,
  ((select coalesce(sum(o.quantity), 0::bigint)
      from public.orders o
     where o.batch_product_id = bp.id
       and o.status = any (array['payment_pending'::public.order_status,'payment_submitted'::public.order_status,'insufficient_payment'::public.order_status,'payment_confirmed'::public.order_status,'preparing'::public.order_status,'completed'::public.order_status]))
   + (select coalesce(sum(c.quantity), 0::bigint)
        from public.group_order_commitments c
        join public.group_orders g on g.id = c.group_order_id
       where c.batch_product_id = bp.id and g.status = 'forming'::text
         and public.group_formation_deadline(g.batch_id) > clock_timestamp())) as quantity_claimed,
  (select count(*) from public.waitlist_entries w
     where w.batch_product_id = bp.id and w.status = 'waiting'::public.waitlist_status) as waitlist_count,
  bp.limit_per_user,
  bp.waitlist_limit,
  b.gallery_paths as batch_gallery_paths,
  b.moderation_status,
  b.moderation_reason
from public.batches b
join public.user_profiles seller on seller.id = b.seller_id
join public.batch_products bp on bp.batch_id = b.id
where b.status <> 'draft'::public.batch_status
  -- Hidden batches disappear from the catalog, except for their own seller
  -- (who still sees them with the moderation notice).
  and (b.moderation_status <> 'hidden'::public.batch_moderation or b.seller_id = auth.uid());

grant select on public.batch_catalog to authenticated;

-- ─── 4. admin_list_batches() ────────────────────────────────────────────────
-- p_status: all|draft|live|locked|closed ; p_moderation: all|visible|flagged|hidden

create or replace function public.admin_list_batches(
  p_search text default null,
  p_status text default 'all',
  p_moderation text default 'all',
  p_category text default 'all',
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
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_total integer;
  v_rows jsonb;
begin
  perform public.admin_assert();

  select count(*) into v_total
  from public.batches b
  join public.user_profiles s on s.id = b.seller_id
  where
    (v_search is null
      or b.title ilike '%' || v_search || '%'
      or s.display_name ilike '%' || v_search || '%'
      or b.id::text = v_search)
    and (p_status = 'all' or b.status::text = p_status)
    and (p_moderation = 'all' or b.moderation_status::text = p_moderation)
    and (p_category = 'all' or b.category = p_category);

  select coalesce(jsonb_agg(row_to_json(r) order by r."createdAt" desc), '[]'::jsonb)
    into v_rows
  from (
    select
      b.id,
      b.title,
      b.status,
      b.category,
      b.moderation_status as "moderationStatus",
      b.moderation_reason as "moderationReason",
      b.cover_path as "coverPath",
      b.starts_on as "startsOn",
      b.ends_on as "endsOn",
      b.created_at as "createdAt",
      b.seller_id as "sellerId",
      s.display_name as "sellerName",
      (select count(*) from public.batch_products x where x.batch_id = b.id) as products,
      coalesce((select sum(x.quantity_total) from public.batch_products x where x.batch_id = b.id), 0) as "totalQty",
      coalesce((
        select sum(o.quantity) from public.orders o
        join public.batch_products x on x.id = o.batch_product_id
        where x.batch_id = b.id
          and o.status = any (array['payment_pending'::public.order_status,'payment_submitted'::public.order_status,'insufficient_payment'::public.order_status,'payment_confirmed'::public.order_status,'preparing'::public.order_status,'completed'::public.order_status])
      ), 0) as "claimedQty"
    from public.batches b
    join public.user_profiles s on s.id = b.seller_id
    where
      (v_search is null
        or b.title ilike '%' || v_search || '%'
        or s.display_name ilike '%' || v_search || '%'
        or b.id::text = v_search)
      and (p_status = 'all' or b.status::text = p_status)
      and (p_moderation = 'all' or b.moderation_status::text = p_moderation)
      and (p_category = 'all' or b.category = p_category)
    order by b.created_at desc
    offset v_offset limit v_limit
  ) r;

  return jsonb_build_object('rows', v_rows, 'total', coalesce(v_total, 0), 'nextOffset', v_offset + v_limit);
end;
$$;

revoke all on function public.admin_list_batches(text, text, text, text, integer, integer) from public, anon;
grant execute on function public.admin_list_batches(text, text, text, text, integer, integer) to authenticated;

-- ─── 5. admin_get_batch() ───────────────────────────────────────────────────

create or replace function public.admin_get_batch(p_batch_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_confirmed public.order_status[] := array['payment_confirmed','preparing','completed']::public.order_status[];
  v_batch jsonb;
  v_products jsonb;
  v_history jsonb;
begin
  perform public.admin_assert();

  select jsonb_build_object(
    'id', b.id,
    'title', b.title,
    'status', b.status,
    'category', b.category,
    'moderationStatus', b.moderation_status,
    'moderationReason', b.moderation_reason,
    'coverPath', b.cover_path,
    'startsOn', b.starts_on,
    'endsOn', b.ends_on,
    'reservationHours', b.reservation_hours,
    'notes', b.notes,
    'sellerId', b.seller_id,
    'sellerName', s.display_name,
    'createdAt', b.created_at,
    'orderCount', coalesce((
      select count(*) from public.orders o
      join public.batch_products x on x.id = o.batch_product_id
      where x.batch_id = b.id), 0),
    'confirmedGmv', coalesce((
      select sum(o.total_amount) from public.orders o
      join public.batch_products x on x.id = o.batch_product_id
      where x.batch_id = b.id and o.status = any(v_confirmed)), 0)
  )
  into v_batch
  from public.batches b
  join public.user_profiles s on s.id = b.seller_id
  where b.id = p_batch_id;

  if v_batch is null then
    raise exception 'Batch not found' using errcode = 'P0002';
  end if;

  select coalesce(jsonb_agg(row_to_json(p) order by p.name), '[]'::jsonb)
    into v_products
  from (
    select
      bp.name,
      bp.selling_price as "sellingPrice",
      bp.quantity_total as "quantityTotal",
      bp.is_locked as "isLocked",
      coalesce((select sum(o.quantity) from public.orders o
        where o.batch_product_id = bp.id
          and o.status = any (array['payment_pending'::public.order_status,'payment_submitted'::public.order_status,'insufficient_payment'::public.order_status,'payment_confirmed'::public.order_status,'preparing'::public.order_status,'completed'::public.order_status])), 0) as claimed,
      coalesce((select count(*) from public.waitlist_entries w
        where w.batch_product_id = bp.id and w.status = 'waiting'::public.waitlist_status), 0) as waitlist
    from public.batch_products bp
    where bp.batch_id = p_batch_id
  ) p;

  select coalesce(jsonb_agg(row_to_json(h) order by h.created_at desc), '[]'::jsonb)
    into v_history
  from (
    select id, actor_name, action, reason, created_at
    from public.admin_audit_log
    where target_type = 'batch' and target_id = p_batch_id::text
    order by created_at desc limit 10
  ) h;

  return v_batch || jsonb_build_object('products', v_products, 'moderationHistory', v_history);
end;
$$;

revoke all on function public.admin_get_batch(uuid) from public, anon;
grant execute on function public.admin_get_batch(uuid) to authenticated;

-- ─── 6. admin_moderate_batch() ──────────────────────────────────────────────
-- actions: lock | unlock | flag | hide | restore | close

create or replace function public.admin_moderate_batch(
  p_batch_id uuid,
  p_action text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch public.batches;
  v_new_status public.batch_status;
  v_new_mod public.batch_moderation;
  v_needs_reason boolean := p_action in ('flag','hide','restore','close');
begin
  perform public.admin_assert();

  if v_needs_reason and (nullif(trim(coalesce(p_reason, '')), '') is null or length(trim(p_reason)) < 8) then
    raise exception 'A reason of at least 8 characters is required' using errcode = '22023';
  end if;

  select * into v_batch from public.batches where id = p_batch_id for update;
  if not found then raise exception 'Batch not found' using errcode = 'P0002'; end if;

  v_new_status := v_batch.status;
  v_new_mod := v_batch.moderation_status;

  if p_action = 'lock' then
    v_new_status := 'locked';
  elsif p_action = 'unlock' then
    if v_batch.status = 'locked' then v_new_status := 'live'; end if;
  elsif p_action = 'flag' then
    v_new_mod := 'flagged';
  elsif p_action = 'hide' then
    v_new_mod := 'hidden';
  elsif p_action = 'restore' then
    v_new_mod := 'visible';
  elsif p_action = 'close' then
    v_new_status := 'closed';
  else
    raise exception 'Unknown moderation action: %', p_action using errcode = '22023';
  end if;

  if v_new_status = v_batch.status and v_new_mod = v_batch.moderation_status then
    return jsonb_build_object('changed', false);
  end if;

  update public.batches
  set status = v_new_status,
      moderation_status = v_new_mod,
      moderation_reason = case when v_needs_reason then trim(p_reason) else moderation_reason end,
      moderated_by = auth.uid(),
      moderated_at = now()
  where id = p_batch_id;

  perform public.admin_audit(
    'batch_' || p_action, 'batch', p_batch_id::text, v_batch.title, nullif(trim(coalesce(p_reason,'')),''),
    jsonb_build_object('status', v_batch.status, 'moderation', v_batch.moderation_status),
    jsonb_build_object('status', v_new_status, 'moderation', v_new_mod)
  );

  insert into public.notifications (recipient_id, category, message, target_path, context, dedupe_key)
  values (
    v_batch.seller_id, 'package',
    case p_action
      when 'flag' then 'Your batch "' || v_batch.title || '" was flagged for review.'
      when 'hide' then 'Your batch "' || v_batch.title || '" was hidden from the catalog. Reason: ' || trim(p_reason)
      when 'restore' then 'Your batch "' || v_batch.title || '" is visible again.'
      when 'close' then 'Your batch "' || v_batch.title || '" was closed by an admin.'
      when 'lock' then 'Your batch "' || v_batch.title || '" was locked by an admin.'
      else 'Your batch "' || v_batch.title || '" was updated by an admin.'
    end,
    'Batches', jsonb_build_object('batch_id', v_batch.id),
    'batch_mod_' || v_batch.id::text || '_' || extract(epoch from now())::bigint::text
  )
  on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing;

  return jsonb_build_object('changed', true, 'status', v_new_status, 'moderation', v_new_mod);
end;
$$;

revoke all on function public.admin_moderate_batch(uuid, text, text) from public, anon;
grant execute on function public.admin_moderate_batch(uuid, text, text) to authenticated;

-- ─── 7. admin_list_orders() / admin_get_order() ─────────────────────────────

create or replace function public.admin_list_orders(
  p_search text default null,
  p_status text default 'all',
  p_days integer default 30,
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
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_since timestamptz := case when coalesce(p_days,0) > 0 then now() - make_interval(days => p_days) else null end;
  v_total integer;
  v_rows jsonb;
begin
  perform public.admin_assert();

  select count(*) into v_total
  from public.orders o
  join public.batch_products bp on bp.id = o.batch_product_id
  join public.user_profiles buyer on buyer.id = o.buyer_id
  join public.user_profiles seller on seller.id = o.seller_id
  where
    (v_search is null or o.order_number ilike '%' || v_search || '%'
      or bp.name ilike '%' || v_search || '%'
      or buyer.display_name ilike '%' || v_search || '%'
      or seller.display_name ilike '%' || v_search || '%')
    and (p_status = 'all' or o.status::text = p_status)
    and (v_since is null or o.created_at >= v_since);

  select coalesce(jsonb_agg(row_to_json(r) order by r."createdAt" desc), '[]'::jsonb)
    into v_rows
  from (
    select
      o.id, o.order_number as "orderNumber", bp.name as product,
      buyer.display_name as buyer, seller.display_name as seller,
      o.total_amount as amount, o.status,
      o.tracking_number as "trackingNumber", o.created_at as "createdAt"
    from public.orders o
    join public.batch_products bp on bp.id = o.batch_product_id
    join public.user_profiles buyer on buyer.id = o.buyer_id
    join public.user_profiles seller on seller.id = o.seller_id
    where
      (v_search is null or o.order_number ilike '%' || v_search || '%'
        or bp.name ilike '%' || v_search || '%'
        or buyer.display_name ilike '%' || v_search || '%'
        or seller.display_name ilike '%' || v_search || '%')
      and (p_status = 'all' or o.status::text = p_status)
      and (v_since is null or o.created_at >= v_since)
    order by o.created_at desc
    offset v_offset limit v_limit
  ) r;

  return jsonb_build_object('rows', v_rows, 'total', coalesce(v_total,0), 'nextOffset', v_offset + v_limit);
end;
$$;

revoke all on function public.admin_list_orders(text, text, integer, integer, integer) from public, anon;
grant execute on function public.admin_list_orders(text, text, integer, integer, integer) to authenticated;

create or replace function public.admin_get_order(p_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v jsonb;
  v_payments jsonb;
begin
  perform public.admin_assert();

  select jsonb_build_object(
    'id', o.id,
    'orderNumber', o.order_number,
    'product', bp.name,
    'quantity', o.quantity,
    'amount', o.total_amount,
    'status', o.status,
    'buyer', buyer.display_name,
    'buyerId', o.buyer_id,
    'seller', seller.display_name,
    'sellerId', o.seller_id,
    'trackingNumber', o.tracking_number,
    'eta', o.eta,
    'deliveryAddress', o.delivery_pin_address,
    'reservationExpiresAt', o.reservation_expires_at,
    'paymentConfirmedAt', o.payment_confirmed_at,
    'completedAt', o.completed_at,
    'createdAt', o.created_at
  )
  into v
  from public.orders o
  join public.batch_products bp on bp.id = o.batch_product_id
  join public.user_profiles buyer on buyer.id = o.buyer_id
  join public.user_profiles seller on seller.id = o.seller_id
  where o.id = p_order_id;

  if v is null then raise exception 'Order not found' using errcode = 'P0002'; end if;

  select coalesce(jsonb_agg(row_to_json(p) order by p."submittedAt" desc), '[]'::jsonb)
    into v_payments
  from (
    select id, status, method_type as method, amount, reference_number as "referenceNumber",
      submitted_at as "submittedAt"
    from public.payments where order_id = p_order_id
  ) p;

  return v || jsonb_build_object('payments', v_payments);
end;
$$;

revoke all on function public.admin_get_order(uuid) from public, anon;
grant execute on function public.admin_get_order(uuid) to authenticated;

-- ─── 8. admin_cancel_order() ────────────────────────────────────────────────

create or replace function public.admin_cancel_order(p_order_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  perform public.admin_assert();

  if nullif(trim(coalesce(p_reason, '')), '') is null or length(trim(p_reason)) < 8 then
    raise exception 'A reason of at least 8 characters is required' using errcode = '22023';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;

  if v_order.status = 'completed' then
    raise exception 'A completed order cannot be cancelled' using errcode = '22023';
  end if;
  if v_order.status = 'cancelled' then
    return jsonb_build_object('changed', false);
  end if;

  update public.orders
  set status = 'cancelled'
  where id = p_order_id;

  perform public.admin_audit(
    'cancel_order', 'order', p_order_id::text, v_order.order_number, trim(p_reason),
    jsonb_build_object('status', v_order.status),
    jsonb_build_object('status', 'cancelled')
  );

  insert into public.notifications (recipient_id, category, message, target_path, context, dedupe_key)
  select r, 'package',
    'Order ' || v_order.order_number || ' was cancelled by an admin. Reason: ' || trim(p_reason),
    'Orders', jsonb_build_object('order_id', v_order.id),
    'admin_cancel_' || v_order.id::text
  from unnest(array[v_order.buyer_id, v_order.seller_id]) as r
  on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing;

  return jsonb_build_object('changed', true);
end;
$$;

revoke all on function public.admin_cancel_order(uuid, text) from public, anon;
grant execute on function public.admin_cancel_order(uuid, text) to authenticated;

-- ─── 9. admin_list_payments() / admin_get_payment() ─────────────────────────

create or replace function public.admin_list_payments(
  p_search text default null,
  p_status text default 'all',
  p_days integer default 30,
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
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_since timestamptz := case when coalesce(p_days,0) > 0 then now() - make_interval(days => p_days) else null end;
  v_total integer;
  v_rows jsonb;
begin
  perform public.admin_assert();

  select count(*) into v_total
  from public.payments pay
  join public.orders o on o.id = pay.order_id
  join public.user_profiles buyer on buyer.id = o.buyer_id
  join public.user_profiles seller on seller.id = o.seller_id
  where
    (v_search is null or o.order_number ilike '%' || v_search || '%'
      or pay.reference_number ilike '%' || v_search || '%'
      or buyer.display_name ilike '%' || v_search || '%'
      or seller.display_name ilike '%' || v_search || '%')
    and (p_status = 'all' or pay.status::text = p_status)
    and (v_since is null or pay.submitted_at >= v_since);

  select coalesce(jsonb_agg(row_to_json(r) order by r."submittedAt" desc), '[]'::jsonb)
    into v_rows
  from (
    select
      pay.id, o.order_number as "orderNumber",
      buyer.display_name as buyer, seller.display_name as seller,
      pay.method_type as method, pay.amount, pay.reference_number as "referenceNumber",
      pay.status, pay.submitted_at as "submittedAt",
      reviewer.display_name as "reviewedBy"
    from public.payments pay
    join public.orders o on o.id = pay.order_id
    join public.user_profiles buyer on buyer.id = o.buyer_id
    join public.user_profiles seller on seller.id = o.seller_id
    left join public.user_profiles reviewer on reviewer.id = pay.reviewed_by
    where
      (v_search is null or o.order_number ilike '%' || v_search || '%'
        or pay.reference_number ilike '%' || v_search || '%'
        or buyer.display_name ilike '%' || v_search || '%'
        or seller.display_name ilike '%' || v_search || '%')
      and (p_status = 'all' or pay.status::text = p_status)
      and (v_since is null or pay.submitted_at >= v_since)
    order by pay.submitted_at desc
    offset v_offset limit v_limit
  ) r;

  return jsonb_build_object('rows', v_rows, 'total', coalesce(v_total,0), 'nextOffset', v_offset + v_limit);
end;
$$;

revoke all on function public.admin_list_payments(text, text, integer, integer, integer) from public, anon;
grant execute on function public.admin_list_payments(text, text, integer, integer, integer) to authenticated;

create or replace function public.admin_get_payment(p_payment_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v jsonb;
begin
  perform public.admin_assert();
  select jsonb_build_object(
    'id', pay.id,
    'orderId', pay.order_id,
    'orderNumber', o.order_number,
    'buyer', buyer.display_name,
    'seller', seller.display_name,
    'method', pay.method_type,
    'amount', pay.amount,
    'payerName', pay.payer_account_name,
    'payerPhone', pay.payer_phone,
    'referenceNumber', pay.reference_number,
    'receiptPath', pay.receipt_path,
    'status', pay.status,
    'rejectionReason', pay.rejection_reason,
    'submittedAt', pay.submitted_at,
    'reviewedAt', pay.reviewed_at,
    'reviewedBy', reviewer.display_name
  )
  into v
  from public.payments pay
  join public.orders o on o.id = pay.order_id
  join public.user_profiles buyer on buyer.id = o.buyer_id
  join public.user_profiles seller on seller.id = o.seller_id
  left join public.user_profiles reviewer on reviewer.id = pay.reviewed_by
  where pay.id = p_payment_id;

  if v is null then raise exception 'Payment not found' using errcode = 'P0002'; end if;
  return v;
end;
$$;

revoke all on function public.admin_get_payment(uuid) from public, anon;
grant execute on function public.admin_get_payment(uuid) to authenticated;

-- ─── 10. admin_review_payment() — override verify / reject ──────────────────

create or replace function public.admin_review_payment(
  p_payment_id uuid,
  p_decision text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pay public.payments;
  v_order public.orders;
  v_new public.payment_status;
begin
  perform public.admin_assert();

  if p_decision not in ('verified','rejected') then
    raise exception 'Decision must be verified or rejected' using errcode = '22023';
  end if;
  if nullif(trim(coalesce(p_reason, '')), '') is null or length(trim(p_reason)) < 8 then
    raise exception 'A reason of at least 8 characters is required' using errcode = '22023';
  end if;

  select * into v_pay from public.payments where id = p_payment_id for update;
  if not found then raise exception 'Payment not found' using errcode = 'P0002'; end if;

  v_new := p_decision::public.payment_status;
  if v_pay.status = v_new then
    return jsonb_build_object('changed', false);
  end if;

  select * into v_order from public.orders where id = v_pay.order_id for update;

  update public.payments
  set status = v_new,
      reviewed_at = now(),
      reviewed_by = auth.uid(),
      rejection_reason = case when v_new = 'rejected' then trim(p_reason) else null end
  where id = p_payment_id;

  -- Reflect the override on the order's paid state.
  if v_new = 'verified' then
    update public.orders
    set status = 'payment_confirmed', payment_confirmed_at = coalesce(payment_confirmed_at, now())
    where id = v_pay.order_id and status in ('payment_submitted','insufficient_payment','payment_pending');
  end if;

  perform public.admin_audit(
    'review_payment', 'payment', p_payment_id::text,
    coalesce(v_order.order_number, p_payment_id::text), trim(p_reason),
    jsonb_build_object('status', v_pay.status),
    jsonb_build_object('status', v_new)
  );

  insert into public.notifications (recipient_id, category, message, target_path, context, dedupe_key)
  select r, 'check',
    'A payment on order ' || coalesce(v_order.order_number, '') || ' was ' || p_decision || ' by an admin.',
    'Payments', jsonb_build_object('payment_id', p_payment_id),
    'admin_review_pay_' || p_payment_id::text || '_' || extract(epoch from now())::bigint::text
  from unnest(array[v_order.buyer_id, v_order.seller_id]) as r
  on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing;

  return jsonb_build_object('changed', true, 'status', v_new);
end;
$$;

revoke all on function public.admin_review_payment(uuid, text, text) from public, anon;
grant execute on function public.admin_review_payment(uuid, text, text) to authenticated;

-- ─── 11. admin_list_combined_payments() — read-only, degrades gracefully ────

create or replace function public.admin_list_combined_payments(
  p_search text default null,
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
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_total integer;
  v_rows jsonb;
begin
  perform public.admin_assert();

  -- Degrade gracefully when the combined-delivery schema is not present.
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'combined_delivery_groups'
  ) then
    return jsonb_build_object('available', false, 'rows', '[]'::jsonb, 'total', 0, 'nextOffset', 0);
  end if;

  select count(*) into v_total
  from public.combined_delivery_groups g
  join public.user_profiles buyer on buyer.id = g.buyer_id
  join public.user_profiles seller on seller.id = g.seller_id
  where (v_search is null
      or buyer.display_name ilike '%' || v_search || '%'
      or seller.display_name ilike '%' || v_search || '%'
      or g.id::text = v_search)
    and (p_status = 'all' or g.status = p_status);

  select coalesce(jsonb_agg(row_to_json(r) order by r."createdAt" desc), '[]'::jsonb)
    into v_rows
  from (
    select
      g.id, buyer.display_name as buyer, seller.display_name as seller,
      g.shipping_fee as "shippingFee", g.status,
      g.created_at as "createdAt",
      (select count(*) from public.combined_delivery_members m where m.group_id = g.id and m.released_at is null) as "memberCount"
    from public.combined_delivery_groups g
    join public.user_profiles buyer on buyer.id = g.buyer_id
    join public.user_profiles seller on seller.id = g.seller_id
    where (v_search is null
        or buyer.display_name ilike '%' || v_search || '%'
        or seller.display_name ilike '%' || v_search || '%'
        or g.id::text = v_search)
      and (p_status = 'all' or g.status = p_status)
    order by g.created_at desc
    offset v_offset limit v_limit
  ) r;

  return jsonb_build_object('available', true, 'rows', v_rows, 'total', coalesce(v_total,0), 'nextOffset', v_offset + v_limit);
end;
$$;

revoke all on function public.admin_list_combined_payments(text, text, integer, integer) from public, anon;
grant execute on function public.admin_list_combined_payments(text, text, integer, integer) to authenticated;

notify pgrst, 'reload schema';
