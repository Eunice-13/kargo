-- Run inside the isolated transaction in tests/batchImagesDb.test.mjs.
-- The seeded accepted admin is 71000000-0000-0000-0000-000000000099.
insert into public.batches(id,seller_id,title,status,starts_on,ends_on,category,cover_path)
values ('72000000-0000-0000-0000-000000000098','71000000-0000-0000-0000-000000000099',
  'Admin photo test','closed',current_date,current_date,'Food','seller/closed/cover.png');
insert into public.batch_products(id,batch_id,name,base_price,quantity_total,image_path)
values ('73000000-0000-0000-0000-000000000098','72000000-0000-0000-0000-000000000098',
  'Photographed item',10,5,'seller/closed/product.png');
insert into public.orders(batch_product_id,quantity,total_amount,status)
values ('73000000-0000-0000-0000-000000000098',2,20,'payment_confirmed');
insert into public.waitlist_entries(batch_product_id,status)
values ('73000000-0000-0000-0000-000000000098','waiting');

set local role authenticated;
do $$
declare v_detail jsonb;
begin
  v_detail := public.admin_get_batch('72000000-0000-0000-0000-000000000098');
  if v_detail->'products'->0->>'imagePath' <> 'seller/closed/product.png'
    or v_detail->>'coverPath' <> 'seller/closed/cover.png'
    or v_detail->'products'->0->>'claimed' <> '2'
    or v_detail->'products'->0->>'waitlist' <> '1'
    or v_detail->>'confirmedGmv' <> '20' then
    raise exception 'Admin detail lost the stored image or existing aggregates';
  end if;
  -- Legacy null remains an explicit JSON null. The RPC never invents a path.
  v_detail := public.admin_get_batch('72000000-0000-0000-0000-000000000099');
  if not (v_detail->'products'->0 ? 'imagePath')
    or v_detail->'products'->0->'imagePath' <> 'null'::jsonb then
    raise exception 'Legacy product image was omitted or fabricated';
  end if;
  begin
    perform public.admin_get_batch('72000000-0000-0000-0000-000000000097');
    raise exception 'Missing batch did not raise not found';
  exception when no_data_found then null; end;
end $$;

select set_config('request.jwt.claim.sub','71000000-0000-0000-0000-000000000097',true);
do $$ begin
  begin
    perform public.admin_get_batch('72000000-0000-0000-0000-000000000098');
    raise exception 'Non-admin read batch photos';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
  begin
    perform public.admin_get_batch('72000000-0000-0000-0000-000000000098');
    raise exception 'Unauthenticated caller read batch photos';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  if has_function_privilege('anon','public.admin_get_batch(uuid)','execute')
    or not has_function_privilege('authenticated','public.admin_get_batch(uuid)','execute')
    or not (select prosecdef from pg_proc where oid='public.admin_get_batch(uuid)'::regprocedure) then
    raise exception 'Admin RPC permissions changed';
  end if;
end $$;
