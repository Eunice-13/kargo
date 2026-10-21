-- Run after Phase 1 + Phase 2 migrations against local Supabase. Everything rolls back.
-- psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/combined_delivery_buyer_requests.sql
begin;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
select ('61000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  'authenticated', 'authenticated', 'combined-delivery-' || n || '@kargo.test', '', now(), now(), now()
from generate_series(1, 4) n;
update public.user_profiles set can_sell = true
where id in ('61000000-0000-0000-0000-000000000002', '61000000-0000-0000-0000-000000000004');

insert into public.batches(id, seller_id, title, status, starts_on, ends_on, category, reservation_hours)
values
  ('62000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000002', 'Combined test batch', 'live', current_date, current_date + 7, 'Food', 24),
  ('62000000-0000-0000-0000-000000000002', '61000000-0000-0000-0000-000000000002', 'Combined test batch', 'live', current_date, current_date + 7, 'Food', 24);
insert into public.batch_products(id, batch_id, name, base_price, markup, quantity_total)
values
  ('63000000-0000-0000-0000-000000000001', '62000000-0000-0000-0000-000000000001', 'Combined item A', 500, 50, 20),
  ('63000000-0000-0000-0000-000000000002', '62000000-0000-0000-0000-000000000001', 'Combined item B', 350, 50, 20),
  ('63000000-0000-0000-0000-000000000003', '62000000-0000-0000-0000-000000000002', 'Other batch item', 350, 50, 20);
insert into public.delivery_destinations(id, buyer_id, pin_lat, pin_lng, address_text)
values
  ('64000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000001', 14.6, 121.0, 'Unit 1, Test address'),
  ('64000000-0000-0000-0000-000000000002', '61000000-0000-0000-0000-000000000001', 14.7, 121.1, 'Unit 2, Test address');
insert into public.orders(id, order_number, batch_product_id, buyer_id, seller_id, quantity,
  unit_base_price, unit_selling_price, reservation_expires_at, reserved_payment_method,
  shipping_applies, buyer_accepted_shipping_fee, shipping_state, delivery_pin_lat,
  delivery_pin_lng, delivery_pin_address, deadline_paused_at, delivery_destination_id)
select ('65000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid, 'COMBINED-TEST-' || n,
  case when n = 1 then '63000000-0000-0000-0000-000000000001'::uuid else '63000000-0000-0000-0000-000000000002'::uuid end,
  '61000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000002', 1,
  case when n = 1 then 500 else 350 end, case when n = 1 then 550 else 400 end,
  now() - interval '1 day', 'GCash', true, true, 'waiting_for_seller', 14.6, 121.0,
  'Unit 1, Test address', now() - interval '2 days', '64000000-0000-0000-0000-000000000001'
from generate_series(1, 3) n;
select set_config('request.jwt.claim.sub', '61000000-0000-0000-0000-000000000001', true);

-- Existing independent reservations have no canonical destination reference.
update public.orders set delivery_destination_id = null where id::text like '65000000-%';

do $$
declare result jsonb;
begin
  result := public.combined_delivery_request_candidates();
  if jsonb_array_length(result) <> 3 or not (result->0 ?& array['product','qty','batchName','sellerName','pinLat','pinLng','addressText']) then
    raise exception 'Buyer confirmation projection is incomplete';
  end if;
  if exists(select 1 from public.combined_delivery_groups) then raise exception 'Reading candidates created a request'; end if;
  if exists(select 1 from public.orders where id::text like '65000000-%' and delivery_destination_id is not null) then raise exception 'Reading candidates silently confirmed destinations'; end if;
  begin
    perform public.request_combined_delivery(array['65000000-0000-0000-0000-000000000001'::uuid,'65000000-0000-0000-0000-000000000002'::uuid],14.6,121,'Unit 1, Test address',false);
    raise exception using errcode = 'ZX002', message = 'Unconfirmed request accepted';
  exception when invalid_parameter_value then
    if sqlerrm <> 'Confirm the shared delivery destination before requesting combined delivery' then raise; end if;
  end;
end;
$$;

-- Subtransactions prove rejected requests leave no partial group, destination,
-- membership, notification, fee, timer reset, or inventory allocation changes.
do $$
declare scenario record; ids uuid[] := array['65000000-0000-0000-0000-000000000001'::uuid,'65000000-0000-0000-0000-000000000002'::uuid];
begin
  for scenario in select * from (values
    ('different batch', 'batch_product_id = ''63000000-0000-0000-0000-000000000003'''),
    ('different seller', 'seller_id = ''61000000-0000-0000-0000-000000000004'''),
    ('different buyer', 'buyer_id = ''61000000-0000-0000-0000-000000000003'''),
    ('different payment method', 'reserved_payment_method = ''Maya'''),
    ('different unit at same pin', 'delivery_pin_address = ''Unit 2, Test address'''),
    ('different pin at same address', 'delivery_pin_lat = 14.60001'),
    ('URL-only destination', 'delivery_pin_lat = null'),
    ('shipping finalized at zero', 'shipping_fee = 0'),
    ('paid', 'status = ''payment_confirmed'''),
    ('submitted', 'status = ''payment_submitted'''),
    ('expired', 'status = ''expired'''),
    ('cancelled', 'status = ''cancelled'''),
    ('location correction', 'shipping_state = ''correction_requested'''),
    ('unpaused', 'deadline_paused_at = null'),
    ('budget exhausted', 'reservation_expires_at = deadline_paused_at')
  ) as cases(label, changes) loop
    begin
      execute 'update public.orders set ' || scenario.changes || ' where id = ''65000000-0000-0000-0000-000000000002''';
      perform public.request_combined_delivery(ids,14.6,121,'Unit 1, Test address',true);
      raise exception using errcode = 'ZX002', message = 'Ineligible case accepted: ' || scenario.label;
    exception when invalid_parameter_value or insufficient_privilege then null;
    end;
  end loop;
  begin
    update public.orders set reservation_expires_at = now() + interval '1 day' where id = ids[2];
    insert into public.payments(order_id,submitted_by,method_type,amount,status) values(ids[2],auth.uid(),'GCash',400,'rejected');
    perform public.request_combined_delivery(ids,14.6,121,'Unit 1, Test address',true);
    raise exception using errcode = 'ZX002', message = 'Reservation with payment history accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    -- Failure after the destination is inserted/bound must undo that binding.
    update public.user_profiles set can_sell = false where id = '61000000-0000-0000-0000-000000000002';
    perform public.request_combined_delivery(ids,14.6,121,'Unit 1, Test address',true);
    raise exception using errcode = 'ZX002', message = 'Inactive seller context accepted';
  exception when raise_exception then
    if sqlerrm <> 'Invalid delivery group context' then raise; end if;
  end;
  if exists(select 1 from public.combined_delivery_groups)
    or exists(select 1 from public.combined_delivery_members)
    or exists(select 1 from public.combined_delivery_events)
    or exists(select 1 from public.notifications where dedupe_key like 'combined_delivery_requested_%')
    or (select count(*) from public.delivery_destinations) <> 2
    or exists(select 1 from public.orders where id = any(ids) and delivery_destination_id is not null) then
    raise exception 'Rejected request left partial writes';
  end if;
end;
$$;

-- A real authenticated buyer can invoke the RPC without direct table writes.
set local role authenticated;
do $$
declare target public.combined_delivery_groups; retry public.combined_delivery_groups; ids uuid[] := array['65000000-0000-0000-0000-000000000001'::uuid,'65000000-0000-0000-0000-000000000002'::uuid];
begin
  target := public.request_combined_delivery(ids,14.6,121,'Unit 1, Test address',true);
  retry := public.request_combined_delivery(array[ids[2],ids[1]],14.6,121,'Unit 1, Test address',true);
  if target.id <> retry.id or target.status <> 'pending_approval' or target.shipping_fee is not null then raise exception 'Request retry or initial state is incorrect'; end if;
  if (select count(*) from public.combined_delivery_members where group_id = target.id and released_at is null) <> 2 then raise exception 'Individual membership records missing'; end if;
  begin
    perform public.request_combined_delivery(array[ids[2],'65000000-0000-0000-0000-000000000003'::uuid],14.6,121,'Unit 1, Test address',true);
    raise exception using errcode = 'ZX002', message = 'Overlapping request accepted';
  exception when invalid_parameter_value then
    if sqlerrm <> 'One or more reservations already have a combined delivery request' then raise; end if;
  end;
end;
$$;
reset role;
set constraints all immediate;
set constraints all deferred;
do $$
begin
  if (select count(*) from public.combined_delivery_groups) <> 1
    or (select count(*) from public.combined_delivery_events) <> 3
    or (select count(*) from public.notifications where dedupe_key like 'combined_delivery_requested_%') <> 1 then raise exception 'Duplicate requests generated duplicate history or seller notifications'; end if;
  if exists(select 1 from public.orders where id::text like '65000000-%' and (status <> 'payment_pending' or shipping_fee is not null or reservation_expires_at <> now() - interval '1 day' or deadline_paused_at <> now() - interval '2 days' or quantity <> 1)) then raise exception 'Request changed reservation/payment/inventory/timer data'; end if;
  if (select sum(item_subtotal) from public.combined_delivery_members) <> 950 then raise exception 'Request subtotal differs from original line amounts'; end if;
end;
$$;

-- The unchanged individual shipping RPC is blocked only while a request is active.
select set_config('request.jwt.claim.sub', '61000000-0000-0000-0000-000000000002', true);
set local role authenticated;
do $$ begin
  begin
    perform public.set_order_shipping_fee('65000000-0000-0000-0000-000000000001',100);
    raise exception using errcode = 'ZX002', message = 'Individual shipping bypass accepted';
  exception when raise_exception then
    if sqlerrm <> 'Reservation is awaiting combined delivery review' then raise; end if;
  end;
end; $$;
reset role;

-- Neither the seller nor another buyer can cancel this buyer's request.
do $$
declare actor uuid; target uuid;
begin
  select id into target from public.combined_delivery_groups limit 1;
  foreach actor in array array['61000000-0000-0000-0000-000000000002'::uuid,'61000000-0000-0000-0000-000000000003'::uuid] loop
    perform set_config('request.jwt.claim.sub',actor::text,true);
    begin
      perform public.cancel_combined_delivery_request(target);
      raise exception using errcode = 'ZX002', message = 'Unauthorized cancellation accepted';
    exception when insufficient_privilege then null;
    end;
  end loop;
end;
$$;
select set_config('request.jwt.claim.sub', '61000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select public.cancel_combined_delivery_request(id) from public.combined_delivery_groups;
select public.cancel_combined_delivery_request(id) from public.combined_delivery_groups;
reset role;
do $$
begin
  if exists(select 1 from public.combined_delivery_members where released_at is null) then raise exception 'Cancellation did not release individual reservations'; end if;
  if exists(select 1 from public.combined_delivery_groups where status <> 'cancelled') then raise exception 'Cancellation state incorrect'; end if;
  if (select count(*) from public.combined_delivery_events where event_type = 'cancelled') <> 1
    or (select count(*) from public.notifications where dedupe_key like 'combined_delivery_cancelled_%') <> 1 then raise exception 'Cancellation retry duplicated history'; end if;
  if exists(select 1 from public.orders where id::text like '65000000-%' and (status <> 'payment_pending' or shipping_fee is not null or reservation_expires_at <> now() - interval '1 day' or deadline_paused_at <> now() - interval '2 days')) then raise exception 'Cancellation reset deadlines or cancelled orders'; end if;
  begin
    perform public.request_combined_delivery(array['65000000-0000-0000-0000-000000000001'::uuid,'65000000-0000-0000-0000-000000000002'::uuid],14.6,121,'Unit 1, Test address',true);
    raise exception using errcode = 'ZX002', message = 'Rapid repeated requests accepted';
  exception when invalid_parameter_value then
    if sqlerrm <> 'Please wait a minute before making another combined delivery request' then raise; end if;
  end;
end;
$$;
-- After buyer cancellation, the original shipping flow can resume its exact
-- stored budget. Unrelated reservations also remain independently processable.
select set_config('request.jwt.claim.sub', '61000000-0000-0000-0000-000000000002', true);
set local role authenticated;
select public.set_order_shipping_fee('65000000-0000-0000-0000-000000000001',100);
select public.set_order_shipping_fee('65000000-0000-0000-0000-000000000003',50);
reset role;
do $$ begin
  if not exists(select 1 from public.orders where id = '65000000-0000-0000-0000-000000000001' and shipping_fee = 100 and shipping_state = 'fee_set' and deadline_paused_at is null and reservation_expires_at = now() + interval '1 day' and total_amount = 550) then raise exception 'Original individual shipping workflow regressed after cancellation'; end if;
  if not exists(select 1 from public.orders where id = '65000000-0000-0000-0000-000000000003' and shipping_fee = 50 and shipping_state = 'fee_set' and deadline_paused_at is null) then raise exception 'Unrelated shipping workflow regressed'; end if;
end; $$;
rollback;
