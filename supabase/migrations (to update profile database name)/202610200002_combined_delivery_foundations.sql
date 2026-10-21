-- Phase 1 only. No buyer request, seller review, fee-setting, or payment RPC is
-- exposed. Existing reservations are never backfilled or automatically grouped.
begin;

create table public.delivery_destinations (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.user_profiles(id) on delete restrict,
  pin_lat double precision not null check (pin_lat between -90 and 90),
  pin_lng double precision not null check (pin_lng between -180 and 180),
  address_text text not null check (char_length(trim(address_text)) between 1 and 1000),
  confirmed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (id, buyer_id)
);

alter table public.orders add column delivery_destination_id uuid;
alter table public.orders add constraint orders_delivery_destination_owner_fk
  foreign key (delivery_destination_id, buyer_id)
  references public.delivery_destinations(id, buyer_id) on delete restrict;
create index orders_delivery_destination_idx on public.orders(delivery_destination_id)
  where delivery_destination_id is not null;

create table public.combined_delivery_groups (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.user_profiles(id) on delete restrict,
  seller_id uuid not null references public.user_profiles(id) on delete restrict,
  batch_id uuid not null references public.batches(id) on delete restrict,
  destination_id uuid not null,
  fulfillment_method text not null default 'delivery' check (fulfillment_method = 'delivery'),
  payment_method text not null check (char_length(trim(payment_method)) > 0),
  -- Payable states and shared payment links arrive in the payment integration
  -- migration. Until then, no record in this table can become payable.
  status text not null default 'pending_approval'
    check (status in ('pending_approval', 'rejected', 'cancelled', 'invalidated')),
  shipping_fee numeric(12,2) check (shipping_fee is null),
  decided_by uuid references public.user_profiles(id) on delete restrict,
  decision_reason text check (decision_reason is null or char_length(decision_reason) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (buyer_id <> seller_id),
  foreign key (destination_id, buyer_id)
    references public.delivery_destinations(id, buyer_id) on delete restrict
);
create index combined_delivery_buyer_idx on public.combined_delivery_groups(buyer_id, created_at desc);
create index combined_delivery_seller_idx on public.combined_delivery_groups(seller_id, created_at desc);

create table public.combined_delivery_members (
  group_id uuid not null references public.combined_delivery_groups(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  -- Immutable snapshots retain the original reservation budget and line amount.
  item_subtotal numeric(12,2) not null check (item_subtotal >= 0),
  original_expires_at timestamptz not null,
  original_paused_at timestamptz not null,
  joined_at timestamptz not null default now(),
  released_at timestamptz,
  primary key (group_id, order_id),
  check (original_expires_at > original_paused_at),
  check (released_at is null or released_at >= joined_at)
);
create unique index combined_delivery_one_active_group_per_order
  on public.combined_delivery_members(order_id) where released_at is null;

create table public.combined_delivery_events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.combined_delivery_groups(id) on delete restrict,
  actor_id uuid references public.user_profiles(id) on delete restrict,
  event_type text not null check (event_type in ('created', 'member_added', 'rejected', 'cancelled', 'invalidated')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index combined_delivery_events_group_idx on public.combined_delivery_events(group_id, created_at);

-- No string matching or geographic proximity establishes address identity.
-- Phase 2 must explicitly confirm and bind a buyer-owned destination snapshot.
create view public.combined_delivery_candidate_records as
select o.id, o.buyer_id, o.seller_id, bp.batch_id,
  o.delivery_destination_id as destination_id,
  coalesce(d.buyer_id = o.buyer_id and d.pin_lat = o.delivery_pin_lat
    and d.pin_lng = o.delivery_pin_lng and d.address_text = o.delivery_pin_address, false) as destination_matches,
  case when o.shipping_applies then 'delivery' else 'meetup' end as fulfillment_method,
  o.reserved_payment_method as payment_method, o.status::text as order_status,
  o.shipping_state, o.shipping_fee, o.shipping_fee_set_at is not null as shipping_fee_set,
  o.buyer_accepted_shipping_fee as shipping_accepted, o.deadline_paused_at,
  o.reservation_expires_at as expires_at, o.group_order_id,
  m.group_id as active_delivery_group_id,
  exists (select 1 from public.payments p where p.order_id = o.id) as has_payment_history,
  o.total_amount as item_subtotal
from public.orders o join public.batch_products bp on bp.id = o.batch_product_id
left join public.delivery_destinations d on d.id = o.delivery_destination_id
left join public.combined_delivery_members m on m.order_id = o.id and m.released_at is null;
revoke all on public.combined_delivery_candidate_records from public, anon, authenticated;

-- Strict V1 policy, centralized for request, membership and approval checks.
-- UUID parameters and real FK joins establish identity; names never participate.
create function public.combined_delivery_batch_reasons(p_order_ids uuid[], p_expected_batch_id uuid default null)
returns text[] language plpgsql security definer set search_path = '' as $$
declare reasons text[] := '{}'; expected_orders integer; valid_orders integer; batch_count integer;
begin
  select count(distinct id) into expected_orders from unnest(p_order_ids) as t(id);
  -- Stabilize the product -> batch relationship through the mutation transaction.
  perform 1 from public.orders o
    join public.batch_products bp on bp.id = o.batch_product_id
    join public.batches b on b.id = bp.batch_id
    where o.id = any(p_order_ids) order by b.id, bp.id for share of b, bp;
  select count(distinct o.id), count(distinct b.id) into valid_orders, batch_count
    from public.orders o join public.batch_products bp on bp.id = o.batch_product_id
    join public.batches b on b.id = bp.batch_id where o.id = any(p_order_ids);
  if expected_orders = 0 or valid_orders <> expected_orders
    or exists (select 1 from unnest(p_order_ids) as t(id) where id is null)
    or (p_expected_batch_id is not null and not exists (select 1 from public.batches where id = p_expected_batch_id)) then
    reasons := array_append(reasons, 'invalid_batch');
  end if;
  if batch_count > 1 or (p_expected_batch_id is not null and exists (
    select 1 from public.orders o join public.batch_products bp on bp.id = o.batch_product_id
    where o.id = any(p_order_ids) and bp.batch_id is distinct from p_expected_batch_id
  )) then reasons := array_append(reasons, 'different_batch'); end if;
  return reasons;
end;
$$;

create function public.combined_delivery_batch_feedback(p_reasons text[])
returns jsonb language sql immutable set search_path = '' as $$
  select to_jsonb(array_remove(array[
    case when 'invalid_batch' = any(p_reasons) then 'Each reservation must belong to a valid Pasabuy batch.' end,
    case when 'different_batch' = any(p_reasons) then 'Only reservations from the same Pasabuy batch can be combined.' end
  ], null));
$$;

-- Internal assertion for write boundaries. Never grant clients an override.
create function public.assert_combined_delivery_batch(p_order_ids uuid[], p_expected_batch_id uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare reasons text[];
begin
  reasons := public.combined_delivery_batch_reasons(p_order_ids, p_expected_batch_id);
  if cardinality(reasons) > 0 then
    raise exception using errcode = '22023',
      message = public.combined_delivery_batch_feedback(reasons)->>0,
      detail = array_to_string(reasons, ',');
  end if;
end;
$$;
revoke all on function public.combined_delivery_batch_reasons(uuid[], uuid),
  public.combined_delivery_batch_feedback(text[]), public.assert_combined_delivery_batch(uuid[], uuid)
  from public, anon, authenticated;

create function public.combined_delivery_order_reasons(p_order_id uuid, p_buyer_id uuid)
returns text[] language plpgsql security definer set search_path = '' as $$
declare r record; reasons text[] := '{}';
begin
  select * into r from public.combined_delivery_candidate_records where id = p_order_id;
  if not found or r.buyer_id is distinct from p_buyer_id then
    raise exception 'Reservation unavailable' using errcode = '42501';
  end if;
  if r.destination_id is null then reasons := array_append(reasons, 'unconfirmed_destination'); end if;
  if not r.destination_matches then reasons := array_append(reasons, 'destination_changed'); end if;
  if nullif(trim(r.payment_method), '') is null then reasons := array_append(reasons, 'different_payment_method'); end if;
  if r.fulfillment_method <> 'delivery' then reasons := array_append(reasons, 'not_delivery'); end if;
  if r.order_status <> 'payment_pending' then reasons := array_append(reasons, 'not_unpaid'); end if;
  if r.shipping_fee is not null or r.shipping_fee_set then reasons := array_append(reasons, 'shipping_finalized'); end if;
  if r.shipping_state is distinct from 'waiting_for_seller' then reasons := array_append(reasons, 'shipping_not_pending'); end if;
  if not r.shipping_accepted then reasons := array_append(reasons, 'shipping_not_accepted'); end if;
  if r.deadline_paused_at is null then reasons := array_append(reasons, 'not_paused'); end if;
  if r.deadline_paused_at is null or r.expires_at <= r.deadline_paused_at then reasons := array_append(reasons, 'deadline_exhausted'); end if;
  if r.group_order_id is not null or r.active_delivery_group_id is not null then reasons := array_append(reasons, 'already_grouped'); end if;
  if r.has_payment_history then reasons := array_append(reasons, 'payment_history'); end if;
  return reasons;
end;
$$;
revoke all on function public.combined_delivery_order_reasons(uuid, uuid) from public, anon, authenticated;

create function public.combined_delivery_candidates()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_active(auth.uid()) then
    raise exception 'Active buyer account required' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id', r.id, 'buyerId', r.buyer_id, 'sellerId', r.seller_id, 'batchId', r.batch_id,
    'destinationId', r.destination_id, 'destinationMatches', r.destination_matches,
    'fulfillmentMethod', r.fulfillment_method, 'paymentMethod', r.payment_method,
    'orderStatus', r.order_status, 'shippingState', r.shipping_state,
    'shippingFee', r.shipping_fee, 'shippingFeeSet', r.shipping_fee_set,
    'shippingAccepted', r.shipping_accepted, 'deadlinePausedAt', r.deadline_paused_at,
    'expiresAt', r.expires_at, 'groupOrderId', r.group_order_id,
    'activeDeliveryGroupId', r.active_delivery_group_id,
    'hasPaymentHistory', r.has_payment_history, 'itemSubtotal', r.item_subtotal
  ) order by r.id) from public.combined_delivery_candidate_records r
    where r.buyer_id = auth.uid() and r.order_status = 'payment_pending'
      and r.fulfillment_method = 'delivery'), '[]'::jsonb);
