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


-- The only trigger bypasses below represent stale pre-migration data. Normal
-- authenticated batch changes are separately tested and must always be refused.
create function pg_temp.approved_delivery(p_fee boolean default false) returns uuid language plpgsql as $$
declare g uuid;
begin
 perform set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000001',true);
 select (public.request_combined_delivery(array['65000000-0000-0000-0000-000000000001'::uuid,'65000000-0000-0000-0000-000000000002'::uuid],14.6,121,'Unit 1, Test address',true)).id into g;
 perform set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000002',true);
 perform public.review_combined_delivery(g,'approve');
 if p_fee then perform public.review_combined_delivery(g,'set_shipping_fee',null,125.50); end if;
 return g;
end; $$;
create function pg_temp.stale_delivery_batch() returns void language plpgsql as $$
begin
 -- Owner-only fixture: simulate the absence of pins in pre-3.2 legacy data.
    delete from public.combined_delivery_batch_pins where product_id='63000000-0000-0000-0000-000000000002';
    alter table public.batch_products disable trigger batch_products_active_delivery_identity;
 update public.batch_products set batch_id='62000000-0000-0000-0000-000000000002' where id='63000000-0000-0000-0000-000000000002';
 alter table public.batch_products enable trigger batch_products_active_delivery_identity;
end; $$;

-- Prevention and unchanged valid-group operation. Each successful scenario is
-- deliberately rolled back with ZX031, independently of assertion failures.
do $$ declare g uuid; terminal_fee boolean; begin
 foreach terminal_fee in array array[false,true] loop
 begin
 g:=pg_temp.approved_delivery(terminal_fee);
 begin
 update public.batch_products set batch_id='62000000-0000-0000-0000-000000000002' where id='63000000-0000-0000-0000-000000000002';
 raise exception using errcode='ZX999',message='Active product moved to another batch';
 exception when invalid_parameter_value then
 if sqlerrm not like 'This product belongs to an active combined delivery.%' then raise; end if;
 end;
 begin
 update public.batches set seller_id='61000000-0000-0000-0000-000000000004' where id='62000000-0000-0000-0000-000000000001';
 raise exception using errcode='ZX999',message='Active batch seller changed';
 exception when invalid_parameter_value then
 if sqlerrm not like 'This batch belongs to an active combined delivery.%' then raise; end if;
 end;
 update public.batch_products set name='Updated name' where id='63000000-0000-0000-0000-000000000001';
 begin
 perform public.invalidate_combined_delivery_request(g);
 raise exception using errcode='ZX999',message='Valid approved group recovered';
 exception when invalid_parameter_value then
 if sqlerrm not like 'This request is still eligible.%' then raise; end if;
 end;
 begin
 perform public.review_combined_delivery(g,'reject','Changed my mind');
 raise exception using errcode='ZX999',message='Seller cancellation broadened to valid approved groups';
 exception when invalid_parameter_value then
 if sqlerrm not like 'This request is still eligible.%' then raise; end if;
 end;
 perform set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000001',true);
 begin
 perform public.cancel_combined_delivery_request(g);
 raise exception using errcode='ZX999',message='Buyer cancellation broadened to valid approved groups';
 exception when invalid_parameter_value then
 if sqlerrm not like 'This request is still eligible.%' then raise; end if;
 end;
 perform set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000002',true);
 if not terminal_fee then perform public.review_combined_delivery(g,'set_shipping_fee',null,0); end if;
 if (select count(*) from public.combined_delivery_members where group_id=g and released_at is null)<>2 then raise exception 'Valid group lost members'; end if;
 raise exception using errcode='ZX031',message='Scenario passed';
 exception when sqlstate 'ZX031' then null;
 end;
 end loop;
end; $$;

