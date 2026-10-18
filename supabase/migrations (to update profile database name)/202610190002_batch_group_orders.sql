-- Batch-wide group orders with leader-only checkout and payment authority.

alter table public.batches
  add column if not exists group_orders_enabled boolean not null default false,
  add column if not exists group_discount_type text,
  add column if not exists group_discount_value numeric(12,2),
  add column if not exists group_discount_min_subtotal numeric(12,2);

alter table public.batches
  drop constraint if exists batches_group_discount_type_check,
  add constraint batches_group_discount_type_check check (
    group_discount_type is null or group_discount_type in ('percentage', 'fixed')
  ),
  drop constraint if exists batches_group_discount_value_check,
  add constraint batches_group_discount_value_check check (
    group_discount_value is null or group_discount_value > 0
  ),
  drop constraint if exists batches_group_discount_min_check,
  add constraint batches_group_discount_min_check check (
    group_discount_min_subtotal is null or group_discount_min_subtotal > 0
  );

alter table public.batch_products
  add column if not exists selling_unit text not null default 'piece',
  add column if not exists pieces_per_box integer;

alter table public.batch_products
  drop constraint if exists batch_products_selling_unit_check,
  add constraint batch_products_selling_unit_check check (selling_unit in ('piece', 'box')),
  drop constraint if exists batch_products_pieces_per_box_check,
  add constraint batch_products_pieces_per_box_check check (
    (selling_unit = 'piece' and pieces_per_box is null)
    or (selling_unit = 'box' and pieces_per_box is not null and pieces_per_box > 0)
  );

