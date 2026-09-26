-- One heart reaction per authenticated user per batch.

create table if not exists public.batch_reactions (
  batch_id uuid not null references public.batches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (batch_id, user_id)
);

create index if not exists batch_reactions_batch_created_idx
  on public.batch_reactions (batch_id, created_at desc);

alter table public.batch_reactions enable row level security;

drop policy if exists batch_reactions_select_own on public.batch_reactions;
create policy batch_reactions_select_own
  on public.batch_reactions for select to authenticated
  using (user_id = auth.uid());

drop policy if exists batch_reactions_insert_own on public.batch_reactions;
create policy batch_reactions_insert_own
  on public.batch_reactions for insert to authenticated
  with check (user_id = auth.uid() and public.is_active());

drop policy if exists batch_reactions_delete_own on public.batch_reactions;
create policy batch_reactions_delete_own
  on public.batch_reactions for delete to authenticated
  using (user_id = auth.uid() and public.is_active());

-- Public aggregate only: individual users' reactions remain private under RLS.
create or replace view public.batch_reaction_counts
with (security_barrier = true)
as
select
  b.id as batch_id,
  b.created_at as batch_created_at,
  count(br.user_id)::bigint as reaction_count
from public.batches b
left join public.batch_reactions br on br.batch_id = b.id
where b.status <> 'draft'
group by b.id, b.created_at;

revoke all on public.batch_reactions from anon;
grant select, insert, delete on public.batch_reactions to authenticated;
grant select on public.batch_reaction_counts to authenticated;
