create table if not exists application_oauth_pending_requests (
  pending_token_hash text primary key,
  client_id text not null,
  redirect_uri text not null,
  state text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_application_oauth_pending_expiry on application_oauth_pending_requests(expires_at);
