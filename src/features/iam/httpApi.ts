import { httpRequest } from './httpClient';
import {
  mapAuditLog,
  mapRuntimeApplicationAdmin,
  mapRuntimeApplicationDiagnostics,
  mapRuntimeRedirectUri,
  mapCreateApplicationResult,
  mapCurrentSessionResponse,
  mapPageResult,
  mapRuntimeDepartment,
  mapRuntimeApplication,
  mapRuntimeDirectoryUser,
  mapRuntimePermissionRegistration,
  mapRuntimePermissionTree,
  mapRuntimeRole,
  mapRuntimeSyncPreflightResult,
  mapRuntimeSyncEvent,
  mapRuntimeSyncEventStatusOverview,
  mapRuntimeSyncRun,
  mapRuntimeSyncStatusOverview,
} from './dtoMappers';
import type {
  Application,
  AddApplicationAdminInput,
  ApplicationAdmin,
  ApplicationDiagnostics,
  ApplicationRedirectUri,
  ApplicationPermissionRegistration,
  AuditAction,
  AuditLog,
  AuditResult,
  CreateApplicationInput,
  CreateApplicationRedirectUriInput,
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
  RotateSecretResult,
  SecretKind,
  SyncPreflightResult,
  SyncEvent,
  SyncEventStatusOverview,
  SyncRun,
  SyncStatusOverview,
  UpdateRoleAuthorizationInput,
  UpsertRoleInput,
  UpdateApplicationRedirectUriStatusInput,
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
  redirect_uri_count?: number | null;
  active_redirect_uri_count?: number | null;
  admin_count?: number | null;
  app_secret_rotated_at?: string | null;
  api_secret_rotated_at?: string | null;
  last_api_called_at?: string | null;
  last_permission_query_at?: string | null;
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

export async function listApplicationRedirectUris(applicationId: string): Promise<ApplicationRedirectUri[]> {
  const result = await httpRequest<{ items: RuntimeRedirectUri[] }>(`/api/applications/${applicationId}/redirect-uris`);
  return result.items.map(mapRuntimeRedirectUri);
}

export async function createApplicationRedirectUri(
  applicationId: string,
  input: CreateApplicationRedirectUriInput,
): Promise<ApplicationRedirectUri> {
  return mapRuntimeRedirectUri(
    await httpRequest<RuntimeRedirectUri>(`/api/applications/${applicationId}/redirect-uris`, {
      method: 'POST',
      body: input,
    }),
  );
}

export async function updateApplicationRedirectUriStatus(
  applicationId: string,
  input: UpdateApplicationRedirectUriStatusInput,
): Promise<ApplicationRedirectUri> {
  return mapRuntimeRedirectUri(
    await httpRequest<RuntimeRedirectUri>(`/api/applications/${applicationId}/redirect-uris/status`, {
      method: 'PATCH',
      body: input,
    }),
  );
}

export async function rotateApplicationSecret(applicationId: string, kind: SecretKind): Promise<RotateSecretResult> {
  return httpRequest<RotateSecretResult>(`/api/applications/${applicationId}/secrets/rotate`, {
    method: 'POST',
    body: { kind },
  });
}

export async function listApplicationAdmins(applicationId: string): Promise<ApplicationAdmin[]> {
  const result = await httpRequest<{ items: RuntimeApplicationAdmin[] }>(`/api/applications/${applicationId}/admins`);
  return result.items.map(mapRuntimeApplicationAdmin);
}

export async function addApplicationAdmin(applicationId: string, input: AddApplicationAdminInput): Promise<ApplicationAdmin> {
  return mapRuntimeApplicationAdmin(
    await httpRequest<RuntimeApplicationAdmin>(`/api/applications/${applicationId}/admins`, {
      method: 'POST',
      body: input,
    }),
  );
}

export async function removeApplicationAdmin(applicationId: string, feishuUserId: string): Promise<{ ok: true }> {
  return httpRequest<{ ok: true }>(`/api/applications/${applicationId}/admins/${encodeURIComponent(feishuUserId)}`, {
    method: 'DELETE',
  });
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

export async function getApplicationDiagnostics(applicationId: string): Promise<ApplicationDiagnostics> {
  return mapRuntimeApplicationDiagnostics(await httpRequest(`/api/applications/${applicationId}/diagnostics`));
}

export async function copyApplicationDiagnostics(applicationId: string): Promise<{ ok: true }> {
  return httpRequest<{ ok: true }>(`/api/applications/${applicationId}/diagnostics/copy`, {
    method: 'POST',
    body: {},
  });
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
      permissionGroupCodes: input.permissionGroupKeys ?? [],
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

export async function listSyncRuns(request: PageRequest): Promise<PageResult<SyncRun>> {
  return mapPageResult(
    await httpRequest<RuntimePageResult<RuntimeSyncRun>>('/api/sync/runs', {
      query: { page: request.page, pageSize: request.pageSize },
    }),
    mapRuntimeSyncRun,
  );
}

export async function getSyncStatus(): Promise<SyncStatusOverview> {
  return mapRuntimeSyncStatusOverview(await httpRequest<RuntimeSyncStatusOverview>('/api/sync/status'));
}

export async function runSyncPreflight(): Promise<SyncPreflightResult> {
  return mapRuntimeSyncPreflightResult(await httpRequest<RuntimeSyncPreflightResult>('/api/sync/preflight', { method: 'POST' }));
}

export async function getLatestSyncRun(): Promise<SyncRun | undefined> {
  const page = await listSyncRuns({ page: 1, pageSize: 1 });
  return page.items[0];
}

export async function listSyncEvents(request: PageRequest): Promise<PageResult<SyncEvent>> {
  return mapPageResult(
    await httpRequest<RuntimePageResult<RuntimeSyncEvent>>('/api/sync/events', {
      query: { page: request.page, pageSize: request.pageSize },
    }),
    mapRuntimeSyncEvent,
  );
}

export async function getSyncEventStatus(): Promise<SyncEventStatusOverview> {
  return mapRuntimeSyncEventStatusOverview(await httpRequest<RuntimeSyncEventStatusOverview>('/api/sync/events/status'));
}

export async function retrySyncEvent(syncEventId: string): Promise<SyncEvent> {
  return mapRuntimeSyncEvent(await httpRequest<RuntimeSyncEvent>(`/api/sync/events/${syncEventId}/retry`, { method: 'POST' }));
}

export async function retrySyncRun(syncRunId: string): Promise<SyncRun> {
  return mapRuntimeSyncRun(await httpRequest<RuntimeSyncRun>(`/api/sync/runs/${syncRunId}/retry`, { method: 'POST' }));
}

export async function startManualSync(): Promise<SyncRun> {
  return mapRuntimeSyncRun(await httpRequest<RuntimeSyncRun>('/api/sync/runs', { method: 'POST' }));
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