create table if not exists public.group_orders (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches(id) on delete cascade,
  leader_id uuid not null references public.user_profiles(id) on delete restrict,
  referral_code text not null unique,
  status text not null default 'forming' check (
    status in ('forming', 'waiting_for_seller', 'payment_pending',
               'payment_submitted', 'payment_confirmed', 'cancelled', 'expired')
  ),
  regular_subtotal numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  final_subtotal numeric(12,2) not null default 0,
  reserved_payment_method text,
  shipping_applies boolean not null default false,
  shipping_state text check (
    shipping_state is null or shipping_state in ('waiting_for_seller', 'correction_requested', 'fee_set', 'declined')
  ),
  shipping_fee numeric(12,2) check (shipping_fee is null or shipping_fee >= 0),
  delivery_pin_lat double precision,
  delivery_pin_lng double precision,
  delivery_pin_url text,
  delivery_pin_address text,
  acknowledged_by_leader boolean not null default false,
  formation_deadline timestamptz not null,
  payment_deadline timestamptz,
  checked_out_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.group_order_members (
  id uuid primary key default gen_random_uuid(),
  group_order_id uuid not null references public.group_orders(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete restrict,
  role text not null check (role in ('leader', 'member')),
  status text not null default 'active' check (status in ('active', 'left', 'removed')),
  joined_at timestamptz not null default now(),
  unique (group_order_id, user_id)
);

create table if not exists public.group_order_commitments (
  id uuid primary key default gen_random_uuid(),
  group_order_id uuid not null references public.group_orders(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete restrict,
  batch_product_id uuid not null references public.batch_products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_selling_price numeric(12,2) not null check (unit_selling_price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_order_id, user_id, batch_product_id)
);

alter table public.orders
  add column if not exists group_order_id uuid references public.group_orders(id) on delete restrict;

alter table public.group_orders
  add column if not exists payment_order_id uuid references public.orders(id) on delete set null;

create index if not exists group_orders_batch_idx on public.group_orders(batch_id);
create index if not exists group_orders_leader_idx on public.group_orders(leader_id);
create index if not exists group_members_user_idx on public.group_order_members(user_id, status);
create index if not exists group_commitments_product_idx on public.group_order_commitments(batch_product_id);
create index if not exists orders_group_order_idx on public.orders(group_order_id);

alter table public.group_orders enable row level security;
alter table public.group_order_members enable row level security;
alter table public.group_order_commitments enable row level security;

create or replace function public.can_view_group_order(p_group_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.group_orders g
    join public.batches b on b.id = g.batch_id
    where g.id = p_group_id
      and (
        g.leader_id = auth.uid()
        or b.seller_id = auth.uid()
        or exists (
          select 1 from public.group_order_members m
          where m.group_order_id = g.id and m.user_id = auth.uid() and m.status = 'active'
        )
      )
  );
$$;

revoke all on function public.can_view_group_order(uuid) from public;
grant execute on function public.can_view_group_order(uuid) to authenticated;

drop policy if exists group_orders_select_participant on public.group_orders;
create policy group_orders_select_participant on public.group_orders for select to authenticated
  using (public.can_view_group_order(id));

drop policy if exists group_members_select_participant on public.group_order_members;
create policy group_members_select_participant on public.group_order_members for select to authenticated
  using (public.can_view_group_order(group_order_id));

drop policy if exists group_commitments_select_participant on public.group_order_commitments;
create policy group_commitments_select_participant on public.group_order_commitments for select to authenticated
  using (public.can_view_group_order(group_order_id));

grant select on public.group_orders, public.group_order_members, public.group_order_commitments to authenticated;

create or replace function public.generate_group_referral_code()
returns text language plpgsql volatile security definer set search_path = '' as $$
declare
  candidate text;
begin
  loop
    candidate := upper(substr(encode(extensions.gen_random_bytes(8), 'hex'), 1, 8));
    exit when not exists (select 1 from public.group_orders where referral_code = candidate);
  end loop;
  return candidate;
end;
$$;

create or replace function public.start_group_order(p_batch_id uuid)
returns public.group_orders language plpgsql security definer set search_path = '' as $$
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
  if current_date > target_batch.ends_on then raise exception 'This batch has already closed'; end if;
  if exists (
    select 1 from public.group_order_members m
    join public.group_orders g on g.id = m.group_order_id
    where m.user_id = auth.uid() and m.status = 'active'
      and g.batch_id = p_batch_id and g.status in ('forming', 'waiting_for_seller', 'payment_pending', 'payment_submitted')
  ) then raise exception 'You already belong to an active group for this batch'; end if;

  insert into public.group_orders (batch_id, leader_id, referral_code, formation_deadline)
  values (
    p_batch_id, auth.uid(), public.generate_group_referral_code(),
    (target_batch.ends_on::timestamp + interval '1 day' - interval '1 second') at time zone 'Asia/Manila'
  ) returning * into result;

  insert into public.group_order_members (group_order_id, user_id, role)
  values (result.id, auth.uid(), 'leader');
  return result;
end;
$$;

create or replace function public.join_group_order(p_referral_code text)
returns public.group_orders language plpgsql security definer set search_path = '' as $$
declare
  result public.group_orders;
  target_batch public.batches;
begin
  if auth.uid() is null or not public.is_active(auth.uid()) then raise exception 'Active account required'; end if;
  if public.can_sell(auth.uid()) then raise exception 'Seller accounts cannot join group orders'; end if;
  select * into result from public.group_orders
    where referral_code = upper(trim(p_referral_code)) and status = 'forming' for update;
  if not found or result.formation_deadline <= now() then raise exception 'This group code is invalid or expired'; end if;
  select * into target_batch from public.batches where id = result.batch_id;
  if target_batch.status <> 'live' then raise exception 'This batch is not accepting orders'; end if;
  if exists (
    select 1 from public.group_order_members m
    join public.group_orders g on g.id = m.group_order_id
    where m.user_id = auth.uid() and m.status = 'active'
      and g.batch_id = result.batch_id and g.id <> result.id
      and g.status in ('forming', 'waiting_for_seller', 'payment_pending', 'payment_submitted')
  ) then raise exception 'You already belong to another active group for this batch'; end if;

  insert into public.group_order_members (group_order_id, user_id, role, status)
  values (result.id, auth.uid(), 'member', 'active')
  on conflict (group_order_id, user_id) do update set status = 'active', joined_at = now();
  insert into public.notifications (recipient_id, category, message, target_path, context)
  values (result.leader_id, 'users', 'A member joined your group order.', 'Batches', jsonb_build_object('group_order_id', result.id));
  return result;
end;
$$;

create or replace function public.set_group_commitment(
  p_group_order_id uuid,
  p_batch_product_id uuid,
  p_quantity integer
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  target_group public.group_orders;
  product public.batch_products;
  active_reserved integer;
  own_reserved integer;
  solo_claimed integer;
begin
  if p_quantity <= 0 then raise exception 'Quantity must be positive'; end if;
  select * into target_group from public.group_orders where id = p_group_order_id for update;
  if not found or target_group.status <> 'forming' or target_group.formation_deadline <= now() then
    raise exception 'This group is no longer accepting commitments';
  end if;
  if not exists (
    select 1 from public.group_order_members where group_order_id = target_group.id
      and user_id = auth.uid() and status = 'active'
  ) then raise exception 'Active group membership required'; end if;
  select * into product from public.batch_products
    where id = p_batch_product_id and batch_id = target_group.batch_id for update;
  if not found or product.is_locked then raise exception 'Product is not available'; end if;

  select coalesce(sum(o.quantity), 0)::integer into active_reserved
  from public.orders o where o.batch_product_id = product.id
    and o.status in ('payment_pending', 'payment_submitted', 'insufficient_payment', 'payment_confirmed', 'preparing', 'completed');
  select coalesce(sum(c.quantity), 0)::integer into active_reserved
  from public.group_order_commitments c
  join public.group_orders g on g.id = c.group_order_id
  where c.batch_product_id = product.id and g.status = 'forming'
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
      where c.batch_product_id = product.id and c.user_id = auth.uid() and g.status = 'forming'
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
end;
$$;

create or replace function public.leave_group_order(p_group_order_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare target public.group_orders;
begin
  select * into target from public.group_orders where id = p_group_order_id for update;
  if not found or target.status <> 'forming' then raise exception 'This group can no longer be changed'; end if;
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
$$;

create or replace function public.remove_group_member(p_group_order_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare target public.group_orders;
begin
  select * into target from public.group_orders where id = p_group_order_id for update;
  if not found or target.leader_id <> auth.uid() or target.status <> 'forming' then raise exception 'Leader access required'; end if;
  if p_user_id = target.leader_id then raise exception 'The leader cannot remove themselves'; end if;
  update public.group_order_members set status = 'removed'
    where group_order_id = target.id and user_id = p_user_id and status = 'active';
  delete from public.group_order_commitments where group_order_id = target.id and user_id = p_user_id;
  insert into public.notifications (recipient_id, category, message, target_path, context)
  values (p_user_id, 'x', 'You were removed from a group order.', 'Batches', jsonb_build_object('group_order_id', target.id));
end;
$$;

create or replace function public.regenerate_group_code(p_group_order_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare new_code text;
begin
  new_code := public.generate_group_referral_code();
  update public.group_orders set referral_code = new_code, updated_at = now()
    where id = p_group_order_id and leader_id = auth.uid() and status = 'forming';
  if not found then raise exception 'Leader access required'; end if;
  return new_code;
end;
$$;

create or replace function public.checkout_group_order(
  p_group_order_id uuid,
  p_payment_method text,
  p_pin_lat double precision,
  p_pin_lng double precision,
  p_pin_url text,
  p_pin_address text,
  p_accept_shipping boolean,
  p_acknowledged boolean
)
returns public.group_orders language plpgsql security definer set search_path = '' as $$
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
  if target.formation_deadline <= now() then raise exception 'The batch deadline has passed'; end if;
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
$$;

create or replace function public.set_group_order_shipping_fee(p_group_order_id uuid, p_fee numeric)
returns void language plpgsql security definer set search_path = '' as $$
declare target public.group_orders; target_batch public.batches;
begin
  if p_fee < 0 then raise exception 'Shipping fee cannot be negative'; end if;
  select * into target from public.group_orders where id = p_group_order_id for update;
  select * into target_batch from public.batches where id = target.batch_id;
  if not found or target_batch.seller_id <> auth.uid() or not public.can_sell(auth.uid()) then raise exception 'Seller access required'; end if;
  if target.status <> 'waiting_for_seller' then raise exception 'This group order is not waiting for a shipping fee'; end if;
  update public.group_orders set status = 'payment_pending', shipping_state = 'fee_set', shipping_fee = p_fee,
    payment_deadline = now() + make_interval(hours => target_batch.reservation_hours), updated_at = now()
    where id = target.id;
  update public.orders set shipping_state = 'fee_set', shipping_fee = p_fee, deadline_paused_at = null,
    reservation_expires_at = now() + make_interval(hours => target_batch.reservation_hours)
    where id = target.payment_order_id;
end;
$$;

create or replace function public.request_group_location_correction(p_group_order_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare target public.group_orders; target_batch public.batches;
begin
  select * into target from public.group_orders where id = p_group_order_id for update;
  select * into target_batch from public.batches where id = target.batch_id;
  if not found or target_batch.seller_id <> auth.uid() then raise exception 'Seller access required'; end if;
  if target.status <> 'waiting_for_seller' then raise exception 'This group order is not awaiting delivery review'; end if;
  update public.group_orders set shipping_state = 'correction_requested', updated_at = now() where id = target.id;
  update public.orders set shipping_state = 'correction_requested' where id = target.payment_order_id;
  insert into public.notifications (recipient_id, category, message, target_path, context)
  values (target.leader_id, 'location', 'The seller requested a delivery location correction for your group order.', 'My Claims', jsonb_build_object('group_order_id', target.id));
end;
$$;

create or replace function public.update_group_delivery_pin(
  p_group_order_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_url text,
  p_address text
)
returns void language plpgsql security definer set search_path = '' as $$
declare target public.group_orders;
begin
  select * into target from public.group_orders where id = p_group_order_id and leader_id = auth.uid() for update;
  if not found then raise exception 'Group leader access required'; end if;
  if target.status <> 'waiting_for_seller' or target.shipping_state <> 'correction_requested' then raise exception 'A correction was not requested'; end if;
  if p_lat is null and p_lng is null and nullif(trim(p_url), '') is null then raise exception 'Delivery location required'; end if;
  update public.group_orders set delivery_pin_lat = p_lat, delivery_pin_lng = p_lng,
    delivery_pin_url = nullif(trim(p_url), ''), delivery_pin_address = nullif(trim(p_address), ''),
    shipping_state = 'waiting_for_seller', updated_at = now() where id = target.id;
  update public.orders set delivery_pin_lat = p_lat, delivery_pin_lng = p_lng,
    delivery_pin_url = nullif(trim(p_url), ''), delivery_pin_address = nullif(trim(p_address), ''),
    delivery_pin_updated_at = now(), shipping_state = 'waiting_for_seller' where id = target.payment_order_id;
end;
$$;

create or replace function public.decline_group_delivery_order(p_group_order_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare target public.group_orders; target_batch public.batches;
begin
  select * into target from public.group_orders where id = p_group_order_id for update;
  select * into target_batch from public.batches where id = target.batch_id;
  if not found or target_batch.seller_id <> auth.uid() then raise exception 'Seller access required'; end if;
  if target.status <> 'waiting_for_seller' then raise exception 'This group order cannot be declined'; end if;
  update public.group_orders set status = 'cancelled', shipping_state = 'declined', updated_at = now() where id = target.id;
  update public.orders set status = 'cancelled', shipping_state = 'declined', decline_reason = nullif(trim(p_reason), '') where group_order_id = target.id;
  insert into public.notifications (recipient_id, category, message, target_path, context)
  values (target.leader_id, 'x', 'The seller declined the group delivery order.', 'My Claims', jsonb_build_object('group_order_id', target.id));
end;
$$;

create or replace function public.submit_group_order_payment(
  p_group_order_id uuid,
  p_method_type text,
  p_amount numeric,
  p_reference_number text,
  p_receipt_path text,
  p_payer_account_name text,
  p_payer_phone text,
  p_buyer_contact_url text
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare target public.group_orders; result public.payments;
begin
  select * into target from public.group_orders where id = p_group_order_id and leader_id = auth.uid() for update;
  if not found then raise exception 'Group order not found'; end if;
  if target.status not in ('payment_pending') then return jsonb_build_object('accepted', false, 'error', 'Group order is not payable'); end if;
  if target.payment_deadline is null or target.payment_deadline <= now() then
    update public.group_orders set status = 'expired', updated_at = now() where id = target.id;
    update public.orders set status = 'expired' where group_order_id = target.id;
    return jsonb_build_object('accepted', false, 'error', 'Payment deadline has expired');
  end if;
  if lower(trim(p_method_type)) <> lower(target.reserved_payment_method) then
    return jsonb_build_object('accepted', false, 'error', 'Use the payment method selected at checkout');
  end if;
  insert into public.payments (
    order_id, submitted_by, method_type, amount, reference_number, receipt_path,
    payer_account_name, payer_phone, buyer_contact_url
  ) values (
    target.payment_order_id, auth.uid(), target.reserved_payment_method, p_amount,
    nullif(trim(p_reference_number), ''), p_receipt_path,
    nullif(trim(p_payer_account_name), ''), nullif(trim(p_payer_phone), ''), nullif(trim(p_buyer_contact_url), '')
  ) returning * into result;
  update public.group_orders set status = 'payment_submitted', updated_at = now() where id = target.id;
  update public.orders set status = 'payment_submitted' where group_order_id = target.id;
  return jsonb_build_object('accepted', true, 'payment', to_jsonb(result));
end;
$$;

create or replace function public.review_group_order_payment(
  p_payment_id uuid,
  p_decision public.payment_status,
  p_reason text,
  p_deadline_hours numeric
)
returns void language plpgsql security definer set search_path = '' as $$
declare payment public.payments; target public.group_orders; target_batch public.batches; total_paid numeric; amount_due numeric; deadline_at timestamptz;
begin
  select * into payment from public.payments where id = p_payment_id for update;
  if not found then raise exception 'Payment not found'; end if;
  select g.* into target from public.group_orders g where g.payment_order_id = payment.order_id for update;
  if not found then raise exception 'Group order not found'; end if;
  select * into target_batch from public.batches where id = target.batch_id;
  if target_batch.seller_id <> auth.uid() or not public.can_sell(auth.uid()) then raise exception 'Seller access required'; end if;
  if p_decision = 'rejected' then
    if p_deadline_hours is null or p_deadline_hours <= 0 then raise exception 'A resubmission deadline is required'; end if;
    deadline_at := now() + p_deadline_hours * interval '1 hour';
  end if;
  update public.payments set status = p_decision,
    rejection_reason = case when p_decision = 'rejected' then nullif(trim(p_reason), '') end,
    rejection_deadline = case when p_decision = 'rejected' then deadline_at end,
    reviewed_at = now(), reviewed_by = auth.uid() where id = payment.id;
  if p_decision = 'verified' then
    select coalesce(sum(amount), 0) into total_paid from public.payments
      where order_id = target.payment_order_id and status = 'verified';
    amount_due := target.final_subtotal + coalesce(target.shipping_fee, 0);
    update public.group_orders set status = case when total_paid >= amount_due then 'payment_confirmed' else 'payment_pending' end,
      updated_at = now() where id = target.id;
    update public.orders set status = case when total_paid >= amount_due then 'payment_confirmed'::public.order_status else 'insufficient_payment'::public.order_status end,
      payment_confirmed_at = case when total_paid >= amount_due then now() end where group_order_id = target.id;
    if total_paid >= amount_due then
      insert into public.notifications (recipient_id, category, message, target_path, context)
      select user_id, 'check', 'Payment was confirmed for your group order.', 'Orders', jsonb_build_object('group_order_id', target.id)
      from public.group_order_members where group_order_id = target.id and status = 'active';
    end if;
  else
    update public.group_orders set status = 'payment_pending', payment_deadline = deadline_at, updated_at = now() where id = target.id;
    update public.orders set status = 'payment_pending', reservation_expires_at = deadline_at where group_order_id = target.id;
  end if;
end;
$$;

revoke all on function public.generate_group_referral_code() from public, authenticated;
revoke all on function public.start_group_order(uuid) from public;
revoke all on function public.join_group_order(text) from public;
revoke all on function public.set_group_commitment(uuid, uuid, integer) from public;
revoke all on function public.leave_group_order(uuid) from public;
revoke all on function public.remove_group_member(uuid, uuid) from public;
revoke all on function public.regenerate_group_code(uuid) from public;
revoke all on function public.checkout_group_order(uuid, text, double precision, double precision, text, text, boolean, boolean) from public;
revoke all on function public.set_group_order_shipping_fee(uuid, numeric) from public;
revoke all on function public.request_group_location_correction(uuid) from public;
revoke all on function public.update_group_delivery_pin(uuid, double precision, double precision, text, text) from public;
revoke all on function public.decline_group_delivery_order(uuid, text) from public;
revoke all on function public.submit_group_order_payment(uuid, text, numeric, text, text, text, text, text) from public;
revoke all on function public.review_group_order_payment(uuid, public.payment_status, text, numeric) from public;

grant execute on function public.start_group_order(uuid) to authenticated;
grant execute on function public.join_group_order(text) to authenticated;
grant execute on function public.set_group_commitment(uuid, uuid, integer) to authenticated;
grant execute on function public.leave_group_order(uuid) to authenticated;
grant execute on function public.remove_group_member(uuid, uuid) to authenticated;
grant execute on function public.regenerate_group_code(uuid) to authenticated;
grant execute on function public.checkout_group_order(uuid, text, double precision, double precision, text, text, boolean, boolean) to authenticated;
grant execute on function public.set_group_order_shipping_fee(uuid, numeric) to authenticated;
grant execute on function public.request_group_location_correction(uuid) to authenticated;
grant execute on function public.update_group_delivery_pin(uuid, double precision, double precision, text, text) to authenticated;
grant execute on function public.decline_group_delivery_order(uuid, text) to authenticated;
grant execute on function public.submit_group_order_payment(uuid, text, numeric, text, text, text, text, text) to authenticated;
grant execute on function public.review_group_order_payment(uuid, public.payment_status, text, numeric) to authenticated;

drop view if exists public.batch_catalog;
create view public.batch_catalog with (security_barrier = true) as
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
  (select coalesce(sum(x.quantity_total), 0) from public.batch_products x where x.batch_id = b.id) as batch_total_items,
  ((select coalesce(sum(o.quantity), 0) from public.orders o join public.batch_products x on x.id = o.batch_product_id
    where x.batch_id = b.id and o.status in ('payment_pending', 'payment_submitted', 'insufficient_payment', 'payment_confirmed', 'preparing', 'completed'))
   + (select coalesce(sum(c.quantity), 0) from public.group_order_commitments c
      join public.group_orders g on g.id = c.group_order_id
      join public.batch_products x on x.id = c.batch_product_id
      where x.batch_id = b.id and g.status = 'forming')) as batch_claimed,
  ((select coalesce(sum(o.quantity), 0) from public.orders o where o.batch_product_id = bp.id
    and o.status in ('payment_pending', 'payment_submitted', 'insufficient_payment', 'payment_confirmed', 'preparing', 'completed'))
   + (select coalesce(sum(c.quantity), 0) from public.group_order_commitments c
      join public.group_orders g on g.id = c.group_order_id
      where c.batch_product_id = bp.id and g.status = 'forming')) as quantity_claimed,
  (select count(*) from public.waitlist_entries w where w.batch_product_id = bp.id and w.status = 'waiting') as waitlist_count,
  bp.limit_per_user,
  bp.waitlist_limit
from public.batches b
join public.user_profiles seller on seller.id = b.seller_id
join public.batch_products bp on bp.batch_id = b.id
where b.status <> 'draft';

grant select on public.batch_catalog to authenticated;

create or replace function public.prevent_started_batch_rule_changes()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (
    old.group_orders_enabled is distinct from new.group_orders_enabled
    or old.group_discount_type is distinct from new.group_discount_type
    or old.group_discount_value is distinct from new.group_discount_value
    or old.group_discount_min_subtotal is distinct from new.group_discount_min_subtotal
  ) and (
    exists (
      select 1 from public.orders o join public.batch_products bp on bp.id = o.batch_product_id
      where bp.batch_id = old.id and o.status not in ('expired', 'cancelled')
    )
    or exists (
      select 1 from public.group_order_commitments c join public.group_orders g on g.id = c.group_order_id
      where g.batch_id = old.id and g.status not in ('cancelled', 'expired')
    )
  ) then raise exception 'Selling and group-order settings are locked after the first claim or commitment';
  end if;
  return new;
end;
$$;

drop trigger if exists lock_started_batch_rules on public.batches;
create trigger lock_started_batch_rules before update on public.batches
for each row execute function public.prevent_started_batch_rule_changes();

create or replace function public.prevent_started_product_unit_changes()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (
    old.selling_unit is distinct from new.selling_unit
    or old.pieces_per_box is distinct from new.pieces_per_box
  ) and (
    exists (select 1 from public.orders o where o.batch_product_id = old.id and o.status not in ('expired', 'cancelled'))
    or exists (
      select 1 from public.group_order_commitments c join public.group_orders g on g.id = c.group_order_id
      where c.batch_product_id = old.id and g.status not in ('cancelled', 'expired')
    )
  ) then raise exception 'Selling unit is locked after the first claim or commitment';
  end if;
  return new;
end;
$$;

drop trigger if exists lock_started_product_units on public.batch_products;
create trigger lock_started_product_units before update on public.batch_products
for each row execute function public.prevent_started_product_unit_changes();

create or replace function public.enforce_group_aware_order_inventory()
returns trigger language plpgsql set search_path = '' as $$
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
    where c.batch_product_id = product.id and g.status = 'forming'
      and (new.group_order_id is null or g.id <> new.group_order_id);
  if ordered + committed + new.quantity > product.quantity_total then raise exception 'Insufficient inventory'; end if;

  if new.group_order_id is null and product.limit_per_user is not null then
    select coalesce(sum(quantity), 0)::integer into buyer_ordered from public.orders
      where batch_product_id = product.id and buyer_id = new.buyer_id
        and status in ('payment_pending', 'payment_submitted', 'insufficient_payment', 'payment_confirmed', 'preparing', 'completed');
    select coalesce(sum(c.quantity), 0)::integer into buyer_committed
      from public.group_order_commitments c join public.group_orders g on g.id = c.group_order_id
      where c.batch_product_id = product.id and c.user_id = new.buyer_id and g.status = 'forming';
    if buyer_ordered + buyer_committed + new.quantity > product.limit_per_user then
      raise exception 'Per-buyer limit of % reached for this item', product.limit_per_user;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists group_aware_order_inventory on public.orders;
create trigger group_aware_order_inventory before insert on public.orders
for each row execute function public.enforce_group_aware_order_inventory();
