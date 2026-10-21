-- Phase 3: seller decisions and a single group fee. Payment remains locked.
begin;
alter table public.combined_delivery_groups drop constraint combined_delivery_groups_status_check;
alter table public.combined_delivery_groups drop constraint combined_delivery_groups_shipping_fee_check;
alter table public.combined_delivery_groups
  add column approved_at timestamptz,
  add column shipping_fee_set_at timestamptz,
  add column payment_window_seconds numeric,
  add constraint combined_delivery_groups_status_check check (status in ('pending_approval','awaiting_shipping_fee','shipping_fee_set','rejected','cancelled','invalidated')),
  add constraint combined_delivery_groups_shipping_fee_check check (
    (status = 'shipping_fee_set' and shipping_fee is not null and shipping_fee >= 0 and shipping_fee_set_at is not null and approved_at is not null and payment_window_seconds is not null and payment_window_seconds > 0)
    or (status <> 'shipping_fee_set' and shipping_fee is null and shipping_fee_set_at is null));
alter table public.combined_delivery_events drop constraint combined_delivery_events_event_type_check;
alter table public.combined_delivery_events add constraint combined_delivery_events_event_type_check
  check(event_type in ('created','member_added','rejected','cancelled','invalidated','approved','shipping_fee_assigned'));

-- Private validator: a group's own membership is the ONLY exemption from
-- already_grouped. All underlying eligibility rules still apply under locks.
create function public.assert_combined_delivery_group(p_group_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare g public.combined_delivery_groups; r record; ids uuid[]; reasons text[];
begin
  select * into strict g from public.combined_delivery_groups where id = p_group_id;
  select array_agg(order_id order by order_id) into ids from public.combined_delivery_members where group_id = g.id and released_at is null;
  if coalesce(cardinality(ids),0) < 2 then raise exception 'Combined delivery requires at least two active reservations' using errcode='22023'; end if;
  perform public.assert_combined_delivery_batch(ids, g.batch_id);
  if not public.is_active(g.buyer_id) or not public.can_sell(g.seller_id)
    or not exists(select 1 from public.batches where id=g.batch_id and seller_id=g.seller_id) then
    raise exception 'Delivery group account or batch is no longer eligible' using errcode='22023';
  end if;
  for r in select c.*, m.original_expires_at, m.original_paused_at, m.item_subtotal as saved_subtotal
    from public.combined_delivery_candidate_records c join public.combined_delivery_members m on m.order_id=c.id
    where m.group_id=g.id and m.released_at is null order by c.id loop
    reasons := public.combined_delivery_order_reasons(r.id,g.buyer_id);
    if r.active_delivery_group_id=g.id and r.group_order_id is null then reasons:=array_remove(reasons,'already_grouped'); end if;
    if cardinality(reasons)>0 or r.seller_id<>g.seller_id or r.destination_id is distinct from g.destination_id
      or r.payment_method is distinct from g.payment_method or r.fulfillment_method<>g.fulfillment_method
      or r.item_subtotal is distinct from r.saved_subtotal or r.expires_at is distinct from r.original_expires_at
      or r.deadline_paused_at is distinct from r.original_paused_at then
      raise exception 'Reservations are no longer eligible for this combined delivery. Refresh and review the request.' using errcode='22023', detail=array_to_string(reasons,',');
    end if;
  end loop;
end;
$$;
revoke all on function public.assert_combined_delivery_group(uuid) from public,anon,authenticated;

create or replace function public.guard_combined_delivery_group()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op='DELETE' then raise exception 'Delivery group history cannot be deleted'; end if;
  if tg_op='INSERT' then
    if new.status<>'pending_approval' or new.shipping_fee is not null or new.approved_at is not null
      or new.shipping_fee_set_at is not null or new.payment_window_seconds is not null
      or not public.is_active(new.buyer_id) or not public.can_sell(new.seller_id)
      or not exists(select 1 from public.batches where id=new.batch_id and seller_id=new.seller_id) then
      raise exception 'Invalid delivery group context'; end if;
  else
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

create or replace function public.audit_combined_delivery_group()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op='INSERT' or new.status is distinct from old.status then
    insert into public.combined_delivery_events(group_id,actor_id,event_type,details)
    values(new.id,auth.uid(),case when tg_op='INSERT' then 'created' when new.status='awaiting_shipping_fee' then 'approved' when new.status='shipping_fee_set' then 'shipping_fee_assigned' else new.status end,
      jsonb_build_object('status',new.status,'reason',new.decision_reason,'shipping_fee',new.shipping_fee,'payment_window_seconds',new.payment_window_seconds));
    if new.status in ('rejected','cancelled','invalidated') then
      update public.combined_delivery_members set released_at=now() where group_id=new.id and released_at is null;
    end if;
  end if;
  return new;
end;
$$;

-- One mutation boundary shares the buyer request lock, locks orders before the
-- header (same ordering as cancellation), and never changes individual totals.
create function public.review_combined_delivery(p_group_id uuid,p_action text,p_reason text default null,p_shipping_fee numeric default null)
returns public.combined_delivery_groups language plpgsql security definer set search_path = '' as $$
declare g public.combined_delivery_groups; budget numeric; message text;
begin
  if auth.uid() is null or not public.is_active(auth.uid()) or not public.can_sell(auth.uid()) then raise exception 'Active seller account required' using errcode='42501'; end if;
  select * into g from public.combined_delivery_groups where id=p_group_id and seller_id=auth.uid();
  if not found then raise exception 'Delivery request unavailable' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('combined_delivery:'||g.buyer_id::text,0));
  perform 1 from public.orders where id in (select order_id from public.combined_delivery_members where group_id=g.id) order by id for update;
  select * into g from public.combined_delivery_groups where id=p_group_id for update;
  if p_action='approve' then
    if g.status in ('awaiting_shipping_fee','shipping_fee_set') then return g; end if;
    if g.status<>'pending_approval' then raise exception 'Only pending requests can be approved' using errcode='22023'; end if;
    perform public.assert_combined_delivery_group(g.id);
    update public.combined_delivery_groups set status='awaiting_shipping_fee',approved_at=now(),decided_by=auth.uid() where id=g.id returning * into g;
    message:='Your combined delivery request was approved. The seller will set one shared shipping fee.';
  elsif p_action='reject' then
    if g.status='rejected' then return g; end if;
    if g.status<>'pending_approval' then raise exception 'Only pending requests can be rejected' using errcode='22023'; end if;
    if char_length(coalesce(p_reason,''))>500 then raise exception 'Reason must be 500 characters or fewer' using errcode='22023'; end if;
    update public.combined_delivery_groups set status='rejected',decision_reason=nullif(trim(p_reason),''),decided_by=auth.uid() where id=g.id returning * into g;
    message:='Your combined delivery request was rejected. Your reservations remain separate.';
  elsif p_action='set_shipping_fee' then
    if p_shipping_fee is null or p_shipping_fee::text in ('NaN','Infinity','-Infinity') or p_shipping_fee<0 or p_shipping_fee>9999999999.99 or p_shipping_fee<>round(p_shipping_fee,2) then raise exception 'Enter a valid shipping fee with at most two decimal places' using errcode='22023'; end if;
    if g.status='shipping_fee_set' and g.shipping_fee=p_shipping_fee then return g; end if;
    if g.status<>'awaiting_shipping_fee' then raise exception 'Approve the request before assigning its single shipping fee' using errcode='22023'; end if;
    perform public.assert_combined_delivery_group(g.id);
    select min(extract(epoch from (original_expires_at-original_paused_at))) into budget from public.combined_delivery_members where group_id=g.id and released_at is null;
    update public.combined_delivery_groups set status='shipping_fee_set',shipping_fee=p_shipping_fee,shipping_fee_set_at=now(),payment_window_seconds=budget where id=g.id returning * into g;
    message:='The shared shipping fee has been set. Your reservations and payment deadlines remain paused until combined payment is available.';
  else raise exception 'Invalid seller action' using errcode='22023'; end if;
  insert into public.notifications(recipient_id,category,message,target_path,context,dedupe_key)
    values(g.buyer_id,'package',message,'My Claims',jsonb_build_object('combined_delivery_group_id',g.id),'combined_delivery_'||p_action||'_'||g.id::text)
    on conflict (recipient_id,dedupe_key) where dedupe_key is not null do nothing;
  return g;
