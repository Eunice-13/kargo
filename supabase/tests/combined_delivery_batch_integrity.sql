-- Apply all combined-delivery migrations through Phase 3.2; isolated, rollback-only suite.
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


create function pg_temp.assert_delivery_pins() returns void language plpgsql as $$
begin
 if (select count(*) from public.combined_delivery_batch_pins)<>(select count(*) from public.combined_delivery_members where released_at is null) then raise exception 'Active membership/pin count mismatch'; end if;
 if exists(select 1 from public.combined_delivery_batch_pins p join public.combined_delivery_members m using(group_id,order_id)
   join public.orders o on o.id=m.order_id join public.combined_delivery_groups g on g.id=m.group_id
   where m.released_at is not null or p.product_id<>o.batch_product_id or p.batch_id<>g.batch_id or p.seller_id<>g.seller_id or p.order_revision<>o.combined_delivery_revision) then raise exception 'Incorrect active identity pin'; end if;
end; $$;
create function pg_temp.pin_group(p_approve boolean default false,p_fee boolean default false) returns uuid language plpgsql as $$
declare key uuid;
begin
 perform set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000001',true);
 select (public.request_combined_delivery(array['65000000-0000-0000-0000-000000000001'::uuid,'65000000-0000-0000-0000-000000000002'::uuid],14.6,121,'Unit 1, Test address',true)).id into key;
 perform pg_temp.assert_delivery_pins();
 if p_approve then
 perform set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000002',true);
 perform public.review_combined_delivery(key,'approve');
 if p_fee then perform public.review_combined_delivery(key,'set_shipping_fee',null,125.50); end if;
 end if;
 return key;
end; $$;

-- Force the FK backstops to run without the friendly trigger. An unrelated
-- error is not success: both SQLSTATE class and constraint identity are checked.
do $$ declare key uuid; protected_constraint text; begin
 begin
 key:=pg_temp.pin_group(true,true);
 begin
 alter table public.batch_products disable trigger batch_products_active_delivery_identity;
 update public.batch_products set batch_id='62000000-0000-0000-0000-000000000002' where id='63000000-0000-0000-0000-000000000002';
 raise exception using errcode='ZX999',message='Product identity FK bypassed';
 exception when foreign_key_violation or restrict_violation then
 get stacked diagnostics protected_constraint=constraint_name;
 if protected_constraint<>'combined_delivery_batch_pin_product_fk' then raise; end if;
 end;
 begin
 alter table public.batches disable trigger batches_active_delivery_identity;
 update public.batches set seller_id='61000000-0000-0000-0000-000000000004' where id='62000000-0000-0000-0000-000000000001';
 raise exception using errcode='ZX999',message='Batch seller FK bypassed';
 exception when foreign_key_violation or restrict_violation then
 get stacked diagnostics protected_constraint=constraint_name;
 if protected_constraint<>'combined_delivery_batch_pin_seller_fk' then raise; end if;
 end;
 begin
 alter table public.orders disable trigger orders_combined_delivery_guard;
 update public.orders set batch_product_id='63000000-0000-0000-0000-000000000003' where id='65000000-0000-0000-0000-000000000001';
 raise exception using errcode='ZX999',message='Reservation revision FK bypassed';
 exception when foreign_key_violation or restrict_violation then
 get stacked diagnostics protected_constraint=constraint_name;
 if protected_constraint<>'combined_delivery_batch_pin_order_fk' then raise; end if;
 end;
 -- Isolate the revision/FK backstop from the old guard's generated-column
 -- comparison; financial input columns remain immutable under the new FK.
 alter table public.orders disable trigger orders_combined_delivery_guard;
 update public.orders set updated_at=clock_timestamp() where id='65000000-0000-0000-0000-000000000001';
 alter table public.orders enable trigger orders_combined_delivery_guard;
 perform pg_temp.assert_delivery_pins();
 if not exists(select 1 from public.combined_delivery_groups where id=key and status='shipping_fee_set' and shipping_fee=125.50) then raise exception 'Approved fee/history changed on failed identity mutation'; end if;
 update public.batch_products set name='Unrelated name edit' where id='63000000-0000-0000-0000-000000000001';
 update public.batches set title='Unrelated title edit' where id='62000000-0000-0000-0000-000000000001';
 raise exception using errcode='ZX032',message='Scenario passed';
 exception when sqlstate 'ZX032' then null; end;
end; $$;

