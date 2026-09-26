-- Consolidate batch categories to the new 5-category taxonomy:
--   Food, Beauty, Luxury, Apparel, Others
--
--   Grocery & Snacks -> Food
--   Skincare         -> Beauty
--   Mixed            -> Others
--
-- The CHECK constraint from 202609280002 pins categories to the old 6, so the
-- allowed list must be widened BEFORE (or together with) the remap. We drop the
-- constraint first, remap existing rows, then re-add the constraint with the
-- new list. Idempotent: safe to re-run.

-- 1. Drop the old constraint so remaps and new inserts are not blocked.
alter table public.batches
  drop constraint if exists batches_category_allowed;

-- 2. Remap any legacy values to their new home. Also catch any stray value
--    outside the new list so the constraint below cannot fail.
update public.batches set category = 'Food'   where category = 'Grocery & Snacks';
update public.batches set category = 'Beauty' where category = 'Skincare';
update public.batches set category = 'Others' where category = 'Mixed';
update public.batches
  set category = 'Others'
  where category not in ('Food', 'Beauty', 'Luxury', 'Apparel', 'Others');

-- 3. Enforce the new canonical list.
alter table public.batches
  add constraint batches_category_allowed
  check (category in ('Food', 'Beauty', 'Luxury', 'Apparel', 'Others'));
