import type { DbPool } from '../../db/pool';

type DiagnosticSeverity = 'info' | 'warning' | 'critical';
type DiagnosticStatus = 'healthy' | 'warning' | 'failed';

interface DiagnosticFinding {
  code: string;
  severity: DiagnosticSeverity;
  title: string;
  description: string;
  nextAction: string;
  relatedRequestId?: string;
}

interface RecentEvent {
  action: string;
  result: 'success' | 'failed';
  requestId: string;
  createdAt: string;
  message: string;
}

interface ApplicationDiagnostics {
  applicationId: string;
  appKey: string;
  status: DiagnosticStatus;
  checkedAt: string;
  endpoints: {
    oauthAuthorize: string;
    oauthToken: string;
    applicationPermissions: string;
  };
  redirectUris: {
    active: string[];
    disabled: string[];
  };
  secrets: {
    appSecret: { status: 'issued' | 'missing'; rotatedAt?: string };
    apiSecret: { status: 'issued' | 'missing'; rotatedAt?: string };
  };
  counts: {
    applicationAdmins: number;
    permissionGroups: number;
    permissionPoints: number;
    roles: number;
    roleBindings: number;
    syncedUsers: number;
  };
  findings: DiagnosticFinding[];
  recentEvents: RecentEvent[];
}

interface ApplicationDiagnosticRow {
  id: string;
  app_key: string;
  status: string;
  app_secret_status: 'issued' | 'missing';
  app_secret_rotated_at: Date | string | null;
  api_secret_status: 'issued' | 'missing';
  api_secret_rotated_at: Date | string | null;
  application_admin_count: number;
  permission_group_count: number;
  permission_point_count: number;
  role_count: number;
  role_binding_count: number;
  synced_user_count: number;
}

interface RedirectUriRow {
  redirect_uri: string;
  status: 'active' | 'disabled';
}

interface AuditRow {
  action: string;
  result: 'success' | 'failure';
  request_id: string;
  created_at: Date | string;
}

