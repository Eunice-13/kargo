-- Phase 2 only: buyer requests and cancellation. No seller approval, fee
-- assignment or payment mutation is enabled by this migration.
begin;

create function public.combined_delivery_request_candidates()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  -- The existing candidate RPC authorizes the active buyer and filters ownership.
  return coalesce((select jsonb_agg(candidate.value || jsonb_build_object(
    'product', bp.name, 'qty', o.quantity, 'batchName', b.title,
    'sellerName', coalesce(nullif(trim(seller.display_name), ''), 'Seller'), 'orderNumber', o.order_number,
    'pinLat', o.delivery_pin_lat, 'pinLng', o.delivery_pin_lng,
    'addressText', o.delivery_pin_address
  ) order by o.created_at, o.id)
  from jsonb_array_elements(public.combined_delivery_candidates()) candidate(value)
  join public.orders o on o.id = (candidate.value->>'id')::uuid and o.buyer_id = auth.uid()
  join public.batch_products bp on bp.id = o.batch_product_id
  join public.batches b on b.id = bp.batch_id
  join public.user_profiles seller on seller.id = o.seller_id), '[]'::jsonb);
end;
$$;

create function public.request_combined_delivery(
  p_order_ids uuid[], p_lat double precision, p_lng double precision,
  p_address text, p_confirm_destination boolean
)
returns public.combined_delivery_groups
language plpgsql security definer set search_path = '' as $$
declare
  selected public.orders;
  destination public.delivery_destinations;
  existing_group public.combined_delivery_groups;
  result public.combined_delivery_groups;
  reasons text[];
  validation jsonb;
  actual_count integer;
  destination_count integer;
  order_key uuid;
  batch_key uuid;
