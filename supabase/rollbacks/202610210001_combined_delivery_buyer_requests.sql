-- Preserve all request, reservation and destination history. Roll back the
-- Phase-2 frontend together with these RPCs; do not strand active requests.
begin;
do $$ begin
  if exists(select 1 from public.combined_delivery_groups where status = 'pending_approval') then
    raise exception 'Resolve or cancel pending combined delivery requests before rolling back Phase 2';
  end if;
end; $$;
drop function public.cancel_combined_delivery_request(uuid);
drop function public.request_combined_delivery(uuid[], double precision, double precision, text, boolean);
drop function public.combined_delivery_request_candidates();
commit;
