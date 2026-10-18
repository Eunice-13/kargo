-- Branded transactional email: the claim RPC now hands the worker everything the
-- designed templates need (template name, context, and a resolved detail bag),
-- and a public brand-assets bucket hosts the logo the email banner points at.
--
-- The queued subject/body remain the source of truth and the fallback: older
-- rows, unknown templates, and plain-text clients still render correctly.

-- ── 1 — Public brand assets ───────────────────────────────────────────────────
-- Holds kargo-logo-head.png (the transparent ship mark used in the banner).
-- Upload with scripts/upload-brand-assets.mjs or the Supabase dashboard.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'brand-assets',
  'brand-assets',
  true,
  1048576,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  create policy brand_assets_public_read
    on storage.objects for select
    using (bucket_id = 'brand-assets');
exception when duplicate_object then null;
end $$;

-- ── 2 — Richer claim payload ──────────────────────────────────────────────────
-- The return type changes, so the function is replaced rather than updated.
-- Callers that only read the original columns are unaffected.

drop function if exists public.claim_pending_emails(integer, integer);

create function public.claim_pending_emails(
  p_limit integer default 25,
  p_lease_seconds integer default 300
)
returns table (
  id uuid,
  claim_token uuid,
  attempt_count integer,
  recipient_email text,
  recipient_name text,
  subject text,
  body text,
  template text,
  context jsonb,
  details jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with candidates as (
    select pe.id
    from public.pending_emails pe
    where pe.sent_at is null
      and pe.attempt_count < 5
      and pe.next_attempt_at <= now()
      and (
        pe.status = 'pending'
        or (
          pe.status = 'processing'
          and pe.locked_at < now() - make_interval(
            secs => greatest(coalesce(p_lease_seconds, 300), 60)
          )
        )
      )
    order by pe.created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 25), 100))
  ), claimed as (
    update public.pending_emails pe
    set status = 'processing',
        locked_at = now(),
        claim_token = gen_random_uuid(),
        last_attempt_at = now(),
        attempt_count = pe.attempt_count + 1,
        last_error = null
    from candidates c
    where pe.id = c.id
    returning pe.id, pe.claim_token, pe.attempt_count, pe.recipient_id,
              pe.subject, pe.body, pe.template, pe.context, pe.created_at
  )
  select c.id,
         c.claim_token,
         c.attempt_count,
         u.email::text,
         up.display_name,
         c.subject,
         c.body,
         c.template,
         c.context,
         jsonb_strip_nulls(jsonb_build_object(
           'orderNumber', o.order_number,
           'productName', coalesce(bp.name, wbp.name),
           'quantity', o.quantity,
           'totalAmount', o.total_amount,
           'shippingFee', o.shipping_fee,
           'verifiedAmount', case when o.id is null then null else (
             select coalesce(sum(p.amount), 0)
             from public.payments p
             where p.order_id = o.id and p.status = 'verified'
           ) end,
           'balanceDue', case when o.id is null then null
             else greatest(o.total_amount - (
               select coalesce(sum(p.amount), 0)
               from public.payments p
               where p.order_id = o.id and p.status = 'verified'
             ), 0) end,
           'orderStatus', o.status,
           'fulfillmentStage', o.fulfillment_stage,
           'deadline', o.reservation_expires_at,
           'paymentMethod', o.reserved_payment_method,
           'courier', o.courier_company,
           'riderName', o.rider_name,
           'riderContact', o.rider_contact,
           'trackingNumber', o.tracking_number,
           'trackingUrl', o.tracking_url,
           'eta', o.eta,
           'declineReason', o.decline_reason,
           'paymentRejectionReason', coalesce(
             pm.rejection_reason,
             (
               select p.rejection_reason
               from public.payments p
               where p.order_id = o.id
                 and p.status = 'rejected'
                 and p.rejection_reason is not null
               order by p.submitted_at desc
               limit 1
             )
           ),
           -- Offer quantity lived on the table until 202610010001; older queued
           -- rows still carry it in context, so read it from there.
           'offerQuantity', case
             when coalesce(c.context->>'offer_quantity', '') ~ '^[0-9]+$'
               then (c.context->>'offer_quantity')::integer
           end,
           'desiredQuantity', w.desired_quantity
         )) as details
  from claimed c
  left join auth.users u on u.id = c.recipient_id
  left join public.user_profiles up on up.id = c.recipient_id
  left join public.orders o on o.id = (
    case
      when coalesce(c.context->>'order_id', '') ~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (c.context->>'order_id')::uuid
    end
  )
  left join public.batch_products bp on bp.id = o.batch_product_id
  left join public.payments pm on pm.id = (
    case
      when coalesce(c.context->>'payment_id', '') ~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (c.context->>'payment_id')::uuid
    end
  )
  left join public.waitlist_entries w on w.id = (
    case
      when coalesce(c.context->>'waitlist_id', '') ~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (c.context->>'waitlist_id')::uuid
    end
  )
  left join public.batch_products wbp on wbp.id = w.batch_product_id
  order by c.created_at;
end;
$$;

revoke all on function public.claim_pending_emails(integer, integer)
  from public, anon, authenticated;
grant execute on function public.claim_pending_emails(integer, integer)
  to service_role;

notify pgrst, 'reload schema';
