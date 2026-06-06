CREATE INDEX IF NOT EXISTS security_events_request_id_idx
  ON security_events (request_id);

CREATE INDEX IF NOT EXISTS security_events_application_created_at_idx
  ON security_events (application_id, created_at DESC);

CREATE INDEX IF NOT EXISTS security_events_client_created_at_idx
  ON security_events (client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS security_events_feishu_user_created_at_idx
  ON security_events (feishu_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS feishu_sync_runs_request_id_idx
  ON feishu_sync_runs (request_id);
