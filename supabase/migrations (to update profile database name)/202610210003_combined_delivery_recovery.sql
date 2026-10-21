-- Phase 3.1 only: recover stale, unpaid combined-delivery requests.
-- No group payment, fee allocation, deadline policy or inventory reset is added.
begin;

-- Invalidated groups retain their former shared fee as non-payable history.
alter table public.combined_delivery_groups drop constraint combined_delivery_groups_shipping_fee_check;
alter table public.combined_delivery_groups add constraint combined_delivery_groups_shipping_fee_check check (
  (status in ('shipping_fee_set','invalidated') and shipping_fee is not null and shipping_fee >= 0
    and shipping_fee_set_at is not null and approved_at is not null
    and payment_window_seconds is not null and payment_window_seconds > 0)
  or (status <> 'shipping_fee_set' and shipping_fee is null and shipping_fee_set_at is null)
);

-- Prevent new instances of the preflight failure. These guards do NOT acquire
-- order/group locks while holding product/batch write locks: request/review RPCs
-- lock orders first, then stabilize batch/product identity with FOR SHARE.
-- PostgreSQL serializes the conflicting product/batch UPDATE against that lock.
create function public.guard_active_delivery_batch_identity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name='batch_products' then
    if new.batch_id is distinct from old.batch_id and exists (
      select 1 from public.orders o join public.combined_delivery_members m on m.order_id=o.id
      where o.batch_product_id=old.id and m.released_at is null
    ) then raise exception 'This product belongs to an active combined delivery. Recover or resolve the request before changing its batch.' using errcode='22023'; end if;
  elsif new.seller_id is distinct from old.seller_id and exists (
    select 1 from public.combined_delivery_groups g
    where g.batch_id=old.id and g.status in ('pending_approval','awaiting_shipping_fee','shipping_fee_set')
  ) then raise exception 'This batch belongs to an active combined delivery. Resolve the request before changing its seller.' using errcode='22023'; end if;
  return new;
end;
$$;
revoke all on function public.guard_active_delivery_batch_identity() from public,anon,authenticated;
create trigger batch_products_active_delivery_identity before update of batch_id on public.batch_products
  for each row execute function public.guard_active_delivery_batch_identity();
create trigger batches_active_delivery_identity before update of seller_id on public.batches
  for each row execute function public.guard_active_delivery_batch_identity();

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
end;
$$;

