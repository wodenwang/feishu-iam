CREATE TABLE IF NOT EXISTS application_environments (
  id text PRIMARY KEY,
  application_id text NOT NULL REFERENCES applications(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  environment_key text NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT application_environments_environment_key_check CHECK (environment_key IN ('dev', 'test', 'prod')),
  CONSTRAINT application_environments_status_check CHECK (status IN ('active', 'disabled')),
  CONSTRAINT application_environments_application_key_unique UNIQUE (application_id, environment_key),
  CONSTRAINT application_environments_id_application_unique UNIQUE (application_id, id)
);

CREATE TABLE IF NOT EXISTS application_redirect_uris (
  id text PRIMARY KEY,
  application_id text NOT NULL,
  environment_id text NOT NULL,
  redirect_uri text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT application_redirect_uris_status_check CHECK (status IN ('active', 'disabled')),
  CONSTRAINT application_redirect_uris_environment_fk FOREIGN KEY (application_id, environment_id)
    REFERENCES application_environments(application_id, id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT application_redirect_uris_environment_uri_unique UNIQUE (environment_id, redirect_uri)
);

CREATE TABLE IF NOT EXISTS application_clients (
  id text PRIMARY KEY,
  application_id text NOT NULL,
  environment_id text NOT NULL,
  client_id text NOT NULL UNIQUE,
  client_secret_hash text NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT application_clients_status_check CHECK (status IN ('active', 'disabled')),
  CONSTRAINT application_clients_environment_fk FOREIGN KEY (application_id, environment_id)
    REFERENCES application_environments(application_id, id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT application_clients_application_environment_client_unique UNIQUE (application_id, environment_id, client_id),
  CONSTRAINT application_clients_environment_name_unique UNIQUE (environment_id, name)
);

CREATE TABLE IF NOT EXISTS oauth_login_states (
  id text PRIMARY KEY,
  state_hash text NOT NULL UNIQUE,
  client_id text NOT NULL REFERENCES application_clients(client_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  redirect_uri text NOT NULL,
  requested_scope text NOT NULL,
  external_state text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS oauth_authorization_codes (
  id text PRIMARY KEY,
  code_hash text NOT NULL UNIQUE,
  application_id text NOT NULL,
  environment_id text NOT NULL,
  client_id text NOT NULL,
  redirect_uri text NOT NULL,
  feishu_user_id text NOT NULL REFERENCES feishu_users(user_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  scope text NOT NULL,
  state text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT oauth_authorization_codes_application_fk FOREIGN KEY (application_id)
    REFERENCES applications(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT oauth_authorization_codes_environment_fk FOREIGN KEY (application_id, environment_id)
    REFERENCES application_environments(application_id, id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT oauth_authorization_codes_client_fk FOREIGN KEY (application_id, environment_id, client_id)
    REFERENCES application_clients(application_id, environment_id, client_id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS oauth_access_tokens (
  id text PRIMARY KEY,
  token_hash text NOT NULL UNIQUE,
  application_id text NOT NULL,
  environment_id text NOT NULL,
  client_id text NOT NULL,
  feishu_user_id text NOT NULL REFERENCES feishu_users(user_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  scope text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT oauth_access_tokens_application_fk FOREIGN KEY (application_id)
    REFERENCES applications(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT oauth_access_tokens_environment_fk FOREIGN KEY (application_id, environment_id)
    REFERENCES application_environments(application_id, id) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT oauth_access_tokens_client_fk FOREIGN KEY (application_id, environment_id, client_id)
    REFERENCES application_clients(application_id, environment_id, client_id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS security_events (
  id text PRIMARY KEY,
  event_type text NOT NULL,
  application_id text REFERENCES applications(id) ON UPDATE CASCADE ON DELETE SET NULL,
  client_id text,
  feishu_user_id text,
  result text NOT NULL,
  reason_code text,
  summary text NOT NULL,
  ip text,
  user_agent text,
  request_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT security_events_result_check CHECK (result IN ('success', 'failed'))
);

CREATE INDEX IF NOT EXISTS application_environments_application_id_idx ON application_environments(application_id);
CREATE INDEX IF NOT EXISTS application_redirect_uris_environment_id_idx ON application_redirect_uris(environment_id);
CREATE INDEX IF NOT EXISTS application_redirect_uris_status_idx ON application_redirect_uris(status);
CREATE INDEX IF NOT EXISTS application_clients_environment_id_idx ON application_clients(environment_id);
CREATE INDEX IF NOT EXISTS application_clients_status_idx ON application_clients(status);
CREATE INDEX IF NOT EXISTS oauth_login_states_expires_at_idx ON oauth_login_states(expires_at);
CREATE INDEX IF NOT EXISTS oauth_authorization_codes_client_id_idx ON oauth_authorization_codes(client_id);
CREATE INDEX IF NOT EXISTS oauth_authorization_codes_expires_at_idx ON oauth_authorization_codes(expires_at);
CREATE INDEX IF NOT EXISTS oauth_access_tokens_client_id_idx ON oauth_access_tokens(client_id);
CREATE INDEX IF NOT EXISTS oauth_access_tokens_feishu_user_id_idx ON oauth_access_tokens(feishu_user_id);
CREATE INDEX IF NOT EXISTS oauth_access_tokens_expires_at_idx ON oauth_access_tokens(expires_at);
CREATE INDEX IF NOT EXISTS security_events_created_at_idx ON security_events(created_at DESC);
CREATE INDEX IF NOT EXISTS security_events_event_type_idx ON security_events(event_type);

INSERT INTO schema_versions(version, description)
VALUES ('0.4.0', 'SSO Provider 授权码最小闭环')
ON CONFLICT (version) DO NOTHING;
