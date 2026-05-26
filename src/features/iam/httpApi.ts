import { httpRequest } from './httpClient';
import {
  mapAuditLog,
  mapCreateApplicationResult,
  mapCurrentSessionResponse,
  mapPageResult,
  mapRuntimeDepartment,
  mapRuntimeApplication,
  mapRuntimeDirectoryUser,
  mapRuntimePermissionRegistration,
  mapRuntimePermissionTree,
  mapRuntimeRole,
} from './dtoMappers';
import type {
  Application,
  ApplicationPermissionRegistration,
  AuditAction,
  AuditLog,
  AuditResult,
  CreateApplicationInput,
  CreateApplicationResult,
  CurrentSession,
  DashboardSummary,
  DirectoryUser,
  FeishuDepartment,
  IamPermissionNode,
  IamRole,
  ListRolesRequest,
  PageRequest,
  PageResult,
  SyncRun,
  UpdateRoleAuthorizationInput,
  UpsertRoleInput,
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
  children?: RuntimePermissionNode[];
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

export async function getCurrentSession(): Promise<CurrentSession> {
  return mapCurrentSessionResponse(await httpRequest('/api/session/current'));
}

export async function getInitializationStatus(): Promise<{ initialized: boolean }> {
  return httpRequest('/api/initialization/status');
}

export async function bindPlatformAdmin(): Promise<{ initialized: boolean; platformAdminFeishuUserId: string }> {
  return httpRequest('/api/initialization/bind-platform-admin', { method: 'POST' });
}

export async function mockFeishuLogin(input: { feishuUserId: string; name: string; email?: string }): Promise<{ redirectTo?: string }> {
  return httpRequest('/api/dev/feishu/mock-login', { method: 'POST', body: input });
}

export async function logout(): Promise<void> {
  await httpRequest('/api/auth/logout', { method: 'POST' });
}

export async function listApplications(
  request: PageRequest & {
    keyword?: string;
    status?: Application['status'];
    createdAtFrom?: string;
    createdAtTo?: string;
    allowedApplicationIds?: string[];
  },
): Promise<PageResult<Application>> {
  const { page, pageSize, keyword, status, createdAtFrom, createdAtTo } = request;
  return mapPageResult(
    await httpRequest<RuntimePageResult<RuntimeApplication>>('/api/applications', {
      query: { page, pageSize, keyword, status, createdAtFrom, createdAtTo },
    }),
    mapRuntimeApplication,
  );
}

export async function createApplication(input: Pick<CreateApplicationInput, 'name' | 'ownerFeishuUserId'>): Promise<CreateApplicationResult> {
  return mapCreateApplicationResult(
    await httpRequest('/api/applications', { method: 'POST', body: { name: input.name, ownerFeishuUserId: input.ownerFeishuUserId } }),
  );
}

export async function listAuditLogs(
  request: PageRequest & {
    action?: AuditAction;
    result?: AuditResult;
    keyword?: string;
    applicationId?: string;
  },
): Promise<PageResult<AuditLog>> {
  const { page, pageSize, action, result, keyword, applicationId } = request;
  return mapPageResult(
    await httpRequest<RuntimePageResult<RuntimeAuditLog>>('/api/audit-logs', {
      query: { page, pageSize, action, result, keyword, targetId: applicationId, targetType: applicationId ? 'application' : undefined },
    }),
    mapAuditLog,
  );
}

export function getDashboardSummary(): Promise<DashboardSummary> {
  return unsupportedHttpMethod('getDashboardSummary');
}

export async function getApplication(applicationId: string): Promise<Application> {
  return mapRuntimeApplication(await httpRequest<RuntimeApplication>(`/api/applications/${applicationId}`));
}

export function batchDisableApplications(_applicationIds: string[]): Promise<Application[]> {
  return unsupportedHttpMethod('batchDisableApplications');
}

export function rotateApplicationSecret(_applicationId: string, _secretType: 'appsecret' | 'apiSecret'): Promise<Application> {
  return unsupportedHttpMethod('rotateApplicationSecret');
}

export async function recordRuntimeSecretCopy(
  applicationId: string,
  kind: 'runtime_env' | 'agent_prompt' = 'runtime_env',
): Promise<AuditLog> {
  await httpRequest(`/api/applications/${applicationId}/secret-copy-events`, {
    method: 'POST',
    body: { kind },
  });
  return {
    id: `${applicationId}:${kind}`,
    action: 'secret.copy',
    result: 'success',
    actorFeishuUserId: '-',
    applicationId,
    message: kind === 'agent_prompt' ? '复制 Agent Prompt' : '复制运行时环境变量',
    requestId: '-',
    createdAt: new Date().toISOString(),
  };
}

export async function listApplicationPermissionRegistrations(
  applicationId: string,
): Promise<ApplicationPermissionRegistration[]> {
  const result = await httpRequest<{ items: RuntimePermissionRegistration[] }>(
    `/api/applications/${applicationId}/permission-registrations`,
  );
  return result.items.map(mapRuntimePermissionRegistration);
}

export async function createRole(input: UpsertRoleInput): Promise<IamRole> {
  const application = await findApplicationForHttpRole(input.applicationId);
  const role = await httpRequest<RuntimeRole>('/api/roles', {
    method: 'POST',
    body: {
      appKey: application.appKey,
      code: input.code,
      name: input.name,
      description: input.description,
      status: input.status,
    },
  });
  return mapRuntimeRole({
    ...role,
    application_id: application.id,
    application_name: application.name,
    app_key: application.appKey,
  });
}

export async function updateRole(roleId: string, input: UpsertRoleInput): Promise<IamRole> {
  const application = await findApplicationForHttpRole(input.applicationId);
  const role = await httpRequest<RuntimeRole>(`/api/roles/${roleId}`, {
    method: 'PATCH',
    body: {
      name: input.name,
      description: input.description,
      status: input.status,
    },
  });
  return mapRuntimeRole({
    ...role,
    application_id: application.id,
    application_name: application.name,
    app_key: application.appKey,
  });
}

export async function updateRoleAuthorization(input: UpdateRoleAuthorizationInput): Promise<IamRole> {
  await httpRequest(`/api/roles/${input.roleId}/authorization`, {
    method: 'PUT',
    body: {
      permissionPointCodes: input.permissionKeys,
      departmentIds: input.departmentIds,
      feishuUserIds: input.userIds,
    },
  });
  return findRuntimeRoleById(input.roleId);
}

export async function disableRoles(roleIds: string[]): Promise<IamRole[]> {
  return Promise.all(
    roleIds.map(async (roleId) =>
      mapRuntimeRole(await httpRequest<RuntimeRole>(`/api/roles/${roleId}`, { method: 'PATCH', body: { status: 'disabled' } })),
    ),
  );
}

export async function listRoles(request: ListRolesRequest): Promise<PageResult<IamRole>> {
  const appKey = request.applicationId ? (await findApplicationForHttpRole(request.applicationId)).appKey : undefined;
  return mapPageResult(
    await httpRequest<RuntimePageResult<RuntimeRole>>('/api/roles', {
      query: {
        page: request.page,
        pageSize: request.pageSize,
        appKey,
        keyword: request.keyword,
        status: request.status,
        createdAtFrom: request.createdAtFrom,
        createdAtTo: request.createdAtTo,
      },
    }),
    mapRuntimeRole,
  );
}

export async function listIamPermissionTree(): Promise<IamPermissionNode[]> {
  const result = await httpRequest<{ items: RuntimePermissionNode[] }>('/api/roles/permission-tree');
  return mapRuntimePermissionTree(result.items);
}

export async function listFeishuDepartments(): Promise<FeishuDepartment[]> {
  const pageSize = 100;
  const departments: FeishuDepartment[] = [];
  let pageNumber = 1;
  let total = 0;

  do {
    const page = await httpRequest<RuntimePageResult<RuntimeDepartment>>('/api/directory/departments', {
      query: { page: pageNumber, pageSize },
    });
    departments.push(...page.items.map(mapRuntimeDepartment));
    total = page.total ?? departments.length;
    pageNumber += 1;
  } while (departments.length < total);

  return departments;
}

export async function listDirectoryUsers(request: PageRequest & { departmentId?: string }): Promise<PageResult<DirectoryUser>> {
  const { page, pageSize, departmentId } = request;
  return mapPageResult(
    await httpRequest<RuntimePageResult<RuntimeDirectoryUser>>('/api/directory/users', {
      query: { departmentId, page, pageSize },
    }),
    mapRuntimeDirectoryUser,
  );
}

export function listSyncRuns(_request: PageRequest): Promise<PageResult<SyncRun>> {
  return unsupportedHttpMethod('listSyncRuns');
}

export function getLatestSyncRun(): Promise<SyncRun | undefined> {
  return unsupportedHttpMethod('getLatestSyncRun');
}

export function retrySyncRun(_syncRunId: string): Promise<SyncRun> {
  return unsupportedHttpMethod('retrySyncRun');
}

export function startManualSync(): Promise<SyncRun> {
  return unsupportedHttpMethod('startManualSync');
}

function unsupportedHttpMethod(name: string): never {
  throw new Error(`${name} is not available in HTTP mode for the current vertical slice`);
}

async function findApplicationForHttpRole(applicationId: string): Promise<Application> {
  const applications = await listApplications({ page: 1, pageSize: 100 });
  const application = applications.items.find((item) => item.id === applicationId);
  if (!application) {
    throw new Error(`APPLICATION_NOT_FOUND:${applicationId}`);
  }
  return application;
}

async function findRuntimeRoleById(roleId: string): Promise<IamRole> {
  const roles = await listRoles({ page: 1, pageSize: 100 });
  const role = roles.items.find((item) => item.id === roleId);
  if (!role) {
    throw new Error(`ROLE_NOT_FOUND:${roleId}`);
  }
  return role;
}
