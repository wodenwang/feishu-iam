create table if not exists application_oauth_redirect_uris (
  application_id uuid not null references applications(id) on delete cascade,
  redirect_uri text not null,
  created_at timestamptz not null default now(),
  primary key (application_id, redirect_uri)
);

create table if not exists application_oauth_authorization_codes (
  code_hash text primary key,
  application_id uuid not null references applications(id) on delete cascade,
  redirect_uri text not null,
  feishu_user_id text not null references feishu_users(feishu_user_id),
  state text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists application_oauth_sessions (
  token_hash text primary key,
  application_id uuid not null references applications(id) on delete cascade,
  feishu_user_id text not null references feishu_users(feishu_user_id),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

insert into application_oauth_redirect_uris(application_id, redirect_uri)
select id, 'http://127.0.0.1:4200/oauth/callback'
from applications
on conflict do nothing;

create index if not exists idx_application_oauth_codes_app_user on application_oauth_authorization_codes(application_id, feishu_user_id);
create index if not exists idx_application_oauth_codes_expiry on application_oauth_authorization_codes(expires_at);
create index if not exists idx_application_oauth_sessions_app_user on application_oauth_sessions(application_id, feishu_user_id);
create index if not exists idx_application_oauth_sessions_expiry on application_oauth_sessions(expires_at);
