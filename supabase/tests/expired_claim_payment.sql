-- Run against a local Supabase database after migrations:
--   psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/expired_claim_payment.sql
begin;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'expiry-buyer@kargo.test', '', now(), now(), now()),
  ('10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'expiry-seller@kargo.test', '', now(), now(), now())
on conflict (id) do nothing;

insert into public.profiles (id, display_name, can_sell, bir_status)
values
  ('10000000-0000-0000-0000-000000000001', 'Expiry Buyer', false, 'none'),
  ('10000000-0000-0000-0000-000000000002', 'Expiry Seller', true, 'verified')
on conflict (id) do update set display_name = excluded.display_name;

insert into public.batches (id, seller_id, title, status, starts_on, ends_on, category, reservation_hours)
values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'Expiry Test Batch', 'live', current_date, current_date + 1, 'Food', 1);

insert into public.batch_products (id, batch_id, name, base_price, markup, quantity_total)
values ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Thai Snack Box', 600, 50, 2);

insert into public.orders (
  id, order_number, batch_product_id, buyer_id, seller_id, quantity,
  unit_base_price, unit_selling_price, status, reservation_expires_at
)
values (
  '40000000-0000-0000-0000-000000000001', 'EXPIRY-TEST-1',
  '30000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  2, 600, 650, 'payment_pending', now() - interval '1 second'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
declare
  response jsonb;
  current_status public.order_status;
begin
  response := public.submit_order_payment(
    '40000000-0000-0000-0000-000000000001', 'GCash', 1300, 'EXPIRED-REF', null, null, null, null
  );
  if response->>'accepted' <> 'false' or response->>'error' <> 'Payment deadline has expired' then
    raise exception 'Expected backend expiry rejection, got %', response;
  end if;
  select status into current_status from public.orders where id = '40000000-0000-0000-0000-000000000001';
  if current_status <> 'expired' then raise exception 'Expected Expired status, got %', current_status; end if;
  if exists (select 1 from public.payments where order_id = '40000000-0000-0000-0000-000000000001') then
    raise exception 'Expired order accepted a payment';
  end if;

  -- Bypassing the RPC must fail at the table boundary too. Catch only the
  -- expected guard error so any other database failure still fails this test.
  begin
    insert into public.payments (order_id, submitted_by, method_type, amount, reference_number)
    values (
      '40000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000001',
      'GCash', 1300, 'DIRECT-EXPIRED-REF'
    );
    raise exception 'Direct insert unexpectedly accepted an expired payment';
  exception
    when raise_exception then
      if sqlerrm <> 'Payment deadline has expired' then raise; end if;
  end;

  if (select quantity_claimed from public.batch_catalog where product_id = '30000000-0000-0000-0000-000000000001') <> 0 then
    raise exception 'Expired stock was not released';
  end if;
end;
$$;

rollback;
