DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM iam_roles
    GROUP BY key
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'iam_roles contains duplicate keys; merge or rename roles before applying v1.0.5';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS iam_role_applications (
  iam_role_id TEXT NOT NULL,
  application_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (iam_role_id, application_id),
  CONSTRAINT iam_role_applications_status_check
    CHECK (status IN ('active', 'disabled')),
  CONSTRAINT iam_role_applications_iam_role_id_fkey
    FOREIGN KEY (iam_role_id) REFERENCES iam_roles (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT iam_role_applications_application_id_fkey
    FOREIGN KEY (application_id) REFERENCES applications (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'iam_roles'
      AND column_name = 'application_id'
  ) THEN
    INSERT INTO iam_role_applications (
      iam_role_id,
      application_id,
      status,
      created_at,
      updated_at
    )
    SELECT
      id,
      application_id,
      'active',
      created_at,
      updated_at
    FROM iam_roles
    WHERE application_id IS NOT NULL
    ON CONFLICT (iam_role_id, application_id) DO NOTHING;
  END IF;
END $$;

ALTER TABLE iam_role_permission_groups
  DROP CONSTRAINT IF EXISTS iam_role_permission_groups_iam_role_id_fkey;

ALTER TABLE iam_role_permission_points
  DROP CONSTRAINT IF EXISTS iam_role_permission_points_iam_role_id_fkey;

ALTER TABLE iam_role_permission_groups
  DROP CONSTRAINT IF EXISTS iam_role_permission_groups_pkey;

ALTER TABLE iam_role_permission_points
  DROP CONSTRAINT IF EXISTS iam_role_permission_points_pkey;

ALTER TABLE iam_role_permission_groups
  ADD CONSTRAINT iam_role_permission_groups_pkey
  PRIMARY KEY (application_id, iam_role_id, permission_group_id);

ALTER TABLE iam_role_permission_points
  ADD CONSTRAINT iam_role_permission_points_pkey
  PRIMARY KEY (application_id, iam_role_id, permission_point_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'iam_role_permission_groups_role_application_fkey'
      AND conrelid = 'iam_role_permission_groups'::regclass
  ) THEN
    ALTER TABLE iam_role_permission_groups
      ADD CONSTRAINT iam_role_permission_groups_role_application_fkey
      FOREIGN KEY (iam_role_id, application_id)
      REFERENCES iam_role_applications (iam_role_id, application_id)
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'iam_role_permission_points_role_application_fkey'
      AND conrelid = 'iam_role_permission_points'::regclass
  ) THEN
    ALTER TABLE iam_role_permission_points
      ADD CONSTRAINT iam_role_permission_points_role_application_fkey
      FOREIGN KEY (iam_role_id, application_id)
      REFERENCES iam_role_applications (iam_role_id, application_id)
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DROP INDEX IF EXISTS iam_roles_application_id_idx;

ALTER TABLE iam_roles
  DROP CONSTRAINT IF EXISTS iam_roles_application_key_unique;

ALTER TABLE iam_roles
  DROP CONSTRAINT IF EXISTS iam_roles_application_id_id_unique;

ALTER TABLE iam_roles
  DROP CONSTRAINT IF EXISTS iam_roles_application_id_fkey;

ALTER TABLE iam_roles
  DROP COLUMN IF EXISTS application_id;

CREATE UNIQUE INDEX IF NOT EXISTS iam_roles_key_unique
  ON iam_roles (key);

CREATE INDEX IF NOT EXISTS iam_role_applications_application_id_idx
  ON iam_role_applications (application_id);

CREATE INDEX IF NOT EXISTS iam_role_applications_status_idx
  ON iam_role_applications (status);

INSERT INTO schema_versions(version, description)
VALUES ('1.0.5', '角色全局化与角色应用多对多绑定')
ON CONFLICT (version) DO NOTHING;
