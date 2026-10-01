-- ─── Per-batch seller expense bookkeeping ────────────────────────────────────
--
-- Private, seller-only expense record for a batch. Used for the seller's own
-- bookkeeping + printable receipt; NEVER shown to buyers. One record per batch.
--
-- mode:
--   'single'   → total_amount is a manually entered total; items is [].
--   'itemized' → items is an array of line items; total_amount = sum(items.amount).
--
-- items jsonb shape: [{ "label": text, "amount": number, "category"?: text, "date"?: text }]

create table if not exists public.batch_expenses (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches(id) on delete cascade,
  mode text not null default 'single' check (mode in ('single', 'itemized')),
  total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (batch_id)
);
create index if not exists batch_expenses_batch_idx on public.batch_expenses(batch_id);

create trigger batch_expenses_updated_at before update on public.batch_expenses
  for each row execute function public.set_updated_at();

alter table public.batch_expenses enable row level security;

-- Seller-only for EVERY operation, including SELECT: expenses are private
-- bookkeeping and must never be visible to buyers. Ownership is derived from
-- the parent batch's seller_id.
create policy batch_expenses_select_seller on public.batch_expenses for select to authenticated
  using (exists (select 1 from public.batches b where b.id = batch_id and b.seller_id = auth.uid()));
create policy batch_expenses_insert_seller on public.batch_expenses for insert to authenticated
  with check (exists (select 1 from public.batches b where b.id = batch_id and b.seller_id = auth.uid()) and public.can_sell());
create policy batch_expenses_update_seller on public.batch_expenses for update to authenticated
  using (exists (select 1 from public.batches b where b.id = batch_id and b.seller_id = auth.uid()) and public.can_sell())
  with check (exists (select 1 from public.batches b where b.id = batch_id and b.seller_id = auth.uid()));
create policy batch_expenses_delete_seller on public.batch_expenses for delete to authenticated
  using (exists (select 1 from public.batches b where b.id = batch_id and b.seller_id = auth.uid()) and public.can_sell());

revoke all on public.batch_expenses from anon;
grant select, insert, update, delete on public.batch_expenses to authenticated;
grant select, insert, update, delete on public.batch_expenses to service_role;
