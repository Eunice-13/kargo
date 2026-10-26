-- ============================================================================
-- Make a user delete cascade cleanly (no FK "violates constraint" errors)
-- ----------------------------------------------------------------------------
-- Deleting a row from auth.users already cascades into public.user_profiles.
-- From there, a web of ON DELETE RESTRICT / NO ACTION constraints currently
-- BLOCKS the delete whenever the user has orders, payments, reviews, group
-- orders, or combined-delivery records. This migration recreates those
-- constraints so the whole graph removes itself in the right order.
--
-- ⚠️ IRREVERSIBLE DATA BEHAVIOR — read before applying:
--   Deleting a user who is a SELLER removes their batches, and therefore the
--   orders, payments, and reviews OTHER buyers placed on those batches. There
--   is no way around this: a buyer's payment is attached to the seller's order.
--   Audit / "who did it" reference columns are kept via SET NULL so the record
--   survives with a blank actor instead of blocking or vanishing.
--
-- Safe to run once. Every statement drops the constraint by its known name and
-- recreates it; wrapped in a single transaction.
-- ============================================================================

begin;

-- ─── orders: the hub everything hangs off ───────────────────────────────────
-- buyer/seller -> user; batch_product -> product; group_order link.

alter table public.orders drop constraint if exists orders_buyer_id_fkey;
alter table public.orders add constraint orders_buyer_id_fkey
  foreign key (buyer_id) references public.user_profiles(id) on delete cascade;

alter table public.orders drop constraint if exists orders_seller_id_fkey;
alter table public.orders add constraint orders_seller_id_fkey
  foreign key (seller_id) references public.user_profiles(id) on delete cascade;

alter table public.orders drop constraint if exists orders_batch_product_id_fkey;
alter table public.orders add constraint orders_batch_product_id_fkey
  foreign key (batch_product_id) references public.batch_products(id) on delete cascade;

-- The two columns with NO on-delete clause (default NO ACTION) that would block
-- a delete. These are "who acted" markers, so null them instead of cascading.
alter table public.orders drop constraint if exists orders_shipping_fee_set_by_fkey;
alter table public.orders add constraint orders_shipping_fee_set_by_fkey
  foreign key (shipping_fee_set_by) references public.user_profiles(id) on delete set null;

alter table public.orders drop constraint if exists orders_declined_by_fkey;
alter table public.orders add constraint orders_declined_by_fkey
  foreign key (declined_by) references public.user_profiles(id) on delete set null;

-- ─── payments: follow the order away ────────────────────────────────────────

alter table public.payments drop constraint if exists payments_order_id_fkey;
alter table public.payments add constraint payments_order_id_fkey
  foreign key (order_id) references public.orders(id) on delete cascade;

alter table public.payments drop constraint if exists payments_submitted_by_fkey;
alter table public.payments add constraint payments_submitted_by_fkey
  foreign key (submitted_by) references public.user_profiles(id) on delete cascade;

-- reviewed_by already SET NULL in the base schema; leave as-is.

-- ─── reviews: tied to the order and both parties ────────────────────────────

alter table public.reviews drop constraint if exists reviews_order_id_fkey;
alter table public.reviews add constraint reviews_order_id_fkey
  foreign key (order_id) references public.orders(id) on delete cascade;

alter table public.reviews drop constraint if exists reviews_reviewer_id_fkey;
alter table public.reviews add constraint reviews_reviewer_id_fkey
  foreign key (reviewer_id) references public.user_profiles(id) on delete cascade;

alter table public.reviews drop constraint if exists reviews_reviewee_id_fkey;
alter table public.reviews add constraint reviews_reviewee_id_fkey
  foreign key (reviewee_id) references public.user_profiles(id) on delete cascade;

-- ─── group orders ───────────────────────────────────────────────────────────
-- group_orders.batch_id already cascades; members/commitments cascade from
-- group_orders. Only the user references and the orders link block.

alter table public.group_orders drop constraint if exists group_orders_leader_id_fkey;
alter table public.group_orders add constraint group_orders_leader_id_fkey
  foreign key (leader_id) references public.user_profiles(id) on delete cascade;

alter table public.group_order_members drop constraint if exists group_order_members_user_id_fkey;
alter table public.group_order_members add constraint group_order_members_user_id_fkey
  foreign key (user_id) references public.user_profiles(id) on delete cascade;

alter table public.group_order_commitments drop constraint if exists group_order_commitments_user_id_fkey;
alter table public.group_order_commitments add constraint group_order_commitments_user_id_fkey
  foreign key (user_id) references public.user_profiles(id) on delete cascade;

alter table public.group_order_commitments drop constraint if exists group_order_commitments_batch_product_id_fkey;
alter table public.group_order_commitments add constraint group_order_commitments_batch_product_id_fkey
  foreign key (batch_product_id) references public.batch_products(id) on delete cascade;

-- orders.group_order_id: when a group order goes away, detach the paid order
-- rather than deleting it a second way (the order already cascades via buyer/
-- seller). SET NULL avoids a double-delete path conflict.
alter table public.orders drop constraint if exists orders_group_order_id_fkey;
alter table public.orders add constraint orders_group_order_id_fkey
  foreign key (group_order_id) references public.group_orders(id) on delete set null;

-- group_order_members.batch_id (NO ACTION by default) -> cascade with the batch.
alter table public.group_order_members drop constraint if exists group_order_members_batch_id_fkey;
alter table public.group_order_members add constraint group_order_members_batch_id_fkey
  foreign key (batch_id) references public.batches(id) on delete cascade;

-- ─── combined delivery ──────────────────────────────────────────────────────
-- A RESTRICT web into orders / batches / user_profiles / members / payments.

