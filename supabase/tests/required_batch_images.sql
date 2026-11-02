-- Isolated SQL regression; all synthetic rows and helper functions roll back.
-- Executed by: node --test tests/batchImagesDb.test.mjs (ephemeral PGlite).
begin;
insert into auth.users(id) values
  ('71000000-0000-0000-0000-000000000001'),
  ('71000000-0000-0000-0000-000000000002'),
  ('71000000-0000-0000-0000-000000000003');
insert into public.user_profiles(id,display_name,can_sell,account_status) values
  ('71000000-0000-0000-0000-000000000001','Image seller',true,'active'),
  ('71000000-0000-0000-0000-000000000002','Image buyer',false,'active'),
  ('71000000-0000-0000-0000-000000000003','Suspended image seller',true,'suspended')
on conflict (id) do update set can_sell=excluded.can_sell,account_status=excluded.account_status;

create function pg_temp.image_batch(p_path text default 'seller/batch/cover.png')
returns jsonb language sql as $$ select jsonb_build_object(
  'title','Required photos','starts_on',current_date,'ends_on',current_date+1,
  'category','Food','reservation_hours',24,'cover_path',p_path,
  'gallery_paths',jsonb_build_array('seller/batch/gallery.png'),
  'group_orders_enabled',true,'group_discount_type','fixed',
  'group_discount_value',5,'group_discount_min_subtotal',50) $$;
create function pg_temp.image_product(p_name text default 'Product', p_path text default 'seller/batch/product.png')
returns jsonb language sql as $$ select jsonb_build_object(
  'id',gen_random_uuid(),'name',p_name,'base_price',100,'markup',10,
  'quantity_total',5,'image_path',p_path,'selling_unit','box','pieces_per_box',6,
  'limit_per_user',2,'waitlist_limit',0) $$;

select set_config('request.jwt.claim.sub','71000000-0000-0000-0000-000000000001',true);
set local role authenticated;
select public.create_batch_with_products('72000000-0000-0000-0000-000000000001',
  pg_temp.image_batch(),jsonb_build_array(pg_temp.image_product('One'),pg_temp.image_product('Two')));

