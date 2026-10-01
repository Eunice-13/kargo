-- Keep the checked-in schema aligned with the live API table names.
-- PostgreSQL updates tracked foreign keys, views and policies on rename.
-- String-based function bodies require the follow-up function-reference migration.
do $$
begin
  if to_regclass('public.user_profiles') is null
    and to_regclass('public.profiles') is not null then
    alter table public.profiles rename to user_profiles;
  end if;
end
$$;

do $$
begin
  if to_regclass('public.payments') is null
    and to_regclass('public.payment_verification') is not null then
    alter table public.payment_verification rename to payments;
  end if;
end
$$;

grant select, update on public.user_profiles to authenticated;
grant all on public.user_profiles to service_role;
grant select on public.payments to authenticated;
grant all on public.payments to service_role;

notify pgrst, 'reload schema';