end;
$$;

create function public.combined_delivery_eligibility(p_order_ids uuid[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r record; first_order record; reasons text[] := '{}'; unique_count integer;
begin
  if auth.uid() is null or not public.is_active(auth.uid()) then
    raise exception 'Active buyer account required' using errcode = '42501';
  end if;
  if coalesce(cardinality(p_order_ids), 0) < 2 then reasons := array_append(reasons, 'at_least_two_reservations'); end if;
  select count(distinct id) into unique_count from unnest(p_order_ids) as t(id);
  if unique_count <> coalesce(cardinality(p_order_ids), 0) then reasons := array_append(reasons, 'duplicate_reservation'); end if;
  -- Lock in a consistent order. Future request/approval RPCs must re-use this
  -- validation inside the SAME transaction as creating/changing membership.
  perform 1 from public.orders where id = any(p_order_ids) and buyer_id = auth.uid() order by id for update;
  if (select count(*) from public.orders where id = any(p_order_ids) and buyer_id = auth.uid()) <> unique_count then
    raise exception 'Reservation unavailable' using errcode = '42501';
  end if;
  reasons := reasons || public.combined_delivery_batch_reasons(p_order_ids);
  select * into first_order from public.combined_delivery_candidate_records where id = any(p_order_ids) order by id limit 1;
  for r in select * from public.combined_delivery_candidate_records where id = any(p_order_ids) order by id loop
    reasons := reasons || public.combined_delivery_order_reasons(r.id, auth.uid());
    if r.seller_id <> first_order.seller_id then reasons := array_append(reasons, 'different_seller'); end if;
    if r.destination_id is distinct from first_order.destination_id then reasons := array_append(reasons, 'different_destination'); end if;
    if r.payment_method is distinct from first_order.payment_method then reasons := array_append(reasons, 'different_payment_method'); end if;
  end loop;
  select coalesce(array_agg(distinct reason order by reason), '{}'::text[]) into reasons from unnest(reasons) as t(reason);
  return jsonb_build_object('eligible', cardinality(reasons) = 0, 'reasons', to_jsonb(reasons), 'feedback', public.combined_delivery_batch_feedback(reasons));
end;
$$;
revoke all on function public.combined_delivery_candidates() from public, anon;
revoke all on function public.combined_delivery_eligibility(uuid[]) from public, anon;
grant execute on function public.combined_delivery_candidates(), public.combined_delivery_eligibility(uuid[]) to authenticated;

-- Server-written, immutable destination snapshots. No address backfill, client
-- write grant, or destination-confirmation RPC is enabled in this phase.
create function public.guard_delivery_destination_snapshot()
returns trigger language plpgsql set search_path = '' as $$
begin raise exception '% records are immutable', tg_table_name; end;
$$;
create trigger delivery_destinations_immutable before update or delete on public.delivery_destinations
  for each row execute function public.guard_delivery_destination_snapshot();
create trigger combined_delivery_events_immutable before update or delete on public.combined_delivery_events
  for each row execute function public.guard_delivery_destination_snapshot();

create function public.guard_combined_delivery_group()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then raise exception 'Delivery group history cannot be deleted'; end if;
  if tg_op = 'INSERT' then
    if new.status <> 'pending_approval' or not public.is_active(new.buyer_id) or not public.can_sell(new.seller_id) or not exists (
      select 1 from public.batches b where b.id = new.batch_id and b.seller_id = new.seller_id
    ) then raise exception 'Invalid delivery group context'; end if;
  else
    if (to_jsonb(new) - array['status', 'decided_by', 'decision_reason', 'updated_at'])
      is distinct from (to_jsonb(old) - array['status', 'decided_by', 'decision_reason', 'updated_at']) then
      raise exception 'Delivery group identity and financial fields are immutable';
    end if;
    -- Revalidate on nonterminal status changes (including future approval),
    -- before trusting a saved group header or a previous preview result.
    if new.status not in ('rejected', 'cancelled', 'invalidated') then
      perform public.assert_combined_delivery_batch(
        array(select order_id from public.combined_delivery_members where group_id = new.id and released_at is null order by order_id),
        new.batch_id
      );
    end if;
    if old.status <> 'pending_approval' then raise exception 'Delivery group is closed'; end if;
    if new.status not in ('pending_approval', 'rejected', 'cancelled', 'invalidated') then raise exception 'Invalid delivery transition'; end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger combined_delivery_groups_guard before insert or update or delete on public.combined_delivery_groups
  for each row execute function public.guard_combined_delivery_group();

create function public.guard_combined_delivery_member()
returns trigger language plpgsql security definer set search_path = '' as $$
declare g public.combined_delivery_groups; r record;
begin
  if tg_op = 'DELETE' then raise exception 'Delivery membership history cannot be deleted'; end if;
  if tg_op = 'UPDATE' then
    if (to_jsonb(new) - 'released_at') is distinct from (to_jsonb(old) - 'released_at')
      or old.released_at is not null or new.released_at is null
      or exists (select 1 from public.combined_delivery_groups where id = old.group_id and status = 'pending_approval') then
      raise exception 'Delivery membership is immutable while active';
    end if;
    return new;
  end if;
  -- The order lock serializes membership with individual fee/payment updates.
  perform 1 from public.orders where id = new.order_id for update;
  select * into g from public.combined_delivery_groups where id = new.group_id for update;
  if not found or g.status <> 'pending_approval' or new.released_at is not null then raise exception 'Delivery group is not accepting members'; end if;
  perform public.assert_combined_delivery_batch(array[new.order_id], g.batch_id);
  if cardinality(public.combined_delivery_order_reasons(new.order_id, g.buyer_id)) > 0 then raise exception 'Reservation is not eligible for combined delivery'; end if;
  select * into r from public.combined_delivery_candidate_records where id = new.order_id;
  if r.seller_id <> g.seller_id
    or r.destination_id is distinct from g.destination_id or r.payment_method is distinct from g.payment_method then
    raise exception 'Reservation does not match delivery group';
  end if;
  new.item_subtotal := r.item_subtotal;
  new.original_expires_at := r.expires_at;
  new.original_paused_at := r.deadline_paused_at;
  return new;
end;
$$;
create trigger combined_delivery_members_guard before insert or update or delete on public.combined_delivery_members
  for each row execute function public.guard_combined_delivery_member();

create function public.check_combined_delivery_member_count()
returns trigger language plpgsql security definer set search_path = '' as $$
declare group_key uuid;
begin
  if tg_table_name = 'combined_delivery_groups' then
    group_key := new.id;
  else
    group_key := new.group_id;
  end if;
  if (select count(*) from public.combined_delivery_members where group_id = group_key) < 2 then
    raise exception 'Combined delivery requires at least two reservations';
  end if;
  return null;
end;
$$;
create constraint trigger combined_delivery_groups_minimum_members after insert on public.combined_delivery_groups
  deferrable initially deferred for each row execute function public.check_combined_delivery_member_count();
create constraint trigger combined_delivery_members_minimum_members after insert on public.combined_delivery_members
  deferrable initially deferred for each row execute function public.check_combined_delivery_member_count();

create function public.audit_combined_delivery_group()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.combined_delivery_events(group_id, actor_id, event_type, details)
    values (new.id, auth.uid(), case when tg_op = 'INSERT' then 'created' else new.status end,
      jsonb_build_object('status', new.status, 'reason', new.decision_reason));
    if new.status <> 'pending_approval' then
      update public.combined_delivery_members set released_at = now() where group_id = new.id and released_at is null;
    end if;
  end if;
  return new;
end;
$$;
create trigger combined_delivery_groups_audit after insert or update on public.combined_delivery_groups
  for each row execute function public.audit_combined_delivery_group();
create function public.audit_combined_delivery_member()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.combined_delivery_events(group_id, actor_id, event_type, details)
  values (new.group_id, auth.uid(), 'member_added', jsonb_build_object('order_id', new.order_id));
  return new;
end;
$$;
create trigger combined_delivery_members_audit after insert on public.combined_delivery_members
  for each row execute function public.audit_combined_delivery_member();

create function public.guard_order_combined_delivery()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.combined_delivery_members where order_id = old.id and released_at is null)
    and (to_jsonb(new) - 'updated_at') is distinct from (to_jsonb(old) - 'updated_at') then
    raise exception 'Reservation is awaiting combined delivery review';
  end if;
  if new.delivery_destination_id is not null and not exists (
    select 1 from public.delivery_destinations d where d.id = new.delivery_destination_id
      and d.buyer_id = new.buyer_id and d.pin_lat = new.delivery_pin_lat
      and d.pin_lng = new.delivery_pin_lng and d.address_text = new.delivery_pin_address
  ) then
    if new.delivery_destination_id is distinct from old.delivery_destination_id then raise exception 'Destination does not match reservation'; end if;
    -- Existing correction RPCs continue working on ungrouped orders; they
    -- invalidate address confirmation rather than silently reusing an old ID.
    new.delivery_destination_id := null;
  end if;
  return new;
end;
$$;
create trigger orders_combined_delivery_guard before update on public.orders
  for each row execute function public.guard_order_combined_delivery();
create function public.guard_individual_combined_delivery_payment()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.orders where id = new.order_id for update;
  if exists (select 1 from public.combined_delivery_members where order_id = new.order_id and released_at is null) then
    raise exception 'Individual payment is blocked for an active combined delivery';
  end if;
  return new;
end;
$$;
create trigger payments_combined_delivery_guard before insert on public.payments
  for each row execute function public.guard_individual_combined_delivery_payment();

-- Participant-only reads. All writes require a future authenticated RPC.
alter table public.delivery_destinations enable row level security;
alter table public.combined_delivery_groups enable row level security;
alter table public.combined_delivery_members enable row level security;
alter table public.combined_delivery_events enable row level security;
create policy delivery_destinations_participant_read on public.delivery_destinations for select to authenticated using (
  buyer_id = auth.uid() or exists (select 1 from public.combined_delivery_groups g where g.destination_id = delivery_destinations.id and g.seller_id = auth.uid())
);
create policy combined_delivery_groups_participant_read on public.combined_delivery_groups for select to authenticated
  using (buyer_id = auth.uid() or seller_id = auth.uid());
create policy combined_delivery_members_participant_read on public.combined_delivery_members for select to authenticated
  using (exists (select 1 from public.combined_delivery_groups g where g.id = group_id));
create policy combined_delivery_events_participant_read on public.combined_delivery_events for select to authenticated
  using (exists (select 1 from public.combined_delivery_groups g where g.id = group_id));
revoke all on public.delivery_destinations, public.combined_delivery_groups, public.combined_delivery_members, public.combined_delivery_events from public, anon, authenticated;
grant select on public.delivery_destinations, public.combined_delivery_groups, public.combined_delivery_members, public.combined_delivery_events to authenticated;
-- Trigger helpers cannot be called directly by clients.
revoke all on function public.guard_delivery_destination_snapshot(), public.guard_combined_delivery_group(),
  public.guard_combined_delivery_member(), public.check_combined_delivery_member_count(),
  public.audit_combined_delivery_group(), public.audit_combined_delivery_member(),
  public.guard_order_combined_delivery(), public.guard_individual_combined_delivery_payment()
  from public, anon, authenticated;

commit;
