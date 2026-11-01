-- Use the full recorded fulfillment history for the analytics cohort.
-- This supersedes the temporary Oct 29 boundary from the first Phase 1 rollout.
update public.fulfillment_analytics_metadata
set capture_started_at = coalesce(
  (select min(occurred_at) from public.order_fulfillment_events),
  '1970-01-01 00:00:00+00'::timestamptz
)
where singleton;

notify pgrst, 'reload schema';
