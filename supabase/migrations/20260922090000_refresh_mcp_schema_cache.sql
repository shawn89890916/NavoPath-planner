-- Refresh PostgREST before MCP token operations resume after deployment.
-- This is non-disruptive and does not modify application data.
select pg_notification_queue_usage();
notify pgrst, 'reload schema';
