CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  app_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  owner_user_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT applications_status_check
    CHECK (status IN ('active', 'disabled'))
);

CREATE TABLE IF NOT EXISTS permission_groups (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT permission_groups_application_id_fkey
    FOREIGN KEY (application_id) REFERENCES applications (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT permission_groups_status_check
    CHECK (status IN ('active', 'disabled')),
  CONSTRAINT permission_groups_application_key_unique
    UNIQUE (application_id, key),
  CONSTRAINT permission_groups_application_id_id_unique
    UNIQUE (application_id, id)
);

CREATE TABLE IF NOT EXISTS permission_points (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT permission_points_application_id_fkey
    FOREIGN KEY (application_id) REFERENCES applications (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT permission_points_status_check
    CHECK (status IN ('active', 'disabled')),
  CONSTRAINT permission_points_application_key_unique
    UNIQUE (application_id, key),
  CONSTRAINT permission_points_application_id_id_unique
    UNIQUE (application_id, id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'permission_groups'::regclass
      AND conname = 'permission_groups_application_id_id_unique'
  ) THEN
    ALTER TABLE permission_groups
      ADD CONSTRAINT permission_groups_application_id_id_unique
      UNIQUE (application_id, id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'permission_points'::regclass
      AND conname = 'permission_points_application_id_id_unique'
  ) THEN
    ALTER TABLE permission_points
      ADD CONSTRAINT permission_points_application_id_id_unique
      UNIQUE (application_id, id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS permission_group_points (
  application_id TEXT NOT NULL,
  permission_group_id TEXT NOT NULL,
  permission_point_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (permission_group_id, permission_point_id),
  CONSTRAINT permission_group_points_application_id_fkey
    FOREIGN KEY (application_id) REFERENCES applications (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT permission_group_points_permission_group_id_fkey
    FOREIGN KEY (application_id, permission_group_id)
    REFERENCES permission_groups (application_id, id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT permission_group_points_permission_point_id_fkey
    FOREIGN KEY (application_id, permission_point_id)
    REFERENCES permission_points (application_id, id)
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS iam_roles (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT iam_roles_application_id_fkey
    FOREIGN KEY (application_id) REFERENCES applications (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT iam_roles_status_check
    CHECK (status IN ('active', 'disabled')),
  CONSTRAINT iam_roles_application_key_unique
    UNIQUE (application_id, key),
  CONSTRAINT iam_roles_application_id_id_unique
    UNIQUE (application_id, id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'iam_roles'::regclass
      AND conname = 'iam_roles_application_id_id_unique'
  ) THEN
    ALTER TABLE iam_roles
      ADD CONSTRAINT iam_roles_application_id_id_unique
      UNIQUE (application_id, id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS iam_role_subjects (
  id TEXT PRIMARY KEY,
  iam_role_id TEXT NOT NULL,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  is_orphaned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT iam_role_subjects_iam_role_id_fkey
    FOREIGN KEY (iam_role_id) REFERENCES iam_roles (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT iam_role_subjects_subject_type_check
    CHECK (subject_type IN ('feishu_user', 'feishu_department')),
  CONSTRAINT iam_role_subjects_role_subject_unique
    UNIQUE (iam_role_id, subject_type, subject_id)
);

CREATE TABLE IF NOT EXISTS iam_role_permission_groups (
  application_id TEXT NOT NULL,
  iam_role_id TEXT NOT NULL,
  permission_group_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (iam_role_id, permission_group_id),
  CONSTRAINT iam_role_permission_groups_application_id_fkey
    FOREIGN KEY (application_id) REFERENCES applications (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT iam_role_permission_groups_iam_role_id_fkey
    FOREIGN KEY (application_id, iam_role_id)
    REFERENCES iam_roles (application_id, id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT iam_role_permission_groups_permission_group_id_fkey
    FOREIGN KEY (application_id, permission_group_id)
    REFERENCES permission_groups (application_id, id)
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS iam_role_permission_points (
  application_id TEXT NOT NULL,
  iam_role_id TEXT NOT NULL,
  permission_point_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (iam_role_id, permission_point_id),
  CONSTRAINT iam_role_permission_points_application_id_fkey
    FOREIGN KEY (application_id) REFERENCES applications (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT iam_role_permission_points_iam_role_id_fkey
    FOREIGN KEY (application_id, iam_role_id)
    REFERENCES iam_roles (application_id, id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT iam_role_permission_points_permission_point_id_fkey
    FOREIGN KEY (application_id, permission_point_id)
    REFERENCES permission_points (application_id, id)
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  source TEXT NOT NULL,
  application_id TEXT,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  action TEXT NOT NULL,
  before JSONB,
  after JSONB,
  result TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  request_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT audit_logs_application_id_fkey
    FOREIGN KEY (application_id) REFERENCES applications (id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT audit_logs_result_check
    CHECK (result IN ('success', 'failed'))
);

ALTER TABLE permission_group_points
  ADD COLUMN IF NOT EXISTS application_id TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM permission_group_points pgp
    JOIN permission_groups pg ON pg.id = pgp.permission_group_id
    JOIN permission_points pp ON pp.id = pgp.permission_point_id
    WHERE pg.application_id <> pp.application_id
       OR (
         pgp.application_id IS NOT NULL
         AND pgp.application_id <> pg.application_id
       )
  ) THEN
    RAISE EXCEPTION 'permission_group_points contains cross-application bindings';
  END IF;
END $$;

UPDATE permission_group_points pgp
SET application_id = pg.application_id
FROM permission_groups pg
WHERE pg.id = pgp.permission_group_id
  AND pgp.application_id IS NULL;

ALTER TABLE permission_group_points
  ALTER COLUMN application_id SET NOT NULL;

ALTER TABLE permission_group_points
  DROP CONSTRAINT IF EXISTS permission_group_points_permission_group_id_fkey,
  DROP CONSTRAINT IF EXISTS permission_group_points_permission_point_id_fkey;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'permission_group_points'::regclass
      AND conname = 'permission_group_points_application_id_fkey'
  ) THEN
    ALTER TABLE permission_group_points
      ADD CONSTRAINT permission_group_points_application_id_fkey
      FOREIGN KEY (application_id) REFERENCES applications (id)
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'permission_group_points'::regclass
      AND conname = 'permission_group_points_permission_group_id_fkey'
  ) THEN
    ALTER TABLE permission_group_points
      ADD CONSTRAINT permission_group_points_permission_group_id_fkey
      FOREIGN KEY (application_id, permission_group_id)
      REFERENCES permission_groups (application_id, id)
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'permission_group_points'::regclass
      AND conname = 'permission_group_points_permission_point_id_fkey'
  ) THEN
    ALTER TABLE permission_group_points
      ADD CONSTRAINT permission_group_points_permission_point_id_fkey
      FOREIGN KEY (application_id, permission_point_id)
      REFERENCES permission_points (application_id, id)
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE iam_role_permission_groups
  ADD COLUMN IF NOT EXISTS application_id TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM iam_role_permission_groups irpg
    JOIN iam_roles ir ON ir.id = irpg.iam_role_id
    JOIN permission_groups pg ON pg.id = irpg.permission_group_id
    WHERE ir.application_id <> pg.application_id
       OR (
         irpg.application_id IS NOT NULL
         AND irpg.application_id <> ir.application_id
       )
  ) THEN
    RAISE EXCEPTION 'iam_role_permission_groups contains cross-application bindings';
  END IF;
END $$;

UPDATE iam_role_permission_groups irpg
SET application_id = ir.application_id
FROM iam_roles ir
WHERE ir.id = irpg.iam_role_id
  AND irpg.application_id IS NULL;

ALTER TABLE iam_role_permission_groups
  ALTER COLUMN application_id SET NOT NULL;

ALTER TABLE iam_role_permission_groups
  DROP CONSTRAINT IF EXISTS iam_role_permission_groups_iam_role_id_fkey,
  DROP CONSTRAINT IF EXISTS iam_role_permission_groups_permission_group_id_fkey;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'iam_role_permission_groups'::regclass
      AND conname = 'iam_role_permission_groups_application_id_fkey'
  ) THEN
    ALTER TABLE iam_role_permission_groups
      ADD CONSTRAINT iam_role_permission_groups_application_id_fkey
      FOREIGN KEY (application_id) REFERENCES applications (id)
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'iam_role_permission_groups'::regclass
      AND conname = 'iam_role_permission_groups_iam_role_id_fkey'
  ) THEN
    ALTER TABLE iam_role_permission_groups
      ADD CONSTRAINT iam_role_permission_groups_iam_role_id_fkey
      FOREIGN KEY (application_id, iam_role_id)
      REFERENCES iam_roles (application_id, id)
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'iam_role_permission_groups'::regclass
      AND conname = 'iam_role_permission_groups_permission_group_id_fkey'
  ) THEN
    ALTER TABLE iam_role_permission_groups
      ADD CONSTRAINT iam_role_permission_groups_permission_group_id_fkey
      FOREIGN KEY (application_id, permission_group_id)
      REFERENCES permission_groups (application_id, id)
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE iam_role_permission_points
  ADD COLUMN IF NOT EXISTS application_id TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM iam_role_permission_points irpp
    JOIN iam_roles ir ON ir.id = irpp.iam_role_id
    JOIN permission_points pp ON pp.id = irpp.permission_point_id
    WHERE ir.application_id <> pp.application_id
       OR (
         irpp.application_id IS NOT NULL
         AND irpp.application_id <> ir.application_id
       )
  ) THEN
    RAISE EXCEPTION 'iam_role_permission_points contains cross-application bindings';
  END IF;
END $$;

UPDATE iam_role_permission_points irpp
SET application_id = ir.application_id
FROM iam_roles ir
WHERE ir.id = irpp.iam_role_id
  AND irpp.application_id IS NULL;

ALTER TABLE iam_role_permission_points
  ALTER COLUMN application_id SET NOT NULL;

ALTER TABLE iam_role_permission_points
  DROP CONSTRAINT IF EXISTS iam_role_permission_points_iam_role_id_fkey,
  DROP CONSTRAINT IF EXISTS iam_role_permission_points_permission_point_id_fkey;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'iam_role_permission_points'::regclass
      AND conname = 'iam_role_permission_points_application_id_fkey'
  ) THEN
    ALTER TABLE iam_role_permission_points
      ADD CONSTRAINT iam_role_permission_points_application_id_fkey
      FOREIGN KEY (application_id) REFERENCES applications (id)
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'iam_role_permission_points'::regclass
      AND conname = 'iam_role_permission_points_iam_role_id_fkey'
  ) THEN
    ALTER TABLE iam_role_permission_points
      ADD CONSTRAINT iam_role_permission_points_iam_role_id_fkey
      FOREIGN KEY (application_id, iam_role_id)
      REFERENCES iam_roles (application_id, id)
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'iam_role_permission_points'::regclass
      AND conname = 'iam_role_permission_points_permission_point_id_fkey'
  ) THEN
    ALTER TABLE iam_role_permission_points
      ADD CONSTRAINT iam_role_permission_points_permission_point_id_fkey
      FOREIGN KEY (application_id, permission_point_id)
      REFERENCES permission_points (application_id, id)
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS permission_groups_application_id_idx
  ON permission_groups (application_id);

CREATE INDEX IF NOT EXISTS permission_points_application_id_idx
  ON permission_points (application_id);

CREATE INDEX IF NOT EXISTS permission_group_points_permission_point_id_idx
  ON permission_group_points (permission_point_id);

CREATE INDEX IF NOT EXISTS permission_group_points_application_id_idx
  ON permission_group_points (application_id);

CREATE INDEX IF NOT EXISTS iam_roles_application_id_idx
  ON iam_roles (application_id);

CREATE INDEX IF NOT EXISTS iam_role_subjects_subject_idx
  ON iam_role_subjects (subject_type, subject_id);

CREATE INDEX IF NOT EXISTS iam_role_permission_groups_permission_group_id_idx
  ON iam_role_permission_groups (permission_group_id);

CREATE INDEX IF NOT EXISTS iam_role_permission_groups_application_id_idx
  ON iam_role_permission_groups (application_id);

CREATE INDEX IF NOT EXISTS iam_role_permission_points_permission_point_id_idx
  ON iam_role_permission_points (permission_point_id);

CREATE INDEX IF NOT EXISTS iam_role_permission_points_application_id_idx
  ON iam_role_permission_points (application_id);

CREATE INDEX IF NOT EXISTS audit_logs_application_id_created_at_idx
  ON audit_logs (application_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_logs_resource_idx
  ON audit_logs (resource_type, resource_id);

CREATE INDEX IF NOT EXISTS audit_logs_request_id_idx
  ON audit_logs (request_id);

INSERT INTO schema_versions (version, description)
VALUES ('0.3.0', '应用与权限模型')
ON CONFLICT (version) DO NOTHING;
