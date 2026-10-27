-- ============================================================================
-- KARGO Admin — Phase 5: Invitation acceptance (accept / decline)
-- ============================================================================
-- Today, admin_grant_admin() is silent: the target is an admin the instant the
-- RPC commits, and only finds out from a notification. This migration makes a
-- grant an INVITATION that the account holder must accept before any admin
-- capability turns on.
--
--   grant  -> admin_members row with accepted_at = null  (pending, no power)
--   accept -> accepted_at = now()                        (is_admin() becomes true)
--   decline-> revoked_at = now() + declined_at = now()   (grant is spent)
--
-- is_admin() is the single choke point for every admin RLS policy and every
-- admin_* RPC (via admin_assert()), so gating it here locks the whole console
-- without touching a single policy.
--
-- Backfill: every currently-granted admin is grandfathered as already accepted,
-- so nobody in production is locked out or shown an invitation they never got.
--
-- Depends on 202611010001 (admin_members, is_admin, admin_audit) and
-- 202611010004 (admin_list_team, admin_grant_admin, admin_revoke_admin).
-- Idempotent: one-shot column/backfill block, create or replace elsewhere.
-- ============================================================================

-- ─── 1. Invitation state columns ────────────────────────────────────────────
-- Added inside a one-shot block together with the backfill, so re-running this
-- migration can never auto-accept an invitation that is still pending.

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'admin_members'
      and column_name = 'accepted_at'
  ) then
    alter table public.admin_members
      add column accepted_at timestamptz,
      add column declined_at timestamptz;

    -- Grandfather every existing membership: anyone granted before this
    -- migration already has console access, so they must not be shown an
    -- invitation they never received.
    update public.admin_members
    set accepted_at = granted_at
    where revoked_at is null;
  end if;
end
$$;

comment on column public.admin_members.accepted_at is
  'Null while the invitation is pending. is_admin() requires a non-null value.';
comment on column public.admin_members.declined_at is
  'Set when the invitee declined the invitation. The row is also revoked.';

-- ─── 2. is_admin() now requires acceptance ──────────────────────────────────

create or replace function public.is_admin(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_members m
    join public.user_profiles p on p.id = m.user_id
    where m.user_id = p_user_id
      and m.revoked_at is null
      and m.accepted_at is not null
      and p.account_status = 'active'
  );
$$;

revoke all on function public.is_admin(uuid) from public, anon;
grant execute on function public.is_admin(uuid) to authenticated;

-- ─── 3. admin_my_invite() — the caller's own pending invitation ──────────────
-- Readable by any signed-in account (including buyers/sellers), so the invitee
-- can see who invited them without gaining admin read access to user_profiles.
-- Returns null when there is nothing pending.

create or replace function public.admin_my_invite()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_out jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'pending', true,
    'grantedAt', m.granted_at,
    'grantedBy', coalesce(nullif(gb.display_name, ''), gu.email)
  )
  into v_out
  from public.admin_members m
  left join public.user_profiles gb on gb.id = m.granted_by
  left join auth.users gu on gu.id = m.granted_by
  where m.user_id = auth.uid()
    and m.revoked_at is null
    and m.accepted_at is null;

  return v_out;
end;
$$;

revoke all on function public.admin_my_invite() from public, anon;
grant execute on function public.admin_my_invite() to authenticated;

-- ─── 4. admin_accept_invite() — invitee accepts; admin power turns on ────────

create or replace function public.admin_accept_invite()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.admin_members;
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not public.is_active(auth.uid()) then
    raise exception 'Active account required' using errcode = '42501';
  end if;

  select * into v_row from public.admin_members where user_id = auth.uid() for update;
  if not found then
    raise exception 'No admin invitation found' using errcode = 'P0002';
  end if;
  if v_row.revoked_at is not null then
    raise exception 'This admin invitation is no longer active' using errcode = '22023';
  end if;
  if v_row.accepted_at is not null then
    return jsonb_build_object('accepted', true, 'changed', false);
  end if;

  update public.admin_members
  set accepted_at = now(),
      declined_at = null
  where user_id = auth.uid();

  select coalesce(display_name, '') into v_name
  from public.user_profiles where id = auth.uid();

  perform public.admin_audit(
    'accept_admin', 'user', auth.uid()::text, v_name,
    'Invitation accepted by the account holder',
    jsonb_build_object('accepted', false),
    jsonb_build_object('accepted', true)
  );

  return jsonb_build_object('accepted', true, 'changed', true);
