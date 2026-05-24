create table if not exists directory_departments (
  id text primary key,
  name text not null,
  parent_id text references directory_departments(id),
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists directory_users (
  feishu_user_id text primary key references feishu_users(feishu_user_id),
  name text not null,
  email text,
  department_id text references directory_departments(id),
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists application_api_credentials (
  application_id uuid primary key references applications(id),
  api_secret_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists permission_groups (
  id uuid primary key,
  application_id uuid not null references applications(id),
  code text not null,
  name text not null,
  description text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (application_id, code)
);

create table if not exists permission_points (
  id uuid primary key,
  application_id uuid not null references applications(id),
  group_id uuid not null references permission_groups(id),
  code text not null,
  name text not null,
  description text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (application_id, code)
);

create table if not exists roles (
  id uuid primary key,
  application_id uuid not null references applications(id),
  code text not null,
  name text not null,
  description text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (application_id, code)
);

create table if not exists role_permission_points (
  role_id uuid not null references roles(id) on delete cascade,
  permission_point_id uuid not null references permission_points(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_point_id)
);

create table if not exists role_department_bindings (
  role_id uuid not null references roles(id) on delete cascade,
  department_id text not null references directory_departments(id),
  created_at timestamptz not null default now(),
  primary key (role_id, department_id)
);

create table if not exists role_user_bindings (
  role_id uuid not null references roles(id) on delete cascade,
  feishu_user_id text not null references feishu_users(feishu_user_id),
  created_at timestamptz not null default now(),
  primary key (role_id, feishu_user_id)
);

create table if not exists application_api_nonces (
  application_id uuid not null references applications(id) on delete cascade,
  nonce text not null,
  request_timestamp timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (application_id, nonce)
);

insert into directory_departments(id, name, status)
values
  ('dept_it', 'IT 部', 'active'),
  ('dept_sales', '销售部', 'active')
on conflict (id) do nothing;

create index if not exists idx_directory_users_department_status on directory_users(department_id, status);
create index if not exists idx_permission_groups_app_status on permission_groups(application_id, status);
create index if not exists idx_permission_points_app_group_status on permission_points(application_id, group_id, status);
create index if not exists idx_roles_app_status on roles(application_id, status);
create index if not exists idx_role_user_bindings_user on role_user_bindings(feishu_user_id);
create index if not exists idx_role_department_bindings_department on role_department_bindings(department_id);
create index if not exists idx_application_api_nonces_created_at on application_api_nonces(created_at);
