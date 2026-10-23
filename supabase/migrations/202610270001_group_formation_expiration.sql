-- Depends on the existing Group Orders schema and 202610260001 membership synchronization.
-- Existing sweep scheduling, grants, view columns and post-checkout functions are preserved.
-- Formation expiry uses the batch date, never a separately configured deadline.
-- No historical commitments are deleted and no inventory counters are decremented.
begin;
create or replace function public.group_formation_deadline(p_batch_id uuid)
returns timestamptz language sql stable security definer set search_path = '' as $$
  select (ends_on::timestamp + interval '1 day' - interval '1 second') at time zone 'Asia/Manila'
  from public.batches where id=p_batch_id
$$;
revoke all on function public.group_formation_deadline(uuid) from public;
grant execute on function public.group_formation_deadline(uuid) to anon, authenticated, service_role;

create or replace function public.expire_forming_group_orders()
returns integer language plpgsql security definer set search_path = '' as $$
declare target record; expired_count integer := 0;
begin
  for target in select g.id from public.group_orders g
    where g.status='forming' and g.checked_out_at is null and g.payment_order_id is null
      and public.group_formation_deadline(g.batch_id) <= clock_timestamp()
    order by g.id for update of g skip locked
  loop
    perform 1 from public.batches where id=(select batch_id from public.group_orders where id=target.id) for share;
    update public.group_orders set status='expired', updated_at=clock_timestamp()
    where id=target.id and status='forming' and checked_out_at is null and payment_order_id is null
      and public.group_formation_deadline(batch_id) <= clock_timestamp();
    if found then expired_count := expired_count+1; end if;
  end loop;
  return expired_count;
end $$;
revoke all on function public.expire_forming_group_orders() from public, anon, authenticated;
grant execute on function public.expire_forming_group_orders() to service_role;


CREATE OR REPLACE FUNCTION public.join_group_order(p_referral_code text)
 RETURNS group_orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  result public.group_orders;
  target_batch public.batches;
begin
  if auth.uid() is null or not public.is_active(auth.uid()) then raise exception 'Active account required'; end if;
  if public.can_sell(auth.uid()) then raise exception 'Seller accounts cannot join group orders'; end if;
  select * into result from public.group_orders
    where referral_code = upper(trim(p_referral_code)) and status = 'forming' for update;
  if not found or public.group_formation_deadline(result.batch_id) <= clock_timestamp() then raise exception 'This group code is invalid or expired'; end if;
  select * into target_batch from public.batches where id = result.batch_id for share;
  if public.group_formation_deadline(result.batch_id) <= clock_timestamp() then raise exception 'This group code is invalid or expired'; end if;
  if target_batch.status <> 'live' then raise exception 'This batch is not accepting orders'; end if;
  if exists (
    select 1 from public.group_order_members m
    join public.group_orders g on g.id = m.group_order_id
    where m.user_id = auth.uid() and m.status = 'active'
      and g.batch_id = result.batch_id and g.id <> result.id
      and g.status in ('forming', 'waiting_for_seller', 'payment_pending', 'payment_submitted')
  ) then
    raise exception 'GROUP_MEMBERSHIP_CONFLICT' using detail=jsonb_build_object('can_leave',
      not exists(select 1 from public.group_order_members m join public.group_orders g on g.id=m.group_order_id
       where m.user_id=auth.uid() and m.status='active' and g.batch_id=result.batch_id
       and g.status in ('waiting_for_seller','payment_pending','payment_submitted')))::text;
  end if;

  if exists(select 1 from public.group_order_members where group_order_id=result.id and user_id=auth.uid() and status='active') then return result; end if;
  insert into public.group_order_members (group_order_id, user_id, role, status)
  values (result.id, auth.uid(), 'member', 'active')
  on conflict (group_order_id, user_id) do update set status = 'active', joined_at = now();
  if public.group_formation_deadline(result.batch_id) <= clock_timestamp() then raise exception 'This group code is invalid or expired'; end if;
  insert into public.notifications (recipient_id, category, message, target_path, context)
  values (result.leader_id, 'users', 'A member joined your group order.', 'Batches', jsonb_build_object('group_order_id', result.id));
  return result;
