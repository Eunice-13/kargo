-- One active Group Order per buyer and batch; historical memberships remain intact.
begin;
lock table public.group_orders, public.group_order_members in share row exclusive mode;
do $$ begin
 if exists(select 1 from public.group_order_members m join public.group_orders g on g.id=m.group_order_id
  where m.status='active' and g.status in ('forming','waiting_for_seller','payment_pending','payment_submitted')
  group by m.user_id,g.batch_id having count(*)>1) then
  raise exception 'Duplicate active group memberships exist. Review and repair separately before applying this migration.';
 end if;
end $$;
alter table public.group_order_members add column batch_id uuid references public.batches(id),
 add column group_active boolean not null default false;
update public.group_order_members m set batch_id=g.batch_id,
 group_active=g.status in ('forming','waiting_for_seller','payment_pending','payment_submitted')
 from public.group_orders g where g.id=m.group_order_id;
alter table public.group_order_members alter column batch_id set not null;
create unique index group_members_one_active_batch on public.group_order_members(user_id,batch_id)
 where status='active' and group_active;

create function public.sync_group_membership_context() returns trigger
language plpgsql security definer set search_path='' as $$
declare g public.group_orders;
begin
 if tg_op='UPDATE' and (new.user_id<>old.user_id or new.group_order_id<>old.group_order_id) then
  raise exception 'Group membership identity is immutable'; end if;
 select * into strict g from public.group_orders where id=new.group_order_id for update;
 new.batch_id:=g.batch_id;
 new.group_active:=g.status in ('forming','waiting_for_seller','payment_pending','payment_submitted');
 return new;
end $$;
create trigger sync_group_membership_context before insert or update on public.group_order_members
 for each row execute function public.sync_group_membership_context();
create function public.sync_group_membership_activity() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.batch_id<>old.batch_id then raise exception 'A group cannot change its batch'; end if;
 update public.group_order_members set group_active=new.status in ('forming','waiting_for_seller','payment_pending','payment_submitted')
  where group_order_id=new.id;
 return new;
end $$;
create trigger sync_group_membership_activity after update of status,batch_id on public.group_orders
 for each row execute function public.sync_group_membership_activity();
revoke all on function public.sync_group_membership_context(),public.sync_group_membership_activity() from public,anon,authenticated;

create or replace function public.start_group_order(p_batch_id uuid)
returns public.group_orders language plpgsql security definer set search_path = '' as $$
declare
  target_batch public.batches;
  result public.group_orders;
begin
  if auth.uid() is null or not public.is_active(auth.uid()) then raise exception 'Active account required'; end if;
  if public.can_sell(auth.uid()) then raise exception 'Seller accounts cannot start group orders'; end if;

  select * into target_batch from public.batches where id = p_batch_id for update;
  if not found or target_batch.status <> 'live' or not target_batch.group_orders_enabled then
    raise exception 'Group ordering is not available for this batch';
  end if;
  if target_batch.seller_id = auth.uid() then raise exception 'Sellers cannot order from their own batch'; end if;
  if current_date > target_batch.ends_on then raise exception 'This batch has already closed'; end if;
  if exists (
    select 1 from public.group_order_members m
    join public.group_orders g on g.id = m.group_order_id
    where m.user_id = auth.uid() and m.status = 'active'
      and g.batch_id = p_batch_id and g.status in ('forming', 'waiting_for_seller', 'payment_pending', 'payment_submitted')
  ) then
    raise exception 'GROUP_MEMBERSHIP_CONFLICT' using detail=jsonb_build_object('can_leave',
      not exists(select 1 from public.group_order_members m join public.group_orders g on g.id=m.group_order_id
       where m.user_id=auth.uid() and m.status='active' and g.batch_id=p_batch_id
       and g.status in ('waiting_for_seller','payment_pending','payment_submitted')))::text;
  end if;

  insert into public.group_orders (batch_id, leader_id, referral_code, formation_deadline)
  values (
    p_batch_id, auth.uid(), public.generate_group_referral_code(),
    (target_batch.ends_on::timestamp + interval '1 day' - interval '1 second') at time zone 'Asia/Manila'
  ) returning * into result;

  insert into public.group_order_members (group_order_id, user_id, role)
  values (result.id, auth.uid(), 'leader');
  return result;
exception when unique_violation then
  if sqlerrm like '%group_members_one_active_batch%' then
    raise exception 'GROUP_MEMBERSHIP_CONFLICT' using detail='{"can_leave":false}';
  end if;
  raise;
end;
$$;


create or replace function public.join_group_order(p_referral_code text)
returns public.group_orders language plpgsql security definer set search_path = '' as $$
declare
  result public.group_orders;
  target_batch public.batches;
begin
  if auth.uid() is null or not public.is_active(auth.uid()) then raise exception 'Active account required'; end if;
  if public.can_sell(auth.uid()) then raise exception 'Seller accounts cannot join group orders'; end if;
  select * into result from public.group_orders
    where referral_code = upper(trim(p_referral_code)) and status = 'forming' for update;
  if not found or result.formation_deadline <= now() then raise exception 'This group code is invalid or expired'; end if;
  select * into target_batch from public.batches where id = result.batch_id;
  if target_batch.status <> 'live' then raise exception 'This batch is not accepting orders'; end if;
  if exists (
    select 1 from public.group_order_members m
    join public.group_orders g on g.id = m.group_order_id
    where m.user_id = auth.uid() and m.status = 'active'
      and g.batch_id = result.batch_id and g.id <> result.id
      and g.status in ('forming', 'waiting_for_seller', 'payment_pending', 'payment_submitted')
  ) then
    raise exception 'GROUP_MEMBERSHIP_CONFLICT' using detail=jsonb_build_object('can_leave',
      not exists(select 1 from public.group_order_members m join public.group_orders g on g.id=m.group_order_id
       where m.user_id=auth.uid() and m.status='active' and g.batch_id=result.batch_id
       and g.status in ('waiting_for_seller','payment_pending','payment_submitted')))::text;
  end if;

  if exists(select 1 from public.group_order_members where group_order_id=result.id and user_id=auth.uid() and status='active') then return result; end if;
  insert into public.group_order_members (group_order_id, user_id, role, status)
  values (result.id, auth.uid(), 'member', 'active')
  on conflict (group_order_id, user_id) do update set status = 'active', joined_at = now();
  insert into public.notifications (recipient_id, category, message, target_path, context)
  values (result.leader_id, 'users', 'A member joined your group order.', 'Batches', jsonb_build_object('group_order_id', result.id));
  return result;
exception when unique_violation then
  if sqlerrm like '%group_members_one_active_batch%' then
    raise exception 'GROUP_MEMBERSHIP_CONFLICT' using detail='{"can_leave":false}';
  end if;
  raise;
end;
$$;


commit;