end;
$$;
revoke all on function public.review_combined_delivery(uuid,text,text,numeric) from public,anon;
grant execute on function public.review_combined_delivery(uuid,text,text,numeric) to authenticated;

create function public.seller_combined_delivery_requests()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_active(auth.uid()) or not public.can_sell(auth.uid()) then raise exception 'Active seller account required' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(g)||jsonb_build_object(
    'buyerName',u.display_name,'batchName',b.title,
    'destination',jsonb_build_object('pin_lat',d.pin_lat,'pin_lng',d.pin_lng,'address_text',d.address_text),
    'members',(select jsonb_agg(jsonb_build_object('order_id',m.order_id,'item_subtotal',m.item_subtotal,'released_at',m.released_at,
      'order',jsonb_build_object('quantity',o.quantity,'batch_products',jsonb_build_object('name',bp.name))) order by m.order_id)
      from public.combined_delivery_members m join public.orders o on o.id=m.order_id join public.batch_products bp on bp.id=o.batch_product_id where m.group_id=g.id)
    ) order by g.created_at desc,g.id) from public.combined_delivery_groups g join public.user_profiles u on u.id=g.buyer_id
      join public.batches b on b.id=g.batch_id join public.delivery_destinations d on d.id=g.destination_id where g.seller_id=auth.uid()),'[]'::jsonb);
end;
$$;
revoke all on function public.seller_combined_delivery_requests() from public,anon;
grant execute on function public.seller_combined_delivery_requests() to authenticated;
commit;