exception when unique_violation then
  if sqlerrm like '%group_members_one_active_batch%' then
    raise exception 'GROUP_MEMBERSHIP_CONFLICT' using detail='{"can_leave":false}';
  end if;
  raise;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.start_group_order(p_batch_id uuid)
 RETURNS group_orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  target_batch public.batches;
  result public.group_orders;
begin
  if auth.uid() is null or not public.is_active(auth.uid()) then raise exception 'Active account required'; end if;
  if public.can_sell(auth.uid()) then raise exception 'Seller accounts cannot start group orders'; end if;

  select * into target_batch from public.batches where id = p_batch_id for update;
  if not found or target_batch.status <> 'live' or not target_batch.group_orders_enabled then
    raise exception 'Group ordering is not available for this batch';
  end if;
  if target_batch.seller_id = auth.uid() then raise exception 'Sellers cannot order from their own batch'; end if;
  if public.group_formation_deadline(target_batch.id) <= clock_timestamp() then raise exception 'This batch has already closed'; end if;
  if exists (
    select 1 from public.group_order_members m
    join public.group_orders g on g.id = m.group_order_id
    where m.user_id = auth.uid() and m.status = 'active'
      and g.batch_id = p_batch_id and g.status in ('forming', 'waiting_for_seller', 'payment_pending', 'payment_submitted')
  ) then
    raise exception 'GROUP_MEMBERSHIP_CONFLICT' using detail=jsonb_build_object('can_leave',
      not exists(select 1 from public.group_order_members m join public.group_orders g on g.id=m.group_order_id
       where m.user_id=auth.uid() and m.status='active' and g.batch_id=p_batch_id
       and g.status in ('waiting_for_seller','payment_pending','payment_submitted')))::text;
  end if;

  insert into public.group_orders (batch_id, leader_id, referral_code, formation_deadline)
  values (
    p_batch_id, auth.uid(), public.generate_group_referral_code(),
    (target_batch.ends_on::timestamp + interval '1 day' - interval '1 second') at time zone 'Asia/Manila'
  ) returning * into result;

  insert into public.group_order_members (group_order_id, user_id, role)
  values (result.id, auth.uid(), 'leader');
  if public.group_formation_deadline(result.batch_id) <= clock_timestamp() then raise exception 'This batch has already closed'; end if;
  return result;
exception when unique_violation then
  if sqlerrm like '%group_members_one_active_batch%' then
    raise exception 'GROUP_MEMBERSHIP_CONFLICT' using detail='{"can_leave":false}';
  end if;
  raise;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.sweep_expirations()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin perform public.expire_forming_group_orders(); perform public.expire_combined_payments(); perform public.sweep_standalone_delivery_expirations(); end $function$
;

CREATE OR REPLACE FUNCTION public.checkout_group_order(p_group_order_id uuid, p_payment_method text, p_pin_lat double precision, p_pin_lng double precision, p_pin_url text, p_pin_address text, p_accept_shipping boolean, p_acknowledged boolean)
 RETURNS group_orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  target public.group_orders;
  target_batch public.batches;
  member_count integer;
  leader_items integer;
  subtotal numeric(12,2);
  discount numeric(12,2) := 0;
  shipping_required boolean;
  line record;
  created_order public.orders;
  first_order_id uuid;
  factor numeric;
