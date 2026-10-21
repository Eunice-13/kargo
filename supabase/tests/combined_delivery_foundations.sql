-- Current regression suite: apply all combined-delivery migrations through Phase 3.1 first.
-- Local Supabase only, after all migrations. Everything rolls back.
-- psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/combined_delivery_foundations.sql
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

-- No direct client writes, including attempts to bind destination identities.
set local role authenticated;
do $$
declare result jsonb;
begin
  result := public.combined_delivery_eligibility(array['65000000-0000-0000-0000-000000000001'::uuid, '65000000-0000-0000-0000-000000000002'::uuid]);
  if not (result->>'eligible')::boolean then raise exception 'Expected eligible paused reservations, got %', result; end if;
  if jsonb_array_length(public.combined_delivery_candidates()) <> 3 then raise exception 'Candidate projection omitted owned records'; end if;
  if has_table_privilege('authenticated', 'public.combined_delivery_groups', 'INSERT')
    or has_table_privilege('authenticated', 'public.delivery_destinations', 'INSERT')
    or has_table_privilege('authenticated', 'public.combined_delivery_members', 'UPDATE')
    or has_table_privilege('authenticated', 'public.combined_delivery_events', 'INSERT')
    or has_column_privilege('authenticated', 'public.orders', 'delivery_destination_id', 'UPDATE') then
    raise exception 'Client write privilege leaked';
  end if;
end;
$$;
reset role;

-- Each case rolls back its mutations independently; no real reservation changes.
do $$
declare scenario record; result jsonb; ids uuid[] := array['65000000-0000-0000-0000-000000000001'::uuid, '65000000-0000-0000-0000-000000000002'::uuid];
begin
  for scenario in select * from (values
    ('paid', 'status = ''payment_confirmed''', 'not_unpaid'),
    ('expired', 'status = ''expired''', 'not_unpaid'),
    ('cancelled', 'status = ''cancelled''', 'not_unpaid'),
    ('submitted', 'status = ''payment_submitted''', 'not_unpaid'),
    ('different seller', 'seller_id = ''61000000-0000-0000-0000-000000000004''', 'different_seller'),
    ('different batch', 'batch_product_id = ''63000000-0000-0000-0000-000000000003''', 'different_batch'),
    ('different method', 'reserved_payment_method = ''Maya''', 'different_payment_method'),
    ('unconfirmed destination', 'delivery_destination_id = null', 'unconfirmed_destination'),
    ('different destination', 'delivery_destination_id = ''64000000-0000-0000-0000-000000000002'', delivery_pin_lat = 14.7, delivery_pin_lng = 121.1, delivery_pin_address = ''Unit 2, Test address''', 'different_destination'),
    ('shipping finalized', 'shipping_fee = 0', 'shipping_finalized'),
    ('correction needed', 'shipping_state = ''correction_requested''', 'shipping_not_pending'),
    ('meetup', 'shipping_applies = false', 'not_delivery'),
    ('unpaused', 'deadline_paused_at = null', 'not_paused'),
    ('no remaining time', 'reservation_expires_at = deadline_paused_at', 'deadline_exhausted')
  ) as cases(label, changes, reason) loop
    begin
      execute 'update public.orders set ' || scenario.changes || ' where id = ''65000000-0000-0000-0000-000000000002''';
      result := public.combined_delivery_eligibility(ids);
      if (result->>'eligible')::boolean or not (result->'reasons' ? scenario.reason) then
        raise exception 'Case % failed: %', scenario.label, result;
      end if;
      if scenario.reason = 'different_batch' and not (result->'feedback' ? 'Only reservations from the same Pasabuy batch can be combined.') then raise exception 'Missing clear batch feedback'; end if;
      raise exception using errcode = 'ZX001', message = 'rollback successful case';
    exception when sqlstate 'ZX001' then null;
    end;
  end loop;
  if not ('invalid_batch' = any(public.combined_delivery_batch_reasons(array[ids[1], null::uuid]))) then
    raise exception 'Missing batch identity accepted';
  end if;
  -- Explicit state and payment-history checks supplement the TypeScript matrix.
  begin
    update public.orders set reservation_expires_at = now() + interval '1 day' where id = ids[2];
    insert into public.payments(order_id, submitted_by, method_type, amount, status)
      values(ids[2], auth.uid(), 'GCash', 400, 'rejected');
    result := public.combined_delivery_eligibility(ids);
    if not (result->'reasons' ? 'payment_history') then raise exception 'Payment history accepted'; end if;
    raise exception using errcode = 'ZX001', message = 'rollback successful case';
  exception when sqlstate 'ZX001' then null;
  end;
