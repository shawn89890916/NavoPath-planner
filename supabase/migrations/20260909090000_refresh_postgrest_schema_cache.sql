-- Rebuild PostgREST's schema cache after the Agent audit tables are deployed.
-- This is safe to run repeatedly and does not modify application data.
select pg_notification_queue_usage();
notify pgrst, 'reload schema';
