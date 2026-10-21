-- Standalone feature delta. Do not replay the archived historical migration directory.
begin;
create table public.buyer_addresses (
 id uuid primary key default gen_random_uuid(),
 buyer_id uuid not null references auth.users(id) on delete cascade,
 slot smallint not null check (slot in (1,2)),
 label text not null check (char_length(trim(label)) between 1 and 60),
 address_text text not null check (char_length(trim(address_text)) between 1 and 1000),
 pin_lat double precision not null check (pin_lat between -90 and 90),
 pin_lng double precision not null check (pin_lng between -180 and 180),
 is_default boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(buyer_id,slot)
);
create unique index buyer_addresses_one_default on public.buyer_addresses(buyer_id) where is_default;
alter table public.buyer_addresses enable row level security;
create policy buyer_addresses_own on public.buyer_addresses for all to authenticated
 using (buyer_id=auth.uid() and public.is_active(auth.uid()) and not public.can_sell(auth.uid()))
 with check (buyer_id=auth.uid() and public.is_active(auth.uid()) and not public.can_sell(auth.uid()));
-- Mutations must use the transactional RPCs. Slot constraints also protect the
-- two-address limit independently of transaction snapshots and lock scheduling.
revoke all on public.buyer_addresses from public,anon,authenticated;
grant select on public.buyer_addresses to authenticated;

create function public.save_buyer_address(p_id uuid,p_label text,p_address_text text,
 p_pin_lat double precision,p_pin_lng double precision,p_is_default boolean default false)
returns public.buyer_addresses language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); target public.buyer_addresses; chosen_slot smallint; make_default boolean;
begin
 if uid is null or not public.is_active(uid) or public.can_sell(uid) then
  raise exception 'Active buyer account required' using errcode='42501'; end if;
 -- Stable, buyer-specific row lock; no changes to Auth/profile records.
 perform 1 from auth.users where id=uid for update;
 if p_id is not null then
  select * into target from public.buyer_addresses where id=p_id and buyer_id=uid for update;
  if not found then raise exception 'Address unavailable' using errcode='42501'; end if;
  chosen_slot:=target.slot;
 else
  select s::smallint into chosen_slot from generate_series(1,2) s
   where not exists(select 1 from public.buyer_addresses where buyer_id=uid and slot=s) order by s limit 1;
  if chosen_slot is null then raise exception 'You can save up to 2 delivery addresses.' using errcode='23514'; end if;
 end if;
 make_default:=coalesce(p_is_default,false) or coalesce(target.is_default,false)
  or not exists(select 1 from public.buyer_addresses where buyer_id=uid and is_default);
 if make_default then update public.buyer_addresses set is_default=false,updated_at=now() where buyer_id=uid and is_default; end if;
 if p_id is null then
  insert into public.buyer_addresses(buyer_id,slot,label,address_text,pin_lat,pin_lng,is_default)
   values(uid,chosen_slot,trim(p_label),trim(p_address_text),p_pin_lat,p_pin_lng,make_default) returning * into target;
 else
  update public.buyer_addresses set label=trim(p_label),address_text=trim(p_address_text),
   pin_lat=p_pin_lat,pin_lng=p_pin_lng,is_default=make_default,updated_at=now()
   where id=p_id and buyer_id=uid returning * into target;
 end if;
 return target;
end $$;

create function public.set_default_buyer_address(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();
begin
 if uid is null or not public.is_active(uid) or public.can_sell(uid) then raise exception 'Active buyer account required' using errcode='42501'; end if;
 perform 1 from auth.users where id=uid for update;
 if not exists(select 1 from public.buyer_addresses where id=p_id and buyer_id=uid) then raise exception 'Address unavailable' using errcode='42501'; end if;
 update public.buyer_addresses set is_default=false,updated_at=now() where buyer_id=uid and is_default;
 update public.buyer_addresses set is_default=true,updated_at=now() where id=p_id and buyer_id=uid;
end $$;

create function public.delete_buyer_address(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); was_default boolean;
begin
 if uid is null or not public.is_active(uid) or public.can_sell(uid) then raise exception 'Active buyer account required' using errcode='42501'; end if;
 perform 1 from auth.users where id=uid for update;
 delete from public.buyer_addresses where id=p_id and buyer_id=uid returning is_default into was_default;
 if not found then raise exception 'Address unavailable' using errcode='42501'; end if;
 if was_default then update public.buyer_addresses set is_default=true,updated_at=now() where buyer_id=uid; end if;
end $$;
revoke all on function public.save_buyer_address(uuid,text,text,double precision,double precision,boolean),
 public.set_default_buyer_address(uuid),public.delete_buyer_address(uuid) from public,anon,authenticated;
grant execute on function public.save_buyer_address(uuid,text,text,double precision,double precision,boolean),
 public.set_default_buyer_address(uuid),public.delete_buyer_address(uuid) to authenticated;
commit;
