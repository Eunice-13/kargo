-- Run after Phase 1 + Phase 2 migrations against local Supabase. Everything rolls back.
-- psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/combined_delivery_buyer_requests.sql
begin;
-- Production removed this legacy FK; fixtures must not manufacture it again.
do $$ begin
 if exists(select 1 from information_schema.columns where table_schema='public' and table_name='payments' and column_name='seller_payment_method_id') then raise exception 'Fixture resurrected removed payment-method FK'; end if;
end $$;

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


insert into public.seller_payment_methods(seller_id,method_type) values('61000000-0000-0000-0000-000000000002','GCash');
insert into storage.objects(bucket_id,name) values('payment-receipts','61000000-0000-0000-0000-000000000001/proof.jpg');
create function pg_temp.must_fail(p_sql text,p_pattern text) returns void language plpgsql as $$
begin
 begin execute p_sql; exception when others then
  if sqlerrm !~ p_pattern then raise; end if; return;
 end;
 raise exception 'Expected rejection: %',p_sql;
end $$;
create function pg_temp.setup_payment() returns uuid language plpgsql as $$
declare g uuid;
begin
 perform set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000001',true);
 select (public.request_combined_delivery(array['65000000-0000-0000-0000-000000000001'::uuid,'65000000-0000-0000-0000-000000000002'::uuid],14.6,121,'Unit 1, Test address',true)).id into g;
 perform set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000002',true);
 perform public.review_combined_delivery(g,'approve');
 perform public.review_combined_delivery(g,'set_shipping_fee',null,125.50);
 return g;
end $$;
create function pg_temp.submit(g uuid,ref text default 'REF-1') returns uuid language plpgsql as $$
begin
 perform set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000001',true);
 return (public.submit_combined_delivery_payment(g,'GCash',1075.50,ref,'61000000-0000-0000-0000-000000000001/proof.jpg')->'payment'->>'id')::uuid;
end $$;

savepoint success;
do $$ declare g uuid; pay uuid; a public.combined_delivery_payment_accounts; begin
 g:=pg_temp.setup_payment();
 select * into strict a from public.combined_delivery_payment_accounts where group_id=g;
 if a.total<>1075.50 or a.items_subtotal<>950 or a.shipping_fee<>125.50 or a.deadline<>now()+interval '1 day' then raise exception 'Wrong authoritative totals or deadline'; end if;
 if exists(select 1 from public.orders where id in(select order_id from public.combined_delivery_members where group_id=g) and (deadline_paused_at is not null or shipping_fee is not null)) then raise exception 'Shipping duplicated or deadline not resumed'; end if;
 perform public.review_combined_delivery(g,'set_shipping_fee',null,125.50);
 if (select count(*) from public.notifications where dedupe_key='combined_payment_ready_'||g::text)<>1 then raise exception 'Duplicate ready notice'; end if;
 perform set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000003',true);
 perform pg_temp.must_fail(format('select public.submit_combined_delivery_payment(%L,''GCash'',1075.50,''OTHER'',''61000000-0000-0000-0000-000000000001/proof.jpg'')',g),'Delivery request unavailable');
 perform set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000001',true);
 perform pg_temp.must_fail(format('select public.submit_combined_delivery_payment(%L,''GCash'',1201,''REF'',''61000000-0000-0000-0000-000000000001/proof.jpg'')',g),'exact combined total');
 perform pg_temp.must_fail(format('select public.submit_combined_delivery_payment(%L,''Maya'',1075.50,''REF'',''61000000-0000-0000-0000-000000000001/proof.jpg'')',g),'method selected');
 perform pg_temp.must_fail(format('select public.submit_combined_delivery_payment(%L,''GCash'',1075.50,''REF'',''other/proof.jpg'')',g),'proof belonging');
 update public.seller_payment_methods set is_active=false;
 perform pg_temp.must_fail(format('select pg_temp.submit(%L)',g),'seller payment method is unavailable');
 update public.seller_payment_methods set is_active=true;
 pay:=pg_temp.submit(g);
 perform pg_temp.must_fail(format('insert into public.combined_delivery_payment_reservations(payment_id,group_id,order_id,item_subtotal) values(%L,%L,%L,400)',pay,g,'65000000-0000-0000-0000-000000000003'),'foreign key');
 perform pg_temp.must_fail(format('select pg_temp.submit(%L)',g),'not payable');
 if (select count(*) from public.combined_delivery_payment_reservations where payment_id=pay)<>2 or (select count(*) from public.orders where status='payment_submitted')<>2 then raise exception 'Partial submission'; end if;
 perform pg_temp.must_fail(format('select public.invalidate_combined_delivery_request(%L)',g),'cannot be invalidated');
 perform pg_temp.must_fail(format('select public.review_combined_delivery_payment(%L,''verified'')',pay),'Active seller');
 perform set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000004',true);
 perform pg_temp.must_fail(format('select public.review_combined_delivery_payment(%L,''verified'')',pay),'unavailable');
 perform set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000002',true);
 perform pg_temp.must_fail(format('update public.payments set status=''verified'' where id=%L',pay),'Use combined payment verification');
 perform public.review_combined_delivery_payment(pay,'verified');
 perform public.review_combined_delivery_payment(pay,'verified');
 if (select count(*) from public.orders where status='payment_confirmed')<>2 or exists(select 1 from public.combined_delivery_batch_pins where group_id=g) or exists(select 1 from public.combined_delivery_members where group_id=g and released_at is null) then raise exception 'Partial confirmation or retained pins'; end if;
 if (select status from public.combined_delivery_groups where id=g)<>'paid' then raise exception 'Group not paid'; end if;
 if (select count(*) from public.notifications where dedupe_key='combined_payment_verified_'||pay::text)<>1 or (select count(*) from public.notifications where dedupe_key='combined_payment_submitted_'||pay::text)<>2 then raise exception 'Notification duplicates'; end if;
 if exists(select 1 from public.combined_delivery_payment_context) then raise exception 'Capability leaked'; end if;
