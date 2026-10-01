alter table public.reviews
  add column if not exists quick_statements text[] not null default '{}';

alter table public.profiles
  add column if not exists can_sell boolean not null default false,
  add column if not exists social_visibility jsonb not null default '{}'::jsonb;

update public.profiles set can_sell = true where bir_status = 'verified';

create or replace function public.complete_bir_verification(
  p_user_id uuid,
  p_expected_object_path text,
  p_status public.bir_status,
  p_flag_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed integer;
begin
  if p_status not in ('verified', 'none') then raise exception 'Invalid terminal BIR status'; end if;
  update public.profiles
  set bir_status = p_status,
      bir_document_path = case when p_status = 'verified' then bir_document_path else null end,
      bir_flag_reason = null,
      bir_checked_at = now()
  where id = p_user_id
    and bir_status = 'pending'
    and bir_document_path = p_expected_object_path;
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

drop function if exists public.create_order_review(uuid, smallint, text);

create function public.create_order_review(
  p_order_id uuid,
  p_rating smallint,
  p_comment text default null,
  p_quick_statements text[] default '{}'
)
returns public.reviews
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.orders;
  result public.reviews;
  existing public.reviews;
  reviewee uuid;
begin
  if p_rating < 1 or p_rating > 5 then raise exception 'Rating must be between 1 and 5'; end if;
  if length(trim(coalesce(p_comment, ''))) < 10 then raise exception 'Written review must be at least 10 characters'; end if;
  if coalesce(cardinality(p_quick_statements), 0) < 1 then raise exception 'Select at least one quick statement'; end if;
  select * into target from public.orders where id = p_order_id and status = 'completed';
  if not found or auth.uid() not in (target.buyer_id, target.seller_id) then
    raise exception 'Completed order not found';
  end if;
  reviewee := case when auth.uid() = target.buyer_id then target.seller_id else target.buyer_id end;
  select * into existing from public.reviews where order_id = target.id and reviewer_id = auth.uid();
  if found then
    if existing.created_at < now() - interval '24 hours' then raise exception 'Review editing period has ended'; end if;
    update public.reviews
      set rating = p_rating,
          comment = trim(p_comment),
          quick_statements = p_quick_statements,
          updated_at = now()
      where id = existing.id
      returning * into result;
  else
    insert into public.reviews (order_id, reviewer_id, reviewee_id, rating, comment, quick_statements)
    values (target.id, auth.uid(), reviewee, p_rating, trim(p_comment), p_quick_statements)
    returning * into result;
    insert into public.notifications (recipient_id, category, message, target_path, context)
    values (reviewee, 'star', 'You received a ' || p_rating || '-star review', 'Orders', jsonb_build_object('order_id', target.id));
  end if;
  return result;
end;
$$;

revoke all on function public.create_order_review(uuid, smallint, text, text[]) from public;
grant execute on function public.create_order_review(uuid, smallint, text, text[]) to authenticated;

create or replace view public.public_profiles as
select
  p.id,
  p.display_name,
  p.bio,
  p.shop_name,
  coalesce((
    select jsonb_object_agg(link.key, link.value)
    from jsonb_each(p.social_links) as link
    where coalesce((p.social_visibility ->> link.key)::boolean, true)
  ), '{}'::jsonb) as social_links,
  p.avatar_path,
  p.bir_status,
  p.created_at
from public.profiles p
where p.account_status = 'active';

insert into storage.buckets (id, name, public)
values ('profile-avatars', 'profile-avatars', true)
on conflict (id) do update set public = excluded.public;

create policy profile_avatars_public_read on storage.objects for select
  using (bucket_id = 'profile-avatars');

create policy profile_avatars_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy profile_avatars_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'profile-avatars' and owner_id = auth.uid()::text)
  with check (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text);
