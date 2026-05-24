import { httpRequest } from './httpClient';
import {
  mapAuditLog,
  mapCreateApplicationResult,
  mapCurrentSessionResponse,
  mapPageResult,
  mapRuntimeApplication,
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

export async function getCurrentSession(): Promise<CurrentSession> {
  return mapCurrentSessionResponse(await httpRequest('/api/session/current'));
}

export async function getInitializationStatus(): Promise<{ initialized: boolean }> {
  return httpRequest('/api/initialization/status');
}

export async function bindPlatformAdmin(): Promise<{ initialized: boolean; platformAdminFeishuUserId: string }> {
  return httpRequest('/api/initialization/bind-platform-admin', { method: 'POST' });
}

export async function mockFeishuLogin(input: { feishuUserId: string; name: string; email?: string }) {
  return httpRequest('/api/dev/feishu/mock-login', { method: 'POST', body: input });
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

export async function createApplication(input: Pick<CreateApplicationInput, 'name'>): Promise<CreateApplicationResult> {
  return mapCreateApplicationResult(await httpRequest('/api/applications', { method: 'POST', body: { name: input.name } }));
}

export async function listAuditLogs(
  request: PageRequest & {
    action?: AuditAction;
    result?: AuditResult;
    keyword?: string;
  },
): Promise<PageResult<AuditLog>> {
  const { page, pageSize, action, result, keyword } = request;
  return mapPageResult(
    await httpRequest<RuntimePageResult<RuntimeAuditLog>>('/api/audit-logs', { query: { page, pageSize, action, result, keyword } }),
    mapAuditLog,
  );
}

export function getDashboardSummary(): Promise<DashboardSummary> {
  return unsupportedHttpMethod('getDashboardSummary');
}

export function getApplication(_applicationId: string): Promise<Application> {
  return unsupportedHttpMethod('getApplication');
}

export function batchDisableApplications(_applicationIds: string[]): Promise<Application[]> {
  return unsupportedHttpMethod('batchDisableApplications');
}

export function rotateApplicationSecret(_applicationId: string, _secretType: 'appsecret' | 'apiSecret'): Promise<Application> {
  return unsupportedHttpMethod('rotateApplicationSecret');
}

export function recordRuntimeSecretCopy(_applicationId: string): Promise<AuditLog> {
  return unsupportedHttpMethod('recordRuntimeSecretCopy');
}

export function listApplicationPermissionRegistrations(
  _applicationId: string,
): Promise<ApplicationPermissionRegistration[]> {
  return unsupportedHttpMethod('listApplicationPermissionRegistrations');
}

export function createRole(_input: UpsertRoleInput): Promise<IamRole> {
  return unsupportedHttpMethod('createRole');
}

export function updateRole(_roleId: string, _input: UpsertRoleInput): Promise<IamRole> {
  return unsupportedHttpMethod('updateRole');
}

export function updateRoleAuthorization(_input: UpdateRoleAuthorizationInput): Promise<IamRole> {
  return unsupportedHttpMethod('updateRoleAuthorization');
}

export function disableRoles(_roleIds: string[]): Promise<IamRole[]> {
  return unsupportedHttpMethod('disableRoles');
}

export function listRoles(_request: ListRolesRequest): Promise<PageResult<IamRole>> {
  return unsupportedHttpMethod('listRoles');
}

export function listIamPermissionTree(): Promise<IamPermissionNode[]> {
  return unsupportedHttpMethod('listIamPermissionTree');
}

export function listFeishuDepartments(): Promise<FeishuDepartment[]> {
  return unsupportedHttpMethod('listFeishuDepartments');
}

export function listDirectoryUsers(_request: PageRequest & { departmentId?: string }): Promise<PageResult<DirectoryUser>> {
  return unsupportedHttpMethod('listDirectoryUsers');
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
  throw new Error(`${name} is not available in HTTP mode for v0.1.3 first vertical slice`);
}
