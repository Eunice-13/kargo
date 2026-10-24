-- ============================================================================
-- KARGO Admin — Phase 1 foundation
-- ============================================================================
-- Authored against the ACTUAL current schema (post 202609300002 removal and the
-- profiles -> user_profiles rename), NOT the stale snapshot in
-- ADMIN_ACCOUNT_PROMPT.md §4. Facts verified in-repo:
--   * The table is public.user_profiles (renamed from profiles).
--   * The BIR verification system (bir_status/bir_document_path/bir_flag_reason/
--     bir_checked_at columns, bir-certificates bucket, complete_bir_verification)
--     was DROPPED in 202609300002_remove_unused_features.sql. This migration does
--     NOT reference any of it. Seller BIR verification is intentionally out of
--     scope for this foundation (see the re-scope note in the admin PR).
--   * public.can_sell() already reads user_profiles.can_sell, so the spec's
--     "reconcile can_sell" step is already satisfied. We keep that definition and
--     only extend it to also require an active account.
--   * account_status was dropped; we re-add it here so suspend/restore works.
--
-- Idempotent where practical: guarded do-blocks, add column if not exists,
-- create or replace, drop policy if exists before create.
--
-- Bootstrap the first admin AFTER this migration applies (see the final block):
-- the account kargoph2026@gmail.com is promoted to admin if it exists in
-- auth.users.
-- ============================================================================

-- ─── 0. account_status enum + columns (re-added) ────────────────────────────

do $$
begin
  if not exists (select 1 from pg_type where typname = 'account_status') then
    create type public.account_status as enum ('active', 'suspended');
  end if;
end
$$;

alter table public.user_profiles
  add column if not exists account_status public.account_status not null default 'active',
  add column if not exists account_status_reason text,
  add column if not exists account_status_changed_at timestamptz,
  add column if not exists account_status_changed_by uuid
    references public.user_profiles(id) on delete set null;

-- Users may never self-write status or seller capability. (Safe if already revoked.)
revoke update (account_status, account_status_reason, account_status_changed_at,
  account_status_changed_by) on public.user_profiles from authenticated;
revoke update (can_sell) on public.user_profiles from authenticated;

-- ─── 1. is_active() now honors suspension ───────────────────────────────────

create or replace function public.is_active(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_profiles p
    where p.id = p_user_id
      and p.account_status = 'active'
  );
$$;

-- ─── 2. can_sell() keeps reading user_profiles.can_sell, now active-gated ────

create or replace function public.can_sell(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_profiles p
    where p.id = p_user_id
      and p.account_status = 'active'
      and p.can_sell = true
  );
$$;

-- ─── 3. Self-service seller enablement (replaces direct can_sell PATCH) ──────

create or replace function public.enable_seller_access()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not public.is_active(auth.uid()) then
    raise exception 'Active account required' using errcode = '42501';
  end if;
  update public.user_profiles set can_sell = true where id = auth.uid();
end;
$$;

revoke all on function public.enable_seller_access() from public, anon;
grant execute on function public.enable_seller_access() to authenticated;

-- ─── 4. Admin membership + is_admin() ───────────────────────────────────────

create table if not exists public.admin_members (
  user_id uuid primary key references public.user_profiles(id) on delete cascade,
  granted_by uuid references public.user_profiles(id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references public.user_profiles(id) on delete set null
);

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
      and p.account_status = 'active'
  );
$$;

revoke all on function public.is_admin(uuid) from public, anon;
grant execute on function public.is_admin(uuid) to authenticated;

alter table public.admin_members enable row level security;

drop policy if exists admin_members_select_own on public.admin_members;
create policy admin_members_select_own on public.admin_members
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists admin_members_select_admin on public.admin_members;
create policy admin_members_select_admin on public.admin_members
  for select to authenticated
  using (public.is_admin());

-- No insert/update/delete policies: all mutations go through security-definer RPCs.
grant select on public.admin_members to authenticated;
grant all on public.admin_members to service_role;

-- ─── 5. Immutable admin audit log ───────────────────────────────────────────

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.user_profiles(id) on delete set null,
  actor_name text not null default '',
  action text not null,
  target_type text not null,
  target_id text not null,
  target_label text,
  reason text,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_created_idx
  on public.admin_audit_log (created_at desc);
