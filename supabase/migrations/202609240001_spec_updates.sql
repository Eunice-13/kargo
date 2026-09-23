-- KARGO spec updates: seller-claim guard, contact-link visibility, seller QR upload.
-- Idempotent and additive; safe to re-run.

-- ── 1.4 — Sellers (can_sell accounts) may not claim batch products ────────────
-- Re-declare claim_batch_product with a can_sell() guard. A seller-capable
-- account is never a buyer, so claiming is rejected at the logic level (RLS
-- cannot see the ephemeral UI role, so the block lives in the RPC).
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

-- ── 1.2 / Q4 — Expose visibility-filtered contact links on public_profiles ────
-- Buyers and sellers need to read each other's public contact links to open a
-- "Message" redirect. Honor social_visibility (default visible).
create or replace view public.public_profiles as
select
  p.id,
  p.display_name,
  p.bio,
  p.shop_name,
  coalesce((
    select jsonb_object_agg(link.key, link.value)
    from jsonb_each(p.social_links) as link
    where coalesce((p.social_visibility ->> link.key)::boolean, true)
  ), '{}'::jsonb) as social_links,
  p.avatar_path,
  p.bir_status,
  p.created_at
from public.profiles p
where p.account_status = 'active';

grant select on public.public_profiles to authenticated;

-- ── Q14 — Seller payment-method QR image ──────────────────────────────────────
alter table public.seller_payment_methods
  add column if not exists qr_path text;

insert into storage.buckets (id, name, public)
values ('payment-qr', 'payment-qr', true)
on conflict (id) do update set public = excluded.public;

do $$ begin
  create policy payment_qr_public_read on storage.objects for select
    using (bucket_id = 'payment-qr');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy payment_qr_owner_insert on storage.objects for insert to authenticated
    with check (bucket_id = 'payment-qr' and (storage.foldername(name))[1] = auth.uid()::text);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy payment_qr_owner_update on storage.objects for update to authenticated
    using (bucket_id = 'payment-qr' and owner_id = auth.uid()::text)
    with check (bucket_id = 'payment-qr' and (storage.foldername(name))[1] = auth.uid()::text);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy payment_qr_owner_delete on storage.objects for delete to authenticated
    using (bucket_id = 'payment-qr' and owner_id = auth.uid()::text);
exception when duplicate_object then null; end $$;

-- ── Q14 (buyer side) — Let buyers read a seller's display-safe payment methods ─
-- RLS on seller_payment_methods is owner-only. Buyers paying a seller need to
-- see that seller's receive details + QR. This function returns ONLY the
-- display-safe fields (no ids, no is_verified/internal flags) for a given
-- seller, so the full table stays owner-scoped.
create or replace function public.seller_receive_methods(p_seller_id uuid)
returns table (
  method_type text,
  account_name text,
  account_number text,
  qr_path text
)
language sql
security definer
stable
set search_path = ''
as $$
  select m.method_type, m.account_name, m.account_number, m.qr_path
  from public.seller_payment_methods m
  where m.seller_id = p_seller_id and m.is_active
  order by m.created_at;
$$;

revoke all on function public.seller_receive_methods(uuid) from public;
grant execute on function public.seller_receive_methods(uuid) to authenticated;
