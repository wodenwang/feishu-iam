import type {
  Application,
  ApplicationAdmin,
  ApplicationDiagnostics,
  ApplicationRedirectUri,
  ApplicationPermissionRegistration,
  AuditAction,
  AuditLog,
  AuditResult,
  CreateApplicationResult,
  CurrentSession,
  DirectoryUser,
  FeishuDepartment,
  IamPermissionNode,
  IamRole,
  PageResult,
  SyncPreflightResult,
  SyncEvent,
  SyncEventStatusOverview,
  SyncRun,
  SyncStatusOverview,
} from './types';

interface RuntimePageResult<T> {
  items: T[];
  page?: number;
  pageSize?: number;
  total?: number;
}

interface RuntimeApplication {
  id: string;
  app_key: string;
  name: string;
  status: Application['status'];
  created_at: string;
  updated_at?: string;
  created_by_feishu_user_id?: string | null;
  created_by_name?: string | null;
  owner_feishu_user_id?: string | null;
  owner_name?: string | null;
  permission_group_count?: number;
  permission_point_count?: number;
  last_api_called_at?: string | null;
  last_permission_query_at?: string | null;
  redirect_uri_count?: number | null;
  active_redirect_uri_count?: number | null;
  admin_count?: number | null;
  app_secret_rotated_at?: string | null;
  api_secret_rotated_at?: string | null;
  secret_status?: {
    app_secret?: string;
    api_secret?: string;
  };
}

interface RuntimeRedirectUri {
  application_id: string;
  redirect_uri: string;
  environment: ApplicationRedirectUri['environment'];
  status: ApplicationRedirectUri['status'];
  note?: string | null;
  created_by_feishu_user_id?: string | null;
  created_by_name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  disabled_at?: string | null;
}

interface RuntimeApplicationAdmin {
  application_id: string;
  feishu_user_id: string;
  name: string;
  email?: string | null;
  status?: ApplicationAdmin['status'] | null;
  role?: ApplicationAdmin['role'] | null;
  created_by_feishu_user_id?: string | null;
  created_by_name?: string | null;
  created_at?: string | null;
}

interface RuntimeAuditLog {
  id: string | number;
  request_id: string;
  actor_feishu_user_id?: string | null;
  action: string;
  target_type?: string;
  target_id?: string | null;
  result: 'success' | 'failure' | 'failed';
  metadata?: unknown;
  created_at: string;
}

interface RuntimeDepartment {
  id: string;
  name: string;
  parent_id?: string | null;
  path?: string | null;
  user_count?: number | null;
  updated_at?: string | null;
}

interface RuntimeDirectoryUser {
  feishu_user_id: string;
  name: string;
  email?: string | null;
  mobile?: string | null;
  department_id?: string | null;
  department_name?: string | null;
  department_path?: string | null;
  status?: DirectoryUser['status'];
  synced_at?: string | null;
  updated_at?: string | null;
  local_role_summary?: string | null;
  last_login_at?: string | null;
  last_permission_queried_at?: string | null;
}

interface RuntimeRole {
  id: string;
  application_id?: string | null;
  application_name?: string | null;
  app_key?: string | null;
  code: string;
  name: string;
  description?: string | null;
  status?: IamRole['status'];
  created_at?: string | null;
  updated_at?: string | null;
  permission_group_count?: number | null;
  permission_point_count?: number | null;
  department_binding_count?: number | null;
  user_binding_count?: number | null;
  permission_keys?: string[] | null;
  department_ids?: string[] | null;
  user_ids?: string[] | null;
}

interface RuntimePermissionNode {
  key: string;
  title: string;
  children?: RuntimePermissionNode[] | null;
}

interface RuntimePermissionRegistration {
  id?: string | null;
  application_id?: string | null;
  group_code: string;
  group_name: string;
  group_status?: 'active' | 'disabled' | null;
  permission_code?: string | null;
  permission_name?: string | null;
  permission_status?: 'active' | 'disabled' | null;
  updated_at?: string | null;
}

