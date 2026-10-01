create extension if not exists pgcrypto;

create type public.bir_status as enum ('none', 'pending', 'verified', 'flagged');
create type public.account_status as enum ('active', 'suspended');
create type public.batch_status as enum ('draft', 'live', 'locked', 'closed');
create type public.order_status as enum (
  'payment_pending',
  'payment_submitted',
  'insufficient_payment',
  'payment_confirmed',
  'preparing',
  'completed',
  'expired',
  'cancelled',
  'incomplete'
);
create type public.payment_status as enum ('pending_review', 'verified', 'rejected');
create type public.extension_status as enum ('none', 'pending', 'approved', 'denied');
create type public.request_status as enum ('pending', 'replied', 'approved', 'declined');
create type public.waitlist_status as enum ('waiting', 'offered', 'converted', 'cancelled');

create sequence public.order_number_seq start 1;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  bio text,
  phone text,
  shop_name text,
  social_links jsonb not null default '{}'::jsonb,
  avatar_path text,
  bir_document_path text,
  bir_status public.bir_status not null default 'none',
  bir_flag_reason text check (bir_flag_reason is null or bir_flag_reason in ('unreadable', 'bad_domain')),
  bir_checked_at timestamptz,
  account_status public.account_status not null default 'active',
  notification_preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.batches (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete restrict,
  title text not null check (length(trim(title)) > 0),
  status public.batch_status not null default 'draft',
  starts_on date not null,
  ends_on date not null,
  category text not null,
  reservation_hours integer not null default 48 check (reservation_hours > 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

create table public.batch_products (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  base_price numeric(12,2) not null check (base_price >= 0),
  markup numeric(12,2) not null default 0 check (markup >= 0),
  selling_price numeric(12,2) generated always as (base_price + markup) stored,
  quantity_total integer not null check (quantity_total > 0),
  is_locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index batch_products_batch_name_uidx on public.batch_products (batch_id, lower(name));

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  batch_product_id uuid not null references public.batch_products(id) on delete restrict,
  buyer_id uuid not null references public.profiles(id) on delete restrict,
  seller_id uuid not null references public.profiles(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_base_price numeric(12,2) not null check (unit_base_price >= 0),
  unit_selling_price numeric(12,2) not null check (unit_selling_price >= 0),
  total_amount numeric(12,2) generated always as (unit_selling_price * quantity) stored,
  status public.order_status not null default 'payment_pending',
  reservation_expires_at timestamptz not null,
  extension_status public.extension_status not null default 'none',
  extension_requested_hours integer check (extension_requested_hours is null or extension_requested_hours > 0),
  extension_reason text,
  extension_requested_at timestamptz,
  extension_decided_at timestamptz,
  tracking_number text,
  eta timestamptz,
  payment_confirmed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (buyer_id <> seller_id)
);

create table public.seller_payment_methods (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  method_type text not null,
  account_name text,
  account_number text,
  is_active boolean not null default true,
  is_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index seller_payment_methods_signature_uidx
  on public.seller_payment_methods (seller_id, lower(method_type), coalesce(account_number, ''))
  where is_active;

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  submitted_by uuid not null references public.profiles(id) on delete restrict,
  seller_payment_method_id uuid references public.seller_payment_methods(id) on delete set null,
  method_type text not null,
  amount numeric(12,2) not null check (amount > 0),
  payer_account_name text,
  payer_phone text,
  buyer_contact_url text,
  reference_number text,
  receipt_path text,
  status public.payment_status not null default 'pending_review',
  rejection_reason text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null
);
create unique index payments_order_reference_uidx
  on public.payments (order_id, reference_number)
  where reference_number is not null and length(trim(reference_number)) > 0;

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text not null default 'Address',
  address_line text not null,
  city text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index addresses_one_default_uidx on public.addresses (user_id) where is_default;

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  reviewer_id uuid not null references public.profiles(id) on delete restrict,
  reviewee_id uuid not null references public.profiles(id) on delete restrict,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, reviewer_id),
  check (reviewer_id <> reviewee_id)
);

create table public.buyer_requests (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  batch_id uuid references public.batches(id) on delete set null,
  product_name text not null,
  quantity integer not null default 1 check (quantity > 0),
  message text,
  status public.request_status not null default 'pending',
  seller_reply text,
  replied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (buyer_id <> seller_id)
);

create table public.waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  batch_product_id uuid not null references public.batch_products(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  status public.waitlist_status not null default 'waiting',
  joined_at timestamptz not null default now(),
  notified_at timestamptz,
  unique (batch_product_id, buyer_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  category text not null,
  message text not null,
  target_path text,
  context jsonb not null default '{}'::jsonb,
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index notifications_dedupe_uidx
  on public.notifications (recipient_id, dedupe_key)
  where dedupe_key is not null;

create index batches_seller_idx on public.batches(seller_id);
create index batch_products_batch_idx on public.batch_products(batch_id);
create index orders_buyer_idx on public.orders(buyer_id, created_at desc);
create index orders_seller_idx on public.orders(seller_id, created_at desc);
create index orders_product_status_idx on public.orders(batch_product_id, status);
create index payments_order_idx on public.payments(order_id, status);
create index reviews_reviewee_idx on public.reviews(reviewee_id);
create index buyer_requests_seller_idx on public.buyer_requests(seller_id, status);
create index waitlist_product_idx on public.waitlist_entries(batch_product_id, joined_at);
create index notifications_recipient_idx on public.notifications(recipient_id, created_at desc);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger batches_updated_at before update on public.batches for each row execute function public.set_updated_at();
create trigger batch_products_updated_at before update on public.batch_products for each row execute function public.set_updated_at();
create trigger orders_updated_at before update on public.orders for each row execute function public.set_updated_at();
create trigger seller_payment_methods_updated_at before update on public.seller_payment_methods for each row execute function public.set_updated_at();
create trigger addresses_updated_at before update on public.addresses for each row execute function public.set_updated_at();
create trigger reviews_updated_at before update on public.reviews for each row execute function public.set_updated_at();
create trigger buyer_requests_updated_at before update on public.buyer_requests for each row execute function public.set_updated_at();

create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create function public.is_active(p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_user_id and p.account_status = 'active'
  );
$$;

create function public.can_sell(p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_user_id
      and p.account_status = 'active'
      and p.bir_status = 'verified'
  );
$$;

create function public.submit_bir_badge(p_object_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_active(auth.uid()) then
    raise exception 'Authentication and an active account are required';
  end if;
  if p_object_path is null or split_part(p_object_path, '/', 1) <> auth.uid()::text then
    raise exception 'Invalid BIR object path';
  end if;
  update public.profiles
  set bir_document_path = p_object_path,
      bir_status = 'pending',
      bir_flag_reason = null,
      bir_checked_at = null
  where id = auth.uid();
end;
$$;

create function public.complete_bir_verification(
  p_user_id uuid,
  p_expected_object_path text,
  p_status public.bir_status,
  p_flag_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed integer;
begin
  if p_status not in ('verified', 'flagged') then
    raise exception 'Invalid terminal BIR status';
  end if;
  if p_status = 'flagged' and (p_flag_reason is null or p_flag_reason not in ('unreadable', 'bad_domain')) then
    raise exception 'Invalid BIR flag reason';
  end if;
  update public.profiles
  set bir_status = p_status,
      bir_flag_reason = case when p_status = 'flagged' then p_flag_reason else null end,
      bir_checked_at = now()
  where id = p_user_id
    and bir_status = 'pending'
    and bir_document_path = p_expected_object_path;
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

create function public.claim_batch_product(p_batch_product_id uuid, p_quantity integer)
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
  values (batch.seller_id, 'bag', 'A buyer claimed ' || product.name || ' ×' || p_quantity, 'My Claims', jsonb_build_object('order_id', result.id));
  return result;
end;
$$;

create function public.get_financial_summary(
  p_from timestamptz,
  p_to timestamptz,
  p_batch_id uuid default null
)
returns table (
  gross_sales numeric,
  verified_payments numeric,
  outstanding_amount numeric,
  insufficient_outstanding numeric,
  estimated_expenses numeric,
  gross_profit numeric,
  order_count bigint,
  items_sold bigint
)
language sql
security invoker
set search_path = ''
as $$
  with scoped_orders as (
    select o.*
    from public.orders o
    join public.batch_products bp on bp.id = o.batch_product_id
    where o.seller_id = auth.uid()
      and (p_batch_id is null or bp.batch_id = p_batch_id)
  ), realized as (
    select * from scoped_orders
    where status in ('payment_confirmed', 'preparing', 'completed')
      and payment_confirmed_at >= p_from and payment_confirmed_at < p_to
  ), paid_per_order as (
    select p.order_id, coalesce(sum(p.amount), 0) as paid
    from public.payments p
    join scoped_orders so on so.id = p.order_id
    where p.status = 'verified'
    group by p.order_id
  ), received as (
    select coalesce(sum(p.amount), 0) as total
    from public.payments p
    join scoped_orders so on so.id = p.order_id
    where p.status = 'verified'
      and p.reviewed_at >= p_from and p.reviewed_at < p_to
  ), outstanding as (
    select
      coalesce(sum(greatest(so.total_amount - coalesce(ppo.paid, 0), 0)), 0) as total,
      coalesce(sum(greatest(so.total_amount - coalesce(ppo.paid, 0), 0)) filter (where so.status = 'insufficient_payment'), 0) as insufficient
    from scoped_orders so
    left join paid_per_order ppo on ppo.order_id = so.id
    where so.status in ('payment_pending', 'payment_submitted', 'insufficient_payment')
      and so.created_at >= p_from and so.created_at < p_to
  )
  select
    coalesce(sum(r.total_amount), 0),
    (select total from received),
    (select total from outstanding),
    (select insufficient from outstanding),
    coalesce(sum(r.unit_base_price * r.quantity), 0),
    coalesce(sum(r.total_amount - (r.unit_base_price * r.quantity)), 0),
    count(r.id),
    coalesce(sum(r.quantity), 0)
  from realized r;
$$;

create function public.submit_order_payment(
  p_order_id uuid,
  p_method_type text,
  p_amount numeric,
  p_reference_number text default null,
  p_receipt_path text default null,
  p_payer_account_name text default null,
  p_payer_phone text default null,
  p_buyer_contact_url text default null
)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.orders;
  result public.payments;
begin
  if auth.uid() is null or not public.is_active(auth.uid()) then raise exception 'Active account required'; end if;
  select * into target from public.orders where id = p_order_id and buyer_id = auth.uid() for update;
  if not found then raise exception 'Order not found'; end if;
  if target.status not in ('payment_pending', 'payment_submitted', 'insufficient_payment') then raise exception 'Order is not payable'; end if;
  if p_amount <= 0 then raise exception 'Payment amount must be positive'; end if;
  insert into public.payments (
    order_id, submitted_by, method_type, amount, reference_number, receipt_path,
    payer_account_name, payer_phone, buyer_contact_url
  ) values (
    target.id, auth.uid(), p_method_type, p_amount, nullif(trim(p_reference_number), ''),
    p_receipt_path, p_payer_account_name, p_payer_phone, p_buyer_contact_url
  ) returning * into result;
  update public.orders set status = 'payment_submitted' where id = target.id;
  insert into public.notifications (recipient_id, category, message, target_path, context)
  values (target.seller_id, 'clipboard', 'New payment proof submitted for ' || target.order_number, 'Payments', jsonb_build_object('order_id', target.id));
  return result;
end;
$$;

create function public.review_order_payment(p_payment_id uuid, p_decision public.payment_status, p_reason text default null)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment public.payments;
  target public.orders;
  total_paid numeric;
begin
  if p_decision not in ('verified', 'rejected') then raise exception 'Invalid payment decision'; end if;
  select p.* into payment from public.payments p where p.id = p_payment_id for update;
  if not found then raise exception 'Payment not found'; end if;
  select * into target from public.orders where id = payment.order_id and seller_id = auth.uid() for update;
  if not found or not public.can_sell(auth.uid()) then raise exception 'Seller access required'; end if;
  update public.payments set status = p_decision, rejection_reason = case when p_decision = 'rejected' then p_reason else null end,
    reviewed_at = now(), reviewed_by = auth.uid() where id = payment.id;
  if p_decision = 'verified' then
    select coalesce(sum(amount), 0) into total_paid from public.payments where order_id = target.id and status = 'verified';
    update public.orders set
      status = case when total_paid >= target.total_amount then 'payment_confirmed'::public.order_status else 'insufficient_payment'::public.order_status end,
      payment_confirmed_at = case when total_paid >= target.total_amount then coalesce(payment_confirmed_at, now()) else null end
    where id = target.id returning * into target;
  else
    update public.orders set status = 'payment_pending'::public.order_status where id = target.id returning * into target;
  end if;
  insert into public.notifications (recipient_id, category, message, target_path, context)
  values (target.buyer_id, case when p_decision = 'verified' then 'check' else 'clock' end,
    case when p_decision = 'verified' then 'Your payment was reviewed for ' else 'Your payment was rejected for ' end || target.order_number,
    'Payments', jsonb_build_object('order_id', target.id));
  return target;
end;
$$;

create function public.request_order_extension(p_order_id uuid, p_hours integer, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_hours <= 0 then raise exception 'Requested hours must be positive'; end if;
  update public.orders set extension_status = 'pending', extension_requested_hours = p_hours,
    extension_reason = p_reason, extension_requested_at = now(), extension_decided_at = null
  where id = p_order_id and buyer_id = auth.uid() and status in ('payment_pending', 'insufficient_payment') and public.is_active(auth.uid());
  if not found then raise exception 'Order is not eligible for extension'; end if;
  insert into public.notifications (recipient_id, category, message, target_path, context)
  select seller_id, 'clock', 'A buyer requested a payment extension for ' || order_number, 'Batches', jsonb_build_object('order_id', id)
  from public.orders where id = p_order_id;
end;
$$;

create function public.decide_order_extension(p_order_id uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.orders set
    extension_status = case when p_approve then 'approved'::public.extension_status else 'denied'::public.extension_status end,
    reservation_expires_at = case when p_approve then reservation_expires_at + make_interval(hours => extension_requested_hours) else reservation_expires_at end,
    extension_decided_at = now()
  where id = p_order_id and seller_id = auth.uid() and extension_status = 'pending' and public.can_sell(auth.uid());
  if not found then raise exception 'Extension request not found'; end if;
  insert into public.notifications (recipient_id, category, message, target_path, context)
  select buyer_id, 'clock', 'Your extension request was ' || case when p_approve then 'approved' else 'denied' end, 'My Claims', jsonb_build_object('order_id', id)
  from public.orders where id = p_order_id;
end;
$$;

create function public.cancel_order(p_order_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.orders set status = 'cancelled'::public.order_status
  where id = p_order_id and buyer_id = auth.uid()
    and status in ('payment_pending', 'payment_submitted', 'insufficient_payment') and public.is_active(auth.uid());
  if not found then raise exception 'Order cannot be cancelled'; end if;
end;
$$;

create function public.set_fulfillment_status(
  p_order_id uuid,
  p_status public.order_status,
  p_tracking_number text default null,
  p_eta timestamptz default null
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_status not in ('payment_confirmed', 'preparing', 'completed', 'cancelled', 'incomplete') then
    raise exception 'Invalid fulfillment status';
  end if;
  update public.orders set status = p_status, tracking_number = coalesce(p_tracking_number, tracking_number),
    eta = coalesce(p_eta, eta), completed_at = case when p_status = 'completed' then now() else completed_at end
  where id = p_order_id and seller_id = auth.uid() and public.can_sell(auth.uid());
  if not found then raise exception 'Order not found'; end if;
  insert into public.notifications (recipient_id, category, message, target_path, context)
  select buyer_id, 'package', 'Order ' || order_number || ' is now ' || replace(p_status::text, '_', ' '), 'Orders', jsonb_build_object('order_id', id)
  from public.orders where id = p_order_id;
end;
$$;

create function public.create_order_review(p_order_id uuid, p_rating smallint, p_comment text default null)
returns public.reviews
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.orders;
  result public.reviews;
  reviewee uuid;
begin
  if p_rating < 1 or p_rating > 5 then raise exception 'Rating must be between 1 and 5'; end if;
  select * into target from public.orders where id = p_order_id and status = 'completed';
  if not found or auth.uid() not in (target.buyer_id, target.seller_id) then raise exception 'Completed order not found'; end if;
  reviewee := case when auth.uid() = target.buyer_id then target.seller_id else target.buyer_id end;
  insert into public.reviews (order_id, reviewer_id, reviewee_id, rating, comment)
  values (target.id, auth.uid(), reviewee, p_rating, nullif(trim(p_comment), ''))
  returning * into result;
  insert into public.notifications (recipient_id, category, message, target_path, context)
  values (reviewee, 'star', 'You received a ' || p_rating || '-star review', 'Orders', jsonb_build_object('order_id', target.id));
  return result;
end;
$$;

create function public.create_buyer_request(p_batch_id uuid, p_product_name text, p_quantity integer, p_message text default null)
returns public.buyer_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.batches;
  result public.buyer_requests;
begin
  if not public.is_active(auth.uid()) then raise exception 'Active account required'; end if;
  select * into target from public.batches where id = p_batch_id and status <> 'draft';
  if not found then raise exception 'Batch not found'; end if;
  insert into public.buyer_requests (buyer_id, seller_id, batch_id, product_name, quantity, message)
  values (auth.uid(), target.seller_id, target.id, trim(p_product_name), p_quantity, p_message)
  returning * into result;
  insert into public.notifications (recipient_id, category, message, target_path, context)
  values (target.seller_id, 'bag', 'New buyer request for ' || trim(p_product_name), 'Batches', jsonb_build_object('request_id', result.id));
  return result;
end;
$$;

create view public.public_profiles as
select id, display_name, bio, shop_name, social_links, avatar_path, bir_status, created_at
from public.profiles
where account_status = 'active';

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
  (select coalesce(avg(r.rating), 0) from public.reviews r join public.orders o on o.id = r.order_id
    join public.batch_products x on x.id = o.batch_product_id where x.batch_id = b.id and r.reviewee_id = b.seller_id) as rating
from public.batches b
join public.profiles seller on seller.id = b.seller_id
join public.batch_products bp on bp.batch_id = b.id
where b.status <> 'draft' and seller.account_status = 'active';

alter table public.profiles enable row level security;
alter table public.batches enable row level security;
alter table public.batch_products enable row level security;
alter table public.orders enable row level security;
alter table public.payments enable row level security;
alter table public.seller_payment_methods enable row level security;
alter table public.addresses enable row level security;
alter table public.reviews enable row level security;
alter table public.buyer_requests enable row level security;
alter table public.waitlist_entries enable row level security;
alter table public.notifications enable row level security;

create policy profiles_select_own on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid() and public.is_active()) with check (id = auth.uid());

create policy batches_select_visible on public.batches for select to authenticated
  using (status <> 'draft' or seller_id = auth.uid());
create policy batches_insert_seller on public.batches for insert to authenticated
  with check (seller_id = auth.uid() and public.can_sell());
create policy batches_update_seller on public.batches for update to authenticated
  using (seller_id = auth.uid() and public.can_sell()) with check (seller_id = auth.uid() and public.can_sell());
create policy batches_delete_seller on public.batches for delete to authenticated
  using (seller_id = auth.uid() and public.can_sell());

create policy products_select_visible on public.batch_products for select to authenticated
  using (exists (select 1 from public.batches b where b.id = batch_id and (b.status <> 'draft' or b.seller_id = auth.uid())));
create policy products_insert_seller on public.batch_products for insert to authenticated
  with check (exists (select 1 from public.batches b where b.id = batch_id and b.seller_id = auth.uid()) and public.can_sell());
create policy products_update_seller on public.batch_products for update to authenticated
  using (exists (select 1 from public.batches b where b.id = batch_id and b.seller_id = auth.uid()) and public.can_sell());
create policy products_delete_seller on public.batch_products for delete to authenticated
  using (exists (select 1 from public.batches b where b.id = batch_id and b.seller_id = auth.uid()) and public.can_sell());

create policy orders_select_participant on public.orders for select to authenticated
  using (buyer_id = auth.uid() or seller_id = auth.uid());
create policy orders_update_buyer on public.orders for update to authenticated
  using (buyer_id = auth.uid() and public.is_active());
create policy orders_update_seller on public.orders for update to authenticated
  using (seller_id = auth.uid() and public.can_sell());

create policy payments_select_participant on public.payments for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())));
create policy payments_insert_buyer on public.payments for insert to authenticated
  with check (submitted_by = auth.uid() and public.is_active() and exists (select 1 from public.orders o where o.id = order_id and o.buyer_id = auth.uid()));
create policy payments_update_seller on public.payments for update to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.seller_id = auth.uid()) and public.can_sell());

create policy methods_select_owner on public.seller_payment_methods for select to authenticated using (seller_id = auth.uid());
create policy methods_insert_owner on public.seller_payment_methods for insert to authenticated with check (seller_id = auth.uid() and public.can_sell());
create policy methods_update_owner on public.seller_payment_methods for update to authenticated using (seller_id = auth.uid() and public.can_sell());
create policy methods_delete_owner on public.seller_payment_methods for delete to authenticated using (seller_id = auth.uid() and public.can_sell());

create policy addresses_owner_all on public.addresses for all to authenticated
  using (user_id = auth.uid() and public.is_active()) with check (user_id = auth.uid() and public.is_active());

create policy reviews_select_authenticated on public.reviews for select to authenticated using (true);
create policy reviews_insert_participant on public.reviews for insert to authenticated
  with check (reviewer_id = auth.uid() and public.is_active() and exists (
    select 1 from public.orders o where o.id = order_id and o.status = 'completed'
      and ((o.buyer_id = reviewer_id and o.seller_id = reviewee_id) or (o.seller_id = reviewer_id and o.buyer_id = reviewee_id))
  ));
create policy reviews_update_own on public.reviews for update to authenticated using (reviewer_id = auth.uid() and public.is_active());
create policy reviews_delete_own on public.reviews for delete to authenticated using (reviewer_id = auth.uid() and public.is_active());

create policy buyer_requests_select_participant on public.buyer_requests for select to authenticated using (buyer_id = auth.uid() or seller_id = auth.uid());
create policy buyer_requests_insert_buyer on public.buyer_requests for insert to authenticated with check (buyer_id = auth.uid() and public.is_active());
create policy buyer_requests_update_buyer on public.buyer_requests for update to authenticated using (buyer_id = auth.uid() and status = 'pending' and public.is_active());
create policy buyer_requests_update_seller on public.buyer_requests for update to authenticated using (seller_id = auth.uid() and public.can_sell());

create policy waitlist_select_buyer_or_seller on public.waitlist_entries for select to authenticated using (
  buyer_id = auth.uid() or exists (
    select 1 from public.batch_products bp join public.batches b on b.id = bp.batch_id
    where bp.id = batch_product_id and b.seller_id = auth.uid()
  )
);
create policy waitlist_insert_buyer on public.waitlist_entries for insert to authenticated with check (buyer_id = auth.uid() and public.is_active());
create policy waitlist_delete_buyer on public.waitlist_entries for delete to authenticated using (buyer_id = auth.uid() and public.is_active());

create policy notifications_select_own on public.notifications for select to authenticated using (recipient_id = auth.uid());
create policy notifications_update_own on public.notifications for update to authenticated using (recipient_id = auth.uid() and public.is_active());
create policy notifications_delete_own on public.notifications for delete to authenticated using (recipient_id = auth.uid() and public.is_active());

revoke all on all tables in schema public from anon;
grant select on public.public_profiles to authenticated;
grant select on public.batch_catalog to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.batches, public.batch_products, public.addresses, public.reviews, public.buyer_requests, public.waitlist_entries to authenticated;
grant select on public.orders to authenticated;
grant select on public.payments to authenticated;
grant select, insert, update, delete on public.seller_payment_methods to authenticated;
grant select, update, delete on public.notifications to authenticated;
revoke update (bir_document_path, bir_status, bir_flag_reason, bir_checked_at, account_status) on public.profiles from authenticated;
grant usage, select on sequence public.order_number_seq to authenticated;

revoke all on function public.submit_bir_badge(text) from public;
grant execute on function public.submit_bir_badge(text) to authenticated;
revoke all on function public.complete_bir_verification(uuid, text, public.bir_status, text) from public, anon, authenticated;
grant execute on function public.complete_bir_verification(uuid, text, public.bir_status, text) to service_role;
revoke all on function public.claim_batch_product(uuid, integer) from public;
grant execute on function public.claim_batch_product(uuid, integer) to authenticated;
revoke all on function public.get_financial_summary(timestamptz, timestamptz, uuid) from public;
grant execute on function public.get_financial_summary(timestamptz, timestamptz, uuid) to authenticated;
revoke all on function public.submit_order_payment(uuid, text, numeric, text, text, text, text, text) from public;
grant execute on function public.submit_order_payment(uuid, text, numeric, text, text, text, text, text) to authenticated;
revoke all on function public.review_order_payment(uuid, public.payment_status, text) from public;
grant execute on function public.review_order_payment(uuid, public.payment_status, text) to authenticated;
revoke all on function public.request_order_extension(uuid, integer, text) from public;
grant execute on function public.request_order_extension(uuid, integer, text) to authenticated;
revoke all on function public.decide_order_extension(uuid, boolean) from public;
grant execute on function public.decide_order_extension(uuid, boolean) to authenticated;
revoke all on function public.cancel_order(uuid) from public;
grant execute on function public.cancel_order(uuid) to authenticated;
revoke all on function public.set_fulfillment_status(uuid, public.order_status, text, timestamptz) from public;
grant execute on function public.set_fulfillment_status(uuid, public.order_status, text, timestamptz) to authenticated;
revoke all on function public.create_order_review(uuid, smallint, text) from public;
grant execute on function public.create_order_review(uuid, smallint, text) to authenticated;
revoke all on function public.create_buyer_request(uuid, text, integer, text) from public;
grant execute on function public.create_buyer_request(uuid, text, integer, text) to authenticated;

-- service_role is the trusted, server-only role (bypasses RLS). Supabase grants
-- these by default; we make them explicit so administrative/server tooling
-- (Edge Functions, one-off seed/admin scripts) can read and write. This never
-- reaches the browser — anon/authenticated grants above are unchanged.
grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to service_role;

insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', true),
  ('bir-certificates', 'bir-certificates', false),
  ('payment-receipts', 'payment-receipts', false)
on conflict (id) do update set public = excluded.public;

create policy avatars_public_read on storage.objects for select to public using (bucket_id = 'avatars');
create policy avatars_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and owner_id = auth.uid()::text);
create policy avatars_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and owner_id = auth.uid()::text);

create policy bir_owner_read on storage.objects for select to authenticated
  using (bucket_id = 'bir-certificates' and owner_id = auth.uid()::text);
create policy bir_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'bir-certificates' and (storage.foldername(name))[1] = auth.uid()::text);
create policy bir_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'bir-certificates' and owner_id = auth.uid()::text);

create policy receipts_participant_read on storage.objects for select to authenticated using (
  bucket_id = 'payment-receipts' and (
    owner_id = auth.uid()::text or exists (
      select 1 from public.payments p join public.orders o on o.id = p.order_id
      where p.receipt_path = name and o.seller_id = auth.uid()
    )
  )
);
create policy receipts_buyer_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'payment-receipts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy receipts_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'payment-receipts' and owner_id = auth.uid()::text);
