-- Zero disables new waitlist entries; null preserves existing unlimited queues.
alter table public.batch_products
  alter column waitlist_limit set default 0;
alter table public.batch_products
  drop constraint if exists batch_products_waitlist_limit_check;
alter table public.batch_products
  add constraint batch_products_waitlist_limit_check
  check (waitlist_limit is null or waitlist_limit >= 0);

create or replace function public.set_product_waitlist_limit(
  p_product_id uuid,
  p_limit integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  waiting_count integer;
begin
  if auth.uid() is null or not public.is_active(auth.uid()) or not public.can_sell(auth.uid()) then
    raise exception 'Active seller account required';
  end if;
  if p_limit is not null and p_limit < 0 then
    raise exception 'Waitlist limit must be zero or positive';
  end if;

  if not exists (
    select 1
    from public.batch_products bp
    join public.batches b on b.id = bp.batch_id
    where bp.id = p_product_id and b.seller_id = auth.uid()
  ) then
    raise exception 'Product not found or not owned by seller';
  end if;

  select count(*)::integer into waiting_count
  from public.waitlist_entries w
  where w.batch_product_id = p_product_id and w.status = 'waiting';

  if p_limit is not null and p_limit < waiting_count then
    raise exception 'Waitlist limit cannot be lower than the current queue';
  end if;

  update public.batch_products
  set waitlist_limit = p_limit
  where id = p_product_id;
end;
$$;

revoke all on function public.set_product_waitlist_limit(uuid, integer) from public;
grant execute on function public.set_product_waitlist_limit(uuid, integer) to authenticated;