interface RuntimeApplicationDiagnostics {
  applicationId?: string;
  appKey?: string;
  status?: ApplicationDiagnostics['status'];
  checkedAt?: string;
  endpoints?: Partial<ApplicationDiagnostics['endpoints']>;
  redirectUris?: Partial<ApplicationDiagnostics['redirectUris']>;
  secrets?: Partial<ApplicationDiagnostics['secrets']>;
  counts?: Partial<ApplicationDiagnostics['counts']>;
  findings?: ApplicationDiagnostics['findings'] | null;
  recentEvents?: ApplicationDiagnostics['recentEvents'] | null;
}

interface RuntimeSyncRun {
  id: string;
  trigger: SyncRun['trigger'];
  status: SyncRun['status'];
  operator_type?: SyncRun['operatorType'] | null;
  operator_feishu_user_id?: string | null;
  request_id?: string | null;
  started_at: string;
  finished_at?: string | null;
  error_message?: string | null;
  request_batch_count?: number | null;
  success_count?: number | null;
  failed_count?: number | null;
  diff_summary?: Partial<SyncRun['diffSummary']> | null;
}

interface RuntimeSyncStatusOverview {
  latestRun?: RuntimeSyncRun | null;
  latestSuccessfulRun?: RuntimeSyncRun | null;
  latestFailedRun?: RuntimeSyncRun | null;
  isRunning?: boolean;
  directoryUserCount?: number | null;
  directoryDepartmentCount?: number | null;
  healthStatus?: SyncStatusOverview['healthStatus'];
  healthReasons?: string[] | null;
}

interface RuntimeSyncPreflightResult {
  status: SyncPreflightResult['status'];
  checkedAt: string;
  requestBatchCount?: number | null;
  stages?: SyncPreflightResult['stages'] | null;
  requestId?: string | null;
  errorCode?: string | null;
  message?: string | null;
}

interface RuntimeSyncEvent {
  id: string;
  event_id: string;
  event_type: string;
  resource_type?: string | null;
  resource_id?: string | null;
  status: SyncEvent['status'];
  request_id: string;
  received_at: string;
  processed_at?: string | null;
  sync_run_id?: string | null;
  error_message?: string | null;
}

interface RuntimeSyncEventStatusOverview {
  latestEvent?: RuntimeSyncEvent | null;
  latestFailedEvent?: RuntimeSyncEvent | null;
  pendingCount?: number | null;
  failedCount?: number | null;
  processedCount?: number | null;
  ignoredCount?: number | null;
  healthStatus?: SyncEventStatusOverview['healthStatus'];
  healthReasons?: string[] | null;
}

export function mapCurrentSessionResponse(payload: unknown): CurrentSession {
  const value = payload as {
    authenticated?: boolean;
    user?: CurrentSession['user'];
    roles?: CurrentSession['roles'];
    permissions?: CurrentSession['permissions'];
    applicationIds?: string[];
  };

  if (!value.authenticated || !value.user) {
    throw new Error('UNAUTHENTICATED_SESSION');
  }

  return {
    user: value.user,
    roles: value.roles ?? [],
    permissions: value.permissions ?? [],
    applicationIds: value.applicationIds ?? [],
  };
}

export function mapRuntimeApplication(item: RuntimeApplication): Application {
  return {
    id: item.id,
    name: item.name,
    code: item.app_key,
    status: item.status,
    appKey: item.app_key,
    appSecretPreview: 'sec_****',
    apiKey: item.app_key,
    apiSecretPreview: 'api_****',
    callbackUrls: ['https://your-app.example.com/auth/callback'],
    allowedOrigins: ['https://your-app.example.com'],
    ownerFeishuUserId: item.owner_feishu_user_id ?? item.created_by_feishu_user_id ?? '-',
    ownerName: item.owner_name ?? item.created_by_name ?? '-',
    permissionGroupCount: item.permission_group_count ?? 0,
    permissionPointCount: item.permission_point_count ?? 0,
    redirectUriCount: item.redirect_uri_count ?? undefined,
    activeRedirectUriCount: item.active_redirect_uri_count ?? undefined,
    adminCount: item.admin_count ?? undefined,
    appSecretRotatedAt: item.app_secret_rotated_at ?? undefined,
    apiSecretRotatedAt: item.api_secret_rotated_at ?? undefined,
    lastApiCalledAt: item.last_api_called_at ?? item.last_permission_query_at ?? undefined,
    agentPrompt: '',
    createdAt: item.created_at,
    updatedAt: item.updated_at ?? item.created_at,
  };
}