-- Existing seller/buyer actions can recover ONLY stale approved requests,
-- including fee-assigned ones, with idempotent terminal results.
do $$ declare g uuid; actor text; terminal_fee boolean; result public.combined_delivery_groups; first_released timestamptz; snapshot jsonb; begin
 foreach actor in array array['seller','buyer','explicit_buyer','explicit_seller'] loop
 foreach terminal_fee in array array[false,true] loop
 begin
 g:=pg_temp.approved_delivery(terminal_fee);
 select jsonb_agg(to_jsonb(o) order by o.id) into snapshot from public.orders o;
 perform pg_temp.stale_delivery_batch();
 if actor in ('buyer','explicit_buyer') then perform set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000001',true); end if;
 if actor='seller' then perform public.review_combined_delivery(g,'reject','Batch changed');
 elsif actor='buyer' then perform public.cancel_combined_delivery_request(g);
 else perform public.invalidate_combined_delivery_request(g); end if;
 select * into result from public.combined_delivery_groups where id=g;
 if result.status<>'invalidated' or result.decision_reason<>'Only reservations from the same Pasabuy batch can be combined.' then raise exception 'Recovery did not retain the strict batch reason'; end if;
 if terminal_fee and (result.shipping_fee<>125.50 or result.shipping_fee_set_at is null or result.payment_window_seconds<>86400) then raise exception 'Historical fee/budget lost'; end if;
 if exists(select 1 from public.combined_delivery_members where group_id=g and released_at is null) then raise exception 'Orphan active membership'; end if;
 if snapshot is distinct from (select jsonb_agg(to_jsonb(o) order by o.id) from public.orders o) then raise exception 'Legitimate shipping pauses or inventory changed'; end if;
 select min(released_at) into first_released from public.combined_delivery_members where group_id=g;
 perform public.invalidate_combined_delivery_request(g);
 perform public.invalidate_combined_delivery_request(g);
 if (select min(released_at) from public.combined_delivery_members where group_id=g) is distinct from first_released then raise exception 'Double release'; end if;
 if (select count(*) from public.combined_delivery_events where group_id=g and event_type='invalidated')<>1 then raise exception 'Duplicate recovery audit'; end if;
 if (select count(*) from public.notifications where dedupe_key='combined_delivery_invalidated_'||g::text)<>2 then raise exception 'Recovery notices missing or duplicated'; end if;
 if exists(select 1 from public.combined_delivery_members where group_id=g and original_expires_at-original_paused_at<>interval '1 day') then raise exception 'Original snapshots changed'; end if;
 perform set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000002',true);
 begin
 perform public.review_combined_delivery(g,'set_shipping_fee',null,125.50);
 raise exception using errcode='ZX999',message='Invalidated group accepted a fee';
 exception when invalid_parameter_value then null; end;
 -- Normal individual shipping becomes available after memberships release.
 perform public.set_order_shipping_fee('65000000-0000-0000-0000-000000000001',30);
 if not exists(select 1 from public.orders where id='65000000-0000-0000-0000-000000000001' and shipping_fee=30 and deadline_paused_at is null and reservation_expires_at=now()+interval '1 day') then raise exception 'Individual fee flow failed to resume the original budget'; end if;
 raise exception using errcode='ZX031',message='Scenario passed';
 exception when sqlstate 'ZX031' then null;
 end;
 end loop;
 end loop;
end; $$;

