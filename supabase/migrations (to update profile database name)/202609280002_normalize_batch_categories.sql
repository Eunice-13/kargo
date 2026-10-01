-- Normalize legacy category values before enforcing the canonical list.
update public.batches
set category = 'Food'
where category = 'Food & Beauty';

-- Retain old records without orphaning them from the UI if a retired
-- placeholder category was used before categories were standardized.
update public.batches
set category = 'Mixed'
where category not in ('Food', 'Skincare', 'Grocery & Snacks', 'Beauty', 'Luxury', 'Mixed');

alter table public.batches
  drop constraint if exists batches_category_allowed;

alter table public.batches
  add constraint batches_category_allowed
  check (category in ('Food', 'Skincare', 'Grocery & Snacks', 'Beauty', 'Luxury', 'Mixed'));