export function mapRuntimeRedirectUri(item: RuntimeRedirectUri): ApplicationRedirectUri {
  return {
    applicationId: item.application_id,
    redirectUri: item.redirect_uri,
    environment: item.environment,
    status: item.status,
    note: item.note ?? '',
    createdByFeishuUserId: item.created_by_feishu_user_id ?? undefined,
    createdByName: item.created_by_name ?? item.created_by_feishu_user_id ?? '-',
    createdAt: item.created_at ?? '',
    updatedAt: item.updated_at ?? item.created_at ?? '',
    disabledAt: item.disabled_at ?? undefined,
  };
}

export function mapRuntimeApplicationAdmin(item: RuntimeApplicationAdmin): ApplicationAdmin {
  return {
    applicationId: item.application_id,
    feishuUserId: item.feishu_user_id,
    name: item.name,
    email: item.email ?? undefined,
    status: item.status ?? 'active',
    role: item.role ?? 'application_admin',
    createdByFeishuUserId: item.created_by_feishu_user_id ?? undefined,
    createdByName: item.created_by_name ?? item.created_by_feishu_user_id ?? '-',
    createdAt: item.created_at ?? '',
  };
}

export function mapCreateApplicationResult(payload: {
  application: RuntimeApplication;
  appSecret: string;
  apiSecret: string;
}): CreateApplicationResult {
  return {
    application: mapRuntimeApplication(payload.application),
    appSecret: payload.appSecret,
    apiSecret: payload.apiSecret,
  };
}

export function mapAuditLog(item: RuntimeAuditLog): AuditLog {
  return {
    id: String(item.id),
    action: normalizeAuditAction(item.action),
    result: normalizeAuditResult(item.result),
    actorFeishuUserId: item.actor_feishu_user_id ?? '-',
    applicationId: item.target_type === 'application' ? item.target_id ?? undefined : undefined,
    message: item.action,
    requestId: item.request_id,
    createdAt: item.created_at,
  };
}

export function mapRuntimeDepartment(item: RuntimeDepartment): FeishuDepartment {
  return {
    id: item.id,
    name: item.name,
    parentId: item.parent_id ?? undefined,
    path: item.path ?? item.name,
    userCount: item.user_count ?? 0,
    updatedAt: item.updated_at ?? '',
  };
}

export function mapRuntimeDirectoryUser(item: RuntimeDirectoryUser): DirectoryUser {
  return {
    feishuUserId: item.feishu_user_id,
    displayName: item.name,
    departmentPath: item.department_path ?? '-',
    status: item.status ?? 'active',
    departmentId: item.department_id ?? '-',
    departmentName: item.department_name ?? '-',
    email: item.email ?? undefined,
    mobile: item.mobile ?? undefined,
    syncedAt: item.synced_at ?? item.updated_at ?? '',
    localRoleSummary: item.local_role_summary ?? '-',
    lastLoginAt: item.last_login_at ?? undefined,
    lastPermissionQueriedAt: item.last_permission_queried_at ?? undefined,
  };
}

export function mapRuntimeRole(item: RuntimeRole): IamRole {
  const createdAt = item.created_at ?? '';
  return {
    id: item.id,
    applicationId: item.application_id ?? item.app_key ?? '-',
    applicationName: item.application_name ?? '-',
    name: item.name,
    code: item.code,
    description: item.description ?? undefined,
    status: item.status ?? 'active',
    permissionGroupCount: item.permission_group_count ?? 0,
    permissionPointCount: item.permission_point_count ?? 0,
    departmentBindingCount: item.department_binding_count ?? 0,
    userBindingCount: item.user_binding_count ?? 0,
    permissionKeys: item.permission_keys ?? [],
    departmentIds: item.department_ids ?? [],
    userIds: item.user_ids ?? [],
    createdAt,
    updatedAt: item.updated_at ?? createdAt,
  };
}

