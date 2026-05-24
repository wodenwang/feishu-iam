import type {
  Application,
  AuditAction,
  AuditLog,
  AuditResult,
  CreateApplicationResult,
  CurrentSession,
  DirectoryUser,
  FeishuDepartment,
  PageResult,
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
  permission_group_count?: number;
  permission_point_count?: number;
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
    callbackUrls: [],
    allowedOrigins: [],
    ownerFeishuUserId: '-',
    ownerName: '-',
    permissionGroupCount: item.permission_group_count ?? 0,
    permissionPointCount: item.permission_point_count ?? 0,
    agentPrompt: '',
    createdAt: item.created_at,
    updatedAt: item.updated_at ?? item.created_at,
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
    'secret.copy',
    'secret.rotate',
    'role.update',
    'permission.query',
    'sync.run',
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