create or replace function public.audit_combined_delivery_group()
returns trigger language plpgsql security definer set search_path = '' as $$
declare recovery_deadlines jsonb;
begin
  if tg_op='UPDATE' and new.status='invalidated' and new.status is distinct from old.status then
    select jsonb_agg(jsonb_build_object('order_id',o.id,'shipping_state',o.shipping_state,
      'paused_at',o.deadline_paused_at,'expires_at',o.reservation_expires_at,
      'remaining_seconds',case when o.deadline_paused_at is not null then greatest(extract(epoch from (o.reservation_expires_at-o.deadline_paused_at)),0) end)
      order by o.id) into recovery_deadlines
    from public.orders o join public.combined_delivery_members m on m.order_id=o.id
    where m.group_id=new.id and m.released_at is null;
  end if;
  if tg_op='INSERT' or new.status is distinct from old.status then
    insert into public.combined_delivery_events(group_id,actor_id,event_type,details)
    values(new.id,auth.uid(),case when tg_op='INSERT' then 'created' when new.status='awaiting_shipping_fee' then 'approved' when new.status='shipping_fee_set' then 'shipping_fee_assigned' else new.status end,
      jsonb_build_object('status',new.status,'reason',new.decision_reason,'shipping_fee',new.shipping_fee,'payment_window_seconds',new.payment_window_seconds,'recovery_deadlines',recovery_deadlines));
    if new.status in ('rejected','cancelled','invalidated') then
      update public.combined_delivery_members set released_at=now() where group_id=new.id and released_at is null;
      if new.status='invalidated' then
        -- Phases 1-3 never added a timer pause of their own. Membership was
        -- the group hold. Keep genuine shipping/correction pauses intact.
        -- For legacy inconsistent groups with no remaining shipping pause,
        -- use EXACTLY the existing standalone fee-setting resume rule.
        -- Standalone non-delivery reservations must not retain a former
        -- shipping-only label that would block their existing payment UI.
        update public.orders o set shipping_state=null
        where o.id in (select (entry->>'order_id')::uuid from jsonb_array_elements(coalesce(recovery_deadlines,'[]'::jsonb)) entry)
          and o.buyer_id=new.buyer_id and o.seller_id=new.seller_id
          and o.status in ('payment_pending','insufficient_payment')
          and not o.shipping_applies and o.shipping_fee is null
          and o.shipping_state in ('waiting_for_seller','correction_requested');
        update public.orders o set shipping_state='waiting_for_seller'
        where o.id in (select (entry->>'order_id')::uuid from jsonb_array_elements(coalesce(recovery_deadlines,'[]'::jsonb)) entry)
          and o.buyer_id=new.buyer_id and o.seller_id=new.seller_id
          and o.status in ('payment_pending','insufficient_payment') and o.shipping_applies
          and o.shipping_fee is null and o.deadline_paused_at is not null
          and (o.shipping_state is null or o.shipping_state='fee_set');
        update public.orders o set
          reservation_expires_at=now()+greatest(o.reservation_expires_at-o.deadline_paused_at,interval '0 seconds'),
          deadline_paused_at=null
        where o.id in (select (entry->>'order_id')::uuid from jsonb_array_elements(coalesce(recovery_deadlines,'[]'::jsonb)) entry)
          and o.buyer_id=new.buyer_id and o.seller_id=new.seller_id
          and o.status in ('payment_pending','insufficient_payment')
          and o.deadline_paused_at is not null
          and (not o.shipping_applies or (o.shipping_state='fee_set' and o.shipping_fee is not null));
        insert into public.notifications(recipient_id,category,message,target_path,context,dedupe_key)
        select participant,'package',
          'Combined delivery is no longer eligible. Reservations have returned to individual shipping; valid shipping pauses and remaining payment time are preserved.',
          'My Claims',jsonb_build_object('combined_delivery_group_id',new.id,'reason',new.decision_reason),
          'combined_delivery_invalidated_'||new.id::text
        from unnest(array[new.buyer_id,new.seller_id]) participant
        on conflict (recipient_id,dedupe_key) where dedupe_key is not null do nothing;
      end if;
    end if;
  end if;
  return new;
end;
$$;

create function public.invalidate_combined_delivery_request(p_group_id uuid)
returns public.combined_delivery_groups language plpgsql security definer set search_path = '' as $$
declare g public.combined_delivery_groups; failure text;
begin
  if auth.uid() is null or not public.is_active(auth.uid()) then raise exception 'Active participant account required' using errcode='42501'; end if;
  select * into g from public.combined_delivery_groups
    where id=p_group_id and (buyer_id=auth.uid() or (seller_id=auth.uid() and public.can_sell(auth.uid())));
  if not found then raise exception 'Delivery request unavailable' using errcode='42501'; end if;
  -- Same global order as buyer request/cancellation and seller review.
  perform pg_advisory_xact_lock(hashtextextended('combined_delivery:'||g.buyer_id::text,0));
  perform 1 from public.orders where id in (select order_id from public.combined_delivery_members where group_id=g.id) order by id for update;
  select * into g from public.combined_delivery_groups where id=p_group_id for update;
  if g.status='invalidated' then return g; end if;
  if g.status not in ('pending_approval','awaiting_shipping_fee','shipping_fee_set') then raise exception 'Only active delivery requests can be recovered' using errcode='22023'; end if;
  -- Obtain context locks OUTSIDE the validation exception block so a failed
  -- assertion does not roll them back before the invalidation is committed.
  perform public.combined_delivery_batch_reasons(
    array(select order_id from public.combined_delivery_members where group_id=g.id and released_at is null order by order_id),g.batch_id);
  perform 1 from public.user_profiles where id in (g.buyer_id,g.seller_id) order by id for share;
  if not public.is_active(auth.uid()) or (auth.uid()=g.seller_id and not public.can_sell(auth.uid())) then raise exception 'Active participant account required' using errcode='42501'; end if;
  begin
    perform public.assert_combined_delivery_group(g.id);
  exception
    when invalid_parameter_value or insufficient_privilege then failure:=sqlerrm;
  end;
  if failure is null then raise exception 'This request is still eligible. Approved requests cannot be cancelled unless they are no longer eligible.' using errcode='22023'; end if;
  -- Header transition, audit, membership release, deadline repair and notices
  -- are one transaction. Any failure rolls ALL of them back.
  update public.combined_delivery_groups set status='invalidated',decided_by=auth.uid(),decision_reason=left(failure,500)
    where id=g.id returning * into g;
  return g;
