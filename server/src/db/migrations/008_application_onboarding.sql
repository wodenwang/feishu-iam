alter table application_oauth_redirect_uris
  add column if not exists status text not null default 'active',
  add column if not exists environment text not null default 'local',
  add column if not exists note text not null default '',
  add column if not exists created_by_feishu_user_id text references feishu_users(feishu_user_id),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists disabled_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'application_oauth_redirect_uris_status_check'
  ) then
    alter table application_oauth_redirect_uris
      add constraint application_oauth_redirect_uris_status_check check (status in ('active', 'disabled'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'application_oauth_redirect_uris_environment_check'
  ) then
    alter table application_oauth_redirect_uris
      add constraint application_oauth_redirect_uris_environment_check check (environment in ('production', 'staging', 'local'));
  end if;
end $$;

alter table application_secrets
  add column if not exists updated_at timestamptz not null default now();

alter table application_api_credentials
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_application_oauth_redirect_uris_app_status
  on application_oauth_redirect_uris(application_id, status);
