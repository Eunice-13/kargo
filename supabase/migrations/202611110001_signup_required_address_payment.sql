-- Signup now collects a required delivery address plus map pin for buyers, one
-- payment method for sellers, and at least one social account for both roles.
-- All of it arrives in auth metadata, so the signup trigger has to persist and
-- check it: `auth.signUp` issues no session while an email confirmation is
-- pending, and the client cannot write these rows before confirmation.
--
-- The buyer address is stored in the existing `buyer_addresses` table (slot 1,
-- label "Home", default), so it behaves exactly like an address saved later in
-- Settings. The payment method is inserted into `seller_payment_methods` so the
-- seller can receive payments immediately after confirming the account.
--
-- Enforcement only applies to metadata marked `signup_flow = 'kargo_app'`, so
-- admin-created users, imports and other out-of-band accounts are not blocked.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  via_app boolean := (meta ->> 'signup_flow') = 'kargo_app';
  can_sell boolean;
  buyer_address jsonb;
  address_text text;
  address_lat double precision;
  address_lng double precision;
  socials jsonb;
  seller_payment jsonb;
  payment_type text;
  payment_name text;
  payment_number text;
begin
  can_sell := case
    when jsonb_typeof(meta -> 'can_sell') = 'boolean'
      then (meta ->> 'can_sell')::boolean
    else false
  end;
  buyer_address := case
    when jsonb_typeof(meta -> 'buyer_address') = 'object'
      then meta -> 'buyer_address'
    else null
  end;
  if buyer_address is not null then
    address_text := nullif(trim(buyer_address ->> 'addressText'), '');
    address_lat := case
      when jsonb_typeof(buyer_address -> 'lat') = 'number'
        then (buyer_address ->> 'lat')::double precision
      else null
    end;
    address_lng := case
      when jsonb_typeof(buyer_address -> 'lng') = 'number'
        then (buyer_address ->> 'lng')::double precision
      else null
    end;
  end if;
  socials := case
    when jsonb_typeof(meta -> 'social_links') = 'object'
      then meta -> 'social_links'
    else '{}'::jsonb
  end;

  if via_app and socials = '{}'::jsonb then
    raise exception 'Signup requires at least one social account'
      using errcode = '23514';
  end if;

  insert into public.user_profiles (
    id,
    display_name,
    shop_name,
    social_links,
    social_visibility,
    can_sell
  )
  values (
    new.id,
    coalesce(meta ->> 'display_name', ''),
    nullif(meta ->> 'shop_name', ''),
    socials,
    case
      when jsonb_typeof(meta -> 'social_visibility') = 'object'
        then meta -> 'social_visibility'
      else '{}'::jsonb
    end,
    can_sell
  );

  -- Enforce the rest of the signup contract in the database as well as the
  -- form: buyers need a delivery address with a map pin, sellers need one
  -- usable payment method.
  if can_sell then
    seller_payment := meta -> 'seller_payment_method';
    if jsonb_typeof(seller_payment) = 'object' then
      payment_type := nullif(trim(seller_payment ->> 'method_type'), '');
      payment_name := nullif(trim(seller_payment ->> 'account_name'), '');
      payment_number := nullif(trim(seller_payment ->> 'account_number'), '');
    end if;

    if payment_type is null or payment_number is null then
      if via_app then
        raise exception 'Seller signup requires at least one payment method'
          using errcode = '23514';
      end if;
    else
      insert into public.seller_payment_methods (
        seller_id,
        method_type,
        account_name,
        account_number
      )
      select new.id, payment_type, payment_name, payment_number
      where not exists (
        select 1
        from public.seller_payment_methods method
        where method.seller_id = new.id
          and method.is_active
          and lower(method.method_type) = lower(payment_type)
          and coalesce(method.account_number, '') = coalesce(payment_number, '')
      );
    end if;
  else
    if via_app and (
      address_text is null or address_lat is null or address_lng is null
    ) then
      raise exception 'Buyer signup requires a delivery address and map pin'
        using errcode = '23514';
    end if;

    if address_text is not null and address_lat is not null and address_lng is not null then
      insert into public.buyer_addresses (
        buyer_id,
        slot,
        label,
        address_text,
        pin_lat,
        pin_lng,
        is_default
      )
      values (new.id, 1, 'Home', address_text, address_lat, address_lng, true)
      on conflict (buyer_id, slot) do nothing;
    end if;
  end if;

  return new;
end;
$$;

comment on function public.handle_new_auth_user() is
  'Creates the profile and required signup data (buyer address, seller payment method, social account) from auth.signUp metadata, so they survive an unconfirmed-email round trip.';

notify pgrst, 'reload schema';