end;
$$;

revoke all on function public.admin_accept_invite() from public, anon;
grant execute on function public.admin_accept_invite() to authenticated;

-- ─── 5. admin_decline_invite() — invitee declines; grant is spent ───────────
-- Declining revokes the membership and tells the inviting admin. There is no
-- "maybe later": a new grant is required, which creates a fresh invitation.

create or replace function public.admin_decline_invite(p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.admin_members;
  v_name text;
  v_reason text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into v_row from public.admin_members where user_id = auth.uid() for update;
  if not found then
    raise exception 'No admin invitation found' using errcode = 'P0002';
  end if;
  if v_row.revoked_at is not null then
    return jsonb_build_object('declined', true, 'changed', false);
  end if;
  if v_row.accepted_at is not null then
    raise exception 'You have already accepted admin access; ask another admin to revoke it'
      using errcode = '22023';
  end if;

  v_reason := coalesce(
    nullif(trim(coalesce(p_reason, '')), ''),
    'Invitation declined by the account holder'
  );

  update public.admin_members
  set revoked_at = now(),
      revoked_by = auth.uid(),
      declined_at = now()
  where user_id = auth.uid();

  select coalesce(display_name, '') into v_name
  from public.user_profiles where id = auth.uid();

  perform public.admin_audit(
    'decline_admin', 'user', auth.uid()::text, v_name, v_reason,
    jsonb_build_object('accepted', false, 'pending', true),
    jsonb_build_object('declined', true)
  );

  if v_row.granted_by is not null then
    insert into public.notifications (recipient_id, category, message, target_path, context, dedupe_key)
    values (
      v_row.granted_by, 'package',
      coalesce(nullif(v_name, ''), 'An account') || ' declined the admin invitation.',
      'Dashboard', jsonb_build_object('admin', false, 'declined', true),
      'admin_decline_' || auth.uid()::text || '_' || extract(epoch from now())::bigint::text
    )
    on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing;
  end if;

  return jsonb_build_object('declined', true, 'changed', true);
end;
$$;

revoke all on function public.admin_decline_invite(text) from public, anon;
grant execute on function public.admin_decline_invite(text) to authenticated;

-- ─── 6. admin_grant_admin() — now creates a pending invitation ───────────────
-- Same guardrails as before, but the grant no longer turns capability on. The
-- notification becomes an invitation and points at the app shell, because a
-- pending invitee still has buyer/seller tabs (no Security tab yet).

create or replace function public.admin_grant_admin(p_user_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.user_profiles;
  v_existing public.admin_members;
begin
  perform public.admin_assert();

  if nullif(trim(coalesce(p_reason, '')), '') is null or length(trim(p_reason)) < 8 then
    raise exception 'A reason of at least 8 characters is required' using errcode = '22023';
  end if;

  select * into v_target from public.user_profiles where id = p_user_id for update;
  if not found then raise exception 'User not found' using errcode = 'P0002'; end if;

  if v_target.account_status <> 'active' then
    raise exception 'Only active accounts can be made admins' using errcode = '22023';
  end if;

  select * into v_existing from public.admin_members where user_id = p_user_id;

  if found and v_existing.revoked_at is null then
    -- Already an admin or already invited: nothing to do.
    return jsonb_build_object(
      'changed', false,
      'pending', v_existing.accepted_at is null
    );
  end if;

  if found then
    update public.admin_members
    set revoked_at = null,
        revoked_by = null,
        granted_by = auth.uid(),
        granted_at = now(),
        accepted_at = null,
        declined_at = null
    where user_id = p_user_id;
  else
    insert into public.admin_members (user_id, granted_by, granted_at, accepted_at, declined_at)
    values (p_user_id, auth.uid(), now(), null, null);
  end if;

  perform public.admin_audit(
    'grant_admin', 'user', p_user_id::text, v_target.display_name, trim(p_reason),
    jsonb_build_object('admin', false), jsonb_build_object('admin', false, 'pending', true)
  );

  insert into public.notifications (recipient_id, category, message, target_path, context, dedupe_key)
  values (
    p_user_id, 'check',
    'You have been invited to join the KARGO admin team. Open KARGO to accept or decline.',
    'Dashboard', jsonb_build_object('admin', true, 'pending', true),
    'admin_grant_' || p_user_id::text || '_' || extract(epoch from now())::bigint::text
  )
  on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing;

  return jsonb_build_object('changed', true, 'pending', true);
end;
$$;

revoke all on function public.admin_grant_admin(uuid, text) from public, anon;
grant execute on function public.admin_grant_admin(uuid, text) to authenticated;

-- ─── 7. admin_revoke_admin() — count only accepted admins ───────────────────
-- A pending invite never held admin power, so it must not count toward the
-- last-active-admin floor (otherwise a pending row could block a real revoke).

create or replace function public.admin_revoke_admin(p_user_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.user_profiles;
  v_active_count integer;
begin
  perform public.admin_assert();

  if nullif(trim(coalesce(p_reason, '')), '') is null or length(trim(p_reason)) < 8 then
    raise exception 'A reason of at least 8 characters is required' using errcode = '22023';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You cannot revoke your own admin access' using errcode = '42501';
  end if;

  select * into v_target from public.user_profiles where id = p_user_id;
  if not found then raise exception 'User not found' using errcode = 'P0002'; end if;

  -- Lock active admin rows while we count, so two concurrent revokes cannot
  -- both pass the last-admin check.
  perform 1 from public.admin_members where revoked_at is null for update;
  select count(*) into v_active_count
  from public.admin_members m
  join public.user_profiles p on p.id = m.user_id
  where m.revoked_at is null
    and m.accepted_at is not null
    and p.account_status = 'active';

  if not exists (select 1 from public.admin_members where user_id = p_user_id and revoked_at is null) then
    return jsonb_build_object('changed', false);
  end if;

  if v_active_count <= 1 then
    raise exception 'Cannot revoke the last active admin' using errcode = '22023';
  end if;

  update public.admin_members
  set revoked_at = now(), revoked_by = auth.uid()
  where user_id = p_user_id;

  perform public.admin_audit(
    'revoke_admin', 'user', p_user_id::text, v_target.display_name, trim(p_reason),
    jsonb_build_object('admin', true), jsonb_build_object('admin', false)
  );

  insert into public.notifications (recipient_id, category, message, target_path, context, dedupe_key)
  values (
    p_user_id, 'package', 'Your KARGO admin access has been removed.',
    'Dashboard', jsonb_build_object('admin', false),
    'admin_revoke_' || p_user_id::text || '_' || extract(epoch from now())::bigint::text
  )
  on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing;

  return jsonb_build_object('changed', true);
end;
$$;

revoke all on function public.admin_revoke_admin(uuid, text) from public, anon;
grant execute on function public.admin_revoke_admin(uuid, text) to authenticated;

-- ─── 8. admin_list_team() — surface pending invites ─────────────────────────
-- "acceptedAt" null means the invitation has not been answered yet, so the
-- console can show a pending badge instead of pretending they already have
-- admin power.

create or replace function public.admin_list_team()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_rows jsonb;
begin
  perform public.admin_assert();

  select coalesce(jsonb_agg(row_to_json(r) order by r."grantedAt" desc), '[]'::jsonb)
    into v_rows
  from (
    select
      m.user_id as id,
      p.display_name as name,
      u.email,
      p.avatar_path as "avatarPath",
      m.granted_at as "grantedAt",
      m.accepted_at as "acceptedAt",
      gb.display_name as "grantedBy",
      p.account_status as "accountStatus"
    from public.admin_members m
    join public.user_profiles p on p.id = m.user_id
    left join auth.users u on u.id = m.user_id
    left join public.user_profiles gb on gb.id = m.granted_by
    where m.revoked_at is null
  ) r;

  return jsonb_build_object('rows', v_rows);
end;
$$;

revoke all on function public.admin_list_team() from public, anon;
grant execute on function public.admin_list_team() to authenticated;

notify pgrst, 'reload schema';
