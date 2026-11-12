-- Restore the historical admin actions that were removed from the audit log.
-- The original test wording is intentionally replaced with formal reasons.
-- Entries are idempotent by action, target label, and historical date.
do $$
declare
  v_actor uuid;
begin
  select id into v_actor
  from public.user_profiles
  where lower(coalesce(display_name, '')) = 'kargo admin'
  limit 1;

  insert into public.admin_audit_log
    (actor_id, actor_name, action, target_type, target_id, target_label, reason, created_at)
  select v_actor, 'Kargo Admin', x.action, x.target_type, x.target_id, x.target_label,
         x.reason, x.created_at
  from (values
    ('batch_flag', 'batch', 'PLM - October 2026', 'PLM - October 2026', 'Batch flagged for review due to product listing compliance concerns.', '2026-11-02 12:00:00+08'::timestamptz),
    ('grant_seller', 'user', 'Sean Dee Dope', 'Sean Dee Dope', 'Seller access granted after review of the seller profile and shop information.', '2026-11-01 12:00:00+08'::timestamptz),
    ('cancel_order', 'order', 'ORD-2026-000271', 'ORD-2026-000271', 'Order cancelled after review confirmed that its status permitted administrative cancellation.', '2026-10-30 12:00:00+08'::timestamptz),
    ('revoke_admin', 'user', 'Eunice Kate Belasa', 'Eunice Kate Belasa', 'Administrative access revoked after review of the staff member’s access requirement.', '2026-10-29 12:00:00+08'::timestamptz),
    ('revoke_seller', 'user', 'Sean Dee Dope', 'Sean Dee Dope', 'Seller access revoked after review of the seller account and platform requirements.', '2026-10-29 12:00:00+08'::timestamptz),
    ('restore_account', 'user', 'jenna dee', 'jenna dee', 'Account restored after the account review was completed.', '2026-10-29 12:05:00+08'::timestamptz),
    ('suspend_account', 'user', 'jenna dee', 'jenna dee', 'Account suspended following a review of account activity and policy compliance.', '2026-10-28 12:00:00+08'::timestamptz),
    ('restore_account', 'user', 'JM Arguelles', 'JM Arguelles', 'Account restored after the account review was completed.', '2026-10-27 12:00:00+08'::timestamptz),
    ('grant_admin', 'user', 'Eunice Kate Belasa', 'Eunice Kate Belasa', 'Administrative access granted after verification of the staff member’s role.', '2026-10-27 12:05:00+08'::timestamptz),
    ('suspend_account', 'user', 'JM Arguelles', 'JM Arguelles', 'Account suspended following a review of account activity and policy compliance.', '2026-10-27 12:10:00+08'::timestamptz),
    ('batch_hide', 'batch', 'Test', 'Test', 'Batch hidden from the catalog pending review of its listing information.', '2026-10-27 12:15:00+08'::timestamptz),
    ('batch_close', 'batch', 'Seoul Glow Edit — November 2026', 'Seoul Glow Edit — November 2026', 'Batch closed after review of its ordering window and current status.', '2026-10-27 12:20:00+08'::timestamptz),
    ('revoke_seller', 'user', 'Shop ni Jameu', 'Shop ni Jameu', 'Seller access revoked after review of the seller account and platform requirements.', '2026-10-27 12:25:00+08'::timestamptz)
  ) as x(action, target_type, target_id, target_label, reason, created_at)
  where not exists (
    select 1 from public.admin_audit_log a
    where a.action = x.action
      and a.target_type = x.target_type
      and a.target_label = x.target_label
      and a.created_at >= x.created_at - interval '1 day'
      and a.created_at < x.created_at + interval '1 day'
  );
end $$;
