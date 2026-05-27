create table if not exists role_permission_groups (
  role_id uuid not null references roles(id) on delete cascade,
  permission_group_id uuid not null references permission_groups(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_group_id)
);

create index if not exists idx_role_permission_groups_group
  on role_permission_groups(permission_group_id);
