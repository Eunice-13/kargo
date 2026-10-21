-- Explicit rollback for an UNUSED Phase-1 deployment only. Never delete actual
-- group/address history to roll back this feature after it has been activated.
begin;
do $$
begin
  if exists (select 1 from public.delivery_destinations)
    or exists (select 1 from public.combined_delivery_groups) then
    raise exception 'Combined delivery history exists; roll forward instead of deleting records';
  end if;
end;
$$;
drop trigger if exists orders_combined_delivery_guard on public.orders;
drop trigger if exists payments_combined_delivery_guard on public.payments;
drop view public.combined_delivery_candidate_records;
alter table public.orders drop constraint orders_delivery_destination_owner_fk;
alter table public.orders drop column delivery_destination_id;
drop table public.combined_delivery_events;
drop table public.combined_delivery_members;
drop policy delivery_destinations_participant_read on public.delivery_destinations;
drop table public.combined_delivery_groups;
drop table public.delivery_destinations;
drop function public.combined_delivery_candidates();
drop function public.combined_delivery_eligibility(uuid[]);
drop function public.combined_delivery_order_reasons(uuid, uuid);
drop function public.assert_combined_delivery_batch(uuid[], uuid);
drop function public.combined_delivery_batch_reasons(uuid[], uuid);
drop function public.combined_delivery_batch_feedback(text[]);
drop function public.guard_delivery_destination_snapshot();
drop function public.guard_combined_delivery_group();
drop function public.guard_combined_delivery_member();
drop function public.check_combined_delivery_member_count();
drop function public.audit_combined_delivery_group();
drop function public.audit_combined_delivery_member();
drop function public.guard_order_combined_delivery();
drop function public.guard_individual_combined_delivery_payment();
commit;
