create or replace function public.set_batch_reaction(
  p_batch_id uuid,
  p_reacted boolean
)
returns table (reacted boolean, reaction_count bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_active(v_user_id) then
    raise exception 'This account cannot react to batches';
  end if;

  if not exists (
    select 1
    from public.batches b
    where b.id = p_batch_id
      and b.status <> 'draft'
  ) then
    raise exception 'Batch not found';
  end if;

  if p_reacted then
    insert into public.batch_reactions (batch_id, user_id)
    values (p_batch_id, v_user_id)
    on conflict (batch_id, user_id) do nothing;
  else
    delete from public.batch_reactions br
    where br.batch_id = p_batch_id
      and br.user_id = v_user_id;
  end if;

  return query
  select
    exists (
      select 1
      from public.batch_reactions own_reaction
      where own_reaction.batch_id = p_batch_id
        and own_reaction.user_id = v_user_id
    ),
    count(*)::bigint
  from public.batch_reactions all_reactions
  where all_reactions.batch_id = p_batch_id;
end;
$$;

revoke all on function public.set_batch_reaction(uuid, boolean) from public;
grant execute on function public.set_batch_reaction(uuid, boolean) to authenticated;