-- Pending cancellation/rejection, and stale approved recovery, all release pins
-- without deleting membership history or altering the ordinary shipping budget.
do $$ declare key uuid; action text; original_orders jsonb; begin
 foreach action in array array['cancel','reject','recover','recover_fee'] loop
 begin
 key:=pg_temp.pin_group(action in ('recover','recover_fee'),action='recover_fee');
 if action in ('recover','recover_fee') then
 set constraints all immediate;
 alter table public.combined_delivery_groups disable trigger combined_delivery_groups_guard;
 update public.combined_delivery_groups set payment_method='Maya' where id=key;
 alter table public.combined_delivery_groups enable trigger combined_delivery_groups_guard;
 set constraints all deferred;
 end if;
 select jsonb_agg(to_jsonb(o) order by o.id) into original_orders from public.orders o;
 if action='cancel' then
 perform set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000001',true);
 perform public.cancel_combined_delivery_request(key);
 elsif action='reject' then
 perform set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000002',true);
 perform public.review_combined_delivery(key,'reject','Packing requirement');
 else
 perform public.invalidate_combined_delivery_request(key);
 perform public.invalidate_combined_delivery_request(key);
 end if;
 perform pg_temp.assert_delivery_pins();
 if exists(select 1 from public.combined_delivery_batch_pins) or (select count(*) from public.combined_delivery_members where group_id=key)<>2 then raise exception 'Pin release deleted history or left stale protection'; end if;
 if original_orders is distinct from (select jsonb_agg(to_jsonb(o) order by o.id) from public.orders o) then raise exception 'Membership release changed valid reservations/time budgets'; end if;
 -- No active group now depends on this key: ordinary batch moves remain allowed.
 update public.batch_products set batch_id='62000000-0000-0000-0000-000000000002' where id='63000000-0000-0000-0000-000000000002';
 raise exception using errcode='ZX032',message='Scenario passed';
 exception when sqlstate 'ZX032' then null; end;
 end loop;
end; $$;

-- New internal state is not a PostgREST write/read or helper-execution surface.
do $$ begin
 if has_table_privilege('authenticated','public.combined_delivery_batch_pins','select,insert,update,delete')
   or has_table_privilege('anon','public.combined_delivery_batch_pins','select,insert,update,delete')
   or has_table_privilege('service_role','public.combined_delivery_batch_pins','select,insert,update,delete')
   or has_function_privilege('authenticated','public.sync_combined_delivery_batch_pin()','execute') then raise exception 'Private pin privileges exposed'; end if;
end; $$;
set local role authenticated;
do $$ begin
 begin
 delete from public.combined_delivery_batch_pins;
 raise exception using errcode='ZX999',message='Client deleted internal pin';
 exception when insufficient_privilege then null; end;
end; $$;
reset role;

-- A failure after release restores identity pins along with group/members/timers.
create function pg_temp.fail_pin_release_notice() returns trigger language plpgsql as $$
begin if new.dedupe_key like 'combined_delivery_invalidated_%' then raise exception 'Injected pin release failure'; end if; return new; end; $$;
do $$ declare key uuid; begin
 begin
 key:=pg_temp.pin_group(true,true);
 set constraints all immediate;
 alter table public.combined_delivery_groups disable trigger combined_delivery_groups_guard;
 update public.combined_delivery_groups set payment_method='Maya' where id=key;
 alter table public.combined_delivery_groups enable trigger combined_delivery_groups_guard;
 set constraints all deferred;
 create trigger fixture_pin_release_failure before insert on public.notifications for each row execute function pg_temp.fail_pin_release_notice();
 begin
 perform public.invalidate_combined_delivery_request(key);
 raise exception using errcode='ZX999',message='Failed pin recovery committed';
 exception when raise_exception then if sqlerrm<>'Injected pin release failure' then raise; end if; end;
 perform pg_temp.assert_delivery_pins();
 if (select count(*) from public.combined_delivery_batch_pins)<>2 then raise exception 'Recovery failure lost pin references'; end if;
 if not exists(select 1 from public.combined_delivery_groups where id=key and status='shipping_fee_set') then raise exception 'Recovery failure changed group'; end if;
 drop trigger fixture_pin_release_failure on public.notifications;
 perform public.invalidate_combined_delivery_request(key);
 perform pg_temp.assert_delivery_pins();
 raise exception using errcode='ZX032',message='Scenario passed';
 exception when sqlstate 'ZX032' then null; end;
end; $$;
rollback;
