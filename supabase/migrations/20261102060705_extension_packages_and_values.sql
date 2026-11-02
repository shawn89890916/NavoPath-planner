-- Private package blobs are immutable by hash and scoped to their account.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('extension-packages', 'extension-packages', false, 20971520, array['application/octet-stream'])
on conflict (id) do nothing;

create policy "Read own extension packages" on storage.objects for select to authenticated
using (bucket_id = 'extension-packages' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Insert own extension packages" on storage.objects for insert to authenticated
with check (bucket_id = 'extension-packages'
  and name ~ ('^' || (select auth.uid())::text || '/[a-f0-9]{64}\.navopackage$'));
create policy "Delete own extension packages" on storage.objects for delete to authenticated
using (bucket_id = 'extension-packages' and (storage.foldername(name))[1] = (select auth.uid())::text);
-- Intentionally no UPDATE policy: callers cannot replace an existing hash.

create table public.navopath_extension_values (
  user_id uuid not null references auth.users(id) on delete cascade,
  extension_key text not null check (length(extension_key) between 1 and 200),
  key text not null check (length(key) between 1 and 500),
  value jsonb not null check (octet_length(value::text) <= 1048576),
  revision bigint not null default 1,
  updated_at timestamptz not null default now(),
  primary key (user_id, extension_key, key)
);
alter table public.navopath_extension_values enable row level security;
create policy "Read own extension values" on public.navopath_extension_values for select to authenticated
using ((select auth.uid()) = user_id);
create policy "Insert own extension values" on public.navopath_extension_values for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy "Update own extension values" on public.navopath_extension_values for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own extension values" on public.navopath_extension_values for delete to authenticated
using ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.navopath_extension_values to authenticated;
revoke all on public.navopath_extension_values from anon;

create function public.touch_extension_value() returns trigger language plpgsql
security invoker set search_path = '' as $$
begin
  new.revision := old.revision + 1;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.touch_extension_value() from public;
create trigger touch_extension_value before update on public.navopath_extension_values
for each row execute function public.touch_extension_value();

-- Include old row identity for cache invalidation on deletion. Clients filter
-- the account explicitly as DELETE events do not support row filters.
alter table public.navopath_extension_values replica identity full;
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'navopath_extension_values') then
    alter publication supabase_realtime add table public.navopath_extension_values;
  end if;
end $$;
notify pgrst, 'reload schema';