export async function getApplicationDiagnostics(pool: Pick<DbPool, 'query'>, applicationId: string): Promise<ApplicationDiagnostics> {
  const [applicationResult, redirectResult, auditResult] = await Promise.all([
    pool.query<ApplicationDiagnosticRow>(
      `
        select a.id,
               a.app_key,
               a.status,
               case when app_secret.application_id is null then 'missing' else 'issued' end as app_secret_status,
               app_secret.updated_at as app_secret_rotated_at,
               case when api_credential.application_id is null then 'missing' else 'issued' end as api_secret_status,
               api_credential.updated_at as api_secret_rotated_at,
               (
                 select count(*)::int
                 from application_admins aa
                 where aa.application_id = a.id
               ) as application_admin_count,
               (
                 select count(*)::int
                 from permission_groups pg
                 where pg.application_id = a.id
               ) as permission_group_count,
               (
                 select count(*)::int
                 from permission_points pp
                 where pp.application_id = a.id
               ) as permission_point_count,
               (
                 select count(*)::int
                 from roles r
                 where r.application_id = a.id
               ) as role_count,
               (
                 select (
                   count(distinct rpp.role_id)::int
                   + count(distinct rpg.role_id)::int
                   + count(distinct rub.role_id)::int
                   + count(distinct rdb.role_id)::int
                 )
                 from roles r
                 left join role_permission_points rpp on rpp.role_id = r.id
                 left join role_permission_groups rpg on rpg.role_id = r.id
                 left join role_user_bindings rub on rub.role_id = r.id
                 left join role_department_bindings rdb on rdb.role_id = r.id
                 where r.application_id = a.id and r.status = 'active'
               )::int as role_binding_count,
               (
                 select count(*)::int
                 from directory_users du
                 where du.status = 'active'
               ) as synced_user_count
        from applications a
        left join application_secrets app_secret on app_secret.application_id = a.id
        left join application_api_credentials api_credential on api_credential.application_id = a.id
        where a.id = $1
      `,
      [applicationId],
    ),
    pool.query<RedirectUriRow>(
      `
        select redirect_uri, status
        from application_oauth_redirect_uris
        where application_id = $1
        order by status asc, updated_at desc, redirect_uri asc
      `,
      [applicationId],
    ),
    pool.query<AuditRow>(
      `
        select action, result, request_id, created_at
        from audit_logs
        where target_type = 'application'
          and target_id = $1
          and (
            action like 'oauth.%'
            or action like 'application_api.%'
            or action = 'permission.query'
            or action = 'secret.rotate'
            or action = 'secret.copy'
            or action = 'application.diagnostics.copy'
          )
        order by created_at desc, id desc
        limit 10
      `,
      [applicationId],
    ),
  ]);
  const application = applicationResult.rows[0];
  if (!application) {
    throw new Error('APPLICATION_NOT_FOUND');
  }

  const activeRedirectUris = redirectResult.rows.filter((row) => row.status === 'active').map((row) => row.redirect_uri);
  const disabledRedirectUris = redirectResult.rows.filter((row) => row.status === 'disabled').map((row) => row.redirect_uri);
  const recentEvents = auditResult.rows.map(mapRecentEvent);
  const findings = buildFindings(application, activeRedirectUris, disabledRedirectUris, recentEvents);
  const status = deriveStatus(findings);

  return {
    applicationId: application.id,
    appKey: application.app_key,
    status,
    checkedAt: new Date().toISOString(),
    endpoints: {
      oauthAuthorize: '/api/oauth/authorize',
      oauthToken: '/api/oauth/token',
      applicationPermissions: '/api/application/me/permissions',
    },
    redirectUris: {
      active: activeRedirectUris,
      disabled: disabledRedirectUris,
    },
    secrets: {
      appSecret: {
        status: application.app_secret_status,
        rotatedAt: formatOptionalDate(application.app_secret_rotated_at),
      },
      apiSecret: {
        status: application.api_secret_status,
        rotatedAt: formatOptionalDate(application.api_secret_rotated_at),
      },
    },
    counts: {
      applicationAdmins: Number(application.application_admin_count),
      permissionGroups: Number(application.permission_group_count),
      permissionPoints: Number(application.permission_point_count),
      roles: Number(application.role_count),
      roleBindings: Number(application.role_binding_count),
      syncedUsers: Number(application.synced_user_count),
    },
    findings,
    recentEvents,
  };
}

