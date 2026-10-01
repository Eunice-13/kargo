create or replace function public.buyer_order_payment_states()
returns table (
  order_id uuid,
  effective_status text,
  latest_payment_status text,
  rejection_deadline timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    o.id as order_id,
    case
      when o.status in (
        'payment_confirmed'::public.order_status,
        'preparing'::public.order_status,
        'completed'::public.order_status,
        'expired'::public.order_status,
        'cancelled'::public.order_status,
        'incomplete'::public.order_status
      ) then o.status::text
      when latest.status = 'rejected'::public.payment_status then 'payment_pending'
      when latest.status = 'pending_review'::public.payment_status then 'payment_submitted'
      else o.status::text
    end as effective_status,
    latest.status::text as latest_payment_status,
    latest.rejection_deadline
  from public.orders o
  left join lateral (
    select p.status, p.rejection_deadline
    from public.payments p
    where p.order_id = o.id
    order by p.submitted_at desc, p.id desc
    limit 1
  ) latest on true
  where o.buyer_id = auth.uid();
$$;

revoke all on function public.buyer_order_payment_states() from public;
grant execute on function public.buyer_order_payment_states() to authenticated;
