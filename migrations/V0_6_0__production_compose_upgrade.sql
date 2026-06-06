\if :{?initial_platform_admin_feishu_user_id}
\else
\set initial_platform_admin_feishu_user_id ''
\endif

CREATE TEMP TABLE v0_6_0_migration_vars AS
SELECT NULLIF(btrim(:'initial_platform_admin_feishu_user_id'), '') AS initial_feishu_user_id;

DO $$
DECLARE
  initial_feishu_user_id text;
  target_admin_user_id text;
  platform_role_id text;
BEGIN
  SELECT vars.initial_feishu_user_id
  INTO initial_feishu_user_id
  FROM v0_6_0_migration_vars vars;

  IF initial_feishu_user_id IS NULL THEN
    RAISE EXCEPTION 'INITIAL_PLATFORM_ADMIN_FEISHU_USER_ID is required for v0.6.0 migration';
  END IF;

  SELECT id INTO platform_role_id
  FROM admin_roles
  WHERE role_key = 'platform_admin';

  IF platform_role_id IS NULL THEN
    RAISE EXCEPTION 'platform_admin role is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM feishu_users
    WHERE user_id = initial_feishu_user_id
      AND is_active = true
      AND is_deleted = false
  ) THEN
    RAISE EXCEPTION 'initial platform admin feishu user is missing or unavailable: %', initial_feishu_user_id;
  END IF;

  SELECT id INTO target_admin_user_id
  FROM admin_users
  WHERE feishu_user_id = initial_feishu_user_id;

  IF target_admin_user_id IS NULL THEN
    target_admin_user_id := 'admin-user-initial-platform-admin';

    INSERT INTO admin_users(id, feishu_user_id, display_name, status, created_at, updated_at)
    SELECT target_admin_user_id, user_id, name, 'active', now(), now()
    FROM feishu_users
    WHERE user_id = initial_feishu_user_id;
  ELSE
    UPDATE admin_users
    SET status = 'active',
        updated_at = now()
    WHERE id = target_admin_user_id;
  END IF;

  INSERT INTO admin_user_roles(admin_user_id, admin_role_id, created_at)
  VALUES (target_admin_user_id, platform_role_id, now())
  ON CONFLICT (admin_user_id, admin_role_id) DO NOTHING;

  INSERT INTO audit_logs(
    id,
    actor_type,
    actor_id,
    source,
    resource_type,
    resource_id,
    action,
    before,
    after,
    result,
    request_id,
    created_at
  )
  VALUES (
    'audit-v0-6-0-initial-platform-admin',
    'system',
    'deployment',
    'deployment_init',
    'admin_user',
    target_admin_user_id,
    'initialize_platform_admin',
    NULL,
    jsonb_build_object(
      'adminUserId', target_admin_user_id,
      'feishuUserId', initial_feishu_user_id,
      'roleKeys', jsonb_build_array('platform_admin')
    ),
    'success',
    'deployment-init-v0.6.0',
    now()
  )
  ON CONFLICT (id) DO NOTHING;
END $$;

INSERT INTO schema_versions(version, description)
VALUES ('0.6.0', '生产化 Compose 部署与停机升级闭环')
ON CONFLICT (version) DO NOTHING;
