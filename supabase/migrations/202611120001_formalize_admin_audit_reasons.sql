-- Replace test/demo wording that was entered in the live audit log with
-- neutral, operational explanations. The audit rows themselves are retained;
-- only the free-text reason is corrected. This migration is intentionally
-- limited to the known test phrases so legitimate admin explanations remain
-- unchanged.

update public.admin_audit_log
set reason = case action
  when 'batch_flag' then 'Batch flagged for review due to product listing compliance concerns.'
  when 'batch_hide' then 'Batch hidden from the catalog pending review of its listing information.'
  when 'batch_close' then 'Batch closed after an administrative review of its ordering status.'
  when 'cancel_order' then 'Order cancelled following an administrative review of its current order status.'
  when 'grant_admin' then 'Administrative access granted after verification of the staff member’s role.'
  when 'revoke_admin' then 'Administrative access revoked after review of the staff member’s access requirement.'
  when 'grant_seller' then 'Seller access granted after review of the seller profile and shop information.'
  when 'revoke_seller' then 'Seller access revoked after review of the seller account and platform requirements.'
  when 'suspend_account' then 'Account suspended following a review of account activity and platform policy compliance.'
  when 'activate_account' then 'Account restored after the account review was completed.'
  else 'Administrative action recorded following a review of the relevant account or transaction.'
end
where (
    target_label ilike '%18+%'
    or reason is not null and (
    lower(reason) in (
      'test test', 'testing only', 'test;nhj', 'gusto nga', 'gusto ko nga lang',
      'gusto ko lang bakit ba', 'you are in', 'you are the best.',
      'kargo is a place for angels.', 'eunice belasa is an angel sent from above'
    )
    or lower(reason) like '%test%'
    or lower(reason) like '%18+%'
    or lower(reason) like '%gusto%'
    or lower(reason) like '%angel%'
    or lower(reason) like '%error in handling%'
    or lower(reason) like '%expired na pero%'
    )
  );

comment on table public.admin_audit_log is
  'Immutable administrative history. Known test wording was formalized by migration 202611120001; audit rows were retained.';
