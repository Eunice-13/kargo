-- Unused-state downgrade only. Never discard payment or resumed-deadline history.
begin;
lock table public.orders, public.payments, public.combined_delivery_groups,
 public.combined_delivery_members, public.combined_delivery_payment_accounts in access exclusive mode nowait;
do $$ begin
 if exists(select 1 from public.combined_delivery_payment_accounts)
 or exists(select 1 from public.payments where combined_delivery_group_id is not null) then
 raise exception 'Cannot roll back combined payments after activation; preserve payment and deadline history' using errcode='22023'; end if;
end $$;
drop trigger payments_combined_review_guard on public.payments;
do $$ declare f text; definition text; begin
 foreach f in array array['assert_combined_delivery_group','guard_order_combined_delivery',
 'guard_individual_combined_delivery_payment','reject_expired_payment_insert',
 'guard_combined_delivery_group','guard_combined_delivery_member','invalidate_combined_delivery_request',
 'review_combined_delivery','sweep_expirations','seller_combined_delivery_requests','review_order_payment'] loop
  select pg_get_functiondef(p.oid) into strict definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='phase3_'||f;
  execute replace(definition,'public.phase3_'||f||'(', 'public.'||f||'(');
  execute format('drop function %s',
   (select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='phase3_'||f));
 end loop;
 if exists(select 1 from pg_trigger where tgname='queue_payment_submitted_email_trigger') then
  drop trigger queue_payment_submitted_email_trigger on public.payments;
  create trigger queue_payment_submitted_email_trigger after insert on public.payments for each row execute function public.queue_payment_email();
  drop trigger queue_payment_reviewed_email_trigger on public.payments;
  create trigger queue_payment_reviewed_email_trigger after update of status on public.payments for each row execute function public.queue_payment_email();
 end if;
end $$;
drop function public.submit_combined_delivery_payment(uuid,text,numeric,text,text,text,text,text),
 public.review_combined_delivery_payment(uuid,public.payment_status,text,numeric),
 public.guard_combined_payment_review(),public.activate_combined_payment(uuid),
 public.transition_combined_payment_orders(uuid,public.order_status,timestamptz,boolean),
 public.lock_combined_payment(uuid),public.notify_combined_payment(uuid,text,uuid),
 public.expire_combined_payments(),public.sweep_standalone_delivery_expirations(),public.combined_payment_context(uuid);
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
  exists (select 1 from public.payments p where p.order_id = o.id) as has_payment_history,
  o.total_amount as item_subtotal
from public.orders o join public.batch_products bp on bp.id = o.batch_product_id
left join public.delivery_destinations d on d.id = o.delivery_destination_id
left join public.combined_delivery_members m on m.order_id = o.id and m.released_at is null;

drop table public.combined_delivery_payment_reservations,public.combined_delivery_payment_context,public.combined_delivery_payment_accounts;
alter table public.payments drop column combined_delivery_group_id;
alter table public.combined_delivery_groups drop constraint combined_delivery_groups_status_check;
alter table public.combined_delivery_groups add constraint combined_delivery_groups_status_check
 check(status in ('pending_approval','awaiting_shipping_fee','shipping_fee_set','rejected','cancelled','invalidated'));
alter table public.combined_delivery_groups drop constraint combined_delivery_groups_shipping_fee_check;
alter table public.combined_delivery_groups add constraint combined_delivery_groups_shipping_fee_check check (
 (status in ('shipping_fee_set','invalidated') and shipping_fee is not null and shipping_fee>=0 and shipping_fee_set_at is not null
 and approved_at is not null and payment_window_seconds is not null and payment_window_seconds>0)
 or(status<>'shipping_fee_set' and shipping_fee is null and shipping_fee_set_at is null));
alter table public.combined_delivery_events drop constraint combined_delivery_events_event_type_check;
alter table public.combined_delivery_events add constraint combined_delivery_events_event_type_check
 check(event_type in ('created','member_added','rejected','cancelled','invalidated','approved','shipping_fee_assigned'));
notify pgrst,'reload schema';
commit;
