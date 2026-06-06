ALTER TABLE application_clients
  ADD COLUMN IF NOT EXISTS client_secret_ciphertext text,
  ADD COLUMN IF NOT EXISTS client_secret_iv text,
  ADD COLUMN IF NOT EXISTS client_secret_auth_tag text,
  ADD COLUMN IF NOT EXISTS client_secret_algorithm text;

INSERT INTO schema_versions (version, description)
VALUES ('0.7.0', 'admin information architecture and secret vault')
ON CONFLICT (version) DO NOTHING;
