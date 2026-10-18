-- Write every signup field from the auth metadata instead of from a
-- post-signup client update.
--
-- `auth.signUp` issues no session while an email confirmation is pending, and
-- public.user_profiles is update-authenticated only, so the client-side update
-- that used to set shop_name / social_links / social_visibility / can_sell
-- could not run in that case (it matched zero rows and raised nothing). The
-- shop name, social links and seller flag were therefore silently discarded,
-- and a seller who confirmed by email came back as a plain buyer.
--
-- `raw_user_meta_data` is present on the auth user from the moment it is
-- created, so the signup trigger can write the whole row regardless of whether
-- a session was returned. The client now sends all four fields in
-- `options.data`, and this function is the single writer of the signup profile.
--
-- Deploy with the matching frontend change: without this function the trigger
-- writes only display_name, and the other signup fields are dropped again.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
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
    coalesce(new.raw_user_meta_data ->> 'display_name', ''),
    nullif(new.raw_user_meta_data ->> 'shop_name', ''),
    -- Guard the jsonb and boolean reads: metadata is client-supplied, and a
    -- malformed value must not abort the auth.users insert (which would fail
    -- the whole signup).
    case
      when jsonb_typeof(new.raw_user_meta_data -> 'social_links') = 'object'
        then new.raw_user_meta_data -> 'social_links'
      else '{}'::jsonb
    end,
    case
      when jsonb_typeof(new.raw_user_meta_data -> 'social_visibility') = 'object'
        then new.raw_user_meta_data -> 'social_visibility'
      else '{}'::jsonb
    end,
    case
      when jsonb_typeof(new.raw_user_meta_data -> 'can_sell') = 'boolean'
        then (new.raw_user_meta_data ->> 'can_sell')::boolean
      else false
    end
  );
  return new;
end;
$$;

comment on function public.handle_new_auth_user() is
  'Creates the user_profiles row from auth.signUp metadata, so signup fields survive an unconfirmed-email round trip.';

notify pgrst, 'reload schema';
