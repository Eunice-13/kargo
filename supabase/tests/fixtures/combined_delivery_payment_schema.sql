-- Missing standalone-payment/storage columns in the minimal Phase 1 fixture.
-- These are existing production fields, not schema changes in Phase 4.
alter table public.orders add column payment_confirmed_at timestamptz;
create table public.seller_payment_methods (
 id uuid primary key default gen_random_uuid(), seller_id uuid references public.user_profiles(id),
 method_type text not null, is_active boolean not null default true
);
alter table public.payments
 add column reference_number text, add column receipt_path text,
 add column payer_account_name text, add column payer_phone text, add column buyer_contact_url text,
 add column submitted_at timestamptz not null default now(),
 add column reviewed_at timestamptz,add column reviewed_by uuid references public.user_profiles(id),
 add column rejection_reason text,add column rejection_deadline timestamptz;
create unique index payments_order_reference_uidx on public.payments(order_id,reference_number) where reference_number is not null and length(trim(reference_number))>0;
create schema storage;
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
