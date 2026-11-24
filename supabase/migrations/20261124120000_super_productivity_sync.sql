create table if not exists public.navopath_sp_pairing_codes (
  code_hash text primary key check (code_hash ~ '^[a-f0-9]{64}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz
);
alter table public.navopath_sp_pairing_codes enable row level security;
revoke all on public.navopath_sp_pairing_codes from anon, authenticated;
grant insert on public.navopath_sp_pairing_codes to authenticated;
create policy "Insert own Super Productivity pairing codes"
  on public.navopath_sp_pairing_codes for insert to authenticated
  with check ((select auth.uid()) = user_id);

create table if not exists public.navopath_sp_sync_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  token_prefix text not null check (char_length(token_prefix) between 6 and 20),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
alter table public.navopath_sp_sync_tokens enable row level security;
revoke all on public.navopath_sp_sync_tokens from anon, authenticated;
grant select, insert, update, delete on public.navopath_sp_sync_tokens to service_role;

create table if not exists public.navopath_sp_sync_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pair_id uuid not null unique default gen_random_uuid(),
  state jsonb not null default '{"status":"waiting","latest":{},"canonical":{},"pending":{},"conflicts":[],"baseRevision":0}'::jsonb check (octet_length(state::text) <= 10485760),
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.navopath_sp_sync_state enable row level security;
revoke all on public.navopath_sp_sync_state from anon, authenticated;
grant select, insert, update, delete on public.navopath_sp_sync_state to service_role;

create or replace function public.exchange_navopath_sp_pairing_code(pairing_code_hash text, new_token_hash text, new_token_prefix text)
returns table(user_id uuid, token_id uuid, pair_id uuid)
language plpgsql security definer set search_path = public, auth as $$
declare
  target_user uuid;
  target_pair uuid;
  created_token uuid;
begin
  if pairing_code_hash !~ '^[a-f0-9]{64}$' or new_token_hash !~ '^[a-f0-9]{64}$'
    or new_token_prefix not like 'nvs\_%' then raise exception 'Invalid pairing request'; end if;
  update public.navopath_sp_pairing_codes
    set consumed_at = now()
    where code_hash = pairing_code_hash and consumed_at is null and expires_at > now()
    returning navopath_sp_pairing_codes.user_id into target_user;
  if target_user is null then raise exception 'Pairing code is invalid or expired'; end if;
  insert into public.navopath_sp_sync_state(user_id)
    values (target_user) on conflict (user_id) do nothing;
  select s.pair_id into target_pair from public.navopath_sp_sync_state s where s.user_id = target_user;
  insert into public.navopath_sp_sync_tokens(user_id, token_hash, token_prefix)
    values (target_user, new_token_hash, new_token_prefix) returning id into created_token;
  return query select target_user, created_token, target_pair;
end; $$;
revoke all on function public.exchange_navopath_sp_pairing_code(text, text, text) from public, anon, authenticated;
grant execute on function public.exchange_navopath_sp_pairing_code(text, text, text) to service_role;

create or replace function public.save_navopath_sp_sync_state(target_user_id uuid, expected_revision bigint, next_state jsonb)
returns table(pair_id uuid, state jsonb, revision bigint)
language plpgsql security definer set search_path = public, auth as $$
begin
  if octet_length(next_state::text) > 10485760 then raise exception 'Sync state exceeds 10 MB'; end if;
  return query update public.navopath_sp_sync_state s
    set state = next_state, revision = s.revision + 1, updated_at = now()
    where s.user_id = target_user_id and s.revision = expected_revision
    returning s.pair_id, s.state, s.revision;
end; $$;
revoke all on function public.save_navopath_sp_sync_state(uuid, bigint, jsonb) from public, anon, authenticated;
grant execute on function public.save_navopath_sp_sync_state(uuid, bigint, jsonb) to service_role;

create or replace function public.revoke_navopath_sp_sync_pair(target_user_id uuid, target_pair_id uuid)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  update public.navopath_sp_sync_tokens set revoked_at = now()
    where user_id = target_user_id and revoked_at is null;
  delete from public.navopath_sp_sync_state where user_id = target_user_id and pair_id = target_pair_id;
  delete from public.navopath_sp_pairing_codes where user_id = target_user_id;
end; $$;
revoke all on function public.revoke_navopath_sp_sync_pair(uuid, uuid) from public, anon, authenticated;
grant execute on function public.revoke_navopath_sp_sync_pair(uuid, uuid) to service_role;

notify pgrst, 'reload schema';
