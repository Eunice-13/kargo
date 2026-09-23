-- KARGO — Waitlist offers + instant expiry: schema layer.
-- Idempotent and additive; safe to re-run.

-- ── 1 — Quantity-aware, offer-aware waitlist entries ──────────────────────────
-- desired_quantity : what the buyer asked for when joining (Part 1).
-- offer_quantity   : how much stock is currently offered to this entry.
-- offered_at       : when the current offer was extended.
-- offer_expires_at : deadline for a PARTIAL-match offer (null for exact matches,
--                    which auto-claim and need no response).
alter table public.waitlist_entries
  add column if not exists desired_quantity integer not null default 1;
alter table public.waitlist_entries
  add column if not exists offer_quantity integer;
alter table public.waitlist_entries
  add column if not exists offered_at timestamptz;
alter table public.waitlist_entries
  add column if not exists offer_expires_at timestamptz;

alter table public.waitlist_entries
  drop constraint if exists waitlist_desired_quantity_positive;
alter table public.waitlist_entries
  add constraint waitlist_desired_quantity_positive
  check (desired_quantity > 0);

-- Index to find the next waiting entry for a product quickly (FIFO by join time).
create index if not exists waitlist_offer_idx
  on public.waitlist_entries (batch_product_id, status, joined_at);

-- ── 2 — Seller-configurable partial-offer response window ─────────────────────
-- Lives on the seller's profile (edited in the Dashboard waitlist section).
-- Applies ONLY to partial-match offers; exact matches auto-claim with no window.
alter table public.profiles
  add column if not exists waitlist_response_hours integer not null default 24;
alter table public.profiles
  drop constraint if exists profiles_waitlist_response_hours_positive;
alter table public.profiles
  add constraint profiles_waitlist_response_hours_positive
  check (waitlist_response_hours > 0);

-- ── 3 — Outbound email queue (stubbed transactional email) ────────────────────
-- KARGO has no live transactional-email provider yet (only Supabase Auth SMTP).
-- Instead of faking a working pipeline, every email the app "would" send is
-- written here, already gated by the recipient's Email Preferences. A future
-- edge function / SMTP worker can drain rows where sent_at is null. This keeps
-- the in-app notification and the (pending) email as two explicit, auditable
-- triggers as the spec requires.
create table if not exists public.pending_emails (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  template text not null,        -- e.g. 'waitlist_auto_claimed', 'waitlist_partial_offer'
  subject text not null,
  body text not null,
  context jsonb not null default '{}'::jsonb,
  dedupe_key text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists pending_emails_dedupe_uidx
  on public.pending_emails (recipient_id, dedupe_key)
  where dedupe_key is not null;
create index if not exists pending_emails_unsent_idx
  on public.pending_emails (created_at)
  where sent_at is null;

alter table public.pending_emails enable row level security;
-- Recipients may read their own queued mail (useful for a "sent to your email"
-- confirmation in the UI). Only SECURITY DEFINER functions / service_role write.
drop policy if exists pending_emails_select_own on public.pending_emails;
create policy pending_emails_select_own on public.pending_emails
  for select to authenticated using (recipient_id = auth.uid());
grant select on public.pending_emails to authenticated;

-- ── 4 — Helper: does a user want a given email category? ──────────────────────
-- notification_preferences is a jsonb map like {"waitlist": true, "claims": ...}.
-- Missing key defaults to TRUE (opt-out model) so buyers aren't silently dropped.
create or replace function public.wants_email(p_user_id uuid, p_category text)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(
    (select (notification_preferences ->> p_category)::boolean
       from public.profiles where id = p_user_id),
    true
  );
$$;
revoke all on function public.wants_email(uuid, text) from public;
grant execute on function public.wants_email(uuid, text) to authenticated, service_role;
