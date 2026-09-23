-- Optional per-buyer claim limit for batch products.
-- Idempotent and additive; safe to re-run.

-- ── 1 — Store the optional limit on each product ──────────────────────────────
alter table public.batch_products
  add column if not exists limit_per_user integer;

alter table public.batch_products
  drop constraint if exists batch_products_limit_per_user_positive;
alter table public.batch_products
  add constraint batch_products_limit_per_user_positive
  check (limit_per_user is null or limit_per_user > 0);

-- ── 2 — Expose limit_per_user through the catalog view ────────────────────────
-- Drop first: "create or replace view" cannot reorder/insert columns, and the
-- new column is appended at the end to keep the client's select("*") happy.
drop view if exists public.batch_catalog;
create view public.batch_catalog with (security_barrier = true) as
select
  b.id as batch_id,
  b.title as batch_title,
  b.status as batch_status,
  b.starts_on,
  b.ends_on,
  b.category,
  b.reservation_hours,
  b.notes,
  b.seller_id,
  seller.display_name as seller_name,
  bp.id as product_id,
  bp.name as product_name,
  bp.base_price,
  bp.markup,
  bp.selling_price,
  bp.quantity_total,
  bp.is_locked as product_locked,
  (select coalesce(sum(x.quantity_total), 0) from public.batch_products x where x.batch_id = b.id) as batch_total_items,
  (select coalesce(sum(o.quantity), 0) from public.orders o join public.batch_products x on x.id = o.batch_product_id
    where x.batch_id = b.id and o.status in ('payment_pending', 'payment_submitted', 'insufficient_payment', 'payment_confirmed', 'preparing', 'completed')) as batch_claimed,
  (select coalesce(sum(o.quantity), 0) from public.orders o
    where o.batch_product_id = bp.id and o.status in ('payment_pending', 'payment_submitted', 'insufficient_payment', 'payment_confirmed', 'preparing', 'completed')) as quantity_claimed,
  (select count(*) from public.waitlist_entries w where w.batch_product_id = bp.id and w.status = 'waiting') as waitlist_count,
  (select coalesce(avg(r.rating), 0) from public.reviews r join public.orders o on o.id = r.order_id
    join public.batch_products x on x.id = o.batch_product_id where x.batch_id = b.id and r.reviewee_id = b.seller_id) as rating,
  bp.limit_per_user
from public.batches b
join public.profiles seller on seller.id = b.seller_id
join public.batch_products bp on bp.batch_id = b.id
where b.status <> 'draft' and seller.account_status = 'active';

grant select on public.batch_catalog to authenticated;

-- ── 3 — Enforce the per-buyer limit inside the claim RPC ──────────────────────
create or replace function public.claim_batch_product(p_batch_product_id uuid, p_quantity integer)
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
  if auth.uid() is null or not public.is_active(auth.uid()) then
    raise exception 'Authentication and an active account are required';
  end if;
  if public.can_sell(auth.uid()) then
    raise exception 'Seller accounts cannot claim batch items';
  end if;
  if p_quantity <= 0 then raise exception 'Quantity must be positive'; end if;

  select * into product from public.batch_products where id = p_batch_product_id for update;
  if not found then raise exception 'Product not found'; end if;
  select * into batch from public.batches where id = product.batch_id;
  if batch.status <> 'live' or product.is_locked then raise exception 'Product is not available'; end if;
  if batch.seller_id = auth.uid() then raise exception 'Sellers cannot claim their own product'; end if;

  select coalesce(sum(o.quantity), 0)::integer into claimed
  from public.orders o
  where o.batch_product_id = product.id
    and o.status in ('payment_pending', 'payment_submitted', 'insufficient_payment', 'payment_confirmed', 'preparing', 'completed');

  if claimed + p_quantity > product.quantity_total then raise exception 'Insufficient inventory'; end if;

  -- Optional per-buyer limit: sum this buyer's own active claims for the product.
  if product.limit_per_user is not null then
    select coalesce(sum(o.quantity), 0)::integer into buyer_claimed
    from public.orders o
    where o.batch_product_id = product.id
      and o.buyer_id = auth.uid()
      and o.status in ('payment_pending', 'payment_submitted', 'insufficient_payment', 'payment_confirmed', 'preparing', 'completed');
    if buyer_claimed + p_quantity > product.limit_per_user then
      raise exception 'Per-buyer limit of % reached for this item', product.limit_per_user;
    end if;
  end if;

  insert into public.orders (
    order_number, batch_product_id, buyer_id, seller_id, quantity,
    unit_base_price, unit_selling_price, reservation_expires_at
  ) values (
    'ORD-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.order_number_seq')::text, 6, '0'),
    product.id, auth.uid(), batch.seller_id, p_quantity,
    product.base_price, product.selling_price,
    now() + make_interval(hours => batch.reservation_hours)
  ) returning * into result;
  insert into public.notifications (recipient_id, category, message, target_path, context)
  values (batch.seller_id, 'bag', 'A buyer claimed ' || product.name || ' x' || p_quantity, 'My Claims', jsonb_build_object('order_id', result.id));
  return result;
end;
$$;

revoke all on function public.claim_batch_product(uuid, integer) from public;
grant execute on function public.claim_batch_product(uuid, integer) to authenticated;
