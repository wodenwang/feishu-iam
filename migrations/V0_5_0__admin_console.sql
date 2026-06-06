CREATE TABLE IF NOT EXISTS admin_users (
  id text PRIMARY KEY,
  feishu_user_id text NOT NULL REFERENCES feishu_users(user_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  display_name text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_users_feishu_user_id_unique UNIQUE (feishu_user_id),
  CONSTRAINT admin_users_status_check CHECK (status IN ('active', 'disabled'))
);

CREATE TABLE IF NOT EXISTS admin_roles (
  id text PRIMARY KEY,
  role_key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_roles_role_key_check CHECK (role_key IN ('platform_admin', 'application_admin', 'audit_viewer', 'sync_admin'))
);

CREATE TABLE IF NOT EXISTS admin_user_roles (
  admin_user_id text NOT NULL REFERENCES admin_users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  admin_role_id text NOT NULL REFERENCES admin_roles(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (admin_user_id, admin_role_id)
);

CREATE TABLE IF NOT EXISTS admin_application_scopes (
  admin_user_id text NOT NULL REFERENCES admin_users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  application_id text NOT NULL REFERENCES applications(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (admin_user_id, application_id)
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id text PRIMARY KEY,
  session_hash text NOT NULL UNIQUE,
  admin_user_id text NOT NULL REFERENCES admin_users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

CREATE INDEX IF NOT EXISTS admin_users_status_idx ON admin_users(status);
CREATE INDEX IF NOT EXISTS admin_user_roles_admin_role_id_idx ON admin_user_roles(admin_role_id);
CREATE INDEX IF NOT EXISTS admin_application_scopes_application_id_idx ON admin_application_scopes(application_id);
CREATE INDEX IF NOT EXISTS admin_sessions_admin_user_id_idx ON admin_sessions(admin_user_id);
CREATE INDEX IF NOT EXISTS admin_sessions_expires_at_idx ON admin_sessions(expires_at);

INSERT INTO admin_roles(id, role_key, name, description)
VALUES
  ('admin-role-platform-admin', 'platform_admin', '平台管理员', '管理全部应用、管理员、同步、审计和接入配置'),
  ('admin-role-application-admin', 'application_admin', '应用管理员', '管理被授权应用的权限、角色、回调地址和 client'),
  ('admin-role-audit-viewer', 'audit_viewer', '审计查看员', '只读查看审计日志和安全事件'),
  ('admin-role-sync-admin', 'sync_admin', '同步管理员', '查看和触发飞书同步')
ON CONFLICT (role_key) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    updated_at = now();

INSERT INTO schema_versions(version, description)
VALUES ('0.5.0', '管理后台与管理员体系最小闭环')
ON CONFLICT (version) DO NOTHING;