-- All strict eligibility dimensions retain a recovery route. Only legacy/test
-- corruption bypasses guards; actual ordinary order updates remain blocked.
do $$ declare scenario record; g uuid; begin
 for scenario in select * from (values
   ('buyer_id = ''61000000-0000-0000-0000-000000000003'', delivery_destination_id = null'),
   ('seller_id = ''61000000-0000-0000-0000-000000000004'''),
   ('status = ''payment_confirmed'''),
   ('status = ''expired'''),
   ('status = ''cancelled'''),
   ('shipping_applies = false'),
   ('reserved_payment_method = ''Maya'''),
   ('delivery_pin_address = ''Changed unit'''),
   ('shipping_state = ''correction_requested'''),
   ('buyer_accepted_shipping_fee = false')
 ) v(change) loop
 begin
 g:=pg_temp.approved_delivery();
 -- Owner-only fixture: these legacy mutations predate snapshot-safe pins.
    delete from public.combined_delivery_batch_pins;
    alter table public.orders disable trigger orders_combined_delivery_guard;
 execute 'update public.orders set '||scenario.change||' where id=''65000000-0000-0000-0000-000000000002''';
 alter table public.orders enable trigger orders_combined_delivery_guard;
 perform public.invalidate_combined_delivery_request(g);
 if exists(select 1 from public.combined_delivery_members where group_id=g and released_at is null) then raise exception 'Ineligible request has no recovery: %',scenario.change; end if;
 if not exists(select 1 from public.orders where id='65000000-0000-0000-0000-000000000001' and deadline_paused_at is not null and status='payment_pending' and shipping_fee is null) then raise exception 'Recovery damaged a valid sibling'; end if;
 raise exception using errcode='ZX031',message='Scenario passed';
 exception when sqlstate 'ZX031' then null;
 end;
 end loop;
end; $$;

-- Remaining hours are preserved per reservation, never reset to batch duration.
do $$ declare g uuid; begin
 begin
 update public.orders set reservation_expires_at=deadline_paused_at+interval '7 hours' where id='65000000-0000-0000-0000-000000000001';
 update public.orders set reservation_expires_at=deadline_paused_at+interval '130 minutes' where id='65000000-0000-0000-0000-000000000002';
 g:=pg_temp.approved_delivery();
 -- Owner-only fixture: these legacy mutations predate snapshot-safe pins.
    delete from public.combined_delivery_batch_pins;
    alter table public.orders disable trigger orders_combined_delivery_guard;
 update public.orders set shipping_state='correction_requested' where id='65000000-0000-0000-0000-000000000002';
 alter table public.orders enable trigger orders_combined_delivery_guard;
 perform public.invalidate_combined_delivery_request(g);
 if not exists(select 1 from public.orders where id='65000000-0000-0000-0000-000000000002' and shipping_state='correction_requested' and deadline_paused_at is not null and reservation_expires_at-deadline_paused_at=interval '130 minutes') then raise exception 'Correction pause lost'; end if;
 perform public.set_order_shipping_fee('65000000-0000-0000-0000-000000000001',30);
 perform public.set_order_shipping_fee('65000000-0000-0000-0000-000000000002',40);
 if not exists(select 1 from public.orders where id='65000000-0000-0000-0000-000000000001' and reservation_expires_at=now()+interval '7 hours') or not exists(select 1 from public.orders where id='65000000-0000-0000-0000-000000000002' and reservation_expires_at=now()+interval '130 minutes') then raise exception 'Individual time reset'; end if;
 raise exception using errcode='ZX031',message='Scenario passed';
 exception when sqlstate 'ZX031' then null; end;
end; $$;

-- Legacy standalone-ready reservation: use the existing pause/resume rule.
do $$ declare g uuid; begin
 begin
 g:=pg_temp.approved_delivery();
 -- Owner-only fixture: these legacy mutations predate snapshot-safe pins.
    delete from public.combined_delivery_batch_pins;
    alter table public.orders disable trigger orders_combined_delivery_guard;
 update public.orders set shipping_state='fee_set',shipping_fee=55 where id='65000000-0000-0000-0000-000000000001';
 alter table public.orders enable trigger orders_combined_delivery_guard;
 perform public.invalidate_combined_delivery_request(g);
 if not exists(select 1 from public.orders where id='65000000-0000-0000-0000-000000000001' and deadline_paused_at is null and reservation_expires_at=now()+interval '1 day' and shipping_fee=55) then raise exception 'Standalone-ready budget not resumed'; end if;
 raise exception using errcode='ZX031',message='Scenario passed';
 exception when sqlstate 'ZX031' then null; end;
end; $$;

