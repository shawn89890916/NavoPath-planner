-- Proactive notification upgrade: minute-level deterministic reminders and
-- persistent daily review messages.
alter table public.navopath_notifications
  drop constraint if exists navopath_notifications_kind_check;

alter table public.navopath_notifications
  add constraint navopath_notifications_kind_check
  check (kind in (
    'summary', 'material_change', 'deadline_risk', 'weather', 'needs_input',
    'gap_check', 'task_start', 'unfinished_tasks', 'daily_review'
  ));

-- The user explicitly chose immediate enablement for existing active accounts.
-- The settings page remains the opt-out control.
update public.navopath_cloud_assistant_settings
set email_enabled = true, updated_at = now()
where enabled = true and email_enabled = false;

notify pgrst, 'reload schema';

alter table public.navopath_assistant_jobs
  drop constraint if exists navopath_assistant_jobs_trigger_check;

alter table public.navopath_assistant_jobs
  add constraint navopath_assistant_jobs_trigger_check
  check (trigger in ('morning', 'evening', 'workspace_event', 'gap_check', 'notification_tick'));

create or replace function public.claim_navopath_assistant_job(
  target_user_id uuid,
  next_idempotency_key text,
  next_trigger text,
  next_event_ids jsonb
)
returns table(job_id uuid, claimed boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.navopath_assistant_jobs%rowtype;
begin
  if next_trigger not in ('morning', 'evening', 'workspace_event', 'gap_check', 'notification_tick') then
    raise exception 'Invalid assistant trigger';
  end if;

  select * into existing
  from public.navopath_assistant_jobs
  where user_id = target_user_id and idempotency_key = next_idempotency_key
  for update;

  if found and existing.status <> 'failed' then
    job_id := existing.id;
    claimed := false;
    return next;
    return;
  end if;

  if found then
    update public.navopath_assistant_jobs
    set status = 'processing', event_ids = coalesce(next_event_ids, '[]'::jsonb),
        model_called = false, result = '{}'::jsonb, failure_reason = null,
        started_at = now(), finished_at = null
    where id = existing.id
    returning id into job_id;
  else
    insert into public.navopath_assistant_jobs(user_id, idempotency_key, trigger, event_ids)
    values (target_user_id, next_idempotency_key, next_trigger, coalesce(next_event_ids, '[]'::jsonb))
    returning id into job_id;
  end if;
  claimed := true;
  return next;
end;
$$;

revoke all on function public.claim_navopath_assistant_job(uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.claim_navopath_assistant_job(uuid, text, text, jsonb) to service_role;

notify pgrst, 'reload schema';
