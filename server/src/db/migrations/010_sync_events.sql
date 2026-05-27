create table if not exists sync_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  event_type text not null,
  resource_type text,
  resource_id text,
  status text not null,
  request_id text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  sync_run_id uuid references sync_runs(id),
  error_message text,
  payload_summary jsonb not null default '{}'::jsonb
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sync_events_status_check'
  ) then
    alter table sync_events
      add constraint sync_events_status_check
      check (status in ('pending_sync', 'processed', 'failed', 'ignored'));
  end if;
end $$;

create index if not exists idx_sync_events_received_at on sync_events(received_at desc);
create index if not exists idx_sync_events_status on sync_events(status);
create index if not exists idx_sync_events_resource on sync_events(resource_type, resource_id);
