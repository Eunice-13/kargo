-- Current regression suite: apply all combined-delivery migrations through Phase 3.1 first.
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


create temporary table reviewed_group as select (public.request_combined_delivery(array['65000000-0000-0000-0000-000000000001'::uuid,'65000000-0000-0000-0000-000000000002'::uuid],14.6,121,'Unit 1, Test address',true)).id;
create temporary table original_orders as select * from public.orders;
-- Mutation RPC denies buyers and unrelated sellers without revealing records.
do $$ declare actor uuid; begin
 foreach actor in array array['61000000-0000-0000-0000-000000000001'::uuid,'61000000-0000-0000-0000-000000000004'::uuid] loop
 perform set_config('request.jwt.claim.sub',actor::text,true);
 begin
 perform public.review_combined_delivery((select id from reviewed_group),'approve');
 raise exception using errcode='ZX003',message='Unauthorized approval accepted';
 exception when insufficient_privilege then null; end;
 end loop;
end; $$;
select set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000002',true);
-- Batch reassignment is an upstream stale-data case; revalidation uses UUIDs.
do $$ begin
 begin
    -- Simulate a legacy pre-recovery batch change, not a permitted new mutation.
    -- Owner-only fixture: simulate the absence of pins in pre-3.2 legacy data.
    delete from public.combined_delivery_batch_pins where product_id='63000000-0000-0000-0000-000000000002';
    alter table public.batch_products disable trigger batch_products_active_delivery_identity;
 update public.batch_products set batch_id='62000000-0000-0000-0000-000000000002' where id='63000000-0000-0000-0000-000000000002';
    alter table public.batch_products enable trigger batch_products_active_delivery_identity;
 perform public.review_combined_delivery((select id from reviewed_group),'approve');
 raise exception using errcode='ZX003',message='Cross-batch approval accepted';
 exception when invalid_parameter_value then
 if sqlerrm<>'Only reservations from the same Pasabuy batch can be combined.' then raise; end if;
 end;
end; $$;
-- Fee before approval, malformed fees and payment-history changes are rejected.
do $$ begin
 begin
 perform public.review_combined_delivery((select id from reviewed_group),'set_shipping_fee',null,100);
 raise exception using errcode='ZX003',message='Unapproved fee accepted';
 exception when invalid_parameter_value then null; end;
end; $$;
select public.review_combined_delivery((select id from reviewed_group),'approve');
select public.review_combined_delivery((select id from reviewed_group),'approve');
do $$ declare fee numeric; begin
 foreach fee in array array[-1::numeric,1.001,'NaN'::numeric,'Infinity'::numeric,10000000000] loop
 begin
 perform public.review_combined_delivery((select id from reviewed_group),'set_shipping_fee',null,fee);
 raise exception using errcode='ZX003',message='Invalid fee accepted';
 exception when invalid_parameter_value then null; end;
 end loop;
end; $$;
select public.review_combined_delivery((select id from reviewed_group),'set_shipping_fee',null,125.50);
select public.review_combined_delivery((select id from reviewed_group),'set_shipping_fee',null,125.50);
do $$ declare g public.combined_delivery_groups; begin
 select * into g from public.combined_delivery_groups where id=(select id from reviewed_group);
 if g.shipping_fee<>125.50 or g.payment_window_seconds<>86400 or g.status<>'shipping_fee_set' then raise exception 'Incorrect shared fee/budget'; end if;
 if exists((select * from original_orders) except (select * from public.orders)) then raise exception 'Individual reservation changed'; end if;
 if (select count(*) from public.combined_delivery_members where group_id=g.id and released_at is null)<>2 then raise exception 'Approval released members'; end if;
 if (select count(*) from public.combined_delivery_events where group_id=g.id and event_type in ('approved','shipping_fee_assigned'))<>2 then raise exception 'Duplicate audit events'; end if;
 if (select count(*) from public.notifications where recipient_id=g.buyer_id)<>2 then raise exception 'Duplicate buyer notifications'; end if;
 if jsonb_array_length(public.seller_combined_delivery_requests())<>1 then raise exception 'Seller projection missing'; end if;
 begin
 perform public.review_combined_delivery(g.id,'set_shipping_fee',null,150);
 raise exception using errcode='ZX003',message='Fee overwritten';
 exception when invalid_parameter_value then null; end;
 begin
 perform public.set_order_shipping_fee('65000000-0000-0000-0000-000000000001',50);
 raise exception using errcode='ZX003',message='Duplicate individual shipping accepted';
 exception when raise_exception then
 if sqlerrm<>'Reservation is awaiting combined delivery review' then raise; end if;
 end;
