-- Payment-state correction (reversible).
--
-- PREREQUISITE: apply supabase/migrations/202611100001_payment_review_shortfall.sql
-- first (it adds payments.shortfall_amount and the review guards).
--
-- Run scripts/payment-state-correction-dry-run.sql first and review the rows.
-- Then apply this file:
--
--   npx supabase db query --linked -f scripts/payment-state-correction.sql
--
-- Roll back with:
--
--   npx supabase db query --linked -f scripts/payment-state-correction-rollback.sql
--
-- Category A: payments explicitly approved on 2026-11-03 PH (by reviewed_at,
--             never order date). The order returns to `payment_submitted`.
-- Category B: payments with an insufficient/short rejection reason that were
--             wrongly stored as `verified`. They become `rejected` with a
--             stored shortfall and the order becomes `insufficient_payment`.

begin;

create table if not exists public.payment_state_correction_backup (
  payment_id uuid primary key,
  order_id uuid not null,
  category text not null,
  old_payment_status public.payment_status not null,
  old_amount numeric,
  old_shortfall_amount numeric,
  old_reviewed_at timestamptz,
  old_reviewed_by uuid,
  old_rejection_reason text,
  old_rejection_deadline timestamptz,
  old_order_status public.order_status not null,
  old_payment_confirmed_at timestamptz,
  old_reservation_expires_at timestamptz,
  old_group_order_id uuid,
  old_group_status text,
  old_group_payment_deadline timestamptz,
  old_combined_group_id uuid,
  old_combined_status text,
  corrected_at timestamptz not null default now()
);

with bounds as (
  select
    (date '2026-11-03')::timestamp at time zone 'Asia/Manila' as start_at,
    (date '2026-11-04')::timestamp at time zone 'Asia/Manila' as end_at
),
due as (
  select
    o.id as order_id,
    o.group_order_id,
    o.status as order_status,
    o.payment_confirmed_at,
    o.reservation_expires_at,
    (o.total_amount + coalesce(o.shipping_fee, 0)) as amount_due,
    coalesce((
      select sum(p2.amount)
      from public.payments p2
      where p2.order_id = o.id and p2.status = 'verified'
    ), 0) as verified_total
  from public.orders o
),
affected as (
  select
    'A' as category,
    p.id as payment_id,
    p.order_id
  from public.payments p
  cross join bounds b
  where p.status = 'verified'
    and p.reviewed_at >= b.start_at
    and p.reviewed_at < b.end_at

  union all

  select
    'B' as category,
    p.id as payment_id,
    p.order_id
  from public.payments p
  cross join bounds b
  where p.status = 'verified'
    and (
      p.rejection_reason ilike '%insufficient%'
      or p.rejection_reason ilike '%short%'
      or p.rejection_reason ilike '%shortfall%'
    )
    and p.reviewed_at < b.start_at

  union all

  -- Legacy short-payment flow: verified while the order is insufficient.
  select
    'C' as category,
    p.id as payment_id,
    p.order_id
  from public.payments p
  join public.orders o on o.id = p.order_id
  where p.status = 'verified'
    and o.status = 'insufficient_payment'
    and (o.total_amount + coalesce(o.shipping_fee, 0)) >
      coalesce((
        select sum(p2.amount) from public.payments p2
        where p2.order_id = o.id and p2.status = 'verified'
      ), 0) + 0.005
)
insert into public.payment_state_correction_backup (
  payment_id, order_id, category,
  old_payment_status, old_amount, old_shortfall_amount,
  old_reviewed_at, old_reviewed_by, old_rejection_reason, old_rejection_deadline,
  old_order_status, old_payment_confirmed_at, old_reservation_expires_at,
  old_group_order_id, old_group_status, old_group_payment_deadline,
  old_combined_group_id, old_combined_status
)
select
  a.payment_id,
  a.order_id,
  a.category,
  p.status,
  p.amount,
  p.shortfall_amount,
  p.reviewed_at,
  p.reviewed_by,
  p.rejection_reason,
  p.rejection_deadline,
  o.status,
  o.payment_confirmed_at,
  o.reservation_expires_at,
  o.group_order_id,
  g.status,
  g.payment_deadline,
  p.combined_delivery_group_id,
  cg.status
from affected a
join public.payments p on p.id = a.payment_id
join public.orders o on o.id = a.order_id
left join public.group_orders g on g.id = o.group_order_id
left join public.combined_delivery_groups cg on cg.id = p.combined_delivery_group_id
on conflict (payment_id) do nothing;

