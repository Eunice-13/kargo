-- Allow a buyer to remove an existing group commitment by saving quantity 0.
-- A zero quantity is not stored as a commitment; it deletes the buyer's row.

CREATE OR REPLACE FUNCTION public.set_group_commitment(
  p_group_order_id uuid,
  p_batch_product_id uuid,
  p_quantity integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  target_group public.group_orders;
  product public.batch_products;
  active_reserved integer;
  own_reserved integer;
  solo_claimed integer;
BEGIN
  SELECT * INTO target_group
  FROM public.group_orders
  WHERE id = p_group_order_id
  FOR UPDATE;

  IF NOT FOUND
     OR target_group.status <> 'forming'
     OR public.group_formation_deadline(target_group.batch_id) <= clock_timestamp()
  THEN
    RAISE EXCEPTION 'This group is no longer accepting commitments';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.group_order_members
    WHERE group_order_id = target_group.id
      AND user_id = auth.uid()
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Active group membership required';
  END IF;

  PERFORM 1
  FROM public.batches
  WHERE id = target_group.batch_id
  FOR SHARE;

  IF public.group_formation_deadline(target_group.batch_id) <= clock_timestamp() THEN
    RAISE EXCEPTION 'This group is no longer accepting commitments';
  END IF;

  SELECT * INTO product
  FROM public.batch_products
  WHERE id = p_batch_product_id
    AND batch_id = target_group.batch_id
  FOR UPDATE;

  IF NOT FOUND OR product.is_locked THEN
    RAISE EXCEPTION 'Product is not available';
  END IF;

  IF public.group_formation_deadline(target_group.batch_id) <= clock_timestamp() THEN
    RAISE EXCEPTION 'This group is no longer accepting commitments';
  END IF;

  -- Zero means remove this user's existing commitment. Do not insert a
  -- zero-quantity row, because zero rows can incorrectly affect checkout.
  IF p_quantity = 0 THEN
    DELETE FROM public.group_order_commitments
    WHERE group_order_id = target_group.id
      AND user_id = auth.uid()
      AND batch_product_id = product.id;
    RETURN;
  END IF;

  IF p_quantity < 0 THEN
    RAISE EXCEPTION 'Quantity must not be negative';
  END IF;

  SELECT coalesce(sum(o.quantity), 0)::integer INTO active_reserved
  FROM public.orders o
  WHERE o.batch_product_id = product.id
    AND o.status IN (
      'payment_pending', 'payment_submitted', 'insufficient_payment',
      'payment_confirmed', 'preparing', 'completed'
    );

  active_reserved := active_reserved + coalesce((
    SELECT sum(c.quantity)::integer
    FROM public.group_order_commitments c
    JOIN public.group_orders g ON g.id = c.group_order_id
    WHERE c.batch_product_id = product.id
      AND g.status = 'forming'
      AND public.group_formation_deadline(g.batch_id) > clock_timestamp()
      AND NOT (c.group_order_id = target_group.id AND c.user_id = auth.uid())
  ), 0);

  IF active_reserved + p_quantity > product.quantity_total THEN
    RAISE EXCEPTION 'Insufficient inventory';
  END IF;

  IF product.limit_per_user IS NOT NULL THEN
    SELECT coalesce(sum(o.quantity), 0)::integer INTO solo_claimed
    FROM public.orders o
    WHERE o.batch_product_id = product.id
      AND o.buyer_id = auth.uid()
      AND o.status IN (
        'payment_pending', 'payment_submitted', 'insufficient_payment',
        'payment_confirmed', 'preparing', 'completed'
      );

    SELECT coalesce(sum(c.quantity), 0)::integer INTO own_reserved
    FROM public.group_order_commitments c
    JOIN public.group_orders g ON g.id = c.group_order_id
    WHERE c.batch_product_id = product.id
      AND c.user_id = auth.uid()
      AND g.status = 'forming'
      AND public.group_formation_deadline(g.batch_id) > clock_timestamp()
      AND c.group_order_id <> target_group.id;

    IF solo_claimed + own_reserved + p_quantity > product.limit_per_user THEN
      RAISE EXCEPTION 'Per-buyer limit of % reached for this item', product.limit_per_user;
    END IF;
  END IF;

  INSERT INTO public.group_order_commitments (
    group_order_id, user_id, batch_product_id, quantity, unit_selling_price
  )
  VALUES (target_group.id, auth.uid(), product.id, p_quantity, product.selling_price)
  ON CONFLICT (group_order_id, user_id, batch_product_id)
  DO UPDATE SET
    quantity = excluded.quantity,
    unit_selling_price = excluded.unit_selling_price,
    updated_at = now();
END;
$function$;
