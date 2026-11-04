-- Reverts scripts/payment-state-correction.sql using the backup table it wrote.
--
--   npx supabase db query --linked -f scripts/payment-state-correction-rollback.sql
--
-- Restores payment and order fields exactly as they were before the correction.

begin;

update public.payments p
set status = b.old_payment_status,
    amount = b.old_amount,
    shortfall_amount = b.old_shortfall_amount,
    reviewed_at = b.old_reviewed_at,
    reviewed_by = b.old_reviewed_by,
    rejection_reason = b.old_rejection_reason,
    rejection_deadline = b.old_rejection_deadline
from public.payment_state_correction_backup b
where b.payment_id = p.id;

update public.orders o
set status = b.old_order_status,
    payment_confirmed_at = b.old_payment_confirmed_at,
    reservation_expires_at = b.old_reservation_expires_at
from public.payment_state_correction_backup b
where b.order_id = o.id;

update public.group_orders g
set status = b.old_group_status,
    payment_deadline = b.old_group_payment_deadline,
    updated_at = now()
from public.payment_state_correction_backup b
where g.id = b.old_group_order_id;

update public.combined_delivery_groups cg
set status = b.old_combined_status
from public.payment_state_correction_backup b
where cg.id = b.old_combined_group_id;

update public.combined_delivery_members m
set released_at = b.old_released_at
from public.payment_state_correction_combined_members b
where b.group_id = m.group_id and b.order_id = m.order_id;

commit;
