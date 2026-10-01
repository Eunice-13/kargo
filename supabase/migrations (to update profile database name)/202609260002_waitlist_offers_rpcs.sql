-- KARGO — Waitlist offers + instant expiry: RPC / logic layer.
-- Idempotent (create or replace); safe to re-run.

-- ── Helper: available (unclaimed) stock for a product ─────────────────────────
create or replace function public.available_stock(p_product_id uuid)
returns integer
language sql
security definer
stable
set search_path = ''
as $$
  select greatest(
    0,
    (select quantity_total from public.batch_products where id = p_product_id)
    - coalesce((
        select sum(o.quantity) from public.orders o
        where o.batch_product_id = p_product_id
          and o.status in ('payment_pending','payment_submitted','insufficient_payment',
                           'payment_confirmed','preparing','completed')
      ), 0)
  )::integer;
$$;
revoke all on function public.available_stock(uuid) from public;
grant execute on function public.available_stock(uuid) to authenticated, service_role;

-- ── Helper: place an order on a specific buyer's behalf ───────────────────────
-- Mirrors claim_batch_product's inventory + per-buyer-limit checks, but takes an
-- explicit buyer id so the waitlist flow can auto-claim without the buyer being
-- the caller. SECURITY DEFINER; never granted to authenticated (internal only).
create or replace function public.place_order_for_buyer(
  p_product_id uuid,
  p_buyer_id uuid,
  p_quantity integer
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  product public.batch_products;
  batch public.batches;
  claimed integer;
  buyer_claimed integer;
  result public.orders;
begin
  if p_quantity <= 0 then raise exception 'Quantity must be positive'; end if;
  select * into product from public.batch_products where id = p_product_id for update;
  if not found then raise exception 'Product not found'; end if;
  select * into batch from public.batches where id = product.batch_id;

  -- Inventory guard (all active claims across buyers).
  select coalesce(sum(o.quantity), 0)::integer into claimed
  from public.orders o
  where o.batch_product_id = product.id
    and o.status in ('payment_pending','payment_submitted','insufficient_payment',
                     'payment_confirmed','preparing','completed');
  if claimed + p_quantity > product.quantity_total then
    raise exception 'Insufficient inventory';
  end if;

  -- Respect the optional per-buyer limit for this buyer.
  if product.limit_per_user is not null then
    select coalesce(sum(o.quantity), 0)::integer into buyer_claimed
    from public.orders o
    where o.batch_product_id = product.id
      and o.buyer_id = p_buyer_id
      and o.status in ('payment_pending','payment_submitted','insufficient_payment',
                       'payment_confirmed','preparing','completed');
    if buyer_claimed + p_quantity > product.limit_per_user then
      raise exception 'Per-buyer limit reached';
    end if;
  end if;

  insert into public.orders (
    order_number, batch_product_id, buyer_id, seller_id, quantity,
    unit_base_price, unit_selling_price, reservation_expires_at
  ) values (
    'ORD-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.order_number_seq')::text, 6, '0'),
    product.id, p_buyer_id, batch.seller_id, p_quantity,
    product.base_price, product.selling_price,
    now() + make_interval(hours => batch.reservation_hours)
  ) returning * into result;

  -- Seller gets the same "claimed" notification as a normal claim.
  insert into public.notifications (recipient_id, category, message, target_path, context)
  values (batch.seller_id, 'bag',
          'A buyer claimed ' || product.name || ' x' || p_quantity || ' (from waitlist)',
          'My Claims', jsonb_build_object('order_id', result.id));
  return result;
end;
$$;
revoke all on function public.place_order_for_buyer(uuid, uuid, integer) from public, authenticated;

