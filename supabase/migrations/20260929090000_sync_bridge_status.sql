create table if not exists public.navopath_sync_bridge_status (
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  device_name text not null,
  folder_path text not null,
  status text not null check (status in ('running', 'error', 'stopped')),
  last_success_at timestamptz,
  last_seen_at timestamptz not null default now(),
  error text,
  primary key (user_id, device_id)
);

alter table public.navopath_sync_bridge_status enable row level security;

create policy "Users can read their sync bridge status"
  on public.navopath_sync_bridge_status for select to authenticated
  using (user_id = (select auth.uid()));

grant select on public.navopath_sync_bridge_status to authenticated;
grant select, insert, update on public.navopath_sync_bridge_status to service_role;