export function mapRuntimePermissionTree(items: RuntimePermissionNode[]): IamPermissionNode[] {
  return items.map((item) => ({
    key: item.key,
    title: item.title,
    children: item.children ? mapRuntimePermissionTree(item.children) : undefined,
  }));
}

export function mapRuntimePermissionRegistration(item: RuntimePermissionRegistration): ApplicationPermissionRegistration {
  const permissionCode = item.permission_code ?? `${item.group_code}:*`;
  return {
    id: item.id ?? `${item.group_code}:${permissionCode}`,
    applicationId: item.application_id ?? '-',
    groupCode: item.group_code,
    groupName: item.group_name,
    permissionCode,
    permissionName: item.permission_name ?? '权限组占位',
    status: item.permission_status ?? item.group_status ?? 'active',
    updatedAt: item.updated_at ?? '',
  };
}

export function mapRuntimeApplicationDiagnostics(item: RuntimeApplicationDiagnostics): ApplicationDiagnostics {
  return {
    applicationId: item.applicationId ?? '-',
    appKey: item.appKey ?? '-',
    status: item.status ?? 'failed',
    checkedAt: item.checkedAt ?? '',
    endpoints: {
      oauthAuthorize: item.endpoints?.oauthAuthorize ?? '/api/oauth/authorize',
      oauthToken: item.endpoints?.oauthToken ?? '/api/oauth/token',
      applicationPermissions: item.endpoints?.applicationPermissions ?? '/api/application/me/permissions',
    },
    redirectUris: {
      active: item.redirectUris?.active ?? [],
      disabled: item.redirectUris?.disabled ?? [],
    },
    secrets: {
      appSecret: item.secrets?.appSecret ?? { status: 'missing' },
      apiSecret: item.secrets?.apiSecret ?? { status: 'missing' },
    },
    counts: {
      applicationAdmins: item.counts?.applicationAdmins ?? 0,
      permissionGroups: item.counts?.permissionGroups ?? 0,
      permissionPoints: item.counts?.permissionPoints ?? 0,
      roles: item.counts?.roles ?? 0,
      roleBindings: item.counts?.roleBindings ?? 0,
      syncedUsers: item.counts?.syncedUsers ?? 0,
    },
    findings: item.findings ?? [],
    recentEvents: item.recentEvents ?? [],
  };
}

export function mapRuntimeSyncRun(item: RuntimeSyncRun): SyncRun {
  const diffSummary = {
    createdUsers: item.diff_summary?.createdUsers ?? 0,
    updatedUsers: item.diff_summary?.updatedUsers ?? 0,
    resignedUsers: item.diff_summary?.resignedUsers ?? 0,
    failedUsers: item.diff_summary?.failedUsers ?? 0,
    createdDepartments: item.diff_summary?.createdDepartments ?? 0,
    updatedDepartments: item.diff_summary?.updatedDepartments ?? 0,
  };
  return {
    id: item.id,
    trigger: item.trigger,
    status: item.status,
    operatorType: item.operator_type === 'system' ? 'system' : 'feishu_user',
    startedAt: item.started_at,
    finishedAt: item.finished_at ?? undefined,
    durationSeconds: calculateDurationSeconds(item.started_at, item.finished_at),
    userChanges: diffSummary.createdUsers + diffSummary.updatedUsers + diffSummary.resignedUsers,
    departmentChanges: diffSummary.createdDepartments + diffSummary.updatedDepartments,
    operatorFeishuUserId: item.operator_feishu_user_id ?? null,
    requestBatchCount: item.request_batch_count ?? 0,
    successCount: item.success_count ?? 0,
    failedCount: item.failed_count ?? 0,
    diffSummary,
    requestId: item.request_id ?? undefined,
    errorMessage: item.error_message ?? undefined,
  };
}

