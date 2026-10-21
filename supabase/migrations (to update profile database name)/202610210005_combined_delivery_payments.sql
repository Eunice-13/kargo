-- Phase 4: one manual proof and one shipping charge per delivery group.
begin;
lock table public.orders, public.payments, public.combined_delivery_groups,
 public.combined_delivery_members, public.combined_delivery_batch_pins, public.batch_products, public.batches, public.user_profiles in access exclusive mode nowait;

-- Preserve existing implementations for guarded delegation and rollback.
do $$ declare f text; definition text; begin
 foreach f in array array['assert_combined_delivery_group','guard_order_combined_delivery',
 'guard_individual_combined_delivery_payment','reject_expired_payment_insert',
 'guard_combined_delivery_group','guard_combined_delivery_member','invalidate_combined_delivery_request',
 'review_combined_delivery','sweep_expirations','seller_combined_delivery_requests','review_order_payment'] loop
  select pg_get_functiondef(p.oid) into strict definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname=f;
  execute replace(definition,'public.'||f||'(', 'public.phase3_'||f||'(');
  execute format('revoke all on function %s from public,anon,authenticated,service_role',
   (select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='phase3_'||f));
 end loop;
end $$;

alter table public.combined_delivery_groups drop constraint combined_delivery_groups_status_check;
alter table public.combined_delivery_groups add constraint combined_delivery_groups_status_check
 check(status in ('pending_approval','awaiting_shipping_fee','shipping_fee_set','paid','rejected','cancelled','invalidated'));
alter table public.combined_delivery_groups drop constraint combined_delivery_groups_shipping_fee_check;
alter table public.combined_delivery_groups add constraint combined_delivery_groups_shipping_fee_check check (
 (status in ('shipping_fee_set','paid','invalidated') and shipping_fee is not null and shipping_fee>=0
  and shipping_fee_set_at is not null and approved_at is not null and payment_window_seconds>0)
 or (status not in ('shipping_fee_set','paid') and shipping_fee is null and shipping_fee_set_at is null));
alter table public.combined_delivery_events drop constraint combined_delivery_events_event_type_check;
alter table public.combined_delivery_events add constraint combined_delivery_events_event_type_check
 check(event_type in ('created','member_added','rejected','cancelled','invalidated','approved','shipping_fee_assigned','paid','payment_ready','payment_submitted','payment_verified','payment_rejected','payment_expired'));

-- One ledger per group; amounts are server snapshots of locked reservation rows.
create table public.combined_delivery_payment_accounts (
 group_id uuid primary key references public.combined_delivery_groups(id) on delete restrict,
 items_subtotal numeric(14,2) not null check(items_subtotal>=0),
 shipping_fee numeric(12,2) not null check(shipping_fee>=0),
 total numeric(14,2) generated always as (items_subtotal+shipping_fee) stored,
 deadline timestamptz not null,
 status text not null check(status in ('ready','pending_review','rejected','verified','expired','invalidated')),
 created_at timestamptz not null default now()
);
alter table public.payments add column combined_delivery_group_id uuid references public.combined_delivery_groups(id) on delete restrict;
create unique index payments_combined_delivery_open_uidx on public.payments(combined_delivery_group_id)
 where combined_delivery_group_id is not null and status in ('pending_review','verified');
create unique index payments_combined_delivery_reference_uidx on public.payments(combined_delivery_group_id,reference_number)
 where combined_delivery_group_id is not null and reference_number is not null;
alter table public.payments add constraint payments_combined_delivery_identity_key unique(id,combined_delivery_group_id);
create table public.combined_delivery_payment_reservations (
 payment_id uuid not null,
 group_id uuid not null, order_id uuid not null references public.orders(id) on delete restrict,
 item_subtotal numeric(12,2) not null,
 primary key(payment_id,order_id),
 foreign key(payment_id,group_id) references public.payments(id,combined_delivery_group_id) on delete restrict,
 foreign key(group_id,order_id) references public.combined_delivery_members(group_id,order_id) on delete restrict
);
create or replace view public.combined_delivery_candidate_records as
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
  (exists (select 1 from public.payments p where p.order_id = o.id) or exists(select 1 from public.combined_delivery_payment_reservations linked where linked.order_id=o.id)) as has_payment_history,
  o.total_amount as item_subtotal
from public.orders o join public.batch_products bp on bp.id = o.batch_product_id
left join public.delivery_destinations d on d.id = o.delivery_destination_id
left join public.combined_delivery_members m on m.order_id = o.id and m.released_at is null;

