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
)
UPDATE application_clients c
SET is_primary = ranked_clients.rn = 1
FROM ranked_clients
WHERE ranked_clients.id = c.id;

WITH ranked_redirect_uris AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY application_id, redirect_uri
      ORDER BY
        CASE WHEN status = 'active' THEN 0 ELSE 1 END,
        updated_at DESC,
        created_at DESC,
        id ASC
    ) AS rn
  FROM application_redirect_uris
)
DELETE FROM application_redirect_uris d
USING ranked_redirect_uris
WHERE ranked_redirect_uris.id = d.id
  AND ranked_redirect_uris.rn > 1;

ALTER TABLE application_redirect_uris
  ALTER COLUMN environment_id DROP NOT NULL;

ALTER TABLE application_clients
  ALTER COLUMN environment_id DROP NOT NULL;

ALTER TABLE oauth_authorization_codes
  ALTER COLUMN environment_id DROP NOT NULL;

ALTER TABLE oauth_access_tokens
  ALTER COLUMN environment_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'application_redirect_uris_application_fk'
      AND conrelid = 'application_redirect_uris'::regclass
  ) THEN
    ALTER TABLE application_redirect_uris
      ADD CONSTRAINT application_redirect_uris_application_fk
      FOREIGN KEY (application_id)
      REFERENCES applications(id) ON UPDATE CASCADE ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'application_clients_application_fk'
      AND conrelid = 'application_clients'::regclass
  ) THEN
    ALTER TABLE application_clients
      ADD CONSTRAINT application_clients_application_fk
      FOREIGN KEY (application_id)
      REFERENCES applications(id) ON UPDATE CASCADE ON DELETE RESTRICT;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS application_redirect_uris_application_uri_unique
  ON application_redirect_uris(application_id, redirect_uri);

CREATE UNIQUE INDEX IF NOT EXISTS application_clients_application_client_unique
  ON application_clients(application_id, client_id);

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
VALUES ('0.8.1', 'application onboarding without environments')
ON CONFLICT (version) DO NOTHING;