end; $$;
-- The legacy single-order payment path remains blocked after fee assignment.
select set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000001',true);
do $$ begin
 begin
 insert into public.payments(order_id,submitted_by,method_type,amount)
 values('65000000-0000-0000-0000-000000000001',auth.uid(),'GCash',550);
 raise exception using errcode='ZX003',message='Individual payment bypass accepted';
 exception when raise_exception then
 if sqlerrm<>'Individual payment is blocked for an active combined delivery' then raise; end if;
 end;
end; $$;
-- An unrelated seller cannot read the group's delivery information.
select set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000004',true);
do $$ begin
 if jsonb_array_length(public.seller_combined_delivery_requests())<>0 then raise exception 'Seller read leaked another shop'; end if;
end; $$;
rollback;
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


create temporary table rejected_group as select (public.request_combined_delivery(array['65000000-0000-0000-0000-000000000001'::uuid,'65000000-0000-0000-0000-000000000002'::uuid],14.6,121,'Unit 1, Test address',true)).id;
select set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000002',true);
-- Simulate upstream stale changes; each subtransaction restores its fixture.
do $$ declare scenario record; stage text; begin
 foreach stage in array array['approve','set_shipping_fee'] loop
 if stage='set_shipping_fee' then perform public.review_combined_delivery((select id from rejected_group),'approve'); end if;
 for scenario in select * from (values
   ('seller_id = ''61000000-0000-0000-0000-000000000004'''),
   ('status = ''payment_submitted'''),
   ('shipping_fee = 5'),
   ('shipping_applies = false'),
   ('reserved_payment_method = ''Bank Transfer'''),
   ('delivery_pin_address = ''Different address'''),
   ('deadline_paused_at = null'),
   ('reservation_expires_at = deadline_paused_at')
 ) v(change) loop
 begin
 -- Owner-only fixture: these legacy mutations predate snapshot-safe pins.
    delete from public.combined_delivery_batch_pins;
    alter table public.orders disable trigger orders_combined_delivery_guard;
 execute 'update public.orders set '||scenario.change||' where id=''65000000-0000-0000-0000-000000000002''';
 alter table public.orders enable trigger orders_combined_delivery_guard;
 perform public.review_combined_delivery((select id from rejected_group),stage,null,10);
 raise exception using errcode='ZX003',message='Stale eligibility accepted: '||scenario.change;
 exception when invalid_parameter_value then null;
 end;
 end loop;
 end loop;
end; $$;
rollback;
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


create temporary table rejected_group as select (public.request_combined_delivery(array['65000000-0000-0000-0000-000000000001'::uuid,'65000000-0000-0000-0000-000000000002'::uuid],14.6,121,'Unit 1, Test address',true)).id;
select set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000002',true);
select public.review_combined_delivery((select id from rejected_group),'reject','Separate packing required');
select public.review_combined_delivery((select id from rejected_group),'reject','Separate packing required');
do $$ begin
 if exists(select 1 from public.combined_delivery_members where released_at is null) then raise exception 'Rejected memberships still active'; end if;
 if (select count(*) from public.combined_delivery_events where event_type='rejected')<>1 then raise exception 'Duplicate rejection'; end if;
 if (select count(*) from public.notifications where recipient_id='61000000-0000-0000-0000-000000000001')<>1 then raise exception 'Duplicate rejection notification'; end if;
 if exists(select 1 from public.orders where deadline_paused_at is null or shipping_fee is not null) then raise exception 'Rejection changed individual shipping'; end if;
 if has_function_privilege('anon','public.review_combined_delivery(uuid,text,text,numeric)','execute') then raise exception 'Anonymous execution allowed'; end if;
end; $$;
select public.set_order_shipping_fee('65000000-0000-0000-0000-000000000001',50);
rollback;