end;
$$;

-- Unauthorized callers get no existence or buyer information from preview.
select set_config('request.jwt.claim.sub', '61000000-0000-0000-0000-000000000003', true);
set local role authenticated;
do $$
begin
  if public.combined_delivery_candidates() <> '[]'::jsonb then raise exception 'Another buyer data leaked'; end if;
  begin
    perform public.combined_delivery_eligibility(array['65000000-0000-0000-0000-000000000001'::uuid, '65000000-0000-0000-0000-000000000002'::uuid]);
    raise exception 'Unauthorized preview accepted';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
select set_config('request.jwt.claim.sub', '61000000-0000-0000-0000-000000000001', true);

-- Privileged fixtures exercise the DB foundation; no such write API is exposed.
insert into public.combined_delivery_groups(id, buyer_id, seller_id, batch_id, destination_id, payment_method)
values ('66000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000002', '62000000-0000-0000-0000-000000000001', '64000000-0000-0000-0000-000000000001', 'GCash');
insert into public.combined_delivery_members(group_id, order_id)
values
  ('66000000-0000-0000-0000-000000000001', '65000000-0000-0000-0000-000000000001'),
  ('66000000-0000-0000-0000-000000000001', '65000000-0000-0000-0000-000000000002');
set constraints all immediate;
set constraints all deferred;

do $$
begin
  if (select sum(item_subtotal) from public.combined_delivery_members where group_id = '66000000-0000-0000-0000-000000000001') <> 950 then raise exception 'Line amounts changed'; end if;
  if not (public.combined_delivery_eligibility(array['65000000-0000-0000-0000-000000000001'::uuid, '65000000-0000-0000-0000-000000000002'::uuid])->'reasons' ? 'already_grouped') then raise exception 'Already-grouped reservations accepted'; end if;
  begin
    update public.orders set shipping_fee = 100 where id = '65000000-0000-0000-0000-000000000001';
    raise exception using errcode = 'ZX002', message = 'Individual shipping bypass accepted';
  exception when raise_exception then
    if sqlerrm <> 'Reservation is awaiting combined delivery review' then raise; end if;
  end;
  begin
    update public.orders set reservation_expires_at = now() + interval '99 days' where id = '65000000-0000-0000-0000-000000000001';
    raise exception using errcode = 'ZX002', message = 'Individual deadline reset accepted';
  exception when raise_exception then
    if sqlerrm <> 'Reservation is awaiting combined delivery review' then raise; end if;
  end;
  begin
    insert into public.payments(order_id, submitted_by, method_type, amount)
    values ('65000000-0000-0000-0000-000000000001', auth.uid(), 'GCash', 550);
    raise exception using errcode = 'ZX002', message = 'Individual proof accepted';
  exception when raise_exception then
    if sqlerrm <> 'Individual payment is blocked for an active combined delivery' then raise; end if;
  end;
  begin
    insert into public.combined_delivery_groups(id, buyer_id, seller_id, batch_id, destination_id, payment_method)
    values ('66000000-0000-0000-0000-000000000002', '61000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000002', '62000000-0000-0000-0000-000000000001', '64000000-0000-0000-0000-000000000001', 'GCash');
    insert into public.combined_delivery_members(group_id, order_id)
    values ('66000000-0000-0000-0000-000000000002', '65000000-0000-0000-0000-000000000001');
    raise exception using errcode = 'ZX002', message = 'Duplicate active membership accepted';
  exception when raise_exception then
    if sqlerrm <> 'Reservation is not eligible for combined delivery' then raise; end if;
  end;
  begin
    insert into public.combined_delivery_groups(id, buyer_id, seller_id, batch_id, destination_id, payment_method)
    values ('66000000-0000-0000-0000-000000000003', '61000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000002', '62000000-0000-0000-0000-000000000001', '64000000-0000-0000-0000-000000000001', 'GCash');
    insert into public.combined_delivery_members(group_id, order_id)
    values ('66000000-0000-0000-0000-000000000003', '65000000-0000-0000-0000-000000000003');
    set constraints all immediate;
    raise exception using errcode = 'ZX002', message = 'Single-member group accepted';
  exception when raise_exception then
    if sqlerrm <> 'Combined delivery requires at least two reservations' then raise; end if;
  end;
  -- Submission/member-write boundary refuses a different real batch even when
  -- its display name, seller, buyer, method and destination are identical.
  begin
    update public.orders set batch_product_id = '63000000-0000-0000-0000-000000000003'
    where id = '65000000-0000-0000-0000-000000000003';
    insert into public.combined_delivery_members(group_id, order_id)
    values ('66000000-0000-0000-0000-000000000001', '65000000-0000-0000-0000-000000000003');
    raise exception using errcode = 'ZX002', message = 'Cross-batch membership accepted';
  exception when invalid_parameter_value then
    if sqlerrm <> 'Only reservations from the same Pasabuy batch can be combined.' then raise; end if;
  end;
  -- Simulate a stale request before an approval/group-update boundary. The
  -- current product/batch relationship must be checked again, not its name.
  begin
    -- Simulate a legacy pre-recovery batch change, not a permitted new mutation.
    -- Owner-only fixture: simulate the absence of pins in pre-3.2 legacy data.
    delete from public.combined_delivery_batch_pins where product_id='63000000-0000-0000-0000-000000000002';
    alter table public.batch_products disable trigger batch_products_active_delivery_identity;
    update public.batch_products set batch_id = '62000000-0000-0000-0000-000000000002'
    where id = '63000000-0000-0000-0000-000000000002';
    alter table public.batch_products enable trigger batch_products_active_delivery_identity;
    update public.combined_delivery_groups set updated_at = now()
    where id = '66000000-0000-0000-0000-000000000001';
    raise exception using errcode = 'ZX002', message = 'Stale cross-batch group accepted';
  exception when invalid_parameter_value then
    if sqlerrm <> 'Only reservations from the same Pasabuy batch can be combined.' then raise; end if;
  end;
  if (select count(*) from public.combined_delivery_events where group_id = '66000000-0000-0000-0000-000000000001') <> 3 then raise exception 'Creation/member audit missing'; end if;
