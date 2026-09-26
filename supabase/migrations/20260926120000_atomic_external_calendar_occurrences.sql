create or replace function public.replace_navopath_calendar_occurrences(
  target_user_id uuid,
  target_source_id uuid,
  replacement_occurrences jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if replacement_occurrences is null or jsonb_typeof(replacement_occurrences) <> 'array' then
    raise exception 'Calendar occurrences must be a JSON array';
  end if;

  if not exists (
    select 1
    from public.navopath_calendar_sources
    where id = target_source_id and user_id = target_user_id
  ) then
    raise exception 'Calendar source not found for user';
  end if;

  delete from public.navopath_calendar_occurrences
  where source_id = target_source_id and user_id = target_user_id;

  insert into public.navopath_calendar_occurrences (
    user_id,
    source_id,
    external_uid,
    recurrence_id,
    title,
    description,
    location,
    start_at,
    end_at,
    start_date,
    end_date,
    all_day,
    status
  )
  select
    target_user_id,
    target_source_id,
    item.value ->> 'external_uid',
    coalesce(item.value ->> 'recurrence_id', ''),
    coalesce(item.value ->> 'title', 'Busy'),
    coalesce(item.value ->> 'description', ''),
    coalesce(item.value ->> 'location', ''),
    (item.value ->> 'start_at')::timestamptz,
    (item.value ->> 'end_at')::timestamptz,
    (item.value ->> 'start_date')::date,
    (item.value ->> 'end_date')::date,
    coalesce((item.value ->> 'all_day')::boolean, false),
    coalesce(item.value ->> 'status', 'confirmed')
  from jsonb_array_elements(replacement_occurrences) as item(value);
end;
$$;

revoke all on function public.replace_navopath_calendar_occurrences(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.replace_navopath_calendar_occurrences(uuid, uuid, jsonb) to service_role;