end $$;
rollback to success;

savepoint rejection;
do $$ declare g uuid; pay uuid; second uuid; begin
 g:=pg_temp.setup_payment();pay:=pg_temp.submit(g);
 perform set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000002',true);
 perform public.review_combined_delivery_payment(pay,'rejected','Unreadable proof',12);
 perform public.review_combined_delivery_payment(pay,'rejected','Unreadable proof',12);
 if (select count(*) from public.orders where status='payment_pending' and reservation_expires_at=now()+interval '12 hours')<>2 then raise exception 'Rejection deadline not atomic'; end if;
 perform pg_temp.must_fail(format('select pg_temp.submit(%L)',g),'unique constraint');
 second:=pg_temp.submit(g,'REF-2');
 perform set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000002',true);
 perform public.review_combined_delivery_payment(second,'verified');
 if (select count(*) from public.payments where combined_delivery_group_id=g)<>2 or (select count(*) from public.combined_delivery_payment_reservations where group_id=g)<>4 then raise exception 'Payment history lost'; end if;
end $$;
rollback to rejection;

savepoint expiry;
do $$ declare g uuid; begin
 -- Exhaust one original budget while preserving the other's original day.
 update public.orders set reservation_expires_at=deadline_paused_at+interval '1 millisecond' where id='65000000-0000-0000-0000-000000000001';
 g:=pg_temp.setup_payment();
 -- Owner-only clock fixture; client has no ledger update access.
 update public.combined_delivery_payment_accounts set deadline=now()-interval '1 second' where group_id=g;
 insert into public.combined_delivery_payment_context values(txid_current(),g);
 perform public.transition_combined_payment_orders(g,'payment_pending',now()-interval '1 second');
 delete from public.combined_delivery_payment_context;
 perform public.sweep_expirations();
 if (select count(*) from public.orders where status='expired')<>2 or exists(select 1 from public.combined_delivery_batch_pins where group_id=g) then raise exception 'Expired memberships not released'; end if;
 perform pg_temp.must_fail(format('select pg_temp.submit(%L)',g),'not payable');
end $$;
rollback to expiry;