-- Unforgeable transaction-local capability. Custom settings alone are NOT authority.
create table public.combined_delivery_payment_context (
 transaction_id bigint primary key, group_id uuid not null references public.combined_delivery_groups(id)
);
alter table public.combined_delivery_payment_context enable row level security;
revoke all on public.combined_delivery_payment_context from public,anon,authenticated,service_role;
alter table public.combined_delivery_payment_accounts enable row level security;
alter table public.combined_delivery_payment_reservations enable row level security;
revoke all on public.combined_delivery_payment_accounts,public.combined_delivery_payment_reservations from public,anon,authenticated,service_role;
grant select on public.combined_delivery_payment_accounts,public.combined_delivery_payment_reservations to authenticated;
create policy combined_payment_accounts_read on public.combined_delivery_payment_accounts for select to authenticated using
 (exists(select 1 from public.combined_delivery_groups g where g.id=group_id and auth.uid() in (g.buyer_id,g.seller_id)));
create policy combined_payment_links_read on public.combined_delivery_payment_reservations for select to authenticated using
 (exists(select 1 from public.combined_delivery_groups g where g.id=group_id and auth.uid() in (g.buyer_id,g.seller_id)));

create function public.combined_payment_context(p_group uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.combined_delivery_payment_context where transaction_id=txid_current() and group_id=p_group);
$$;
-- All transitions share Phase 3's order, then stabilize product/batch/profile identity.
create function public.lock_combined_payment(p_group uuid) returns public.combined_delivery_groups
language plpgsql security definer set search_path='' as $$
declare g public.combined_delivery_groups;
begin
 select * into strict g from public.combined_delivery_groups where id=p_group;
 perform pg_advisory_xact_lock(hashtextextended('combined_delivery:'||g.buyer_id::text,0));
 perform 1 from public.orders where id in(select order_id from public.combined_delivery_members where group_id=g.id) order by id for update;
 select * into strict g from public.combined_delivery_groups where id=p_group for update;
 perform public.combined_delivery_batch_reasons(array(select order_id from public.combined_delivery_members where group_id=g.id and released_at is null order by order_id),g.batch_id);
 perform 1 from public.user_profiles where id in(g.buyer_id,g.seller_id) order by id for share;
 return g;
end $$;

create or replace function public.guard_order_combined_delivery() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.combined_delivery_members m where m.order_id=old.id and m.released_at is null and public.combined_payment_context(m.group_id)) then
  if (to_jsonb(new)-array['status','reservation_expires_at','deadline_paused_at','payment_confirmed_at','shipping_state','updated_at','total_amount','combined_delivery_revision'])
   is distinct from (to_jsonb(old)-array['status','reservation_expires_at','deadline_paused_at','payment_confirmed_at','shipping_state','updated_at','total_amount','combined_delivery_revision']) then
   raise exception 'Combined payment cannot change reservation identity or amounts'; end if;
  return new;
 end if;
 -- Preserve the original guard (including destination handling) without calling a trigger function directly.
 if exists(select 1 from public.combined_delivery_members where order_id=old.id and released_at is null)
  and (to_jsonb(new)-array['updated_at','total_amount','combined_delivery_revision']) is distinct from (to_jsonb(old)-array['updated_at','total_amount','combined_delivery_revision']) then
  raise exception 'Reservation is awaiting combined delivery review'; end if;
 if new.delivery_destination_id is not null and not exists(select 1 from public.delivery_destinations d
  where d.id=new.delivery_destination_id and d.buyer_id=new.buyer_id and d.pin_lat=new.delivery_pin_lat and d.pin_lng=new.delivery_pin_lng and d.address_text=new.delivery_pin_address) then
  if new.delivery_destination_id is distinct from old.delivery_destination_id then raise exception 'Destination does not match reservation'; end if;
  new.delivery_destination_id:=null;
 end if;
 return new;
end $$;

-- Caller holds all order/context locks. Remove/recreate private pins only within
-- this atomic transition; other sessions cannot observe an unprotected commit.
create function public.transition_combined_payment_orders(p_group uuid,p_status public.order_status,p_deadline timestamptz default null,p_resume boolean default false)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.combined_payment_context(p_group) then raise exception 'Private payment transition required' using errcode='42501'; end if;
 delete from public.combined_delivery_batch_pins where group_id=p_group;
 update public.orders set status=p_status,
  shipping_state=case when p_status='payment_confirmed' then 'fee_set' else shipping_state end,
  reservation_expires_at=case when p_deadline is not null then p_deadline when p_resume then now()+greatest(reservation_expires_at-deadline_paused_at,interval '0 seconds') else reservation_expires_at end,
  deadline_paused_at=case when p_resume then null else deadline_paused_at end,
  payment_confirmed_at=case when p_status='payment_confirmed' then coalesce(payment_confirmed_at,now()) else null end
 where id in(select order_id from public.combined_delivery_members where group_id=p_group and released_at is null);
 insert into public.combined_delivery_batch_pins(group_id,order_id,product_id,order_revision,batch_id,seller_id)
 select m.group_id,m.order_id,o.batch_product_id,o.combined_delivery_revision,g.batch_id,g.seller_id
 from public.combined_delivery_members m join public.orders o on o.id=m.order_id join public.combined_delivery_groups g on g.id=m.group_id
 where m.group_id=p_group and m.released_at is null;