end;
$$;

set local role authenticated;
do $$ begin
  if (select count(*) from public.combined_delivery_groups) <> 1 then raise exception 'Buyer cannot view own group'; end if;
end; $$;
select set_config('request.jwt.claim.sub', '61000000-0000-0000-0000-000000000002', true);
do $$ begin
  if (select count(*) from public.combined_delivery_groups) <> 1
    or (select count(*) from public.combined_delivery_members) <> 2
    or (select count(*) from public.delivery_destinations) <> 1 then raise exception 'Seller participant access failed'; end if;
end; $$;
select set_config('request.jwt.claim.sub', '61000000-0000-0000-0000-000000000003', true);
do $$ begin
  if exists (select 1 from public.combined_delivery_groups)
    or exists (select 1 from public.combined_delivery_members)
    or exists (select 1 from public.combined_delivery_events)
    or exists (select 1 from public.delivery_destinations) then raise exception 'RLS participant isolation failed'; end if;
end; $$;
reset role;
select set_config('request.jwt.claim.sub', '61000000-0000-0000-0000-000000000002', true);
update public.combined_delivery_groups set status = 'rejected', decided_by = auth.uid(), decision_reason = 'Different dispatch requirements'
where id = '66000000-0000-0000-0000-000000000001';
do $$ begin
  if exists (select 1 from public.combined_delivery_members where group_id = '66000000-0000-0000-0000-000000000001' and released_at is null) then raise exception 'Rejected group retained active memberships'; end if;
  if exists (select 1 from public.orders where id in ('65000000-0000-0000-0000-000000000001', '65000000-0000-0000-0000-000000000002') and (status <> 'payment_pending' or shipping_fee is not null or reservation_expires_at <> now() - interval '1 day' or deadline_paused_at <> now() - interval '2 days')) then raise exception 'Rejection changed inventory, totals, or original timer budget'; end if;
end; $$;
rollback;
