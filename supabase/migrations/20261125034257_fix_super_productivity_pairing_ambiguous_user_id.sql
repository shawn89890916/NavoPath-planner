-- Disambiguate the output parameter user_id from the sync state primary key.
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
    values (target_user) on conflict on constraint navopath_sp_sync_state_pkey do nothing;
  select s.pair_id into target_pair from public.navopath_sp_sync_state s where s.user_id = target_user;
  insert into public.navopath_sp_sync_tokens(user_id, token_hash, token_prefix)
    values (target_user, new_token_hash, new_token_prefix) returning id into created_token;
  return query select target_user, created_token, target_pair;
end; $$;
revoke all on function public.exchange_navopath_sp_pairing_code(text, text, text) from public, anon, authenticated;
grant execute on function public.exchange_navopath_sp_pairing_code(text, text, text) to service_role;

notify pgrst, 'reload schema';