create index if not exists admin_audit_log_actor_idx
  on public.admin_audit_log (actor_id, created_at desc);

alter table public.admin_audit_log enable row level security;

drop policy if exists admin_audit_log_select_admin on public.admin_audit_log;
create policy admin_audit_log_select_admin on public.admin_audit_log
  for select to authenticated
  using (public.is_admin());

grant select on public.admin_audit_log to authenticated;
grant all on public.admin_audit_log to service_role;

-- Internal helper: insert an audit row. Not executable by clients; called inside
-- admin RPCs within the same transaction.
create or replace function public.admin_audit(
  p_action text,
  p_target_type text,
  p_target_id text,
  p_target_label text default null,
  p_reason text default null,
  p_before jsonb default null,
  p_after jsonb default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  select coalesce(display_name, '') into v_name
  from public.user_profiles where id = auth.uid();

  insert into public.admin_audit_log (
    actor_id, actor_name, action, target_type, target_id, target_label,
    reason, before_state, after_state
  )
  values (
    auth.uid(), coalesce(v_name, ''), p_action, p_target_type, p_target_id,
    p_target_label, p_reason, p_before, p_after
  );
end;
$$;

revoke all on function public.admin_audit(text, text, text, text, text, jsonb, jsonb)
  from public, anon, authenticated;

-- ─── 6. Admin read-only RLS on operational tables ───────────────────────────
-- Select-only. Every mutation goes through an RPC (added in later migrations).

drop policy if exists user_profiles_select_admin on public.user_profiles;
create policy user_profiles_select_admin on public.user_profiles
  for select to authenticated
  using (public.is_admin());

drop policy if exists batches_select_admin on public.batches;
create policy batches_select_admin on public.batches
  for select to authenticated
  using (public.is_admin());

drop policy if exists batch_products_select_admin on public.batch_products;
create policy batch_products_select_admin on public.batch_products
  for select to authenticated
  using (public.is_admin());

drop policy if exists orders_select_admin on public.orders;
create policy orders_select_admin on public.orders
  for select to authenticated
  using (public.is_admin());

drop policy if exists payments_select_admin on public.payments;
create policy payments_select_admin on public.payments
  for select to authenticated
  using (public.is_admin());

drop policy if exists seller_payment_methods_select_admin on public.seller_payment_methods;
create policy seller_payment_methods_select_admin on public.seller_payment_methods
  for select to authenticated
  using (public.is_admin());

-- ─── 7. Storage: admin read of payment receipts ─────────────────────────────
-- (bir-certificates bucket was removed with the BIR system; only receipts here.)

do $$
begin
  if exists (select 1 from storage.buckets where id = 'payment-receipts') then
    drop policy if exists receipts_admin_read on storage.objects;
    create policy receipts_admin_read on storage.objects
      for select to authenticated
      using (bucket_id = 'payment-receipts' and public.is_admin());
  end if;
end
$$;

-- ─── 8. Let a user read their own admin row via profileFor ──────────────────
-- (covered by admin_members_select_own above; profileFor queries it directly.)

notify pgrst, 'reload schema';

-- ─── 9. Bootstrap the first admin ───────────────────────────────────────────
-- Promotes kargoph2026@gmail.com if that account already exists in auth.users.
-- Safe to re-run: re-activates a previously revoked membership.

do $$
declare
  v_uid uuid;
begin
  select u.id into v_uid
  from auth.users u
  where lower(u.email) = lower('kargoph2026@gmail.com')
  limit 1;

  if v_uid is null then
    raise notice 'Admin bootstrap skipped: kargoph2026@gmail.com not found in auth.users. Sign that account up first, then re-run this block.';
  else
    -- Ensure a profile row exists (the signup trigger normally creates it).
    insert into public.user_profiles (id)
    values (v_uid)
    on conflict (id) do nothing;

    insert into public.admin_members (user_id, granted_by, granted_at)
    values (v_uid, v_uid, now())
    on conflict (user_id) do update
      set revoked_at = null, revoked_by = null;

    raise notice 'Admin bootstrap: kargoph2026@gmail.com promoted to admin (%).', v_uid;
  end if;
end
$$;