export function mapRuntimeSyncStatusOverview(item: RuntimeSyncStatusOverview): SyncStatusOverview {
  return {
    latestRun: item.latestRun ? mapRuntimeSyncRun(item.latestRun) : null,
    latestSuccessfulRun: item.latestSuccessfulRun ? mapRuntimeSyncRun(item.latestSuccessfulRun) : null,
    latestFailedRun: item.latestFailedRun ? mapRuntimeSyncRun(item.latestFailedRun) : null,
    isRunning: Boolean(item.isRunning),
    directoryUserCount: item.directoryUserCount ?? 0,
    directoryDepartmentCount: item.directoryDepartmentCount ?? 0,
    healthStatus: item.healthStatus ?? 'unknown',
    healthReasons: item.healthReasons ?? [],
  };
}

export function mapRuntimeSyncPreflightResult(item: RuntimeSyncPreflightResult): SyncPreflightResult {
  return {
    status: item.status,
    checkedAt: item.checkedAt,
    requestBatchCount: item.requestBatchCount ?? 0,
    stages: item.stages ?? [],
    requestId: item.requestId ?? '-',
    errorCode: item.errorCode ?? undefined,
    message: item.message ?? undefined,
  };
}

export function mapRuntimeSyncEvent(item: RuntimeSyncEvent): SyncEvent {
  return {
    id: item.id,
    eventId: item.event_id,
    eventType: item.event_type,
    resourceType: item.resource_type ?? undefined,
    resourceId: item.resource_id ?? undefined,
    status: item.status,
    requestId: item.request_id,
    receivedAt: item.received_at,
    processedAt: item.processed_at ?? undefined,
    syncRunId: item.sync_run_id ?? undefined,
    errorMessage: item.error_message ?? undefined,
  };
}

export function mapRuntimeSyncEventStatusOverview(item: RuntimeSyncEventStatusOverview): SyncEventStatusOverview {
  return {
    latestEvent: item.latestEvent ? mapRuntimeSyncEvent(item.latestEvent) : null,
    latestFailedEvent: item.latestFailedEvent ? mapRuntimeSyncEvent(item.latestFailedEvent) : null,
    pendingCount: item.pendingCount ?? 0,
    failedCount: item.failedCount ?? 0,
    processedCount: item.processedCount ?? 0,
    ignoredCount: item.ignoredCount ?? 0,
    healthStatus: item.healthStatus ?? 'unknown',
    healthReasons: item.healthReasons ?? [],
  };
}

export function mapPageResult<Input, Output>(
  page: RuntimePageResult<Input>,
  mapper: (item: Input) => Output,
): PageResult<Output> {
  return {
    items: page.items.map(mapper),
    page: page.page ?? 1,
    pageSize: page.pageSize ?? page.items.length,
    total: page.total ?? page.items.length,
  };
}

function normalizeAuditAction(action: string): AuditAction {
  const known = new Set<AuditAction>([
    'login',
    'application.create',
    'application.api_call',
    'application.diagnostics.copy',
    'application.admin.add',
    'application.admin.bind',
    'application.admin.remove',
    'oauth.redirect_uri.create',
    'oauth.redirect_uri.disable',
    'oauth.redirect_uri.enable',
    'role.create',
    'secret.copy',
    'secret.rotate',
    'role.update',
    'role.authorization.update',
    'permission.query',
    'sync.event.receive',
    'sync.event.retry',
    'sync.run',
    'sync.preflight',
  ]);
  if (known.has(action as AuditAction)) {
    return action as AuditAction;
  }
  if (action === 'auth.mock_login') {
    return 'login';
  }
  if (action === 'platform_admin.bind') {
    return 'role.update';
  }
  return 'application.api_call';
}

function normalizeAuditResult(result: RuntimeAuditLog['result']): AuditResult {
  return result === 'success' ? 'success' : 'failed';
}

function calculateDurationSeconds(startedAt: string, finishedAt?: string | null): number | undefined {
  if (!finishedAt) {
    return undefined;
  }
  const started = new Date(startedAt).getTime();
  const finished = new Date(finishedAt).getTime();
  if (!Number.isFinite(started) || !Number.isFinite(finished) || finished < started) {
    return undefined;
  }
  return Math.round((finished - started) / 1000);
}