begin
  if auth.uid() is null or not public.is_active(auth.uid()) or public.can_sell(auth.uid()) then
    raise exception 'An active buyer account is required' using errcode = '42501';
  end if;
  if p_confirm_destination is distinct from true then
    raise exception 'Confirm the shared delivery destination before requesting combined delivery' using errcode = '22023';
  end if;
  if p_lat is null or p_lng is null or not (p_lat between -90 and 90) or not (p_lng between -180 and 180)
    or nullif(trim(p_address), '') is null or char_length(p_address) > 1000 then
    raise exception 'A saved delivery pin and full address are required' using errcode = '22023';
  end if;
  select count(distinct id) into actual_count from unnest(p_order_ids) t(id);
  if coalesce(cardinality(p_order_ids), 0) < 2 or actual_count <> cardinality(p_order_ids) then
    raise exception 'Select at least two distinct reservations' using errcode = '22023';
  end if;
  -- Serialize the same buyer's submissions, including double taps and retries.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('combined_delivery:' || auth.uid()::text, 0));
  perform 1 from public.orders where id = any(p_order_ids) and buyer_id = auth.uid() order by id for update;
  if (select count(*) from public.orders where id = any(p_order_ids) and buyer_id = auth.uid()) <> actual_count then
    raise exception 'One or more reservations are unavailable' using errcode = '42501';
  end if;
  perform public.assert_combined_delivery_batch(p_order_ids);
  select * into selected from public.orders where id = any(p_order_ids) order by id limit 1;
  if exists (select 1 from public.orders o where o.id = any(p_order_ids) and (
    o.seller_id is distinct from selected.seller_id
    or o.reserved_payment_method is distinct from selected.reserved_payment_method
  )) then raise exception 'Choose reservations from the same seller and payment method' using errcode = '22023'; end if;
  -- Echoed original values detect address edits after the confirmation dialog
  -- opened. Do not overwrite or repin an order to make it eligible.
  if exists (select 1 from public.orders o where o.id = any(p_order_ids) and (
    o.delivery_pin_lat is distinct from p_lat or o.delivery_pin_lng is distinct from p_lng
    or o.delivery_pin_address is distinct from p_address
  )) then raise exception 'The saved delivery pin or full address differs. Refresh and review the reservations.' using errcode = '22023'; end if;

  -- Idempotent retry: return the exact pending request, without new events,
  -- destinations, members or duplicate notifications.
  select g.* into existing_group from public.combined_delivery_groups g
  where g.buyer_id = auth.uid() and g.status = 'pending_approval'
    and (select count(*) from public.combined_delivery_members m where m.group_id = g.id and m.released_at is null) = actual_count
    and not exists (select 1 from public.combined_delivery_members m where m.group_id = g.id and m.released_at is null and not (m.order_id = any(p_order_ids)))
  order by g.id limit 1;
  if found then
    perform public.assert_combined_delivery_batch(p_order_ids, existing_group.batch_id);
    return existing_group;
  end if;
  if exists (select 1 from public.combined_delivery_members m where m.order_id = any(p_order_ids) and m.released_at is null) then
    raise exception 'One or more reservations already have a combined delivery request' using errcode = '22023';
  end if;
  -- Limit repeated rejected/cancelled re-submissions; never refresh a deadline.
  if exists (select 1 from public.combined_delivery_groups g
    join public.combined_delivery_members m on m.group_id = g.id
    where g.buyer_id = auth.uid() and g.created_at > now() - interval '1 minute'
      and m.order_id = any(p_order_ids)) then
    raise exception 'Please wait a minute before making another combined delivery request' using errcode = '22023';
  end if;
  select count(distinct delivery_destination_id) into destination_count from public.orders where id = any(p_order_ids);
  if destination_count > 1 then
    raise exception 'Choose reservations with the same confirmed delivery destination' using errcode = '22023';
  end if;
  for order_key in select id from public.orders where id = any(p_order_ids) order by id loop
    reasons := public.combined_delivery_order_reasons(order_key, auth.uid());
    -- Only an unconfirmed snapshot may be bound by this explicit confirmation.
    -- Previously confirmed but now mismatched destinations remain ineligible.
    if (select delivery_destination_id is null from public.orders where id = order_key) then
      reasons := array_remove(array_remove(reasons, 'unconfirmed_destination'), 'destination_changed');
    end if;
    if cardinality(reasons) > 0 then
      raise exception 'A selected reservation is no longer eligible for combined delivery. Refresh and try again.' using errcode = '22023', detail = array_to_string(reasons, ',');
    end if;
  end loop;
  select d.* into destination from public.delivery_destinations d
  join public.orders o on o.delivery_destination_id = d.id where o.id = any(p_order_ids) order by o.id limit 1;
  if not found then
    insert into public.delivery_destinations(buyer_id, pin_lat, pin_lng, address_text)
    values (auth.uid(), p_lat, p_lng, p_address) returning * into destination;
  end if;
  update public.orders set delivery_destination_id = destination.id
    where id = any(p_order_ids) and delivery_destination_id is distinct from destination.id;
  validation := public.combined_delivery_eligibility(p_order_ids);
  if (validation->>'eligible')::boolean is distinct from true then
    raise exception 'The selected reservations cannot share a delivery' using errcode = '22023', detail = validation::text;
  end if;
  select bp.batch_id into batch_key from public.batch_products bp where bp.id = selected.batch_product_id;
  insert into public.combined_delivery_groups(buyer_id, seller_id, batch_id, destination_id, payment_method)
  values (auth.uid(), selected.seller_id, batch_key, destination.id, selected.reserved_payment_method) returning * into result;
  insert into public.combined_delivery_members(group_id, order_id)
  select result.id, o.id from public.orders o where o.id = any(p_order_ids) order by o.id;
  -- No order status, inventory allocation, shipping fee or deadline is changed.
  insert into public.notifications(recipient_id, category, message, target_path, context, dedupe_key)
  values (result.seller_id, 'package', 'A buyer requested combined delivery for ' || actual_count || ' reservations.', 'My Claims',
    jsonb_build_object('combined_delivery_group_id', result.id), 'combined_delivery_requested_' || result.id::text)
  on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing;
  return result;
end;
$$;

create function public.cancel_combined_delivery_request(p_group_id uuid)
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

revoke all on function public.combined_delivery_request_candidates(),
  public.request_combined_delivery(uuid[], double precision, double precision, text, boolean),
  public.cancel_combined_delivery_request(uuid) from public, anon;
grant execute on function public.combined_delivery_request_candidates(),
  public.request_combined_delivery(uuid[], double precision, double precision, text, boolean),
  public.cancel_combined_delivery_request(uuid) to authenticated;
commit;