-- Missing standalone fee is still a legitimate shipping pause, even if legacy
-- data mislabeled the state. Never copy the former GROUP fee to fill it in.
do $$ declare g uuid; begin
 begin
 g:=pg_temp.approved_delivery(true);
 -- Owner-only fixture: these legacy mutations predate snapshot-safe pins.
    delete from public.combined_delivery_batch_pins;
    alter table public.orders disable trigger orders_combined_delivery_guard;
 update public.orders set shipping_state='fee_set' where id='65000000-0000-0000-0000-000000000001';
 alter table public.orders enable trigger orders_combined_delivery_guard;
 perform public.invalidate_combined_delivery_request(g);
 if not exists(select 1 from public.orders where id='65000000-0000-0000-0000-000000000001' and shipping_state='waiting_for_seller' and shipping_fee is null and deadline_paused_at is not null) then raise exception 'Missing individual fee became payable'; end if;
 raise exception using errcode='ZX031',message='Scenario passed';
 exception when sqlstate 'ZX031' then null; end;
end; $$;

-- Zero remaining budget and an already expired unpaused deadline receive no
-- fresh duration. The REAL existing sweep/allocator can then reassign stock.
do $$ declare g uuid; was_paused boolean; begin
 foreach was_paused in array array[true,false] loop
 begin
 update public.batch_products set quantity_total=1 where id='63000000-0000-0000-0000-000000000001';
 g:=pg_temp.approved_delivery();
 -- Owner-only fixture: these legacy mutations predate snapshot-safe pins.
    delete from public.combined_delivery_batch_pins;
    alter table public.orders disable trigger orders_combined_delivery_guard;
 update public.orders set shipping_applies=false,
   reservation_expires_at=case when was_paused then deadline_paused_at else now()-interval '1 hour' end,
   deadline_paused_at=case when was_paused then deadline_paused_at else null end
 where id='65000000-0000-0000-0000-000000000001';
 alter table public.orders enable trigger orders_combined_delivery_guard;
 insert into public.waitlist_entries(batch_product_id,buyer_id,desired_quantity,status)
 values('63000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000003',1,'waiting');
 perform public.invalidate_combined_delivery_request(g);
 if not exists(select 1 from public.orders where id='65000000-0000-0000-0000-000000000001' and status='payment_pending' and deadline_paused_at is null and shipping_state is null and reservation_expires_at<=now()) then raise exception 'Expired budget reset or stock released prematurely'; end if;
 if public.available_stock('63000000-0000-0000-0000-000000000001')<>0 then raise exception 'Recovery released allocated inventory'; end if;
 perform public.sweep_expirations();
 if not exists(select 1 from public.orders where id='65000000-0000-0000-0000-000000000001' and status='expired') then raise exception 'Normal expiry did not resume'; end if;
 if not exists(select 1 from public.waitlist_entries where status='converted') or not exists(select 1 from public.orders where buyer_id='61000000-0000-0000-0000-000000000003' and batch_product_id='63000000-0000-0000-0000-000000000001' and status='payment_pending') then raise exception 'Real waitlist allocator did not reassign released stock'; end if;
 if (select count(*) from public.orders where id::text like '65000000-%')<>3 then raise exception 'Historical reservation deleted'; end if;
 raise exception using errcode='ZX031',message='Scenario passed';
 exception when sqlstate 'ZX031' then null; end;
 end loop;
end; $$;

-- Unauthorized callers never cause release, including when the request is stale.
do $$ declare g uuid; actor text; begin
 begin
 g:=pg_temp.approved_delivery(); perform pg_temp.stale_delivery_batch();
 foreach actor in array array['61000000-0000-0000-0000-000000000003','61000000-0000-0000-0000-000000000004',''] loop
 perform set_config('request.jwt.claim.sub',actor,true);
 begin
 perform public.invalidate_combined_delivery_request(g);
 raise exception using errcode='ZX999',message='Unauthorized recovery accepted';
 exception when insufficient_privilege then null; end;
 end loop;
 if has_function_privilege('anon','public.invalidate_combined_delivery_request(uuid)','execute') then raise exception 'Anonymous recovery execution granted'; end if;
 if (select count(*) from public.combined_delivery_members where group_id=g and released_at is null)<>2 then raise exception 'Unauthorized release'; end if;
 raise exception using errcode='ZX031',message='Scenario passed';
 exception when sqlstate 'ZX031' then null; end;
