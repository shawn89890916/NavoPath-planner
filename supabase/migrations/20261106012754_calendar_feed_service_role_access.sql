grant select on table public.navopath_calendar_tokens to service_role;
grant update (last_used_at) on table public.navopath_calendar_tokens to service_role;

notify pgrst, 'reload schema';
