ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS silent_sso_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS silent_sso_allowed_origins text[] NOT NULL DEFAULT ARRAY[]::text[];

CREATE TABLE IF NOT EXISTS oauth_browser_sessions (
  id text PRIMARY KEY,
  session_hash text NOT NULL UNIQUE,
  feishu_user_id text NOT NULL REFERENCES feishu_users(user_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS oauth_browser_sessions_feishu_user_id_idx
  ON oauth_browser_sessions(feishu_user_id);

CREATE INDEX IF NOT EXISTS oauth_browser_sessions_expires_at_idx
  ON oauth_browser_sessions(expires_at);

UPDATE applications
SET
  silent_sso_enabled = true,
  silent_sso_allowed_origins = ARRAY['https://feishu-iam-sso-demo.riversoft.com.cn']
WHERE app_key = 'feishu-iam-sso-demo'
  AND (
    silent_sso_enabled = false
    OR NOT silent_sso_allowed_origins @> ARRAY['https://feishu-iam-sso-demo.riversoft.com.cn']
  );

INSERT INTO schema_versions(version, description)
VALUES ('1.0.4', 'OAuth silent SSO browser session and application policy')
ON CONFLICT (version) DO NOTHING;
