-- Keep itemized bookkeeping normalized in batch_expenses while exposing one
-- convenient aggregate per batch to its seller. security_invoker ensures the
-- underlying table policies remain active when the view is queried.
create or replace view public.seller_batch_expense_totals
with (security_invoker = true)
as
select
  b.id as batch_id,
  coalesce(e.total_amount, 0::numeric) as total_expenses
from public.batches b
left join public.batch_expenses e on e.batch_id = b.id
where b.seller_id = auth.uid();

revoke all on public.seller_batch_expense_totals from public, anon;
grant select on public.seller_batch_expense_totals to authenticated, service_role;