-- ── Core: offer freed stock to the next waiting buyer ─────────────────────────
-- Called after any event that frees stock (cancel, expiry, decline/timeout).
-- Walks the FIFO queue of 'waiting' entries. For the first one:
--   * exact/over match (available >= desired) → auto-claim desired qty, mark
--     'converted', notify buyer (in-app + queued email). No response needed.
--   * partial match (0 < available < desired) → mark 'offered' with
--     offer_quantity + offer_expires_at (seller window), notify buyer to
--     accept/decline. STOP (that buyer holds the offer until they respond or
--     time out).
-- Skips entries whose buyer can no longer receive stock (e.g. per-user limit).
create or replace function public.offer_to_next_waitlist(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  product public.batch_products;
  batch public.batches;
  seller_hours integer;
  entry public.waitlist_entries;
  avail integer;
  give integer;
  new_order public.orders;
begin
  select * into product from public.batch_products where id = p_product_id;
  if not found then return; end if;
  select * into batch from public.batches where id = product.batch_id;
  -- Only offer while the batch is live and the item unlocked.
  if batch.status <> 'live' or product.is_locked then return; end if;

  select coalesce(waitlist_response_hours, 24) into seller_hours
  from public.profiles where id = batch.seller_id;

  -- If someone already holds an unexpired offer, don't disturb them.
  if exists (
    select 1 from public.waitlist_entries w
    where w.batch_product_id = p_product_id
      and w.status = 'offered'
      and (w.offer_expires_at is null or w.offer_expires_at > now())
  ) then
    return;
  end if;

  loop
    avail := public.available_stock(p_product_id);
    if avail <= 0 then return; end if;

    -- Next waiting buyer in FIFO order.
    select * into entry from public.waitlist_entries w
    where w.batch_product_id = p_product_id and w.status = 'waiting'
    order by w.joined_at asc
    limit 1;
    if not found then return; end if;

    if avail >= entry.desired_quantity then
      -- Exact / over match → auto-claim on their behalf.
      begin
        new_order := public.place_order_for_buyer(p_product_id, entry.buyer_id, entry.desired_quantity);
      exception when others then
        -- Buyer can't receive it (e.g. per-user limit) → skip them, keep going.
        update public.waitlist_entries set status = 'cancelled' where id = entry.id;
        continue;
      end;
      update public.waitlist_entries
        set status = 'converted', offer_quantity = entry.desired_quantity,
            offered_at = now(), offer_expires_at = null, notified_at = now()
      where id = entry.id;

      insert into public.notifications (recipient_id, category, message, target_path, context, dedupe_key)
      values (entry.buyer_id, 'check',
              'Your waitlist claim for ' || product.name || ' x' || entry.desired_quantity || ' went through — pay before the timer ends.',
              'My Claims', jsonb_build_object('order_id', new_order.id, 'product_id', p_product_id),
              'wl_auto_' || entry.id::text);

      if public.wants_email(entry.buyer_id, 'waitlist') then
        insert into public.pending_emails (recipient_id, template, subject, body, context, dedupe_key)
        values (entry.buyer_id, 'waitlist_auto_claimed',
                'Your KARGO waitlist claim went through',
                'Good news! Stock freed up for ' || product.name || ' and your waitlisted quantity ('
                  || entry.desired_quantity || ') was claimed automatically. Please submit payment before your reservation timer ends.',
                jsonb_build_object('order_id', new_order.id, 'product_id', p_product_id),
                'wl_auto_' || entry.id::text)
        on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing;
      end if;
      -- Loop again: more stock may remain for the next buyer.
      continue;
    else
      -- Partial match → extend an offer the buyer must accept/decline.
      give := avail;
      update public.waitlist_entries
        set status = 'offered', offer_quantity = give, offered_at = now(),
            offer_expires_at = now() + make_interval(hours => seller_hours), notified_at = now()
      where id = entry.id;

      insert into public.notifications (recipient_id, category, message, target_path, context, dedupe_key)
      values (entry.buyer_id, 'clock',
              'Only ' || give || ' of ' || product.name || ' is available (you wanted '
                || entry.desired_quantity || '). Accept or decline before the deadline.',
              'My Claims', jsonb_build_object('waitlist_id', entry.id, 'product_id', p_product_id,
                                              'offer_quantity', give),
              'wl_offer_' || entry.id::text || '_' || extract(epoch from now())::bigint::text);

      if public.wants_email(entry.buyer_id, 'waitlist') then
        insert into public.pending_emails (recipient_id, template, subject, body, context, dedupe_key)
        values (entry.buyer_id, 'waitlist_partial_offer',
                'A partial amount of your KARGO waitlist item is available',
                give || ' unit(s) of ' || product.name || ' are available now, though you asked for '
                  || entry.desired_quantity || '. Open KARGO to accept or decline before the response window closes.',
                jsonb_build_object('waitlist_id', entry.id, 'product_id', p_product_id, 'offer_quantity', give),
                'wl_offer_' || entry.id::text || '_' || extract(epoch from now())::bigint::text)
        on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing;
      end if;
      return; -- Wait for this buyer's response.
    end if;
  end loop;
end;
$$;
revoke all on function public.offer_to_next_waitlist(uuid) from public, authenticated;

-- ── Public: join a waitlist with a desired quantity (Part 1) ──────────────────
create or replace function public.join_waitlist(p_product_id uuid, p_quantity integer)
returns public.waitlist_entries
language plpgsql
security definer
set search_path = ''
as $$
declare
  product public.batch_products;
  result public.waitlist_entries;
begin
  if auth.uid() is null or not public.is_active(auth.uid()) then
    raise exception 'Active account required';
  end if;
  if p_quantity <= 0 then raise exception 'Quantity must be positive'; end if;
  select * into product from public.batch_products where id = p_product_id;
  if not found then raise exception 'Product not found'; end if;

  insert into public.waitlist_entries (batch_product_id, buyer_id, status, desired_quantity, joined_at)
  values (p_product_id, auth.uid(), 'waiting', p_quantity, now())
  on conflict (batch_product_id, buyer_id) do update
    set desired_quantity = excluded.desired_quantity,
        status = case when public.waitlist_entries.status in ('converted','cancelled')
                      then 'waiting' else public.waitlist_entries.status end
  returning * into result;
  return result;
end;
$$;
revoke all on function public.join_waitlist(uuid, integer) from public;
grant execute on function public.join_waitlist(uuid, integer) to authenticated;

-- ── Public: buyer responds to a partial-match offer (Part 2) ──────────────────
create or replace function public.respond_waitlist_offer(p_waitlist_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  entry public.waitlist_entries;
  new_order public.orders;
  prod_id uuid;
begin
  select * into entry from public.waitlist_entries where id = p_waitlist_id for update;
  if not found or entry.buyer_id <> auth.uid() then raise exception 'Offer not found'; end if;
  if entry.status <> 'offered' then raise exception 'No active offer to respond to'; end if;
  if entry.offer_expires_at is not null and entry.offer_expires_at <= now() then
    raise exception 'This offer has expired';
  end if;
  prod_id := entry.batch_product_id;

  if p_accept then
    -- Claim the offered (partial) quantity on the buyer's behalf.
    new_order := public.place_order_for_buyer(prod_id, entry.buyer_id, entry.offer_quantity);
    update public.waitlist_entries
      set status = 'converted', offer_expires_at = null where id = entry.id;
    insert into public.notifications (recipient_id, category, message, target_path, context)
    values (entry.buyer_id, 'check',
            'You accepted ' || entry.offer_quantity || ' unit(s) from your waitlist offer — pay before the timer ends.',
            'My Claims', jsonb_build_object('order_id', new_order.id));
  else
    -- Decline → free the hold and roll the offer to the next buyer.
    update public.waitlist_entries
      set status = 'cancelled', offer_expires_at = null where id = entry.id;
  end if;

  -- Whether accepted (stock may remain) or declined, try the next buyer.
  perform public.offer_to_next_waitlist(prod_id);
end;
$$;
revoke all on function public.respond_waitlist_offer(uuid, boolean) from public;
grant execute on function public.respond_waitlist_offer(uuid, boolean) to authenticated;

-- ── Replace cancel_order: free stock THEN trigger a waitlist offer instantly ──
create or replace function public.cancel_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  prod_id uuid;
begin
  update public.orders set status = 'cancelled'::public.order_status
  where id = p_order_id and buyer_id = auth.uid()
    and status in ('payment_pending', 'payment_submitted', 'insufficient_payment')
    and public.is_active(auth.uid())
  returning batch_product_id into prod_id;
  if prod_id is null then raise exception 'Order cannot be cancelled'; end if;

  -- Stock is freed the instant the status flips (available_stock excludes
  -- cancelled orders); immediately offer it to the next waitlisted buyer.
  perform public.offer_to_next_waitlist(prod_id);
end;
$$;
revoke all on function public.cancel_order(uuid) from public;
grant execute on function public.cancel_order(uuid) to authenticated;
