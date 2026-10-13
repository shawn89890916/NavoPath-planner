-- This function is only used by the dayflow_profiles INSERT trigger.
-- Keep SECURITY DEFINER for the trigger's assistant-settings insert, but do not
-- expose it as an anonymous or authenticated PostgREST RPC.
-- Revoke explicit grants as well as the inherited PUBLIC grant, so a fresh
-- environment has the same trigger-only permissions as production.
revoke execute on function public.seed_navopath_cloud_assistant_settings()
  from public, anon, authenticated, service_role;