-- Category A: undo today's approvals. Payment returns to the review queue and
-- the order returns to awaiting verification.
update public.payments p
set status = 'pending_review',
    reviewed_at = null,
    reviewed_by = null,
    rejection_reason = null,
    rejection_deadline = null,
    shortfall_amount = null
from public.payment_state_correction_backup b
where b.payment_id = p.id and b.category = 'A';

update public.orders o
set status = 'payment_submitted',
    payment_confirmed_at = null
from public.payment_state_correction_backup b
where b.order_id = o.id
  and b.category = 'A'
  and o.status in ('payment_confirmed', 'insufficient_payment');

update public.group_orders g
set status = 'payment_submitted',
    payment_deadline = b.old_group_payment_deadline,
    updated_at = now()
from public.payment_state_correction_backup b
where g.id = b.old_group_order_id
  and b.category = 'A'
  and g.status = 'payment_confirmed';

-- Undo the combined-delivery release performed by the paid transition so the
-- affected orders hold their slots again while the payment is re-reviewed.
create table if not exists public.payment_state_correction_combined_members (
  group_id uuid not null,
  order_id uuid not null,
  old_released_at timestamptz,
  primary key (group_id, order_id)
);

insert into public.payment_state_correction_combined_members (group_id, order_id, old_released_at)
select m.group_id, m.order_id, m.released_at
from public.combined_delivery_members m
join public.payment_state_correction_backup b on b.old_combined_group_id = m.group_id
where b.category = 'A'
on conflict (group_id, order_id) do nothing;

update public.combined_delivery_groups cg
set status = 'shipping_fee_set'
from public.payment_state_correction_backup b
where cg.id = b.old_combined_group_id
  and b.category = 'A'
  and cg.status = 'paid';

update public.combined_delivery_members m
set released_at = null
from public.payment_state_correction_backup b
where m.group_id = b.old_combined_group_id
  and b.category = 'A'
  and m.released_at is not null;

-- Category B: correct payments whose insufficient rejection was stored as
-- verified. Shortfall is recomputed from the order due minus every other
-- verified payment.
with correction as (
  select
    b.payment_id,
    b.order_id,
    greatest(
      0,
      round(
        (o.total_amount + coalesce(o.shipping_fee, 0)) -
        coalesce((
          select sum(p2.amount)
          from public.payments p2
          where p2.order_id = o.id
            and p2.status = 'verified'
            and p2.id <> b.payment_id
        ), 0)
        - p.amount,
        2
      )
    ) as shortfall
  from public.payment_state_correction_backup b
  join public.orders o on o.id = b.order_id
  join public.payments p on p.id = b.payment_id
  where b.category in ('B', 'C')
)
update public.payments p
set status = 'rejected',
    shortfall_amount = case when c.shortfall > 0 then c.shortfall else null end,
    rejection_reason = coalesce(p.rejection_reason, 'Insufficient payment'),
    reviewed_at = coalesce(p.reviewed_at, now()),
    reviewed_by = coalesce(p.reviewed_by, auth.uid())
from correction c
where c.payment_id = p.id;

update public.orders o
set status = 'insufficient_payment',
    payment_confirmed_at = null
from public.payment_state_correction_backup b
where b.order_id = o.id
  and b.category in ('B', 'C')
  and o.status in ('payment_confirmed', 'preparing', 'completed');

-- Notify both parties that the corrected payment is short. Deduped per order.
with shortfall as (
  select
    b.order_id,
    p.shortfall_amount
  from public.payment_state_correction_backup b
  join public.payments p on p.id = b.payment_id
  where b.category in ('B', 'C') and coalesce(p.shortfall_amount, 0) > 0
)
insert into public.notifications (recipient_id, category, message, target_path, context, dedupe_key)
select
  r.recipient_id,
  'clock',
  'Payment for ' || o.order_number || ' is short by ₱' ||
    to_char(s.shortfall_amount, 'FM999,999,990.00') ||
    '. The remaining balance is due.',
  'My Claims',
  jsonb_build_object('order_id', o.id),
  'insufficient_correction_' || o.id::text || '_' || r.recipient_id::text
from shortfall s
join public.orders o on o.id = s.order_id
cross join lateral (
  values (o.buyer_id), (o.seller_id)
) as r(recipient_id)
on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing;

commit;
