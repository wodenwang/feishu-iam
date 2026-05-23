create extension if not exists pgcrypto;

create table if not exists schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);

create table if not exists feishu_users (
  feishu_user_id text primary key,
  name text not null,
  email text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists platform_admins (
  id bigserial primary key,
  feishu_user_id text not null references feishu_users(feishu_user_id),
  created_at timestamptz not null default now(),
  unique (feishu_user_id)
);

create table if not exists iam_sessions (
  token_hash text primary key,
  feishu_user_id text not null references feishu_users(feishu_user_id),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists applications (
  id uuid primary key,
  app_key text not null unique,
  name text not null unique,
  status text not null default 'active',
  created_by_feishu_user_id text not null references feishu_users(feishu_user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists application_secrets (
  application_id uuid primary key references applications(id),
  secret_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id bigserial primary key,
  request_id text not null,
  actor_feishu_user_id text,
  action text not null,
  target_type text not null,
  target_id text,
  result text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_created_at on audit_logs(created_at desc);
create index if not exists idx_audit_logs_actor_id on audit_logs(actor_feishu_user_id);
create index if not exists idx_applications_status on applications(status);