-- A failure after all writes must roll the entire submission/review back.
create function pg_temp.fail_payment_notice() returns trigger language plpgsql as $$
begin
 if new.dedupe_key like 'combined_payment_submitted_%' or new.dedupe_key like 'combined_payment_verified_%' then raise exception 'Injected group notice failure'; end if;
 return new;
end $$;
savepoint atomic_submission;
do $$ declare g uuid; begin
 g:=pg_temp.setup_payment();
 execute 'create trigger fixture_fail_notice before insert on public.notifications for each row execute function pg_temp.fail_payment_notice()';
 perform pg_temp.must_fail(format('select pg_temp.submit(%L)',g),'Injected group notice failure');
 if exists(select 1 from public.payments where combined_delivery_group_id=g) or exists(select 1 from public.combined_delivery_payment_reservations where group_id=g)
 or (select count(*) from public.orders where status='payment_pending')<>3 or (select count(*) from public.combined_delivery_batch_pins where group_id=g)<>2
 or (select status from public.combined_delivery_payment_accounts where group_id=g)<>'ready' or exists(select 1 from public.combined_delivery_payment_context) then raise exception 'Failed submission left partial state'; end if;
end $$;
rollback to atomic_submission;
savepoint atomic_review;
do $$ declare g uuid; pay uuid; begin
 g:=pg_temp.setup_payment();pay:=pg_temp.submit(g);
 execute 'create trigger fixture_fail_notice before insert on public.notifications for each row execute function pg_temp.fail_payment_notice()';
 perform set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000002',true);
 perform pg_temp.must_fail(format('select public.review_combined_delivery_payment(%L,''verified'')',pay),'Injected group notice failure');
 if (select count(*) from public.orders where status='payment_submitted')<>2 or (select status from public.payments where id=pay)<>'pending_review'
 or (select status from public.combined_delivery_groups where id=g)<>'shipping_fee_set'
 or (select count(*) from public.combined_delivery_batch_pins where group_id=g)<>2
 or exists(select 1 from public.combined_delivery_payment_context) then raise exception 'Failed verification left partial state'; end if;
 perform pg_temp.must_fail(format('select public.review_order_payment(%L,''verified'',null,null)',pay),'Use combined payment verification');
end $$;
rollback to atomic_review;

-- A zero shared shipping fee stays zero, without being copied onto members.
savepoint free_shipping;
do $$ declare g uuid; begin
 perform set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000001',true);
 select (public.request_combined_delivery(array['65000000-0000-0000-0000-000000000001'::uuid,'65000000-0000-0000-0000-000000000002'::uuid],14.6,121,'Unit 1, Test address',true)).id into g;
 perform set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000002',true);
 perform public.review_combined_delivery(g,'approve');perform public.review_combined_delivery(g,'set_shipping_fee',null,0);
 if (select total from public.combined_delivery_payment_accounts where group_id=g)<>950 then raise exception 'Free shipping total incorrect'; end if;
end $$;
rollback to free_shipping;

-- Valid standalone submission and verification continue through the original RPCs.
savepoint standalone;
do $$ declare result jsonb; pay uuid; begin
 perform set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000001',true);
 update public.orders set deadline_paused_at=null,shipping_applies=false,shipping_state=null,reservation_expires_at=now()+interval '1 day' where id='65000000-0000-0000-0000-000000000003';
 result:=public.submit_order_payment('65000000-0000-0000-0000-000000000003','GCash',400,'SINGLE',null,null,null,null);
 if not (result->>'accepted')::boolean then raise exception 'Standalone submission rejected'; end if;
 pay:=(result->'payment'->>'id')::uuid;
 perform set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000002',true);
 perform public.review_order_payment(pay,'verified',null,null);
 if (select status from public.orders where id='65000000-0000-0000-0000-000000000003')<>'payment_confirmed' then raise exception 'Standalone verification regressed'; end if;
end $$;
rollback to standalone;