end $$;

create or replace function public.assert_combined_delivery_group(p_group_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare g public.combined_delivery_groups; a public.combined_delivery_payment_accounts; ids uuid[];
begin
 select * into a from public.combined_delivery_payment_accounts where group_id=p_group_id;
 if not found then perform public.phase3_assert_combined_delivery_group(p_group_id); return; end if;
 select * into strict g from public.combined_delivery_groups where id=p_group_id;
 select array_agg(order_id order by order_id) into ids from public.combined_delivery_members where group_id=g.id and released_at is null;
 if coalesce(cardinality(ids),0)<2 then raise exception 'Combined delivery requires at least two active reservations' using errcode='22023'; end if;
 perform public.assert_combined_delivery_batch(ids,g.batch_id);
 if not public.is_active(g.buyer_id) or not public.can_sell(g.seller_id) or not exists(select 1 from public.batches where id=g.batch_id and seller_id=g.seller_id)
 or exists(select 1 from public.orders o join public.combined_delivery_members m on m.order_id=o.id where m.group_id=g.id and m.released_at is null and (
 o.buyer_id<>g.buyer_id or o.seller_id<>g.seller_id or o.delivery_destination_id is distinct from g.destination_id or o.reserved_payment_method is distinct from g.payment_method
 or not o.shipping_applies or not o.buyer_accepted_shipping_fee or o.shipping_fee is not null or o.shipping_state<>'waiting_for_seller'
 or o.group_order_id is not null or o.total_amount<>m.item_subtotal or o.deadline_paused_at is not null
 or o.status::text<>case when a.status='pending_review' then 'payment_submitted' else 'payment_pending' end))
 or a.items_subtotal<>(select sum(o.total_amount) from public.orders o where o.id=any(ids)) or a.shipping_fee is distinct from g.shipping_fee then
 raise exception 'Reservations are no longer eligible for this combined delivery. Refresh and review the request.' using errcode='22023'; end if;
end $$;

-- Extend only the terminal payment transition; ordinary Phase 3 transitions keep their implementation.
create or replace function public.guard_combined_delivery_group() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and new.status='paid' and old.status='shipping_fee_set' and public.combined_payment_context(old.id) then
  if (to_jsonb(new)-array['status','updated_at']) is distinct from (to_jsonb(old)-array['status','updated_at']) then raise exception 'Payment cannot rewrite group history'; end if;
  return new;
 end if;

  if tg_op='DELETE' then raise exception 'Delivery group history cannot be deleted'; end if;
  if tg_op='INSERT' then
    if new.status<>'pending_approval' or new.shipping_fee is not null or new.approved_at is not null
      or new.shipping_fee_set_at is not null or new.payment_window_seconds is not null
      or not public.is_active(new.buyer_id) or not public.can_sell(new.seller_id)
      or not exists(select 1 from public.batches where id=new.batch_id and seller_id=new.seller_id) then
      raise exception 'Invalid delivery group context'; end if;
  else
    -- Recovery is terminal and preserves ALL historical financial metadata.
    -- Only the participant-authorized RPC below can request this transition;
    -- clients still have no direct table-write privileges.
    if old.status in ('pending_approval','awaiting_shipping_fee','shipping_fee_set') and new.status='invalidated' then
      if (to_jsonb(new)-array['status','decided_by','decision_reason','updated_at'])
        is distinct from (to_jsonb(old)-array['status','decided_by','decision_reason','updated_at'])
        or nullif(trim(new.decision_reason),'') is null
        or new.decided_by is distinct from auth.uid() then
        raise exception 'Invalid delivery recovery transition';
      end if;
      new.updated_at:=now(); return new;
    end if;
    if (to_jsonb(new)-array['status','decided_by','decision_reason','updated_at','approved_at','shipping_fee','shipping_fee_set_at','payment_window_seconds'])
      is distinct from (to_jsonb(old)-array['status','decided_by','decision_reason','updated_at','approved_at','shipping_fee','shipping_fee_set_at','payment_window_seconds']) then
      raise exception 'Delivery group identity is immutable'; end if;
    if new.status not in ('rejected','cancelled','invalidated') then
      perform public.assert_combined_delivery_batch(array(select order_id from public.combined_delivery_members where group_id=old.id and released_at is null order by order_id),new.batch_id);
    end if;
    if old.status='pending_approval' and new.status in ('rejected','cancelled','invalidated','pending_approval') then
      if new.shipping_fee is not null or new.approved_at is not null or new.shipping_fee_set_at is not null or new.payment_window_seconds is not null then raise exception 'Invalid financial transition'; end if;
    elsif old.status='pending_approval' and new.status='awaiting_shipping_fee' then
      perform public.assert_combined_delivery_group(old.id);
      if new.approved_at is null or new.shipping_fee is not null or new.payment_window_seconds is not null then raise exception 'Invalid approval'; end if;
    elsif old.status='awaiting_shipping_fee' and new.status='shipping_fee_set' then
      perform public.assert_combined_delivery_group(old.id);
      if new.approved_at is distinct from old.approved_at then raise exception 'Approval is immutable'; end if;
    else raise exception 'Invalid delivery transition'; end if;
  end if;
  new.updated_at:=now(); return new;
end $$;
create or replace function public.guard_combined_delivery_member()
returns trigger language plpgsql security definer set search_path = '' as $$
declare g public.combined_delivery_groups; r record;
begin
  if tg_op = 'DELETE' then raise exception 'Delivery membership history cannot be deleted'; end if;
  if tg_op = 'UPDATE' then
    if public.combined_payment_context(old.group_id) and exists(select 1 from public.combined_delivery_groups where id=old.group_id and status='paid')
      and (to_jsonb(new)-'released_at')=(to_jsonb(old)-'released_at') and old.released_at is null and new.released_at is not null then return new; end if;
    if (to_jsonb(new) - 'released_at') is distinct from (to_jsonb(old) - 'released_at')
      or old.released_at is not null or new.released_at is null
      or exists (select 1 from public.combined_delivery_groups where id = old.group_id and status not in ('rejected', 'cancelled', 'invalidated')) then
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

create function public.notify_combined_payment(p_group uuid,p_event text,p_payment uuid default null) returns void
language plpgsql security definer set search_path='' as $$
declare g public.combined_delivery_groups; recipient uuid; body text;
begin
 select * into strict g from public.combined_delivery_groups where id=p_group;
 for recipient in select unnest(case when p_event='submitted' then array[g.buyer_id,g.seller_id] else array[g.buyer_id] end) loop
  body:=case p_event when 'ready' then 'Your combined payment is ready. Pay the item subtotal and one shared shipping fee before the deadline.'
   when 'submitted' then case when recipient=g.seller_id then 'New combined payment proof is awaiting your review.' else 'Your combined payment proof was submitted for seller review.' end
   when 'verified' then 'Your combined payment was verified. All included reservations are confirmed.'
   when 'rejected' then 'Your combined payment was rejected. Review the reason and submit a new proof before the updated deadline.'
   when 'expired' then 'Your combined payment deadline expired. The included reservations have expired.' end;
  if body is null then raise exception 'Unknown combined payment event'; end if;
  insert into public.notifications(recipient_id,category,message,target_path,context,dedupe_key)
  values(recipient,case when p_event='verified' then 'check' else 'clipboard' end,body,
   case when recipient=g.seller_id then 'Payments' else 'My Claims' end,
   jsonb_build_object('combined_delivery_group_id',g.id,'payment_id',p_payment),
   'combined_payment_'||p_event||'_'||coalesce(p_payment::text,g.id::text))
  on conflict(recipient_id,dedupe_key) where dedupe_key is not null do nothing;
 end loop;
 insert into public.combined_delivery_events(group_id,actor_id,event_type,details)
 values(g.id,auth.uid(),'payment_'||p_event,jsonb_build_object('payment_id',p_payment));
end $$;

create function public.activate_combined_payment(p_group uuid) returns void language plpgsql security definer set search_path='' as $$
declare g public.combined_delivery_groups; subtotal numeric; due timestamptz;
begin
 g:=public.lock_combined_payment(p_group);
 if g.status<>'shipping_fee_set' or exists(select 1 from public.combined_delivery_payment_accounts where group_id=g.id) then return; end if;
 perform public.phase3_assert_combined_delivery_group(g.id);
 select sum(o.total_amount), min(now()+greatest(o.reservation_expires_at-o.deadline_paused_at,interval '0 seconds')) into subtotal,due
 from public.orders o join public.combined_delivery_members m on m.order_id=o.id where m.group_id=g.id and m.released_at is null;
 insert into public.combined_delivery_payment_context values(txid_current(),g.id);
 -- Each reservation retains its own original remaining budget; the group must be paid before the earliest deadline.
 perform public.transition_combined_payment_orders(g.id,'payment_pending',null,true);
 insert into public.combined_delivery_payment_accounts(group_id,items_subtotal,shipping_fee,deadline,status)
 values(g.id,subtotal,g.shipping_fee,due,'ready');
 perform public.notify_combined_payment(g.id,'ready');
 delete from public.combined_delivery_payment_context where transaction_id=txid_current();
end $$;

create or replace function public.review_combined_delivery(p_group_id uuid,p_action text,p_reason text default null,p_shipping_fee numeric default null)
returns public.combined_delivery_groups language plpgsql security definer set search_path='' as $$
declare g public.combined_delivery_groups;
begin
 g:=public.phase3_review_combined_delivery(p_group_id,p_action,p_reason,p_shipping_fee);
 if p_action='set_shipping_fee' then
  -- Replace the old fee notice with a single ready notice in the same transaction.
  delete from public.notifications where recipient_id=g.buyer_id and dedupe_key='combined_delivery_set_shipping_fee_'||g.id::text;
  perform public.activate_combined_payment(g.id);
 end if;
 return g;
end $$;

create or replace function public.invalidate_combined_delivery_request(p_group_id uuid) returns public.combined_delivery_groups
language plpgsql security definer set search_path='' as $$
declare g public.combined_delivery_groups; a public.combined_delivery_payment_accounts;
begin
 if auth.uid() is null or not public.is_active(auth.uid()) then raise exception 'Active participant account required' using errcode='42501'; end if;
 select * into g from public.combined_delivery_groups where id=p_group_id and auth.uid() in(buyer_id,seller_id);
 if not found then raise exception 'Delivery request unavailable' using errcode='42501'; end if;
 g:=public.lock_combined_payment(g.id);
 select * into a from public.combined_delivery_payment_accounts where group_id=g.id;
 if a.status in ('pending_review','verified') or g.status='paid' then raise exception 'Submitted or verified combined payments cannot be invalidated' using errcode='22023'; end if;
 -- The Phase 3.1 assertion must fail before any membership is released.
 g:=public.phase3_invalidate_combined_delivery_request(g.id);
 if g.status='invalidated' and a.group_id is not null then
  update public.combined_delivery_payment_accounts set status='invalidated' where group_id=g.id;
  -- Return to the genuine standalone shipping pause, preserving time remaining now.
  update public.orders set deadline_paused_at=coalesce(deadline_paused_at,now()),shipping_state='waiting_for_seller'
  where id in(select order_id from public.combined_delivery_members where group_id=g.id)
   and status='payment_pending' and shipping_applies and shipping_fee is null;
 end if;
 return g;
end $$;

create function public.submit_combined_delivery_payment(p_group_id uuid,p_method_type text,p_amount numeric,
 p_reference_number text default null,p_receipt_path text default null,p_payer_account_name text default null,
 p_payer_phone text default null,p_buyer_contact_url text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare g public.combined_delivery_groups; a public.combined_delivery_payment_accounts; result public.payments; anchor uuid; method_id uuid;
begin
 if auth.uid() is null or not public.is_active(auth.uid()) then raise exception 'Active buyer account required' using errcode='42501'; end if;
 select * into g from public.combined_delivery_groups where id=p_group_id and buyer_id=auth.uid();
 if not found then raise exception 'Delivery request unavailable' using errcode='42501'; end if;
 g:=public.lock_combined_payment(g.id);
 select * into a from public.combined_delivery_payment_accounts where group_id=g.id for update;
 if g.status<>'shipping_fee_set' or a.status not in ('ready','rejected') or a.group_id is null then raise exception 'Combined payment is not payable' using errcode='22023'; end if;
 perform public.assert_combined_delivery_group(g.id);
 if a.deadline<=now() or exists(select 1 from public.orders where id in(select order_id from public.combined_delivery_members where group_id=g.id and released_at is null) and reservation_expires_at<=now()) then
  raise exception 'Payment deadline has expired' using errcode='22023'; end if;
 if p_amount is null or p_amount::text in ('NaN','Infinity','-Infinity') or p_amount<>round(p_amount,2) or p_amount<>a.total or p_amount<=0 then
  raise exception 'Submit the exact combined total, including one shared shipping fee' using errcode='22023'; end if;
 if lower(trim(p_method_type)) is distinct from lower(g.payment_method) then raise exception 'Use the payment method selected at reservation' using errcode='22023'; end if;
 select id into method_id from public.seller_payment_methods where seller_id=g.seller_id and lower(method_type)=lower(g.payment_method) and is_active order by id limit 1 for share;
 if method_id is null then raise exception 'The seller payment method is unavailable' using errcode='22023'; end if;
 if nullif(trim(p_reference_number),'') is null or nullif(trim(p_receipt_path),'') is null then raise exception 'Reference number and one payment proof are required' using errcode='22023'; end if;
 if split_part(p_receipt_path,'/',1)<>auth.uid()::text or not exists(select 1 from storage.objects where bucket_id='payment-receipts' and name=p_receipt_path) then
  raise exception 'Upload a payment proof belonging to your account' using errcode='42501'; end if;
 select order_id into anchor from public.combined_delivery_members where group_id=g.id and released_at is null order by order_id limit 1;
 insert into public.combined_delivery_payment_context values(txid_current(),g.id);
 insert into public.payments(order_id,combined_delivery_group_id,submitted_by,seller_payment_method_id,method_type,amount,reference_number,receipt_path,payer_account_name,payer_phone,buyer_contact_url)
 values(anchor,g.id,auth.uid(),method_id,g.payment_method,a.total,trim(p_reference_number),p_receipt_path,nullif(trim(p_payer_account_name),''),nullif(trim(p_payer_phone),''),nullif(trim(p_buyer_contact_url),'')) returning * into result;
 insert into public.combined_delivery_payment_reservations(payment_id,group_id,order_id,item_subtotal)
 select result.id,g.id,m.order_id,o.total_amount from public.combined_delivery_members m join public.orders o on o.id=m.order_id where m.group_id=g.id and m.released_at is null;
 perform public.transition_combined_payment_orders(g.id,'payment_submitted');
 update public.combined_delivery_payment_accounts set status='pending_review' where group_id=g.id;
 perform public.notify_combined_payment(g.id,'submitted',result.id);
 delete from public.combined_delivery_payment_context where transaction_id=txid_current();
 return jsonb_build_object('accepted',true,'payment',to_jsonb(result));
end $$;

create function public.review_combined_delivery_payment(p_payment_id uuid,p_decision public.payment_status,p_reason text default null,p_deadline_hours numeric default null)
returns void language plpgsql security definer set search_path='' as $$
declare g public.combined_delivery_groups; a public.combined_delivery_payment_accounts; pay public.payments; due timestamptz;
begin
 if auth.uid() is null or not public.is_active(auth.uid()) or not public.can_sell(auth.uid()) then raise exception 'Active seller account required' using errcode='42501'; end if;
 select p.* into pay from public.payments p join public.combined_delivery_groups header on header.id=p.combined_delivery_group_id where p.id=p_payment_id and header.seller_id=auth.uid();
 if not found then raise exception 'Combined payment unavailable' using errcode='42501'; end if;
 g:=public.lock_combined_payment(pay.combined_delivery_group_id);
 select * into a from public.combined_delivery_payment_accounts where group_id=g.id for update;
 select * into pay from public.payments where id=p_payment_id for update;
 if p_decision not in ('verified','rejected') or p_decision is null then raise exception 'Invalid payment decision' using errcode='22023'; end if;
 if pay.status=p_decision then return; end if;
 if pay.status<>'pending_review' or a.status<>'pending_review' or g.status<>'shipping_fee_set' then raise exception 'Payment has already been reviewed' using errcode='22023'; end if;
 perform public.assert_combined_delivery_group(g.id);
 if (select count(*) from public.combined_delivery_payment_reservations where payment_id=pay.id)<>(select count(*) from public.combined_delivery_members where group_id=g.id and released_at is null) or pay.amount<>a.total then raise exception 'Combined payment membership or total changed' using errcode='22023'; end if;
 if p_decision='rejected' then
  if p_deadline_hours is null or p_deadline_hours::text in ('NaN','Infinity','-Infinity') or p_deadline_hours<=0 or nullif(trim(p_reason),'') is null then raise exception 'Rejection reason and positive resubmission deadline are required' using errcode='22023'; end if;
  due:=now()+p_deadline_hours*interval '1 hour';
 end if;
 insert into public.combined_delivery_payment_context values(txid_current(),g.id);
 update public.payments set status=p_decision,rejection_reason=case when p_decision='rejected' then trim(p_reason) end,
  rejection_deadline=due,reviewed_at=now(),reviewed_by=auth.uid() where id=pay.id;
 perform public.transition_combined_payment_orders(g.id,case when p_decision='verified' then 'payment_confirmed'::public.order_status else 'payment_pending'::public.order_status end,due);
 update public.combined_delivery_payment_accounts set status=case when p_decision='verified' then 'verified' else 'rejected' end,deadline=coalesce(due,deadline) where group_id=g.id;
 if p_decision='verified' then
  update public.combined_delivery_groups set status='paid' where id=g.id;
  update public.combined_delivery_members set released_at=now() where group_id=g.id and released_at is null;
 end if;
 perform public.notify_combined_payment(g.id,case when p_decision='verified' then 'verified' else 'rejected' end,pay.id);
 delete from public.combined_delivery_payment_context where transaction_id=txid_current();
end $$;

create or replace function public.guard_individual_combined_delivery_payment()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.combined_delivery_group_id is not null then
    if not public.combined_payment_context(new.combined_delivery_group_id) then raise exception 'Use the combined payment workflow' using errcode='42501'; end if;
    return new;
  end if;
  perform 1 from public.orders where id = new.order_id for update;
  if exists (select 1 from public.combined_delivery_members where order_id = new.order_id and released_at is null) then
    raise exception 'Individual payment is blocked for an active combined delivery';
  end if;
  return new;
end;
$$;

create or replace function public.reject_expired_payment_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.orders;
begin
  if new.combined_delivery_group_id is not null then
    if not public.combined_payment_context(new.combined_delivery_group_id) then raise exception 'Use the combined payment workflow' using errcode='42501'; end if;
    return new;
  end if;
  select * into target from public.orders where id = new.order_id;
  if not found then raise exception 'Order not found'; end if;
  if target.reservation_expires_at <= now() then raise exception 'Payment deadline has expired'; end if;
  if target.status not in ('payment_pending', 'insufficient_payment') then raise exception 'Order is not payable'; end if;
  return new;
end;
$$;

create function public.guard_combined_payment_review() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.combined_delivery_group_id is not null and not public.combined_payment_context(old.combined_delivery_group_id) then
  raise exception 'Use combined payment verification for this payment' using errcode='42501'; end if;
 if new.combined_delivery_group_id is distinct from old.combined_delivery_group_id then raise exception 'Payment group identity is immutable'; end if;
 return new;
end $$;
create trigger payments_combined_review_guard before update on public.payments for each row execute function public.guard_combined_payment_review();

-- Generic per-reservation email triggers would describe only the representative
-- order. Exclude combined payments; group notices use the existing notification table.
do $$ begin
 if exists(select 1 from pg_trigger where tgname='queue_payment_submitted_email_trigger') then
  drop trigger queue_payment_submitted_email_trigger on public.payments;
  create trigger queue_payment_submitted_email_trigger after insert on public.payments for each row
   when (new.combined_delivery_group_id is null) execute function public.queue_payment_email();
  drop trigger queue_payment_reviewed_email_trigger on public.payments;
  create trigger queue_payment_reviewed_email_trigger after update of status on public.payments for each row
   when (new.combined_delivery_group_id is null) execute function public.queue_payment_email();
 end if;
end $$;

create function public.expire_combined_payments() returns void language plpgsql security definer set search_path='' as $$
declare candidate record; g public.combined_delivery_groups; a public.combined_delivery_payment_accounts; member record;
begin
 for candidate in select group_id from public.combined_delivery_payment_accounts where status in ('ready','rejected') and deadline<=now() order by group_id loop
  -- Do not wait with a partial order lock set. Other group actions use the same advisory lock.
  select * into g from public.combined_delivery_groups where id=candidate.group_id;
  if not pg_try_advisory_xact_lock(hashtextextended('combined_delivery:'||g.buyer_id::text,0)) then continue; end if;
  g:=public.lock_combined_payment(g.id);
  select * into a from public.combined_delivery_payment_accounts where group_id=g.id for update;
  if a.status not in ('ready','rejected') or a.deadline>now() then continue; end if;
  -- The shared payment window is the earliest original reservation deadline.
  -- Release the group, then let each reservation's existing expiry rule decide.
  update public.combined_delivery_groups set status='invalidated',decision_reason='Combined payment deadline expired',decided_by=auth.uid() where id=g.id;
  update public.combined_delivery_payment_accounts set status='expired' where group_id=g.id;
  for member in select o.* from public.orders o join public.combined_delivery_members m on m.order_id=o.id where m.group_id=g.id order by o.id loop
   if member.reservation_expires_at<=now() then
    update public.orders set status='expired',deadline_paused_at=null,shipping_state=null where id=member.id;
    perform public.offer_to_next_waitlist(member.batch_product_id);
   else
    -- Longer original budgets return to genuine standalone shipping waits.
    update public.orders set deadline_paused_at=now(),shipping_state='waiting_for_seller' where id=member.id;
   end if;
  end loop;
  -- Phase 3.1 already emits one recovery notice per participant. One group expiry event, no per-item notices.
  insert into public.combined_delivery_events(group_id,actor_id,event_type,details) values(g.id,auth.uid(),'payment_expired',jsonb_build_object('deadline',a.deadline));
 end loop;
end $$;

-- Preserve the original standalone sweep verbatim except excluding active groups.
-- The wrapper above handles them atomically under the shared group lock order.
do $$ declare definition text; original text; begin
 select pg_get_functiondef('public.phase3_sweep_expirations()'::regprocedure) into definition;
 original:=definition;
 definition:=replace(definition,'o.deadline_paused_at is null and o.reservation_expires_at <= now()',
 'o.deadline_paused_at is null and o.reservation_expires_at <= now() and not exists(select 1 from public.combined_delivery_members m where m.order_id=o.id and m.released_at is null)');
 if definition=original then raise exception 'Standalone sweep definition changed; review integration before migrating'; end if;
 definition:=replace(definition,'public.phase3_sweep_expirations()', 'public.sweep_standalone_delivery_expirations()');
 execute definition;
end $$;
create or replace function public.sweep_expirations() returns void language plpgsql security definer set search_path='' as $$
begin perform public.expire_combined_payments(); perform public.sweep_standalone_delivery_expirations(); end $$;

-- Existing fee-assigned groups activate only after authoritative revalidation.
-- Invalid legacy data fails this entire migration rather than silently rewriting history.
do $$ declare g record; begin
 for g in select id from public.combined_delivery_groups where status='shipping_fee_set' order by buyer_id,id loop
  perform public.activate_combined_payment(g.id);
 end loop;
end $$;

-- Internal helpers never become client-callable, including via service-role REST.
do $$ declare f record; begin
 for f in select p.oid::regprocedure::text as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('combined_payment_context','lock_combined_payment','transition_combined_payment_orders',
 'notify_combined_payment','activate_combined_payment','expire_combined_payments','sweep_standalone_delivery_expirations','guard_combined_payment_review') loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
 end loop;
end $$;
revoke all on function public.submit_combined_delivery_payment(uuid,text,numeric,text,text,text,text,text),
 public.review_combined_delivery_payment(uuid,public.payment_status,text,numeric) from public,anon;
grant execute on function public.submit_combined_delivery_payment(uuid,text,numeric,text,text,text,text,text),
 public.review_combined_delivery_payment(uuid,public.payment_status,text,numeric) to authenticated;
create or replace function public.seller_combined_delivery_requests()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_active(auth.uid()) or not public.can_sell(auth.uid()) then raise exception 'Active seller account required' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(g)||jsonb_build_object(
    'payment',(select to_jsonb(a) from public.combined_delivery_payment_accounts a where a.group_id=g.id),'buyerName',u.display_name,'batchName',b.title,
    'destination',jsonb_build_object('pin_lat',d.pin_lat,'pin_lng',d.pin_lng,'address_text',d.address_text),
    'members',(select jsonb_agg(jsonb_build_object('order_id',m.order_id,'item_subtotal',m.item_subtotal,'released_at',m.released_at,
      'order',jsonb_build_object('quantity',o.quantity,'batch_products',jsonb_build_object('name',bp.name))) order by m.order_id)
      from public.combined_delivery_members m join public.orders o on o.id=m.order_id join public.batch_products bp on bp.id=o.batch_product_id where m.group_id=g.id)
    ) order by g.created_at desc,g.id) from public.combined_delivery_groups g join public.user_profiles u on u.id=g.buyer_id
      join public.batches b on b.id=g.batch_id join public.delivery_destinations d on d.id=g.destination_id where g.seller_id=auth.uid()),'[]'::jsonb);
end;
$$;

-- Reject grouped proofs before the standalone reviewer takes a payment-first lock.
create or replace function public.review_order_payment(p_payment_id uuid,p_decision public.payment_status,p_reason text,p_deadline_hours numeric)
returns public.orders language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.payments where id=p_payment_id and combined_delivery_group_id is not null) then
  raise exception 'Use combined payment verification for this payment' using errcode='42501'; end if;
 return public.phase3_review_order_payment(p_payment_id,p_decision,p_reason,p_deadline_hours);
end $$;
notify pgrst,'reload schema';
commit;
