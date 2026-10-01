-- Restore lifecycle and audit fields for seller payment methods.

alter table public.seller_payment_methods
  add column if not exists is_active boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists seller_payment_methods_updated_at
  on public.seller_payment_methods;
create trigger seller_payment_methods_updated_at
before update on public.seller_payment_methods
for each row execute function public.set_updated_at();

-- Only active methods must be unique. This allows a seller to deactivate an
-- old account and later add a replacement with the same type and number.
drop index if exists public.seller_payment_methods_signature_uidx;
create unique index seller_payment_methods_signature_uidx
  on public.seller_payment_methods (
    seller_id,
    lower(method_type),
    coalesce(account_number, '')
  )
  where is_active;

-- Buyers should only receive methods that a seller currently accepts.
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
    and m.is_active
  order by m.created_at;
$$;

revoke all on function public.seller_receive_methods(uuid) from public;
grant execute on function public.seller_receive_methods(uuid) to authenticated;
