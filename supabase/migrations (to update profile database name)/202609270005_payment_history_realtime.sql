do $$
begin
  alter publication supabase_realtime add table public.payments;
exception
  when duplicate_object then null;
end
$$;
