-- The application reads seller bookkeeping directly from batch_expenses when
-- the financial summary is opened, so this aggregate view is unnecessary.
drop view if exists public.seller_batch_expense_totals;
