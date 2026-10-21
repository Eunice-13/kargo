-- Embedded PostgreSQL test fixture, not an application migration. The columns,
-- role boundaries and inventory/expiry guards exercised by these tests mirror
-- the existing migrations. Full Supabase integration still needs staging tests.
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
create table auth.users (
  id uuid primary key, aud text, role text, email text, encrypted_password text,
  email_confirmed_at timestamptz, created_at timestamptz, updated_at timestamptz
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
grant usage on schema auth to authenticated;
create table public.user_profiles (
  id uuid primary key references auth.users(id), display_name text not null default '', can_sell boolean not null default false
);
create function public.fixture_profile() returns trigger language plpgsql as $$
begin insert into public.user_profiles(id) values(new.id); return new; end; $$;
create trigger fixture_signup after insert on auth.users for each row execute function public.fixture_profile();
create function public.is_active(p_user_id uuid default auth.uid()) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.user_profiles where id = p_user_id);
$$;
create function public.can_sell(p_user_id uuid default auth.uid()) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.user_profiles where id = p_user_id and can_sell);
$$;
create table public.batches (
  id uuid primary key, seller_id uuid not null references public.user_profiles(id), title text not null, status text,
  starts_on date, ends_on date, category text, reservation_hours integer
);
create table public.batch_products (
  id uuid primary key, batch_id uuid not null references public.batches(id), name text,
  base_price numeric(12,2), markup numeric(12,2), quantity_total integer,
  selling_price numeric(12,2) generated always as (base_price + markup) stored
);
create table public.group_orders(id uuid primary key);
create type public.order_status as enum ('payment_pending','payment_submitted','insufficient_payment','payment_confirmed','preparing','completed','expired','cancelled','incomplete');
create table public.orders (
  id uuid primary key, order_number text, batch_product_id uuid not null references public.batch_products(id),
  buyer_id uuid not null references public.user_profiles(id), seller_id uuid not null references public.user_profiles(id), quantity integer not null check(quantity > 0),
  unit_base_price numeric(12,2), unit_selling_price numeric(12,2), total_amount numeric(12,2) generated always as (unit_selling_price * quantity) stored,
  status public.order_status not null default 'payment_pending', reservation_expires_at timestamptz not null,
  reserved_payment_method text, shipping_applies boolean not null default false,
  buyer_accepted_shipping_fee boolean not null default false, shipping_state text,
  shipping_fee numeric(12,2), shipping_fee_set_at timestamptz, shipping_fee_set_by uuid references public.user_profiles(id), deadline_paused_at timestamptz,
  delivery_pin_lat double precision, delivery_pin_lng double precision, delivery_pin_address text,
  group_order_id uuid references public.group_orders(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create type public.payment_status as enum ('pending_review','verified','rejected');
create table public.payments (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id), submitted_by uuid references public.user_profiles(id),
  method_type text, amount numeric(12,2), status public.payment_status default 'pending_review'
);
-- Existing ungrouped-payment guard, retained to check coexistence with Phase 1.
create function public.reject_expired_payment_insert() returns trigger language plpgsql security definer set search_path = '' as $$
declare target public.orders;
begin
  select * into target from public.orders where id = new.order_id;
  if target.reservation_expires_at <= now() then raise exception 'Payment deadline has expired'; end if;
  if target.status not in ('payment_pending','insufficient_payment') then raise exception 'Order is not payable'; end if;
  return new;
end; $$;
create trigger payments_reject_expired before insert on public.payments for each row execute function public.reject_expired_payment_insert();
create table public.notifications (
  id uuid primary key default gen_random_uuid(), recipient_id uuid references public.user_profiles(id), category text, message text, target_path text,
  context jsonb default '{}'::jsonb, dedupe_key text, created_at timestamptz default now(), read_at timestamptz
);
create unique index notifications_dedupe_uidx on public.notifications(recipient_id, dedupe_key) where dedupe_key is not null;
alter table public.orders enable row level security;
create policy orders_participant_select on public.orders for select to authenticated using (buyer_id = auth.uid() or seller_id = auth.uid());
grant select on public.orders, public.payments, public.user_profiles to authenticated;

-- Email processing is outside these suites; use the real shipping RPC with mail
-- opt-out so its original pause/resume rules can be tested without a dispatcher.
create function public.wants_email(p_user_id uuid, p_preference text)
returns boolean language sql immutable as $$ select false; $$;

-- Existing standalone expiry/waitlist dependencies used by recovery integration
-- tests. The runner loads the REAL stock, allocator, placement and sweep RPCs.
alter table public.batch_products add column is_locked boolean not null default false, add column limit_per_user integer;
alter table public.orders alter column id set default gen_random_uuid();
create sequence public.order_number_seq;
create table public.waitlist_entries (
 id uuid primary key default gen_random_uuid(), batch_product_id uuid references public.batch_products(id),
 buyer_id uuid references public.user_profiles(id), desired_quantity integer not null,
 status text not null default 'waiting', joined_at timestamptz not null default now(), offer_expires_at timestamptz
);
