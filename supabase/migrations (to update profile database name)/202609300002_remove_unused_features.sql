-- Migration: Remove unused features
-- Drops tables: reviews, addresses, buyer_requests
-- Drops columns from seller_payment_methods: is_active, is_verified, created_at, updated_at
-- Drops columns from profiles: bir_document_path, bir_status, bir_flag_reason, bir_checked_at, account_status
--
-- Order matters: views → functions → policies → triggers → tables → columns → enums

-- ── 1. Drop views that depend on reviews ──────────────────────────────────────
drop view if exists public.batch_catalog;
drop view if exists public.profile_ratings;
drop view if exists public.public_profiles;

-- ── 2. Drop functions that reference reviews ───────────────────────────────────
drop function if exists public.create_order_review(uuid, smallint, text, text[]);

-- ── 3. Drop functions that reference BIR columns ──────────────────────────────
drop function if exists public.submit_bir_badge(text);
drop function if exists public.complete_bir_verification(uuid, text, public.bir_status, text);

-- ── 4. Drop function that references buyer_requests ───────────────────────────
drop function if exists public.create_buyer_request(uuid, text, integer, text);

-- ── 5. Drop RLS policies on tables being dropped ──────────────────────────────
-- reviews policies
drop policy if exists reviews_select_authenticated on public.reviews;
drop policy if exists reviews_insert_participant on public.reviews;
drop policy if exists reviews_update_own on public.reviews;
drop policy if exists reviews_delete_own on public.reviews;

-- addresses policies
drop policy if exists addresses_owner_all on public.addresses;

-- buyer_requests policies
drop policy if exists buyer_requests_select_involved on public.buyer_requests;
drop policy if exists buyer_requests_insert_buyer on public.buyer_requests;
drop policy if exists buyer_requests_update_buyer on public.buyer_requests;
drop policy if exists buyer_requests_delete_buyer on public.buyer_requests;

-- ── 6. Drop triggers on tables being dropped ───────────────────────────────────
drop trigger if exists reviews_updated_at on public.reviews;
drop trigger if exists addresses_updated_at on public.addresses;
drop trigger if exists buyer_requests_updated_at on public.buyer_requests;

-- ── 7. Drop tables ────────────────────────────────────────────────────────────
drop table if exists public.reviews;
drop table if exists public.addresses;
drop table if exists public.buyer_requests;

-- ── 8. Drop columns from seller_payment_methods ───────────────────────────────
-- First drop the partial unique index that references is_active
drop index if exists public.seller_payment_methods_signature_uidx;
drop trigger if exists seller_payment_methods_updated_at on public.seller_payment_methods;

alter table public.seller_payment_methods
  drop column if exists is_active,
  drop column if exists is_verified,
  drop column if exists created_at,
  drop column if exists updated_at;

-- Recreate the unique index without the is_active filter
create unique index seller_payment_methods_signature_uidx
  on public.seller_payment_methods (seller_id, lower(method_type), coalesce(account_number, ''));

-- Update seller_receive_methods to not reference dropped is_active column
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
  where m.seller_id = p_seller_id
  order by m.id;
$$;

revoke all on function public.seller_receive_methods(uuid) from public;
grant execute on function public.seller_receive_methods(uuid) to authenticated;

-- Replace functions before dropping the profile columns they previously used.
create or replace function public.can_sell(p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_user_id
      and p.can_sell = true
  );
$$;

create or replace function public.is_active(p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_user_id
  );
$$;

-- ── 9. Drop columns from profiles ─────────────────────────────────────────────
alter table public.profiles
  drop column if exists bir_document_path,
  drop column if exists bir_status,
  drop column if exists bir_flag_reason,
  drop column if exists bir_checked_at,
  drop column if exists account_status;

-- ── 10. Redefine can_sell() to not reference dropped columns ─────────────────
create or replace function public.can_sell(p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_user_id
      and p.can_sell = true
  );
$$;

-- ── 11. Redefine is_active() to not reference account_status ─────────────────
create or replace function public.is_active(p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_user_id
  );
$$;

-- ── 12. Recreate public_profiles view without bir_status/account_status ──────
create view public.public_profiles as
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
  p.created_at
from public.profiles p;

grant select on public.public_profiles to authenticated;

-- Recreate the batch catalog without ratings or account-status filtering.
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
  bp.limit_per_user
from public.batches b
join public.profiles seller on seller.id = b.seller_id
join public.batch_products bp on bp.batch_id = b.id
where b.status <> 'draft';

grant select on public.batch_catalog to authenticated;

-- ── 13. Drop enum types ──────────────────────────────────────────────────────
drop type if exists public.bir_status;
drop type if exists public.account_status;

-- ── 14. Clean up grants on dropped tables ────────────────────────────────────
-- (Tables are gone, so grants are automatically removed)