do $$
declare bad_path text; v_batch_id uuid; v_products jsonb; v_bad jsonb;
begin
  if (select seller_id from public.batches where id='72000000-0000-0000-0000-000000000001')
      <> '71000000-0000-0000-0000-000000000001'::uuid
    or (select count(*) from public.batch_products where batch_id='72000000-0000-0000-0000-000000000001') <> 2 then
    raise exception 'RPC did not create the complete batch under the caller';
  end if;
  if not exists (select 1 from public.batch_products where
    batch_id='72000000-0000-0000-0000-000000000001' and selling_price=110
    and selling_unit='box' and pieces_per_box=6 and limit_per_user=2 and waitlist_limit=0) then
    raise exception 'RPC did not preserve product options or generated price';
  end if;

  foreach bad_path in array array[null::text,'','   ',E'\t\n'] loop
    -- Direct authenticated INSERTs and UPDATEs cannot bypass either CHECK.
    begin
      insert into public.batches(seller_id,title,starts_on,ends_on,category,cover_path)
      values(auth.uid(),'Missing cover',current_date,current_date,'Food',bad_path);
      raise exception 'Invalid batch insert accepted';
    exception when check_violation then null; end;
    begin
      insert into public.batch_products(batch_id,name,base_price,quantity_total,image_path)
      values('72000000-0000-0000-0000-000000000001','Missing image',1,1,bad_path);
      raise exception 'Invalid product insert accepted';
    exception when check_violation then null; end;
    begin
      update public.batches set cover_path=bad_path where id='72000000-0000-0000-0000-000000000001';
      raise exception 'Invalid batch update accepted';
    exception when check_violation then null; end;
    begin
      update public.batch_products set image_path=bad_path where batch_id='72000000-0000-0000-0000-000000000001';
      raise exception 'Invalid product update accepted';
    exception when check_violation then null; end;

    -- A failure on the second product rolls back the batch and first product.
    v_batch_id := gen_random_uuid();
    begin
      perform public.create_batch_with_products(v_batch_id,pg_temp.image_batch(),
        jsonb_build_array(pg_temp.image_product('Good'),pg_temp.image_product('Bad',bad_path)));
      raise exception 'RPC accepted a missing product image';
    exception when check_violation then null; end;
    if exists(select 1 from public.batches where id=v_batch_id)
      or exists(select 1 from public.batch_products where batch_id=v_batch_id) then
      raise exception 'Failed RPC left partial rows';
    end if;
    begin
      perform public.create_batch_with_products(v_batch_id,pg_temp.image_batch(bad_path),
        jsonb_build_array(pg_temp.image_product()));
      raise exception 'RPC accepted a missing cover image';
    exception when check_violation then null; end;
  end loop;

  -- A later non-image validation error is also atomic.
  v_batch_id := gen_random_uuid();
  begin
    perform public.create_batch_with_products(v_batch_id,pg_temp.image_batch(),
      jsonb_build_array(pg_temp.image_product('Same'),pg_temp.image_product('same')));
    raise exception 'Duplicate product names accepted';
  exception when unique_violation then null; end;
  if exists(select 1 from public.batches where id=v_batch_id)
    or exists(select 1 from public.batch_products where batch_id=v_batch_id) then
    raise exception 'Duplicate-name failure left partial rows';
  end if;

  foreach v_bad in array array['null'::jsonb,'{}'::jsonb,'[]'::jsonb] loop
    begin
      perform public.create_batch_with_products(gen_random_uuid(),pg_temp.image_batch(),v_bad);
      raise exception 'Malformed/empty products accepted';
    exception when invalid_parameter_value then null; end;
  end loop;

  -- Forged seller/batch/status/generated fields are not writable through JSON.
  v_batch_id := gen_random_uuid();
  perform public.create_batch_with_products(v_batch_id,
    pg_temp.image_batch() || '{"seller_id":"71000000-0000-0000-0000-000000000002","status":"draft"}',
    jsonb_build_array(pg_temp.image_product() || '{"batch_id":"72000000-0000-0000-0000-000000000001","selling_price":0}'));
  if not exists(select 1 from public.batches where id=v_batch_id and seller_id=auth.uid() and status='live')
    or not exists(select 1 from public.batch_products where batch_id=v_batch_id and selling_price=110) then
    raise exception 'RPC allowed forged writable columns';
  end if;
end $$;

-- RLS remains active inside this SECURITY INVOKER RPC.
select set_config('request.jwt.claim.sub','71000000-0000-0000-0000-000000000002',true);
do $$ begin
  begin
    perform public.create_batch_with_products(gen_random_uuid(),pg_temp.image_batch(),jsonb_build_array(pg_temp.image_product()));
    raise exception 'Non-seller created a batch';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','71000000-0000-0000-0000-000000000003',true);
do $$ begin
  begin
    perform public.create_batch_with_products(gen_random_uuid(),pg_temp.image_batch(),jsonb_build_array(pg_temp.image_product()));
    raise exception 'Suspended seller created a batch';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
  begin
    perform public.create_batch_with_products(gen_random_uuid(),pg_temp.image_batch(),jsonb_build_array(pg_temp.image_product()));
    raise exception 'Unauthenticated caller created a batch';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
do $$ begin
  if has_function_privilege('anon','public.create_batch_with_products(uuid,jsonb,jsonb)','execute')
    or not has_function_privilege('authenticated','public.create_batch_with_products(uuid,jsonb,jsonb)','execute')
    or (select prosecdef from pg_proc where oid='public.create_batch_with_products(uuid,jsonb,jsonb)'::regprocedure) then
    raise exception 'Incorrect RPC privilege boundary';
  end if;
  -- CHECK constraints also cover privileged SQL/functions that bypass RLS.
  begin
    update public.batches set cover_path=null where id='72000000-0000-0000-0000-000000000001';
    raise exception 'Privileged write bypassed required cover';
  exception when check_violation then null; end;
  begin
    update public.batch_products set image_path='' where batch_id='72000000-0000-0000-0000-000000000001';
    raise exception 'Privileged write bypassed required product image';
  exception when check_violation then null; end;
end $$;
rollback;
