-- Expose public seller handles to shop visitors.
-- This is separate from the signup migration because 202611160001 may already
-- have been applied in deployed environments.

drop view if exists public.public_profiles;

create view public.public_profiles as
select
  p.id,
  p.display_name,
  p.bio,
  p.shop_name,
  coalesce((
    select jsonb_object_agg(link.key, link.value)
    from jsonb_each(p.social_links) as link
    where coalesce((p.social_visibility ->> link.key)::boolean, true)
  ), '{}'::jsonb) as social_links,
  p.avatar_path,
  p.created_at,
  p.username
from public.user_profiles p;

grant select on public.public_profiles to authenticated;
notify pgrst, 'reload schema';
