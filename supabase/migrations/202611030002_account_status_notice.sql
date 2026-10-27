-- ============================================================================
-- KARGO Admin — Phase 6: Account status notice (restore details + self-service RPC)
-- ============================================================================
-- A restore notification today says "Your account has been restored." and links
-- to the Settings tab, where nothing explains what happened. This migration:
--
--   * enriches the suspend/restore notification context with the reason and the
--     exact moment of the change, and points the restored user at Settings;
--   * adds my_account_status(), a self-service RPC that returns the caller's own
--     status plus their suspend/restore history (who, when, why) — the data the
--     Settings → Account status section renders.
--
-- my_account_status() is security definer because admin_audit_log is readable
-- only by admins; the WHERE clause pins it to auth.uid(), so an account can only
-- ever read its own trail.
--
-- Depends on 202611010001 (user_profiles.account_status*, admin_audit_log) and
-- 202611010002 (admin_set_account_status). Idempotent: create or replace.
-- ============================================================================

-- ─── 1. admin_set_account_status() — richer notification ────────────────────

create or replace function public.admin_set_account_status(
  p_user_id uuid,
  p_status public.account_status,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.user_profiles;
  v_label text;
  v_changed_at timestamptz := now();
begin
  perform public.admin_assert();

  if nullif(trim(coalesce(p_reason, '')), '') is null or length(trim(p_reason)) < 8 then
    raise exception 'A reason of at least 8 characters is required' using errcode = '22023';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You cannot change your own account status' using errcode = '42501';
  end if;

  select * into v_target from public.user_profiles where id = p_user_id for update;
  if not found then
    raise exception 'User not found' using errcode = 'P0002';
  end if;

  if v_target.account_status = p_status then
    return jsonb_build_object('changed', false, 'status', p_status);
  end if;

  v_label := coalesce(nullif(v_target.shop_name, ''), v_target.display_name);

  update public.user_profiles
  set account_status = p_status,
      account_status_reason = trim(p_reason),
      account_status_changed_at = v_changed_at,
      account_status_changed_by = auth.uid()
  where id = p_user_id;

  perform public.admin_audit(
    case when p_status = 'suspended' then 'suspend_account' else 'restore_account' end,
    'user', p_user_id::text, v_label, trim(p_reason),
    jsonb_build_object('account_status', v_target.account_status),
    jsonb_build_object('account_status', p_status)
  );

  insert into public.notifications (recipient_id, category, message, target_path, context, dedupe_key)
  values (
    p_user_id,
    case when p_status = 'suspended' then 'package' else 'check' end,
    case when p_status = 'suspended'
      then 'Your account has been suspended. Reason: ' || trim(p_reason)
      else 'Your account has been restored — you can use KARGO again. Tap for details.' end,
    'Settings',
    jsonb_build_object(
      'account_status', p_status,
      'reason', trim(p_reason),
      'changed_at', v_changed_at
    ),
    'account_status_' || p_user_id::text || '_' || extract(epoch from v_changed_at)::bigint::text
  )
  on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing;

  return jsonb_build_object('changed', true, 'status', p_status);
end;
$$;

revoke all on function public.admin_set_account_status(uuid, public.account_status, text)
  from public, anon;
grant execute on function public.admin_set_account_status(uuid, public.account_status, text)
  to authenticated;

-- ─── 2. my_account_status() — the caller's own status + history ─────────────

create or replace function public.my_account_status()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'status', p.account_status,
    'reason', p.account_status_reason,
    'changedAt', p.account_status_changed_at,
    'changedBy', (
      select coalesce(nullif(a.display_name, ''), 'A KARGO admin')
      from public.user_profiles a
      where a.id = p.account_status_changed_by
    ),
    'history', coalesce((
      select jsonb_agg(row_to_json(h) order by h."createdAt" desc)
      from (
        select
          a.action,
          a.reason,
          coalesce(nullif(a.actor_name, ''), 'A KARGO admin') as "actorName",
          a.created_at as "createdAt"
        from public.admin_audit_log a
        where a.target_type = 'user'
          and a.target_id = auth.uid()::text
          and a.action in ('suspend_account', 'restore_account')
        order by a.created_at desc
        limit 10
      ) h
    ), '[]'::jsonb)
  )
  from public.user_profiles p
  where p.id = auth.uid();
$$;

revoke all on function public.my_account_status() from public, anon;
grant execute on function public.my_account_status() to authenticated;

notify pgrst, 'reload schema';
