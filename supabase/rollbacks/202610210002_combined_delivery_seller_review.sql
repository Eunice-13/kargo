begin;
do $$ begin
 if exists(select 1 from public.combined_delivery_groups where status in ('awaiting_shipping_fee','shipping_fee_set')) then
 raise exception 'Cannot roll back seller review while approved delivery groups exist'; end if;
end; $$;
drop function public.review_combined_delivery(uuid,text,text,numeric);
drop function public.seller_combined_delivery_requests();
create or replace function public.guard_combined_delivery_group()
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

create or replace function public.guard_combined_delivery_member()
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

create or replace function public.audit_combined_delivery_group()
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

drop function public.assert_combined_delivery_group(uuid);
alter table public.combined_delivery_groups drop constraint combined_delivery_groups_shipping_fee_check;
alter table public.combined_delivery_groups drop constraint combined_delivery_groups_status_check;
alter table public.combined_delivery_groups drop column approved_at, drop column shipping_fee_set_at, drop column payment_window_seconds;
alter table public.combined_delivery_groups add check(status in ('pending_approval','rejected','cancelled','invalidated')), add check(shipping_fee is null);
-- Retain append-only approval/fee events for historical audit compatibility.
commit;
