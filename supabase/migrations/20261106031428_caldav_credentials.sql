create table public.navopath_caldav_credentials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  password_hash text not null check (password_hash ~ '^[a-f0-9]{64}$'),
  timezone text not null,
  created_at timestamptz not null default now()
);

alter table public.navopath_caldav_credentials enable row level security;
revoke all on public.navopath_caldav_credentials from public, anon, authenticated;
grant select on public.navopath_caldav_credentials to service_role;

create function public.get_caldav_credential()
returns table(username uuid, timezone text)
language sql stable security definer set search_path = ''
as $$
  select c.user_id, c.timezone
  from public.navopath_caldav_credentials c where c.user_id = auth.uid();
$$;

create function public.create_caldav_credential(password_digest text, connection_timezone text)
returns table(username uuid, timezone text)
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if password_digest is null or password_digest !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid calendar password digest';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = connection_timezone) then
    raise exception 'Invalid calendar time zone';
  end if;
  return query
    insert into public.navopath_caldav_credentials as c (user_id, password_hash, timezone)
    values (auth.uid(), password_digest, connection_timezone)
    on conflict (user_id) do update
      set password_hash = excluded.password_hash, timezone = excluded.timezone, created_at = now()
    returning c.user_id, c.timezone;
end;
$$;

create function public.revoke_caldav_credential()
returns void
language sql security definer set search_path = ''
as $$
  delete from public.navopath_caldav_credentials where user_id = auth.uid();
$$;

revoke all on function public.get_caldav_credential(), public.create_caldav_credential(text, text), public.revoke_caldav_credential() from public, anon, authenticated;
grant execute on function public.get_caldav_credential(), public.create_caldav_credential(text, text), public.revoke_caldav_credential() to authenticated;

notify pgrst, 'reload schema';
