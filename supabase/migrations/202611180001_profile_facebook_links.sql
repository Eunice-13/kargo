-- Facebook links must be exact profiles.
--
-- Accounts without a verified profile URL stay blank. KARGO does not invent a
-- people-search page or attach a stranger's profile based on a name match.
--
-- This migration also cleans up values written by an earlier version of this
-- change: generated facebook.com/public/... links and non-URL placeholders such
-- as "joke", "secret" or a bare handle.

-- Remove generated people-search links.
update public.user_profiles
set social_links = coalesce(social_links, '{}'::jsonb) - 'Facebook',
    social_visibility = coalesce(social_visibility, '{}'::jsonb) - 'Facebook'
where social_links ->> 'Facebook' like 'https://www.facebook.com/public/%';

-- Remove values that are not an absolute Facebook URL.
update public.user_profiles
set social_links = coalesce(social_links, '{}'::jsonb) - 'Facebook',
    social_visibility = coalesce(social_visibility, '{}'::jsonb) - 'Facebook'
where social_links ? 'Facebook'
  and social_links ->> 'Facebook' !~* '^https?://(www\.|m\.|web\.)?facebook\.com/';

-- Drop the helpers/trigger from the earlier version if it was applied.
drop trigger if exists ensure_profile_facebook_link on public.user_profiles;
drop function if exists public.ensure_profile_facebook_link();
drop function if exists public.facebook_search_url(text);
