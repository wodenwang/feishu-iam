create table if not exists sync_runs (
  id uuid primary key,
  trigger text not null,
  status text not null,
  operator_feishu_user_id text not null references feishu_users(feishu_user_id),
  request_id text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error_message text,
  request_batch_count int not null default 0,
  success_count int not null default 0,
  failed_count int not null default 0,
  diff_summary jsonb not null default '{}'::jsonb,
  retry_of uuid references sync_runs(id)
);

create index if not exists idx_sync_runs_started_at on sync_runs(started_at desc);
create index if not exists idx_sync_runs_status on sync_runs(status);

alter table directory_users add column if not exists mobile text;
