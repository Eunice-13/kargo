-- KARGO — Shared real-time expiry sweep (waitlist-offer timeouts + unpaid-claim
-- expiry). Runs every minute via pg_cron so stock returns and offers advance on
-- their own, with no dependence on a user loading the page.
--
-- Granularity note: pg_cron's finest interval is 1 minute, so "instant" here
-- means "within ~60s of the deadline" — the standard Supabase approach with no
-- external timer infrastructure. Both expiry types share this one function.

create extension if not exists pg_cron;

create or replace function public.sweep_expirations()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  product public.batch_products;
begin
  -- ── A) Unpaid claims past their reservation deadline → expire + free stock ──
  -- Only 'payment_pending' orders expire on the timer. Once a proof is submitted
  -- (payment_submitted / insufficient_payment) the seller review flow owns it.
  for r in
    select o.id, o.batch_product_id, o.buyer_id, o.quantity, o.order_number,
           bp.name as product_name
    from public.orders o
    join public.batch_products bp on bp.id = o.batch_product_id
    where o.status = 'payment_pending'
      and o.reservation_expires_at is not null
      and o.reservation_expires_at <= now()
  loop
    update public.orders set status = 'expired'::public.order_status where id = r.id;

    -- Notify the buyer their claim lapsed (in-app + queued email).
    insert into public.notifications (recipient_id, category, message, target_path, context, dedupe_key)
    values (r.buyer_id, 'clock',
            'Your claim for ' || r.product_name || ' x' || r.quantity || ' expired — no payment was submitted in time.',
            'My Claims', jsonb_build_object('order_id', r.id),
            'claim_exp_' || r.id::text)
    on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing;

    if public.wants_email(r.buyer_id, 'claims') then
      insert into public.pending_emails (recipient_id, template, subject, body, context, dedupe_key)
      values (r.buyer_id, 'claim_expired',
              'Your KARGO claim was cancelled (no payment)',
              'Your reservation for ' || r.product_name || ' x' || r.quantity
                || ' (' || r.order_number || ') expired because no payment was submitted before the deadline. The stock has been released.',
              jsonb_build_object('order_id', r.id),
              'claim_exp_' || r.id::text)
      on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing;
    end if;

    -- Stock is freed the instant the status flips; offer it down the waitlist.
    perform public.offer_to_next_waitlist(r.batch_product_id);
  end loop;

  -- ── B) Partial-match waitlist offers past their response window → decline ───
  for r in
    select id, batch_product_id, buyer_id
    from public.waitlist_entries
    where status = 'offered'
      and offer_expires_at is not null
      and offer_expires_at <= now()
  loop
    update public.waitlist_entries
      set status = 'cancelled', offer_expires_at = null where id = r.id;

    insert into public.notifications (recipient_id, category, message, target_path, context, dedupe_key)
    values (r.buyer_id, 'clock',
            'Your waitlist offer expired without a response and was passed to the next buyer.',
            'My Claims', jsonb_build_object('waitlist_id', r.id),
            'wl_timeout_' || r.id::text)
    on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing;

    -- Roll the freed hold to the next waiting buyer immediately.
    perform public.offer_to_next_waitlist(r.batch_product_id);
  end loop;
end;
$$;

revoke all on function public.sweep_expirations() from public, authenticated;
grant execute on function public.sweep_expirations() to service_role;

-- Schedule (idempotent): unschedule an existing job of the same name first.
do $$
begin
  perform cron.unschedule('kargo_sweep_expirations');
exception when others then
  null; -- no existing job
end;
$$;

select cron.schedule(
  'kargo_sweep_expirations',
  '* * * * *',                       -- every minute
  $$select public.sweep_expirations();$$
);
