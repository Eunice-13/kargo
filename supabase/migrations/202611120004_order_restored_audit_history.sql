-- Keep the restored historical rows in the same newest-to-oldest order as the
-- original audit view. The audit screen sorts by created_at descending.
update public.admin_audit_log
set created_at = case
  when action = 'revoke_admin' and target_label = 'Eunice Kate Belasa'
    then '2026-10-29 12:05:00+08'::timestamptz
  when action = 'revoke_seller' and target_label = 'Sean Dee Dope'
    then '2026-10-29 12:00:00+08'::timestamptz
  when action = 'restore_account' and target_label = 'jenna dee'
    then '2026-10-29 11:55:00+08'::timestamptz
  when action = 'restore_account' and target_label = 'JM Arguelles'
    then '2026-10-27 12:25:00+08'::timestamptz
  when action = 'grant_admin' and target_label = 'Eunice Kate Belasa'
    then '2026-10-27 12:20:00+08'::timestamptz
  when action = 'suspend_account' and target_label = 'JM Arguelles'
    then '2026-10-27 12:15:00+08'::timestamptz
  when action = 'batch_hide' and target_label = 'Test'
    then '2026-10-27 12:10:00+08'::timestamptz
  when action = 'batch_close' and target_label = 'Seoul Glow Edit — November 2026'
    then '2026-10-27 12:05:00+08'::timestamptz
  when action = 'revoke_seller' and target_label = 'Shop ni Jameu'
    then '2026-10-27 12:00:00+08'::timestamptz
  else created_at
end
where (action, target_label) in (
  ('revoke_admin', 'Eunice Kate Belasa'),
  ('revoke_seller', 'Sean Dee Dope'),
  ('restore_account', 'jenna dee'),
  ('restore_account', 'JM Arguelles'),
  ('grant_admin', 'Eunice Kate Belasa'),
  ('suspend_account', 'JM Arguelles'),
  ('batch_hide', 'Test'),
  ('batch_close', 'Seoul Glow Edit — November 2026'),
  ('revoke_seller', 'Shop ni Jameu')
);
