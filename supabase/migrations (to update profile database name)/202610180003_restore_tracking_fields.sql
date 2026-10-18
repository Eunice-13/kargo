-- Restore the tracking fields consumed by set_order_tracking(). They were
-- removed by the earlier contact/fulfillment cleanup before the dedicated
-- shipping workflow reintroduced tracking.

alter table public.orders
  add column if not exists tracking_number text,
  add column if not exists eta timestamptz;

comment on column public.orders.tracking_number is
  'Courier-provided shipment tracking identifier.';
comment on column public.orders.eta is
  'Seller-provided estimated delivery date and time.';
