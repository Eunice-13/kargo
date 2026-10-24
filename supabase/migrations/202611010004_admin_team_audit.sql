-- ============================================================================
-- KARGO Admin — Phase 4: Team management + Audit log RPCs
-- ============================================================================
-- Reuses existing tables only (admin_members, admin_audit_log, user_profiles,
-- auth.users). No new tables. Depends on 202611010001 (is_admin, admin_audit,
-- admin_assert).
--
-- Single admin role: every active admin can grant/revoke admins. Guardrails:
-- cannot revoke yourself; cannot revoke the last active admin. Apply via the
-- Supabase SQL editor.
-- ============================================================================

-- ─── admin_list_team() ──────────────────────────────────────────────────────

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

-- ─── admin_grant_admin() ────────────────────────────────────────────────────

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
    return jsonb_build_object('changed', false);
  end if;

  if found then
    update public.admin_members
    set revoked_at = null, revoked_by = null, granted_by = auth.uid(), granted_at = now()
    where user_id = p_user_id;
  else
    insert into public.admin_members (user_id, granted_by, granted_at)
    values (p_user_id, auth.uid(), now());
  end if;

  perform public.admin_audit(
    'grant_admin', 'user', p_user_id::text, v_target.display_name, trim(p_reason),
    jsonb_build_object('admin', false), jsonb_build_object('admin', true)
  );

  insert into public.notifications (recipient_id, category, message, target_path, context, dedupe_key)
  values (
    p_user_id, 'check', 'You have been added to the KARGO admin team.',
    'Security', jsonb_build_object('admin', true),
    'admin_grant_' || p_user_id::text || '_' || extract(epoch from now())::bigint::text
  )
  on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing;

  return jsonb_build_object('changed', true);
end;
$$;

revoke all on function public.admin_grant_admin(uuid, text) from public, anon;
grant execute on function public.admin_grant_admin(uuid, text) to authenticated;

-- ─── admin_revoke_admin() ───────────────────────────────────────────────────

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
  where m.revoked_at is null and p.account_status = 'active';

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

-- ─── admin_list_audit() ─────────────────────────────────────────────────────

create or replace function public.admin_list_audit(
  p_search text default null,
  p_action text default 'all',
  p_days integer default 30,
  p_limit integer default 25,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_since timestamptz := case when coalesce(p_days,0) > 0 then now() - make_interval(days => p_days) else null end;
  v_total integer;
  v_rows jsonb;
begin
  perform public.admin_assert();

  select count(*) into v_total
  from public.admin_audit_log a
  where (v_search is null
      or a.actor_name ilike '%' || v_search || '%'
      or a.target_label ilike '%' || v_search || '%'
      or a.action ilike '%' || v_search || '%')
    and (p_action = 'all' or a.action = p_action)
    and (v_since is null or a.created_at >= v_since);

  select coalesce(jsonb_agg(row_to_json(r) order by r."createdAt" desc), '[]'::jsonb)
    into v_rows
  from (
    select
      a.id, a.actor_name as "actorName", a.action,
      a.target_type as "targetType", a.target_label as "targetLabel",
      a.reason, a.before_state as "beforeState", a.after_state as "afterState",
      a.created_at as "createdAt"
    from public.admin_audit_log a
    where (v_search is null
        or a.actor_name ilike '%' || v_search || '%'
        or a.target_label ilike '%' || v_search || '%'
        or a.action ilike '%' || v_search || '%')
      and (p_action = 'all' or a.action = p_action)
      and (v_since is null or a.created_at >= v_since)
    order by a.created_at desc
    offset v_offset limit v_limit
  ) r;

  return jsonb_build_object('rows', v_rows, 'total', coalesce(v_total,0), 'nextOffset', v_offset + v_limit);
end;
$$;

revoke all on function public.admin_list_audit(text, text, integer, integer, integer) from public, anon;
grant execute on function public.admin_list_audit(text, text, integer, integer, integer) to authenticated;

notify pgrst, 'reload schema';