end; $$;


-- A legacy partially released member is NOT affected a second time; it could
-- already belong to a new independent shipping or group context.
do $$ declare g uuid; before_order jsonb; begin
 begin
 g:=pg_temp.approved_delivery();
 set constraints all immediate;
 alter table public.combined_delivery_members disable trigger combined_delivery_members_guard;
 update public.combined_delivery_members set released_at=now() where group_id=g and order_id='65000000-0000-0000-0000-000000000001';
 alter table public.combined_delivery_members enable trigger combined_delivery_members_guard;
 set constraints all deferred;
 update public.orders set shipping_state='fee_set',shipping_fee=88 where id='65000000-0000-0000-0000-000000000001';
 select to_jsonb(o) into before_order from public.orders o where id='65000000-0000-0000-0000-000000000001';
 perform public.invalidate_combined_delivery_request(g);
 if before_order is distinct from (select to_jsonb(o) from public.orders o where id='65000000-0000-0000-0000-000000000001') then raise exception 'Previously released member changed again'; end if;
 if (select jsonb_array_length(details->'recovery_deadlines') from public.combined_delivery_events where group_id=g and event_type='invalidated')<>1 then raise exception 'Recovery scope audit incorrect'; end if;
 raise exception using errcode='ZX031',message='Scenario passed';
 exception when sqlstate 'ZX031' then null; end;
end; $$;

-- Force a failure AFTER membership release/deadline repair: ALL changes roll back.
create function pg_temp.reject_recovery_notice() returns trigger language plpgsql as $$
begin
 if new.dedupe_key like 'combined_delivery_invalidated_%' then raise exception 'Injected recovery failure'; end if;
 return new;
end; $$;
do $$ declare g uuid; before_orders jsonb; begin
 begin
 g:=pg_temp.approved_delivery(); perform pg_temp.stale_delivery_batch();
 -- Owner-only fixture: these legacy mutations predate snapshot-safe pins.
    delete from public.combined_delivery_batch_pins;
    alter table public.orders disable trigger orders_combined_delivery_guard;
 update public.orders set shipping_applies=false where id='65000000-0000-0000-0000-000000000001';
 alter table public.orders enable trigger orders_combined_delivery_guard;
 select jsonb_agg(to_jsonb(o) order by o.id) into before_orders from public.orders o;
 create trigger fixture_recovery_failure before insert on public.notifications for each row execute function pg_temp.reject_recovery_notice();
 begin
 perform public.invalidate_combined_delivery_request(g);
 raise exception using errcode='ZX999',message='Injected failure ignored';
 exception when raise_exception then if sqlerrm<>'Injected recovery failure' then raise; end if; end;
 if (select status from public.combined_delivery_groups where id=g)<>'awaiting_shipping_fee' or (select count(*) from public.combined_delivery_members where group_id=g and released_at is null)<>2 or exists(select 1 from public.combined_delivery_events where group_id=g and event_type='invalidated') then raise exception 'Recovery committed partially'; end if;
 if before_orders is distinct from (select jsonb_agg(to_jsonb(o) order by o.id) from public.orders o) then raise exception 'Deadline repair survived a failed transaction'; end if;
 drop trigger fixture_recovery_failure on public.notifications;
 perform public.invalidate_combined_delivery_request(g);
 if exists(select 1 from public.combined_delivery_members where group_id=g and released_at is null) then raise exception 'Retry after failed transaction did not recover'; end if;
 -- A released membership no longer blocks legitimate product editing.
 update public.batch_products set batch_id='62000000-0000-0000-0000-000000000001' where id='63000000-0000-0000-0000-000000000002';
 raise exception using errcode='ZX031',message='Scenario passed';
 exception when sqlstate 'ZX031' then null; end;
end; $$;
rollback;
