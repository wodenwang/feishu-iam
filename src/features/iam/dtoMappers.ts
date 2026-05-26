import type {
  Application,
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
  secret_status?: {
    app_secret?: string;
    api_secret?: string;
  };
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
    lastApiCalledAt: item.last_api_called_at ?? item.last_permission_query_at ?? undefined,
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
    'role.create',
    'secret.copy',
    'secret.rotate',
    'role.update',
    'role.authorization.update',
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