function buildFindings(
  application: ApplicationDiagnosticRow,
  activeRedirectUris: string[],
  disabledRedirectUris: string[],
  recentEvents: RecentEvent[],
): DiagnosticFinding[] {
  const findings: DiagnosticFinding[] = [];

  if (application.status !== 'active') {
    findings.push({
      code: 'APPLICATION_DISABLED',
      severity: 'critical',
      title: '应用已停用',
      description: '停用应用不能完成新的 OAuth 授权或 Application API 接入。',
      nextAction: '先恢复应用状态，再重新执行第三方接入验证。',
    });
  }
  if (activeRedirectUris.length === 0) {
    findings.push({
      code: 'NO_ACTIVE_REDIRECT_URI',
      severity: 'critical',
      title: '缺少启用状态的 redirect URI',
      description: 'OAuth authorize 只能命中启用状态的 redirect URI。',
      nextAction: '在接入配置中新增或恢复第三方系统实际使用的 redirect URI。',
    });
  }
  if (application.app_secret_status === 'missing') {
    findings.push({
      code: 'MISSING_APP_SECRET',
      severity: 'critical',
      title: '缺少 appSecret',
      description: 'OAuth token exchange 需要可用的 appSecret hash。',
      nextAction: '轮换 appSecret 并把新 secret 写入第三方系统运行时环境变量。',
    });
  }
  if (application.api_secret_status === 'missing') {
    findings.push({
      code: 'MISSING_API_SECRET',
      severity: 'critical',
      title: '缺少 API secret',
      description: 'Application API HMAC 鉴权需要可用的 API secret hash。',
      nextAction: '轮换 API secret 并把新 secret 写入第三方系统运行时环境变量。',
    });
  }
  if (Number(application.application_admin_count) === 0) {
    findings.push({
      code: 'NO_APPLICATION_ADMINS',
      severity: 'warning',
      title: '没有应用管理员',
      description: '没有应用管理员会降低第三方系统接入配置的日常维护效率。',
      nextAction: '由平台管理员在应用详情中添加至少 1 位应用管理员。',
    });
  }
  if (Number(application.permission_group_count) === 0 || Number(application.permission_point_count) === 0) {
    findings.push({
      code: 'NO_PERMISSION_REGISTRATIONS',
      severity: 'warning',
      title: '没有权限注册数据',
      description: '第三方系统尚未通过 Application API 注册权限组或权限点。',
      nextAction: '让第三方系统使用 Application API 注册权限组和权限点后重试。',
    });
  }
  if (Number(application.role_binding_count) === 0) {
    findings.push({
      code: 'NO_ROLE_BINDINGS',
      severity: 'warning',
      title: '没有角色授权绑定',
      description: '用户即使完成登录，也可能查询不到任何权限点。',
      nextAction: '在角色授权中绑定权限组或权限点，并绑定飞书用户或部门。',
    });
  }
  if (disabledRedirectUris.length > 0) {
    findings.push({
      code: 'HAS_DISABLED_REDIRECT_URI',
      severity: 'info',
      title: '存在停用 redirect URI',
      description: '停用 URI 不会被 OAuth authorize 接受。',
      nextAction: '确认第三方系统没有继续使用这些停用 URI。',
    });
  }

  const recentFailures = recentEvents.filter((event) => event.result === 'failed');
  const oauthFailure = recentFailures.find((event) => event.action.startsWith('oauth.'));
  const applicationApiFailure = recentFailures.find((event) => event.action.startsWith('application_api.'));
  const permissionFailure = recentFailures.find((event) => event.action === 'permission.query');
  if (oauthFailure) {
    findings.push({
      code: 'RECENT_OAUTH_FAILURE',
      severity: 'warning',
      title: '最近存在 OAuth 失败',
      description: '最近 OAuth 授权或 token exchange 有失败记录。',
      nextAction: '用 requestId 查询审计详情，优先检查 redirect URI、client_id 和 appSecret。',
      relatedRequestId: oauthFailure.requestId,
    });
  }
  if (applicationApiFailure) {
    findings.push({
      code: 'RECENT_APPLICATION_API_FAILURE',
      severity: 'warning',
      title: '最近存在 Application API 失败',
      description: '最近权限注册或 HMAC 鉴权相关 API 有失败记录。',
      nextAction: '用 requestId 查询审计详情，优先检查 appKey、timestamp、nonce、body hash 和 API secret。',
      relatedRequestId: applicationApiFailure.requestId,
    });
  }
  if (permissionFailure) {
    findings.push({
      code: 'RECENT_PERMISSION_QUERY_FAILURE',
      severity: 'warning',
      title: '最近存在权限查询失败',
      description: '第三方系统查询用户权限时出现失败记录。',
      nextAction: '用 requestId 查询审计详情，检查 bearer token scope、用户同步状态和角色授权。',
      relatedRequestId: permissionFailure.requestId,
    });
  }

  return findings;
}

function deriveStatus(findings: DiagnosticFinding[]): DiagnosticStatus {
  if (findings.some((finding) => finding.severity === 'critical')) {
    return 'failed';
  }
  if (findings.some((finding) => finding.severity === 'warning')) {
    return 'warning';
  }
  return 'healthy';
}

function mapRecentEvent(row: AuditRow): RecentEvent {
  return {
    action: row.action,
    result: row.result === 'success' ? 'success' : 'failed',
    requestId: row.request_id,
    createdAt: formatDate(row.created_at),
    message: formatAuditMessage(row.action, row.result),
  };
}

function formatAuditMessage(action: string, result: 'success' | 'failure'): string {
  const resultText = result === 'success' ? '成功' : '失败';
  return `${action} ${resultText}`;
}

function formatOptionalDate(value: Date | string | null): string | undefined {
  return value ? formatDate(value) : undefined;
}

function formatDate(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
