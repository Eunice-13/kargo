-- READ ONLY. Lists the records the payment-state correction will touch.
-- Run this first and review the output; nothing is modified.
--
--   npx supabase db query --linked -f scripts/payment-state-correction-dry-run.sql -o csv
--
-- Day boundary is 2026-11-03 in Asia/Manila (UTC+8), independent of order dates.

with bounds as (
  select
    (date '2026-11-03')::timestamp at time zone 'Asia/Manila' as start_at,
    (date '2026-11-04')::timestamp at time zone 'Asia/Manila' as end_at
),
due as (
  select
    o.id as order_id,
    o.order_number,
    buyer.display_name as buyer,
    seller.display_name as seller,
    o.status as order_status,
    o.payment_confirmed_at,
    (o.total_amount + coalesce(o.shipping_fee, 0)) as amount_due,
    coalesce((
      select sum(p2.amount)
      from public.payments p2
      where p2.order_id = o.id and p2.status = 'verified'
    ), 0) as verified_total
  from public.orders o
  join public.user_profiles buyer on buyer.id = o.buyer_id
  join public.user_profiles seller on seller.id = o.seller_id
),
today_approvals as (
  select
    'A' as category,
    'approved_today_ph' as reason_code,
    p.id as payment_id,
    p.order_id,
    d.order_number,
    d.buyer,
    d.seller,
    p.amount,
    p.status as payment_status,
    d.order_status,
    p.reviewed_at,
    p.reviewed_by,
    p.rejection_reason,
    null::numeric as computed_shortfall,
    p.submitted_at
  from public.payments p
  join due d on d.order_id = p.order_id
  cross join bounds b
  where p.status = 'verified'
    and p.reviewed_at >= b.start_at
    and p.reviewed_at < b.end_at
),
wrongly_verified_insufficient as (
  select
    'B' as category,
    'verified_insufficient_reason' as reason_code,
    p.id as payment_id,
    p.order_id,
    d.order_number,
    d.buyer,
    d.seller,
    p.amount,
    p.status as payment_status,
    d.order_status,
    p.reviewed_at,
    p.reviewed_by,
    p.rejection_reason,
    greatest(
      0,
      round(d.amount_due - (d.verified_total - p.amount), 2)
    ) as computed_shortfall,
    p.submitted_at
  from public.payments p
  join due d on d.order_id = p.order_id
  where p.status = 'verified'
    and (
      p.rejection_reason ilike '%insufficient%'
      or p.rejection_reason ilike '%short%'
      or p.rejection_reason ilike '%shortfall%'
    )
    and p.reviewed_at < (select start_at from bounds)
),
-- Legacy short-payment flow: the payment was stored as verified while the
-- order is still insufficient_payment (the "Paid and Reserved + Pending"
-- contradiction). No rejection_reason is required to detect it.
verified_short_insufficient as (
  select
    'C' as category,
    'verified_while_insufficient' as reason_code,
    p.id as payment_id,
    p.order_id,
    d.order_number,
    d.buyer,
    d.seller,
    p.amount,
    p.status as payment_status,
    d.order_status,
    p.reviewed_at,
    p.reviewed_by,
    p.rejection_reason,
    greatest(0, round(d.amount_due - d.verified_total, 2)) as computed_shortfall,
    p.submitted_at
  from public.payments p
  join due d on d.order_id = p.order_id
  where p.status = 'verified'
    and d.order_status = 'insufficient_payment'
    and d.verified_total < d.amount_due - 0.005
)
select *
from (
  select * from today_approvals
  union all
  select * from wrongly_verified_insufficient
  union all
  select * from verified_short_insufficient
) affected
order by category, reviewed_at, order_number;