end;
$$;
revoke all on function public.invalidate_combined_delivery_request(uuid) from public,anon;
grant execute on function public.invalidate_combined_delivery_request(uuid) to authenticated;

create or replace function public.review_combined_delivery(p_group_id uuid,p_action text,p_reason text default null,p_shipping_fee numeric default null)
returns public.combined_delivery_groups language plpgsql security definer set search_path = '' as $$
declare g public.combined_delivery_groups; budget numeric; message text;
begin
  if auth.uid() is null or not public.is_active(auth.uid()) or not public.can_sell(auth.uid()) then raise exception 'Active seller account required' using errcode='42501'; end if;
  select * into g from public.combined_delivery_groups where id=p_group_id and seller_id=auth.uid();
  if not found then raise exception 'Delivery request unavailable' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('combined_delivery:'||g.buyer_id::text,0));
  perform 1 from public.orders where id in (select order_id from public.combined_delivery_members where group_id=g.id) order by id for update;
  select * into g from public.combined_delivery_groups where id=p_group_id for update;
  if p_action='reject' and g.status in ('awaiting_shipping_fee','shipping_fee_set','invalidated') then
    -- Approved cancellation is restricted to server-proven ineligibility.
    return public.invalidate_combined_delivery_request(g.id);
  end if;
  if p_action in ('approve','set_shipping_fee') and g.status in ('awaiting_shipping_fee','shipping_fee_set') then
    -- Do not treat a stale approval or saved-fee retry as a fresh validation.
    perform public.assert_combined_delivery_group(g.id);
  end if;
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

create or replace function public.cancel_combined_delivery_request(p_group_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare target public.combined_delivery_groups;
begin
  if auth.uid() is null or not public.is_active(auth.uid()) then raise exception 'Active buyer account required' using errcode = '42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('combined_delivery:' || auth.uid()::text, 0));
  select * into target from public.combined_delivery_groups where id = p_group_id and buyer_id = auth.uid();
  if not found then raise exception 'Request unavailable' using errcode = '42501'; end if;
  perform 1 from public.orders o join public.combined_delivery_members m on m.order_id = o.id
    where m.group_id = target.id order by o.id for update of o;
  select * into target from public.combined_delivery_groups where id = p_group_id and buyer_id = auth.uid() for update;
  if target.status = 'cancelled' then return; end if;
  if target.status in ('awaiting_shipping_fee','shipping_fee_set','invalidated') then
    perform public.invalidate_combined_delivery_request(target.id);
    return;
  end if;
  if target.status <> 'pending_approval' then raise exception 'Only requests awaiting review can be cancelled' using errcode = '22023'; end if;
  update public.combined_delivery_groups set status = 'cancelled', decided_by = auth.uid() where id = target.id;
  -- Existing audit trigger releases active memberships. Individual orders retain
  -- the same seller-shipping pause and original remaining time budget.
  insert into public.notifications(recipient_id, category, message, target_path, context, dedupe_key)
  values (target.seller_id, 'package', 'The buyer cancelled a combined delivery request.', 'My Claims',
    jsonb_build_object('combined_delivery_group_id', target.id), 'combined_delivery_cancelled_' || target.id::text)
  on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing;
end;
$$;
notify pgrst, 'reload schema';
commit;
