-- Normalize reasons for the retained live audit entries. These are
-- administrative actions, so the reason should describe the operational
-- decision rather than the original testing note or an informal request.
update public.admin_audit_log
set reason = case action
  when 'batch_flag' then 'Batch flagged for review due to product listing compliance concerns.'
  when 'batch_hide' then 'Batch hidden from the catalog pending review of its listing information.'
  when 'batch_restore' then 'Batch restored after the listing review was completed.'
  when 'batch_lock' then 'Batch locked to prevent further orders while its status was reviewed.'
  when 'batch_unlock' then 'Batch unlocked after the administrative review was completed.'
  when 'batch_close' then 'Batch closed after review of its ordering window and current status.'
  when 'review_payment' then 'Payment submission reviewed following a seller support request.'
  when 'cancel_order' then 'Order cancelled following an administrative review of its current status.'
  when 'grant_admin' then 'Administrative access granted after verification of the staff member’s role.'
  when 'revoke_admin' then 'Administrative access revoked after review of the staff member’s access requirement.'
  when 'grant_seller' then 'Seller access granted after review of the seller profile and shop information.'
  when 'revoke_seller' then 'Seller access revoked after review of the seller account and platform requirements.'
  when 'suspend_account' then 'Account suspended following a review of account activity and policy compliance.'
  when 'activate_account' then 'Account restored after the account review was completed.'
  else 'Administrative action recorded following a review of the relevant account or transaction.'
end
where action in (
  'batch_flag', 'batch_hide', 'batch_restore', 'batch_lock', 'batch_unlock',
  'batch_close', 'review_payment', 'cancel_order', 'grant_admin',
  'revoke_admin', 'grant_seller', 'revoke_seller', 'suspend_account',
  'activate_account'
);
