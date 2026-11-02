-- Required photos for all future batch/product writes. These are CHECKs rather
-- than SET NOT NULL so legacy rows remain readable without inventing images.
-- NOT VALID skips the historical scan, but PostgreSQL checks every new INSERT
-- and UPDATE (including unrelated updates to a legacy imageless row).
alter table public.batches
  add constraint batches_cover_path_required
  check (cover_path is not null and cover_path ~ '[^[:space:]]') not valid;

alter table public.batch_products
  add constraint batch_products_image_path_required
  check (image_path is not null and image_path ~ '[^[:space:]]') not valid;

-- Reviewed the historical migration functions: none insert batches/products.
-- Existing seller writes are direct INSERTs protected by RLS. This new RPC keeps
-- those same permissions and constraints, explicitly selects writable columns,
-- derives seller_id from auth, and commits the batch and all products together.
-- Storage uploads happen first in the API; no nullable placeholder rows exist.
create or replace function public.create_batch_with_products(
  p_batch_id uuid,
  p_batch jsonb,
  p_products jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_seller_id uuid := auth.uid();
  v_product jsonb;
begin
  if v_seller_id is null or not public.can_sell(v_seller_id) then
    raise exception 'Active seller account required' using errcode = '42501';
  end if;
  if p_batch_id is null or jsonb_typeof(p_batch) is distinct from 'object'
    or jsonb_typeof(p_products) is distinct from 'array' then
    raise exception 'Batch and products are required' using errcode = '22023';
  end if;
  if jsonb_array_length(p_products) = 0 then
    raise exception 'At least one product is required' using errcode = '22023';
  end if;

  insert into public.batches (
    id, seller_id, title, status, starts_on, ends_on, category,
    reservation_hours, notes, cover_path, gallery_paths,
    group_orders_enabled, group_discount_type, group_discount_value,
    group_discount_min_subtotal
  ) values (
    p_batch_id, v_seller_id, p_batch->>'title', 'live',
    (p_batch->>'starts_on')::date, (p_batch->>'ends_on')::date,
    p_batch->>'category', (p_batch->>'reservation_hours')::integer,
    p_batch->>'notes', p_batch->>'cover_path',
    array(select jsonb_array_elements_text(coalesce(p_batch->'gallery_paths', '[]'::jsonb))),
    coalesce((p_batch->>'group_orders_enabled')::boolean, false),
    p_batch->>'group_discount_type', (p_batch->>'group_discount_value')::numeric,
    (p_batch->>'group_discount_min_subtotal')::numeric
  );

  for v_product in select value from jsonb_array_elements(p_products) loop
    insert into public.batch_products (
      id, batch_id, name, base_price, markup, quantity_total, image_path,
      selling_unit, pieces_per_box, limit_per_user, waitlist_limit
    ) values (
      (v_product->>'id')::uuid, p_batch_id, v_product->>'name',
      (v_product->>'base_price')::numeric, (v_product->>'markup')::numeric,
      (v_product->>'quantity_total')::integer, v_product->>'image_path',
      coalesce(v_product->>'selling_unit', 'piece'),
      (v_product->>'pieces_per_box')::integer,
      (v_product->>'limit_per_user')::integer,
      (v_product->>'waitlist_limit')::integer
    );
  end loop;
  return p_batch_id;
end;
$$;

revoke all on function public.create_batch_with_products(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.create_batch_with_products(uuid, jsonb, jsonb) to authenticated;
