-- Ratings: one aggregate per user, computed from `public.reviews`.
--
-- Why this exists
-- ---------------
-- `public.reviews` was already the source of truth for individual ratings, but
-- nothing exposed a per-user aggregate. The only rating the catalog carried was
-- `batch_catalog.rating`, a per-BATCH average of the seller's reviews on that
-- batch's orders, coalesced to 0. That produced two problems the app could not
-- paper over:
--
--   1. A seller's batch card, shop page and profile could each show a
--      different number, because a seller with reviews spread over several
--      batches averaged to 0 on every individual batch.
--   2. `coalesce(..., 0)` made "no reviews" indistinguishable from "rated 0",
--      so a brand-new seller rendered as a literal 0-star batch.
--
-- This migration adds `public.profile_ratings` as the single aggregate every
-- screen reads, and repoints `batch_catalog.rating` at it so a seller's score
-- is identical on their batch cards, shop page, directory row and profile.
--
-- Ratings are never defaulted. `average_rating` is NULL for a user with no
-- reviews; the client renders that as an explicit "No ratings yet" / "New
-- seller" state instead of inventing a score. `round(..., 1)` matches how the
-- UI presents scores, so the SQL and JS aggregations agree.
--
-- Idempotent; safe to re-run.

-- ── 1 — Per-user aggregate ───────────────────────────────────────────────────
-- Reviews are only ever created by `create_order_review`, which requires a
-- completed order and the caller to be a participant, so every row here is
-- backed by real completed activity. No self-reviews: the table's check
-- constraint already forbids reviewer_id = reviewee_id.
create or replace view public.profile_ratings
with (security_barrier = true)
as
select
  p.id as profile_id,
  p.display_name,
  -- NULL, not 0: "no reviews" and "rated 0" are different states.
  round(avg(r.rating), 1) as average_rating,
  count(r.id)::integer as review_count,
  count(r.id) filter (where r.rating = 1)::integer as stars_1,
  count(r.id) filter (where r.rating = 2)::integer as stars_2,
  count(r.id) filter (where r.rating = 3)::integer as stars_3,
  count(r.id) filter (where r.rating = 4)::integer as stars_4,
  count(r.id) filter (where r.rating = 5)::integer as stars_5,
  min(r.created_at) as first_review_at,
  max(r.created_at) as latest_review_at,
  -- Real join date, so "Member since …" is never an invented literal.
  p.created_at as member_since
from public.profiles p
left join public.reviews r on r.reviewee_id = p.id
-- Suspended accounts are hidden everywhere else in the app, so their ratings
-- are hidden here too rather than leaking through a join.
where p.account_status = 'active'
group by p.id, p.display_name;

grant select on public.profile_ratings to authenticated;

-- ── 2 — Point the catalog at that aggregate ───────────────────────────────────
-- `rating` now means "this batch's seller's rating", read from the same view
-- every other surface uses. Column position and type are unchanged (still a
-- nullable number), and `rating_count` is appended after `limit_per_user` so
-- the existing client `select("*")` keeps working.
--
-- "create or replace view" cannot reorder existing columns, so the view is
-- dropped and recreated with the identical leading column list.
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
  -- The seller's own aggregate. NULL when the seller has no reviews yet, so a
  -- new seller reads as "New seller" rather than a 0-star batch.
  (select pr.average_rating from public.profile_ratings pr where pr.profile_id = b.seller_id) as rating,
  bp.limit_per_user,
  -- How many reviews that average rests on. Lets the UI distinguish a lone 5★
  -- from a well-established 5★ instead of printing the same number twice.
  (select pr.review_count from public.profile_ratings pr where pr.profile_id = b.seller_id) as rating_count
from public.batches b
join public.profiles seller on seller.id = b.seller_id
join public.batch_products bp on bp.batch_id = b.id
where b.status <> 'draft' and seller.account_status = 'active';

grant select on public.batch_catalog to authenticated;