savepoint activated_recovery;
do $$ declare g uuid; pay uuid; begin
 g:=pg_temp.setup_payment();pay:=pg_temp.submit(g);
 perform set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000002',true);
 perform public.review_combined_delivery_payment(pay,'rejected','Wrong receipt',12);
 update public.user_profiles set can_sell=false where id='61000000-0000-0000-0000-000000000002';
 perform set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000001',true);
 perform public.invalidate_combined_delivery_request(g);
 if exists(select 1 from public.combined_delivery_batch_pins where group_id=g)
 or (select count(*) from public.orders where id in(select order_id from public.combined_delivery_members where group_id=g) and deadline_paused_at=now() and reservation_expires_at=now()+interval '12 hours' and shipping_state='waiting_for_seller')<>2 then raise exception 'Activated recovery lost standalone pause or remaining budget'; end if;
 if exists(select 1 from public.combined_delivery_candidate_records where id in(select order_id from public.combined_delivery_members where group_id=g) and not has_payment_history) then raise exception 'Non-anchor reservation lost its payment history'; end if;
end $$;
rollback to activated_recovery;


savepoint unequal_deadlines;
do $$ declare g uuid; begin
 g:=pg_temp.setup_payment();
 insert into public.combined_delivery_payment_context values(txid_current(),g);
 delete from public.combined_delivery_batch_pins where group_id=g;
 update public.orders set reservation_expires_at=now()-interval '1 second' where id='65000000-0000-0000-0000-000000000001';
 perform public.transition_combined_payment_orders(g,'payment_pending');
 delete from public.combined_delivery_payment_context;
 update public.combined_delivery_payment_accounts set deadline=now()-interval '1 second' where group_id=g;
 perform public.sweep_expirations();
 if (select status from public.orders where id='65000000-0000-0000-0000-000000000001')<>'expired' or
 (select status from public.orders where id='65000000-0000-0000-0000-000000000002')<>'payment_pending' or
 (select deadline_paused_at from public.orders where id='65000000-0000-0000-0000-000000000002') is null then raise exception 'Group expiry changed individual expiration policy'; end if;
 if (select shipping_fee from public.combined_delivery_groups where id=g)<>125.50 or exists(select 1 from public.orders where shipping_fee is not null) then raise exception 'Expiry changed fee history or duplicated fee'; end if;
end $$;
rollback to unequal_deadlines;

-- Authorization boundaries are checked independently of owner-driven fixtures.
do $$ begin
 if has_table_privilege('authenticated','public.combined_delivery_payment_context','INSERT') or has_function_privilege('authenticated','public.activate_combined_payment(uuid)','EXECUTE') or has_table_privilege('authenticated','public.combined_delivery_payment_accounts','UPDATE') then raise exception 'Internal payment authority exposed'; end if;
end $$;
-- Exercise actual authenticated RLS, not only owner-driven RPC checks.
savepoint authenticated_payment;
select set_config('kargo.test.group',pg_temp.setup_payment()::text,true);
set local role authenticated;
select set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000001',true);
select set_config('kargo.test.payment',(public.submit_combined_delivery_payment(current_setting('kargo.test.group')::uuid,'GCash',1075.50,'RLS-PROOF','61000000-0000-0000-0000-000000000001/proof.jpg')->'payment'->>'id'),true);
do $$ begin
 if (select count(*) from public.combined_delivery_payment_reservations where payment_id=current_setting('kargo.test.payment')::uuid)<>2 then raise exception 'Buyer cannot see own payment links'; end if;
 if (select method_type from public.payments where id=current_setting('kargo.test.payment')::uuid)<>'GCash' then raise exception 'Payment method snapshot lost'; end if;
end $$;
select set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000003',true);
do $$ begin
 if exists(select 1 from public.payments where id=current_setting('kargo.test.payment')::uuid) or exists(select 1 from public.combined_delivery_payment_reservations where payment_id=current_setting('kargo.test.payment')::uuid) then raise exception 'RLS exposed another buyer payment'; end if;
end $$;
select set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000002',true);
select public.review_combined_delivery_payment(current_setting('kargo.test.payment')::uuid,'verified');
reset role;
rollback to authenticated_payment;
rollback;
