ALTER TABLE application_redirect_uris
  ADD COLUMN IF NOT EXISTS source_environment_id text;

UPDATE application_redirect_uris
SET source_environment_id = environment_id
WHERE source_environment_id IS NULL;

ALTER TABLE application_clients
  ADD COLUMN IF NOT EXISTS source_environment_id text,
  ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

UPDATE application_clients
SET source_environment_id = environment_id
WHERE source_environment_id IS NULL;

WITH ranked_clients AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY application_id
      ORDER BY
        CASE WHEN status = 'active' THEN 0 ELSE 1 END,
        last_used_at DESC NULLS LAST,
        created_at DESC,
        id ASC
    ) AS rn
  FROM application_clients
  WHERE revoked_at IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM application_clients existing_primary
      WHERE existing_primary.application_id = application_clients.application_id
        AND existing_primary.is_primary = true
        AND existing_primary.revoked_at IS NULL
    )
)
UPDATE application_clients c
SET is_primary = true
FROM ranked_clients
WHERE ranked_clients.id = c.id
  AND ranked_clients.rn = 1;

ALTER TABLE application_redirect_uris
  ALTER COLUMN environment_id DROP NOT NULL;

ALTER TABLE application_clients
  ALTER COLUMN environment_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS application_redirect_uris_application_uri_unique
  ON application_redirect_uris(application_id, redirect_uri);

CREATE UNIQUE INDEX IF NOT EXISTS application_clients_primary_unique
  ON application_clients(application_id)
  WHERE is_primary = true AND revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS application_developer_credentials (
  id text PRIMARY KEY,
  application_id text NOT NULL REFERENCES applications(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  token_hash text NOT NULL UNIQUE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  last_used_at timestamptz,
  rotated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT application_developer_credentials_status_check CHECK (status IN ('active', 'disabled'))
);

CREATE INDEX IF NOT EXISTS application_developer_credentials_application_id_idx
  ON application_developer_credentials(application_id);

CREATE INDEX IF NOT EXISTS application_developer_credentials_status_idx
  ON application_developer_credentials(status);

INSERT INTO schema_versions(version, description)
VALUES ('0.9.0', 'admin console onboarding contract')
ON CONFLICT (version) DO NOTHING;
