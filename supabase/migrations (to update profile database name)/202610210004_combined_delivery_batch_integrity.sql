-- Phase 3.2: snapshot-safe active delivery identity, without payment changes.
begin;

-- Fail fast rather than wait behind application transactions while taking DDL
-- locks in a different order. Retry this entire migration in a quiet window.
lock table public.orders, public.combined_delivery_groups,
  public.combined_delivery_members, public.batches, public.batch_products
  in access exclusive mode nowait;

-- Never pin a legacy-ineligible group or silently rewrite its batch/history.
-- Resolve such groups with Phase 3.1 recovery before retrying this migration.
do $$
declare checked_group record;
begin
  if exists (
    select 1 from public.combined_delivery_members m
    join public.combined_delivery_groups g on g.id=m.group_id
    where m.released_at is null and g.status not in ('pending_approval','awaiting_shipping_fee','shipping_fee_set')
  ) then raise exception 'Resolve orphaned active delivery memberships before installing batch integrity' using errcode='22023'; end if;
  for checked_group in select id from public.combined_delivery_groups
    where status in ('pending_approval','awaiting_shipping_fee','shipping_fee_set') order by id loop
    perform public.assert_combined_delivery_group(checked_group.id);
  end loop;
end;
$$;

-- Composite referenced keys are necessary: a reference to id alone would not
-- protect batch_id or seller_id updates. Historical memberships are unchanged.
alter table public.batch_products add constraint batch_products_delivery_identity_key unique(id,batch_id);
alter table public.batches add constraint batches_delivery_identity_key unique(id,seller_id);

-- The old order guard is also snapshot-visible. Bind each pin to the exact
-- reservation revision so reassignment/locator/financial changes cannot bypass
-- the product pin via an older snapshot. This enforces the existing freeze rule;
-- standalone orders retain their normal behavior. Constant-default DDL does not
-- reset timers, quantities, money, or membership history.
alter table public.orders add column combined_delivery_revision bigint not null default 0;
alter table public.orders add constraint orders_delivery_revision_key unique(id,combined_delivery_revision);
create function public.stamp_combined_delivery_order_revision()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.combined_delivery_revision is distinct from old.combined_delivery_revision then
    raise exception 'Reservation revision is maintained internally' using errcode='22023';
  end if;
  -- total_amount is generated after BEFORE triggers; its source price/quantity
  -- remain covered, so a computed NULL must not create a false revision change.
  if (to_jsonb(new)-array['updated_at','combined_delivery_revision','total_amount'])
    is distinct from (to_jsonb(old)-array['updated_at','combined_delivery_revision','total_amount']) then
    new.combined_delivery_revision:=old.combined_delivery_revision+1;
  end if;
  return new;
end;
$$;
revoke all on function public.stamp_combined_delivery_order_revision() from public,anon,authenticated,service_role;
create trigger orders_combined_delivery_revision before update on public.orders
  for each row execute function public.stamp_combined_delivery_order_revision();

create table public.combined_delivery_batch_pins (
  group_id uuid not null,
  order_id uuid not null,
  product_id uuid not null,
  order_revision bigint not null,
  batch_id uuid not null,
  seller_id uuid not null,
  primary key(group_id,order_id),
  constraint combined_delivery_batch_pin_member_fk foreign key(group_id,order_id)
    references public.combined_delivery_members(group_id,order_id) on update restrict on delete restrict,
  constraint combined_delivery_batch_pin_order_fk foreign key(order_id,order_revision)
    references public.orders(id,combined_delivery_revision) on update restrict on delete restrict,
  constraint combined_delivery_batch_pin_product_fk foreign key(product_id,batch_id)
    references public.batch_products(id,batch_id) on update restrict on delete restrict,
  constraint combined_delivery_batch_pin_seller_fk foreign key(batch_id,seller_id)
    references public.batches(id,seller_id) on update restrict on delete restrict
);
create index combined_delivery_batch_pin_product_idx on public.combined_delivery_batch_pins(product_id,batch_id);
create index combined_delivery_batch_pin_seller_idx on public.combined_delivery_batch_pins(batch_id,seller_id);
alter table public.combined_delivery_batch_pins enable row level security;
revoke all on public.combined_delivery_batch_pins from public,anon,authenticated,service_role;

-- Trusted trigger only. Clients cannot supply, change, or delete identity pins.
-- Eligibility/order guards already establish the member's order and group;
-- their locks stabilize these values before this trigger creates the reference.
create function public.sync_combined_delivery_batch_pin()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op='INSERT' and new.released_at is null then
    insert into public.combined_delivery_batch_pins(group_id,order_id,product_id,order_revision,batch_id,seller_id)
    select new.group_id,new.order_id,o.batch_product_id,o.combined_delivery_revision,g.batch_id,g.seller_id
    from public.orders o cross join public.combined_delivery_groups g
    where o.id=new.order_id and g.id=new.group_id;
  elsif tg_op='UPDATE' and old.released_at is null and new.released_at is not null then
    delete from public.combined_delivery_batch_pins where group_id=new.group_id and order_id=new.order_id;
  end if;
  return new;
end;
$$;
revoke all on function public.sync_combined_delivery_batch_pin() from public,anon,authenticated,service_role;
create trigger combined_delivery_members_batch_pin after insert or update of released_at on public.combined_delivery_members
  for each row execute function public.sync_combined_delivery_batch_pin();

-- All new DDL and references commit atomically. Table locks above prevent any
-- membership/identity change between validation and this metadata-only backfill.
insert into public.combined_delivery_batch_pins(group_id,order_id,product_id,order_revision,batch_id,seller_id)
select m.group_id,m.order_id,o.batch_product_id,o.combined_delivery_revision,g.batch_id,g.seller_id
from public.combined_delivery_members m join public.orders o on o.id=m.order_id
join public.combined_delivery_groups g on g.id=m.group_id
where m.released_at is null;

-- Keep Phase 3.1's friendly guards. The immediate RESTRICT FKs above are the
-- authoritative backstop: PostgreSQL's RI checks detect concurrent references
-- across snapshots, rejecting the mutation (23001/23503/40001) instead of allowing
-- a stale EXISTS result to authorize a cross-batch/owner committed state.
notify pgrst,'reload schema';
commit;