-- delivery_destinations owned by the buyer.
alter table public.delivery_destinations drop constraint if exists delivery_destinations_buyer_id_fkey;
alter table public.delivery_destinations add constraint delivery_destinations_buyer_id_fkey
  foreign key (buyer_id) references public.user_profiles(id) on delete cascade;

-- orders -> delivery_destinations (composite). Detach so it doesn't fight the
-- destination's own cascade; the order is already being removed via buyer/seller.
alter table public.orders drop constraint if exists orders_delivery_destination_owner_fk;
alter table public.orders add constraint orders_delivery_destination_owner_fk
  foreign key (delivery_destination_id, buyer_id)
  references public.delivery_destinations(id, buyer_id) on delete set null;

-- combined_delivery_groups: buyer/seller/batch/destination/decided_by.
alter table public.combined_delivery_groups drop constraint if exists combined_delivery_groups_buyer_id_fkey;
alter table public.combined_delivery_groups add constraint combined_delivery_groups_buyer_id_fkey
  foreign key (buyer_id) references public.user_profiles(id) on delete cascade;

alter table public.combined_delivery_groups drop constraint if exists combined_delivery_groups_seller_id_fkey;
alter table public.combined_delivery_groups add constraint combined_delivery_groups_seller_id_fkey
  foreign key (seller_id) references public.user_profiles(id) on delete cascade;

alter table public.combined_delivery_groups drop constraint if exists combined_delivery_groups_batch_id_fkey;
alter table public.combined_delivery_groups add constraint combined_delivery_groups_batch_id_fkey
  foreign key (batch_id) references public.batches(id) on delete cascade;

alter table public.combined_delivery_groups drop constraint if exists combined_delivery_groups_decided_by_fkey;
alter table public.combined_delivery_groups add constraint combined_delivery_groups_decided_by_fkey
  foreign key (decided_by) references public.user_profiles(id) on delete set null;

-- The composite destination FK on the group (named by Postgres for the inline
-- table constraint). Recreate as SET NULL-equivalent by cascading the group
-- instead: the group already cascades via buyer_id, so point destination at it.
alter table public.combined_delivery_groups
  drop constraint if exists combined_delivery_groups_destination_id_buyer_id_fkey;
alter table public.combined_delivery_groups
  add constraint combined_delivery_groups_destination_id_buyer_id_fkey
  foreign key (destination_id, buyer_id)
  references public.delivery_destinations(id, buyer_id) on delete cascade;

-- members: group + order.
alter table public.combined_delivery_members drop constraint if exists combined_delivery_members_group_id_fkey;
alter table public.combined_delivery_members add constraint combined_delivery_members_group_id_fkey
  foreign key (group_id) references public.combined_delivery_groups(id) on delete cascade;

alter table public.combined_delivery_members drop constraint if exists combined_delivery_members_order_id_fkey;
alter table public.combined_delivery_members add constraint combined_delivery_members_order_id_fkey
  foreign key (order_id) references public.orders(id) on delete cascade;

-- events: group + actor.
alter table public.combined_delivery_events drop constraint if exists combined_delivery_events_group_id_fkey;
alter table public.combined_delivery_events add constraint combined_delivery_events_group_id_fkey
  foreign key (group_id) references public.combined_delivery_groups(id) on delete cascade;

alter table public.combined_delivery_events drop constraint if exists combined_delivery_events_actor_id_fkey;
alter table public.combined_delivery_events add constraint combined_delivery_events_actor_id_fkey
  foreign key (actor_id) references public.user_profiles(id) on delete set null;

commit;

-- ─── Optional: combined-delivery payment tables (210004 / 210005) ───────────
-- These tables only exist if those migrations were applied. Each statement is
-- guarded so this block is a no-op when the table is absent. Run it after the
-- transaction above; it cascades the remaining RESTRICT web for payments.
do $$
begin
  if to_regclass('public.combined_delivery_batch_pins') is not null then
    execute 'alter table public.combined_delivery_batch_pins
      drop constraint if exists combined_delivery_batch_pins_group_id_order_id_fkey';
    execute 'alter table public.combined_delivery_batch_pins
      add constraint combined_delivery_batch_pins_group_id_order_id_fkey
      foreign key (group_id, order_id)
      references public.combined_delivery_members(group_id, order_id) on delete cascade';
  end if;

  if to_regclass('public.combined_delivery_payment_accounts') is not null then
    execute 'alter table public.combined_delivery_payment_accounts
      drop constraint if exists combined_delivery_payment_accounts_group_id_fkey';
    execute 'alter table public.combined_delivery_payment_accounts
      add constraint combined_delivery_payment_accounts_group_id_fkey
      foreign key (group_id) references public.combined_delivery_groups(id) on delete cascade';
  end if;

  if to_regclass('public.combined_delivery_payment_reservations') is not null then
    execute 'alter table public.combined_delivery_payment_reservations
      drop constraint if exists combined_delivery_payment_reservations_order_id_fkey';
    execute 'alter table public.combined_delivery_payment_reservations
      add constraint combined_delivery_payment_reservations_order_id_fkey
      foreign key (order_id) references public.orders(id) on delete cascade';
  end if;

  -- payments.combined_delivery_group_id (only if the column exists).
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'payments'
      and column_name = 'combined_delivery_group_id'
  ) then
    execute 'alter table public.payments
      drop constraint if exists payments_combined_delivery_group_id_fkey';
    execute 'alter table public.payments
      add constraint payments_combined_delivery_group_id_fkey
      foreign key (combined_delivery_group_id)
      references public.combined_delivery_groups(id) on delete set null';
  end if;
end $$;
