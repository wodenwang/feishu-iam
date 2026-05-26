create table if not exists application_admins (
  application_id uuid not null references applications(id) on delete cascade,
  feishu_user_id text not null references feishu_users(feishu_user_id),
  created_by_feishu_user_id text not null references feishu_users(feishu_user_id),
  created_at timestamptz not null default now(),
  primary key (application_id, feishu_user_id)
);

create index if not exists idx_application_admins_user on application_admins(feishu_user_id);
create index if not exists idx_application_admins_application on application_admins(application_id);
