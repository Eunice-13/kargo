-- The legacy method FK was removed by 202610010003. Reuse the existing
-- method_type snapshot, as standalone submission does. Retain the locked
-- active seller-method check. No existing records or policies are modified.
begin;

create or replace function public.submit_combined_delivery_payment(p_group_id uuid,p_method_type text,p_amount numeric,
 p_reference_number text default null,p_receipt_path text default null,p_payer_account_name text default null,
 p_payer_phone text default null,p_buyer_contact_url text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare g public.combined_delivery_groups; a public.combined_delivery_payment_accounts; result public.payments; anchor uuid; method_id uuid;
begin
 if auth.uid() is null or not public.is_active(auth.uid()) then raise exception 'Active buyer account required' using errcode='42501'; end if;
 select * into g from public.combined_delivery_groups where id=p_group_id and buyer_id=auth.uid();
 if not found then raise exception 'Delivery request unavailable' using errcode='42501'; end if;
 g:=public.lock_combined_payment(g.id);
 select * into a from public.combined_delivery_payment_accounts where group_id=g.id for update;
 if g.status<>'shipping_fee_set' or a.status not in ('ready','rejected') or a.group_id is null then raise exception 'Combined payment is not payable' using errcode='22023'; end if;
 perform public.assert_combined_delivery_group(g.id);
 if a.deadline<=now() or exists(select 1 from public.orders where id in(select order_id from public.combined_delivery_members where group_id=g.id and released_at is null) and reservation_expires_at<=now()) then
  raise exception 'Payment deadline has expired' using errcode='22023'; end if;
 if p_amount is null or p_amount::text in ('NaN','Infinity','-Infinity') or p_amount<>round(p_amount,2) or p_amount<>a.total or p_amount<=0 then
  raise exception 'Submit the exact combined total, including one shared shipping fee' using errcode='22023'; end if;
 if lower(trim(p_method_type)) is distinct from lower(g.payment_method) then raise exception 'Use the payment method selected at reservation' using errcode='22023'; end if;
 select id into method_id from public.seller_payment_methods where seller_id=g.seller_id and lower(method_type)=lower(g.payment_method) and is_active order by id limit 1 for share;
 if method_id is null then raise exception 'The seller payment method is unavailable' using errcode='22023'; end if;
 if nullif(trim(p_reference_number),'') is null or nullif(trim(p_receipt_path),'') is null then raise exception 'Reference number and one payment proof are required' using errcode='22023'; end if;
 if split_part(p_receipt_path,'/',1)<>auth.uid()::text or not exists(select 1 from storage.objects where bucket_id='payment-receipts' and name=p_receipt_path) then
  raise exception 'Upload a payment proof belonging to your account' using errcode='42501'; end if;
 select order_id into anchor from public.combined_delivery_members where group_id=g.id and released_at is null order by order_id limit 1;
 insert into public.combined_delivery_payment_context values(txid_current(),g.id);
 insert into public.payments(order_id,combined_delivery_group_id,submitted_by,method_type,amount,reference_number,receipt_path,payer_account_name,payer_phone,buyer_contact_url)
 values(anchor,g.id,auth.uid(),g.payment_method,a.total,trim(p_reference_number),p_receipt_path,nullif(trim(p_payer_account_name),''),nullif(trim(p_payer_phone),''),nullif(trim(p_buyer_contact_url),'')) returning * into result;
 insert into public.combined_delivery_payment_reservations(payment_id,group_id,order_id,item_subtotal)
 select result.id,g.id,m.order_id,o.total_amount from public.combined_delivery_members m join public.orders o on o.id=m.order_id where m.group_id=g.id and m.released_at is null;
 perform public.transition_combined_payment_orders(g.id,'payment_submitted');
 update public.combined_delivery_payment_accounts set status='pending_review' where group_id=g.id;
 perform public.notify_combined_payment(g.id,'submitted',result.id);
 delete from public.combined_delivery_payment_context where transaction_id=txid_current();
 return jsonb_build_object('accepted',true,'payment',to_jsonb(result));
end $$;

commit;
