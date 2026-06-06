CREATE TABLE IF NOT EXISTS feishu_departments (
  department_id TEXT PRIMARY KEY,
  open_department_id TEXT UNIQUE,
  parent_department_id TEXT,
  name TEXT NOT NULL,
  i18n_name JSONB,
  leader_user_id TEXT,
  "order" TEXT,
  status JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_payload JSONB NOT NULL,
  last_synced_at TIMESTAMPTZ NOT NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feishu_departments_parent_department_id_idx
  ON feishu_departments (parent_department_id);

CREATE INDEX IF NOT EXISTS feishu_departments_is_deleted_idx
  ON feishu_departments (is_deleted);

CREATE TABLE IF NOT EXISTS feishu_users (
  user_id TEXT PRIMARY KEY,
  open_id TEXT UNIQUE,
  union_id TEXT UNIQUE,
  name TEXT NOT NULL,
  en_name TEXT,
  email TEXT,
  mobile TEXT,
  mobile_visible BOOLEAN,
  avatar JSONB,
  employee_no TEXT,
  employee_type INTEGER,
  job_title TEXT,
  leader_user_id TEXT,
  status JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_payload JSONB NOT NULL,
  last_synced_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feishu_users_is_active_idx
  ON feishu_users (is_active);

CREATE INDEX IF NOT EXISTS feishu_users_is_deleted_idx
  ON feishu_users (is_deleted);

CREATE TABLE IF NOT EXISTS feishu_user_departments (
  user_id TEXT NOT NULL,
  department_id TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  user_order INTEGER,
  department_order INTEGER,
  last_synced_at TIMESTAMPTZ NOT NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, department_id),
  CONSTRAINT feishu_user_departments_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES feishu_users (user_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT feishu_user_departments_department_id_fkey
    FOREIGN KEY (department_id) REFERENCES feishu_departments (department_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS feishu_user_departments_department_id_idx
  ON feishu_user_departments (department_id);

CREATE INDEX IF NOT EXISTS feishu_user_departments_is_deleted_idx
  ON feishu_user_departments (is_deleted);

CREATE TABLE IF NOT EXISTS feishu_sync_runs (
  id TEXT PRIMARY KEY,
  triggered_by TEXT NOT NULL,
  trigger_source TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  department_created_count INTEGER NOT NULL DEFAULT 0,
  department_updated_count INTEGER NOT NULL DEFAULT 0,
  department_deleted_count INTEGER NOT NULL DEFAULT 0,
  user_created_count INTEGER NOT NULL DEFAULT 0,
  user_updated_count INTEGER NOT NULL DEFAULT 0,
  user_deleted_count INTEGER NOT NULL DEFAULT 0,
  relation_created_count INTEGER NOT NULL DEFAULT 0,
  relation_updated_count INTEGER NOT NULL DEFAULT 0,
  relation_deleted_count INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  error_message TEXT,
  error_detail JSONB,
  request_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT feishu_sync_runs_status_check
    CHECK (status IN ('running', 'success', 'failed'))
);

CREATE INDEX IF NOT EXISTS feishu_sync_runs_started_at_idx
  ON feishu_sync_runs (started_at DESC);

CREATE INDEX IF NOT EXISTS feishu_sync_runs_status_idx
  ON feishu_sync_runs (status);

CREATE UNIQUE INDEX IF NOT EXISTS feishu_sync_runs_single_running_idx
  ON feishu_sync_runs (status)
  WHERE status = 'running';

INSERT INTO schema_versions (version, description)
VALUES ('0.2.0', '飞书组织与用户身份镜像同步')
ON CONFLICT (version) DO NOTHING;
