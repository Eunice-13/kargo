-- Export of the payment-state correction backup tables.
--
-- Purpose: the live tables `public.payment_state_correction_backup` and
-- `public.payment_state_correction_combined_members` were dropped after the
-- one-time correction in scripts/payment-state-correction.sql was verified.
-- This file preserves their *data* so scripts/payment-state-correction-rollback.sql
-- can still be run if the correction ever needs to be reversed.
--
-- To restore the rollback capability:
--
--   npx supabase db query --linked -f scripts/backups/payment_state_correction_backup_20261103.sql
--   npx supabase db query --linked -f scripts/payment-state-correction-rollback.sql
--
-- Exported: 2026-11-04 (corrected_at timestamps are 2026-11-03).
--   payment_state_correction_backup .............. 1 row
--   payment_state_correction_combined_members .... 0 rows

begin;

-- DDL (identical to scripts/payment-state-correction.sql).
create table if not exists public.payment_state_correction_backup (
  payment_id uuid primary key,
  order_id uuid not null,
  category text not null,
  old_payment_status public.payment_status not null,
  old_amount numeric,
  old_shortfall_amount numeric,
  old_reviewed_at timestamptz,
  old_reviewed_by uuid,
  old_rejection_reason text,
  old_rejection_deadline timestamptz,
  old_order_status public.order_status not null,
  old_payment_confirmed_at timestamptz,
  old_reservation_expires_at timestamptz,
  old_group_order_id uuid,
  old_group_status text,
  old_group_payment_deadline timestamptz,
  old_combined_group_id uuid,
  old_combined_status text,
  corrected_at timestamptz not null default now()
);

create table if not exists public.payment_state_correction_combined_members (
  group_id uuid not null,
  order_id uuid not null,
  old_released_at timestamptz,
  primary key (group_id, order_id)
);

-- Data: payment_state_correction_backup (1 row, category C).
insert into public.payment_state_correction_backup (
  payment_id, order_id, category,
  old_payment_status, old_amount, old_shortfall_amount,
  old_reviewed_at, old_reviewed_by, old_rejection_reason, old_rejection_deadline,
  old_order_status, old_payment_confirmed_at, old_reservation_expires_at,
  old_group_order_id, old_group_status, old_group_payment_deadline,
  old_combined_group_id, old_combined_status, corrected_at
) values (
  'e0d611fa-5afb-427f-9aa2-18dd4f1b4900',
  '1e018dde-0b51-4fb5-8655-3da4a45f89cb',
  'C',
  'verified',
  29.84,
  null,
  '2026-11-01T15:12:32.058948+00:00',
  'cd535f9e-bc03-44c3-9c9d-e4b125b958cc',
  null,
  null,
  'insufficient_payment',
  null,
  '2026-11-06T11:14:55.251318+00:00',
  null,
  null,
  null,
  null,
  null,
  '2026-11-03T05:08:20.419868+00:00'
)
on conflict (payment_id) do nothing;

-- Data: payment_state_correction_combined_members (0 rows).

commit;