begin
  select * into target from public.group_orders where id = p_group_order_id for update;
  if not found or target.leader_id <> auth.uid() or target.status <> 'forming' then raise exception 'Leader access required'; end if;
  if public.group_formation_deadline(target.batch_id) <= clock_timestamp() then raise exception 'The batch deadline has passed'; end if;
  if not p_acknowledged then raise exception 'Leader payment and delivery acknowledgment is required'; end if;
  select * into target_batch from public.batches where id = target.batch_id for update;
  select count(*)::integer into member_count from public.group_order_members
    where group_order_id = target.id and status = 'active';
  if member_count < 2 then raise exception 'At least two separate accounts are required'; end if;
  select coalesce(sum(quantity), 0)::integer into leader_items from public.group_order_commitments
    where group_order_id = target.id and user_id = target.leader_id;
  if leader_items < 1 then raise exception 'The leader must commit at least one item'; end if;
  select coalesce(sum(quantity * unit_selling_price), 0) into subtotal
    from public.group_order_commitments where group_order_id = target.id;
  if subtotal <= 0 then raise exception 'The group has no committed items'; end if;

  if target_batch.group_discount_type is not null
    and (target_batch.group_discount_min_subtotal is null or subtotal >= target_batch.group_discount_min_subtotal) then
    discount := case target_batch.group_discount_type
      when 'percentage' then round(subtotal * least(target_batch.group_discount_value, 100) / 100, 2)
      else least(target_batch.group_discount_value, subtotal)
    end;
  end if;
  factor := (subtotal - discount) / subtotal;
  shipping_required := lower(trim(p_payment_method)) <> lower('Cash on Meetup');
  if nullif(trim(p_payment_method), '') is null then raise exception 'Payment method is required'; end if;
  if not exists (
    select 1 from public.seller_payment_methods m where m.seller_id = target_batch.seller_id
      and m.is_active and lower(m.method_type) = lower(trim(p_payment_method))
  ) then raise exception 'Payment method is not accepted by this seller'; end if;
  if shipping_required and (
    not coalesce(p_accept_shipping, false)
    or (p_pin_lat is null and p_pin_lng is null and nullif(trim(p_pin_url), '') is null)
  ) then raise exception 'A delivery location and shipping acceptance are required'; end if;

  for line in
    select c.batch_product_id, sum(c.quantity)::integer as quantity,
      min(c.unit_selling_price) as unit_price, min(bp.base_price) as base_price
    from public.group_order_commitments c
    join public.batch_products bp on bp.id = c.batch_product_id
    where c.group_order_id = target.id
    group by c.batch_product_id
  loop
    insert into public.orders (
      order_number, batch_product_id, buyer_id, seller_id, quantity,
      unit_base_price, unit_selling_price, reservation_expires_at,
      reserved_payment_method, shipping_applies, group_order_id
    ) values (
      'ORD-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.order_number_seq')::text, 6, '0'),
      line.batch_product_id, target.leader_id, target_batch.seller_id, line.quantity,
      line.base_price, round(line.unit_price * factor, 2),
      now() + make_interval(hours => target_batch.reservation_hours),
      trim(p_payment_method), shipping_required, target.id
    ) returning * into created_order;
    first_order_id := coalesce(first_order_id, created_order.id);
  end loop;

  update public.orders set
    buyer_accepted_shipping_fee = shipping_required and p_accept_shipping,
    buyer_accepted_shipping_fee_at = case when shipping_required then now() end,
    shipping_state = case when shipping_required then 'waiting_for_seller' end,
    delivery_pin_lat = case when shipping_required then p_pin_lat end,
    delivery_pin_lng = case when shipping_required then p_pin_lng end,
    delivery_pin_url = case when shipping_required then nullif(trim(p_pin_url), '') end,
    delivery_pin_address = case when shipping_required then nullif(trim(p_pin_address), '') end,
    delivery_pin_updated_at = case when shipping_required then now() end,
    deadline_paused_at = case when shipping_required then now() end
  where id = first_order_id;

  -- Recheck after product/batch lock waits; an expired checkout rolls back all orders.
  if public.group_formation_deadline(target.batch_id) <= clock_timestamp() then raise exception 'The batch deadline has passed'; end if;
  update public.group_orders set
    status = case when shipping_required then 'waiting_for_seller' else 'payment_pending' end,
    regular_subtotal = subtotal,
    discount_amount = discount,
    final_subtotal = subtotal - discount,
    reserved_payment_method = trim(p_payment_method),
    shipping_applies = shipping_required,
    shipping_state = case when shipping_required then 'waiting_for_seller' end,
    delivery_pin_lat = case when shipping_required then p_pin_lat end,
    delivery_pin_lng = case when shipping_required then p_pin_lng end,
    delivery_pin_url = case when shipping_required then nullif(trim(p_pin_url), '') end,
    delivery_pin_address = case when shipping_required then nullif(trim(p_pin_address), '') end,
    acknowledged_by_leader = true,
    payment_order_id = first_order_id,
    payment_deadline = case when shipping_required then null else now() + make_interval(hours => target_batch.reservation_hours) end,
    checked_out_at = now(), updated_at = now()
  where id = target.id returning * into target;

  insert into public.notifications (recipient_id, category, message, target_path, context)
  values (target_batch.seller_id, 'package', 'A group order is ready for review', 'My Claims', jsonb_build_object('group_order_id', target.id));
  insert into public.notifications (recipient_id, category, message, target_path, context)
  select user_id, 'check', 'Your group order reached checkout.', 'My Claims', jsonb_build_object('group_order_id', target.id)
  from public.group_order_members where group_order_id = target.id and status = 'active' and user_id <> target.leader_id;
  return target;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_group_commitment(p_group_order_id uuid, p_batch_product_id uuid, p_quantity integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  target_group public.group_orders;
  product public.batch_products;
  active_reserved integer;
  own_reserved integer;
  solo_claimed integer;
begin
  if p_quantity <= 0 then raise exception 'Quantity must be positive'; end if;
  select * into target_group from public.group_orders where id = p_group_order_id for update;
  if not found or target_group.status <> 'forming' or public.group_formation_deadline(target_group.batch_id) <= clock_timestamp() then
    raise exception 'This group is no longer accepting commitments';
  end if;
  perform 1 from public.batches where id=target_group.batch_id for share;
  if public.group_formation_deadline(target_group.batch_id) <= clock_timestamp() then raise exception 'This group is no longer accepting commitments'; end if;
  if not exists (
    select 1 from public.group_order_members where group_order_id = target_group.id
      and user_id = auth.uid() and status = 'active'
  ) then raise exception 'Active group membership required'; end if;
  select * into product from public.batch_products
    where id = p_batch_product_id and batch_id = target_group.batch_id for update;
  if not found or product.is_locked then raise exception 'Product is not available'; end if;
  if public.group_formation_deadline(target_group.batch_id) <= clock_timestamp() then raise exception 'This group is no longer accepting commitments'; end if;

  select coalesce(sum(o.quantity), 0)::integer into active_reserved
  from public.orders o where o.batch_product_id = product.id
    and o.status in ('payment_pending', 'payment_submitted', 'insufficient_payment', 'payment_confirmed', 'preparing', 'completed');
  select coalesce(sum(c.quantity), 0)::integer into active_reserved
  from public.group_order_commitments c
  join public.group_orders g on g.id = c.group_order_id
  where c.batch_product_id = product.id and g.status = 'forming' and public.group_formation_deadline(g.batch_id) > clock_timestamp()
    and not (c.group_order_id = target_group.id and c.user_id = auth.uid());
  active_reserved := active_reserved + coalesce((
    select sum(o.quantity)::integer from public.orders o where o.batch_product_id = product.id
      and o.status in ('payment_pending', 'payment_submitted', 'insufficient_payment', 'payment_confirmed', 'preparing', 'completed')
  ), 0);
  if active_reserved + p_quantity > product.quantity_total then raise exception 'Insufficient inventory'; end if;

  if product.limit_per_user is not null then
    select coalesce(sum(o.quantity), 0)::integer into solo_claimed from public.orders o
      where o.batch_product_id = product.id and o.buyer_id = auth.uid()
        and o.status in ('payment_pending', 'payment_submitted', 'insufficient_payment', 'payment_confirmed', 'preparing', 'completed');
    select coalesce(sum(c.quantity), 0)::integer into own_reserved
      from public.group_order_commitments c join public.group_orders g on g.id = c.group_order_id
      where c.batch_product_id = product.id and c.user_id = auth.uid() and g.status = 'forming' and public.group_formation_deadline(g.batch_id) > clock_timestamp()
        and c.group_order_id <> target_group.id;
    if solo_claimed + own_reserved + p_quantity > product.limit_per_user then
      raise exception 'Per-buyer limit of % reached for this item', product.limit_per_user;
    end if;
  end if;

  insert into public.group_order_commitments (
    group_order_id, user_id, batch_product_id, quantity, unit_selling_price
  ) values (target_group.id, auth.uid(), product.id, p_quantity, product.selling_price)
  on conflict (group_order_id, user_id, batch_product_id)
  do update set quantity = excluded.quantity, unit_selling_price = excluded.unit_selling_price, updated_at = now();
  if public.group_formation_deadline(target_group.batch_id) <= clock_timestamp() then raise exception 'This group is no longer accepting commitments'; end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.enforce_group_aware_order_inventory()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  product public.batch_products;
  ordered integer;
  committed integer;
  buyer_ordered integer;
  buyer_committed integer;
begin
  select * into product from public.batch_products where id = new.batch_product_id for update;
  select coalesce(sum(quantity), 0)::integer into ordered from public.orders
    where batch_product_id = product.id
      and status in ('payment_pending', 'payment_submitted', 'insufficient_payment', 'payment_confirmed', 'preparing', 'completed');
  select coalesce(sum(c.quantity), 0)::integer into committed
    from public.group_order_commitments c join public.group_orders g on g.id = c.group_order_id
    where c.batch_product_id = product.id and g.status = 'forming' and public.group_formation_deadline(g.batch_id) > clock_timestamp()
      and (new.group_order_id is null or g.id <> new.group_order_id);
  if ordered + committed + new.quantity > product.quantity_total then raise exception 'Insufficient inventory'; end if;

  if new.group_order_id is null and product.limit_per_user is not null then
    select coalesce(sum(quantity), 0)::integer into buyer_ordered from public.orders
      where batch_product_id = product.id and buyer_id = new.buyer_id
        and status in ('payment_pending', 'payment_submitted', 'insufficient_payment', 'payment_confirmed', 'preparing', 'completed');
    select coalesce(sum(c.quantity), 0)::integer into buyer_committed
      from public.group_order_commitments c join public.group_orders g on g.id = c.group_order_id
      where c.batch_product_id = product.id and c.user_id = new.buyer_id and g.status = 'forming' and public.group_formation_deadline(g.batch_id) > clock_timestamp();
    if buyer_ordered + buyer_committed + new.quantity > product.limit_per_user then
      raise exception 'Per-buyer limit of % reached for this item', product.limit_per_user;
    end if;
  end if;
  return new;
end;
$function$
;

create or replace view public.batch_catalog as  SELECT b.id AS batch_id,
    b.title AS batch_title,
    b.status AS batch_status,
    b.starts_on,
    b.ends_on,
    b.category,
    b.reservation_hours,
    b.notes,
    b.cover_path AS batch_cover_path,
    b.group_orders_enabled,
    b.group_discount_type,
    b.group_discount_value,
    b.group_discount_min_subtotal,
    b.seller_id,
    seller.display_name AS seller_name,
    bp.id AS product_id,
    bp.name AS product_name,
    bp.image_path AS product_image_path,
    bp.selling_unit,
    bp.pieces_per_box,
    bp.base_price,
    bp.markup,
    bp.selling_price,
    bp.quantity_total,
    bp.is_locked AS product_locked,
    ( SELECT COALESCE(sum(x.quantity_total), 0::bigint) AS "coalesce"
           FROM batch_products x
          WHERE x.batch_id = b.id) AS batch_total_items,
    (( SELECT COALESCE(sum(o.quantity), 0::bigint) AS "coalesce"
           FROM orders o
             JOIN batch_products x ON x.id = o.batch_product_id
          WHERE x.batch_id = b.id AND (o.status = ANY (ARRAY['payment_pending'::order_status, 'payment_submitted'::order_status, 'insufficient_payment'::order_status, 'payment_confirmed'::order_status, 'preparing'::order_status, 'completed'::order_status])))) + (( SELECT COALESCE(sum(c.quantity), 0::bigint) AS "coalesce"
           FROM group_order_commitments c
             JOIN group_orders g ON g.id = c.group_order_id
             JOIN batch_products x ON x.id = c.batch_product_id
          WHERE x.batch_id = b.id AND g.status = 'forming'::text AND public.group_formation_deadline(g.batch_id) > clock_timestamp())) AS batch_claimed,
    (( SELECT COALESCE(sum(o.quantity), 0::bigint) AS "coalesce"
           FROM orders o
          WHERE o.batch_product_id = bp.id AND (o.status = ANY (ARRAY['payment_pending'::order_status, 'payment_submitted'::order_status, 'insufficient_payment'::order_status, 'payment_confirmed'::order_status, 'preparing'::order_status, 'completed'::order_status])))) + (( SELECT COALESCE(sum(c.quantity), 0::bigint) AS "coalesce"
           FROM group_order_commitments c
             JOIN group_orders g ON g.id = c.group_order_id
          WHERE c.batch_product_id = bp.id AND g.status = 'forming'::text AND public.group_formation_deadline(g.batch_id) > clock_timestamp())) AS quantity_claimed,
    ( SELECT count(*) AS count
           FROM waitlist_entries w
          WHERE w.batch_product_id = bp.id AND w.status = 'waiting'::waitlist_status) AS waitlist_count,
    bp.limit_per_user,
    bp.waitlist_limit,
    b.gallery_paths AS batch_gallery_paths
   FROM batches b
     JOIN user_profiles seller ON seller.id = b.seller_id
     JOIN batch_products bp ON bp.batch_id = b.id
  WHERE b.status <> 'draft'::batch_status;
CREATE OR REPLACE FUNCTION public.leave_group_order(p_group_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare target public.group_orders;
begin
  select * into target from public.group_orders where id = p_group_order_id for update;
  if not found or target.status <> 'forming' then raise exception 'This group can no longer be changed'; end if;
  perform 1 from public.batches where id=target.batch_id for share;
  if public.group_formation_deadline(target.batch_id) <= clock_timestamp() then raise exception 'The batch deadline has passed'; end if;
  if target.leader_id = auth.uid() then
    insert into public.notifications (recipient_id, category, message, target_path, context)
    select user_id, 'x', 'The group leader cancelled this group order.', 'Batches', jsonb_build_object('group_order_id', target.id)
    from public.group_order_members where group_order_id = target.id and status = 'active' and user_id <> target.leader_id;
    update public.group_orders set status = 'cancelled', updated_at = now() where id = target.id;
  else
    update public.group_order_members set status = 'left'
      where group_order_id = target.id and user_id = auth.uid() and status = 'active';
    delete from public.group_order_commitments where group_order_id = target.id and user_id = auth.uid();
    insert into public.notifications (recipient_id, category, message, target_path, context)
    values (target.leader_id, 'users', 'A member left your group order.', 'Batches', jsonb_build_object('group_order_id', target.id));
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.remove_group_member(p_group_order_id uuid, p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare target public.group_orders;
begin
  select * into target from public.group_orders where id = p_group_order_id for update;
  if not found or target.leader_id <> auth.uid() or target.status <> 'forming' then raise exception 'Leader access required'; end if;
  perform 1 from public.batches where id=target.batch_id for share;
  if public.group_formation_deadline(target.batch_id) <= clock_timestamp() then raise exception 'The batch deadline has passed'; end if;
  if p_user_id = target.leader_id then raise exception 'The leader cannot remove themselves'; end if;
  update public.group_order_members set status = 'removed'
    where group_order_id = target.id and user_id = p_user_id and status = 'active';
  delete from public.group_order_commitments where group_order_id = target.id and user_id = p_user_id;
  insert into public.notifications (recipient_id, category, message, target_path, context)
  values (p_user_id, 'x', 'You were removed from a group order.', 'Batches', jsonb_build_object('group_order_id', target.id));
end;
$function$
;

CREATE OR REPLACE FUNCTION public.regenerate_group_code(p_group_order_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare new_code text;
begin
  new_code := public.generate_group_referral_code();
  update public.group_orders set referral_code = new_code, updated_at = now()
    where id = p_group_order_id and leader_id = auth.uid() and status = 'forming' and public.group_formation_deadline(batch_id) > clock_timestamp();
  if not found then raise exception 'Leader access required'; end if;
  return new_code;
end;
$function$
;

commit;
