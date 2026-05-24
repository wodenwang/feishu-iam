import {
  applicationPermissionRegistrations,
  applications,
  auditLogs,
  dashboardSummary,
  directoryUsers,
  feishuDepartments,
  iamPermissionTree,
  iamRoles,
  platformAdminSession,
  syncRuns,
} from './mockData';
import type {
  Application,
  ApplicationPermissionRegistration,
  ApplicationStatus,
  AuditLog,
  CreateApplicationInput,
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

interface MockIamStore {
  applications: Application[];
  roles: IamRole[];
  departments: FeishuDepartment[];
  directoryUsers: DirectoryUser[];
  permissionRegistrations: ApplicationPermissionRegistration[];
  auditLogs: AuditLog[];
  syncRuns: SyncRun[];
}

const cloneApplication = (application: Application): Application => ({
  ...application,
  callbackUrls: [...application.callbackUrls],
  allowedOrigins: [...application.allowedOrigins],
});

const cloneCurrentSession = (session: CurrentSession): CurrentSession => ({
  user: { ...session.user },
  roles: [...session.roles],
  permissions: [...session.permissions],
  applicationIds: [...session.applicationIds],
});

const cloneAuditLog = (auditLog: AuditLog): AuditLog => ({ ...auditLog });
const cloneSyncRun = (syncRun: SyncRun): SyncRun => ({
  ...syncRun,
  diffSummary: { ...syncRun.diffSummary },
});
const clonePermissionRegistration = (
  registration: ApplicationPermissionRegistration,
): ApplicationPermissionRegistration => ({ ...registration });
const cloneRole = (role: IamRole): IamRole => ({
  ...role,
  permissionKeys: [...role.permissionKeys],
  departmentIds: [...role.departmentIds],
  userIds: [...role.userIds],
});
const cloneDepartment = (department: FeishuDepartment): FeishuDepartment => ({ ...department });
const cloneDirectoryUser = (user: DirectoryUser): DirectoryUser => ({ ...user });
const clonePermissionNode = (node: IamPermissionNode): IamPermissionNode => ({
  ...node,
  children: node.children?.map(clonePermissionNode),
});

const createMockIamStore = (): MockIamStore => ({
  applications: applications.map(cloneApplication),
  roles: iamRoles.map(cloneRole),
  departments: feishuDepartments.map(cloneDepartment),
  directoryUsers: directoryUsers.map(cloneDirectoryUser),
  permissionRegistrations: applicationPermissionRegistrations.map(clonePermissionRegistration),
  auditLogs: auditLogs.map(cloneAuditLog),
  syncRuns: syncRuns.map(cloneSyncRun),
});

let mockIamStore = createMockIamStore();
let mockCurrentSession = platformAdminSession;
let nextApplicationsListError: Error | undefined;
let nextAuditLogsListError: Error | undefined;
let nextRolesListError: Error | undefined;

const wait = (ms = 80) =>
  new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });

const paginate = <T>(items: T[], request: PageRequest): PageResult<T> => {
  const start = (request.page - 1) * request.pageSize;

  return {
    items: items.slice(start, start + request.pageSize),
    total: items.length,
    page: request.page,
    pageSize: request.pageSize,
  };
};

const createUniqueApplicationId = (code: string) => {
  const baseId = `app_${code.replaceAll('-', '_')}`;
  const existingIds = new Set(mockIamStore.applications.map((item) => item.id));

  if (!existingIds.has(baseId)) {
    return baseId;
  }

  let index = 1;
  let nextId = `${baseId}_${index}`;
  while (existingIds.has(nextId)) {
    index += 1;
    nextId = `${baseId}_${index}`;
  }

  return nextId;
};

const createUniqueRoleId = (code: string) => {
  const baseId = `role_${code.replaceAll('-', '_')}`;
  const existingIds = new Set(mockIamStore.roles.map((item) => item.id));

  if (!existingIds.has(baseId)) {
    return baseId;
  }

  let index = 1;
  let nextId = `${baseId}_${index}`;
  while (existingIds.has(nextId)) {
    index += 1;
    nextId = `${baseId}_${index}`;
  }

  return nextId;
};

const countPermissionGroups = (permissionKeys: string[]) => permissionKeys.filter((key) => !key.includes(':')).length;
const countPermissionPoints = (permissionKeys: string[]) => permissionKeys.filter((key) => key.includes(':')).length;

const appendRoleAuditLog = (message: string, applicationId?: string) => {
  const now = new Date().toISOString();
  mockIamStore.auditLogs = [
    {
      id: `audit_role_update_${Date.now()}`,
      action: 'role.update',
      result: 'success',
      actorFeishuUserId: mockCurrentSession.user.feishuUserId,
      applicationId,
      message,
      requestId: `req_${Date.now()}`,
      createdAt: now,
    },
    ...mockIamStore.auditLogs,
  ];
};

export function resetMockIamStore() {
  mockIamStore = createMockIamStore();
  mockCurrentSession = platformAdminSession;
  nextApplicationsListError = undefined;
  nextAuditLogsListError = undefined;
  nextRolesListError = undefined;
}

export function setMockCurrentSession(session: CurrentSession) {
  mockCurrentSession = cloneCurrentSession(session);
}

export function rejectNextApplicationsList(error: Error) {
  nextApplicationsListError = error;
}

export function rejectNextAuditLogsList(error: Error) {
  nextAuditLogsListError = error;
}

export function rejectNextRolesList(error: Error) {
  nextRolesListError = error;
}

export async function getCurrentSession(): Promise<CurrentSession> {
  await wait();
  return cloneCurrentSession(mockCurrentSession);
}

export async function getInitializationStatus(): Promise<{ initialized: boolean }> {
  await wait();
  return { initialized: false };
}

export async function bindPlatformAdmin(): Promise<{ initialized: boolean; platformAdminFeishuUserId: string }> {
  await wait();
  return { initialized: true, platformAdminFeishuUserId: mockCurrentSession.user.feishuUserId };
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  await wait();
  const applicationCount = mockIamStore.applications.length;
  const permissionPointCount = mockIamStore.applications.reduce((total, item) => total + item.permissionPointCount, 0);

  return {
    ...dashboardSummary,
    applicationCount,
    permissionPointCount,
    auditEventCount24h: mockIamStore.auditLogs.length,
    lastSync: { ...dashboardSummary.lastSync },
  };
}

export async function listApplications(
  request: PageRequest & {
    keyword?: string;
    status?: ApplicationStatus;
    createdAtFrom?: string;
    createdAtTo?: string;
    allowedApplicationIds?: string[];
  },
): Promise<PageResult<Application>> {
  await wait();

  if (nextApplicationsListError) {
    const error = nextApplicationsListError;
    nextApplicationsListError = undefined;
    throw error;
  }

  const keyword = request.keyword?.trim().toLowerCase();
  const sessionApplicationScope =
    mockCurrentSession.roles.includes('application_admin') && !mockCurrentSession.roles.includes('platform_admin')
      ? mockCurrentSession.applicationIds
      : undefined;
  const allowedApplicationIds = request.allowedApplicationIds ?? sessionApplicationScope;
  const scopeFiltered = allowedApplicationIds
    ? mockIamStore.applications.filter((item) => allowedApplicationIds.includes(item.id))
    : mockIamStore.applications;
  const keywordFiltered = keyword
    ? scopeFiltered.filter(
        (item) => item.name.toLowerCase().includes(keyword) || item.code.toLowerCase().includes(keyword),
      )
    : scopeFiltered;
  const statusFiltered = request.status ? keywordFiltered.filter((item) => item.status === request.status) : keywordFiltered;
  const filtered = statusFiltered.filter((item) => {
    const createdAt = new Date(item.createdAt).getTime();
    const createdAtFrom = request.createdAtFrom ? new Date(request.createdAtFrom).getTime() : undefined;
    const createdAtTo = request.createdAtTo ? new Date(request.createdAtTo).getTime() : undefined;

    return (!createdAtFrom || createdAt >= createdAtFrom) && (!createdAtTo || createdAt <= createdAtTo);
  });

  return paginate(filtered.map(cloneApplication), request);
}

export async function listRoles(request: ListRolesRequest): Promise<PageResult<IamRole>> {
  await wait();

  if (nextRolesListError) {
    const error = nextRolesListError;
    nextRolesListError = undefined;
    throw error;
  }

  const keyword = request.keyword?.trim().toLowerCase();
  const sessionApplicationScope =
    mockCurrentSession.roles.includes('application_admin') && !mockCurrentSession.roles.includes('platform_admin')
      ? mockCurrentSession.applicationIds
      : undefined;
  const allowedApplicationIds = request.allowedApplicationIds ?? sessionApplicationScope;
  const scopeFiltered = allowedApplicationIds
    ? mockIamStore.roles.filter((item) => allowedApplicationIds.includes(item.applicationId))
    : mockIamStore.roles;
  const keywordFiltered = keyword
    ? scopeFiltered.filter(
        (item) =>
          item.name.toLowerCase().includes(keyword) ||
          item.code.toLowerCase().includes(keyword) ||
          item.applicationName.toLowerCase().includes(keyword),
      )
    : scopeFiltered;
  const applicationFiltered = request.applicationId
    ? keywordFiltered.filter((item) => item.applicationId === request.applicationId)
    : keywordFiltered;
  const statusFiltered = request.status ? applicationFiltered.filter((item) => item.status === request.status) : applicationFiltered;
  const filtered = statusFiltered.filter((item) => {
    const createdAt = new Date(item.createdAt).getTime();
    const createdAtFrom = request.createdAtFrom ? new Date(request.createdAtFrom).getTime() : undefined;
    const createdAtTo = request.createdAtTo ? new Date(request.createdAtTo).getTime() : undefined;

    return (!createdAtFrom || createdAt >= createdAtFrom) && (!createdAtTo || createdAt <= createdAtTo);
  });

  return paginate(filtered.map(cloneRole), request);
}

export async function createRole(input: UpsertRoleInput): Promise<IamRole> {
  await wait();

  const application = mockIamStore.applications.find((item) => item.id === input.applicationId);
  if (!application) {
    throw new Error('application not found');
  }

  const now = new Date().toISOString();
  const role: IamRole = {
    id: createUniqueRoleId(input.code),
    applicationId: input.applicationId,
    applicationName: application.name,
    name: input.name,
    code: input.code,
    description: input.description,
    status: input.status,
    permissionGroupCount: 0,
    permissionPointCount: 0,
    departmentBindingCount: 0,
    userBindingCount: 0,
    permissionKeys: [],
    departmentIds: [],
    userIds: [],
    createdAt: now,
    updatedAt: now,
  };

  mockIamStore.roles = [role, ...mockIamStore.roles];
  appendRoleAuditLog(`创建角色 ${role.name}`, role.applicationId);

  return cloneRole(role);
}

export async function updateRole(roleId: string, input: UpsertRoleInput): Promise<IamRole> {
  await wait();

  const application = mockIamStore.applications.find((item) => item.id === input.applicationId);
  if (!application) {
    throw new Error('application not found');
  }

  const now = new Date().toISOString();
  let updatedRole: IamRole | undefined;
  mockIamStore.roles = mockIamStore.roles.map((role) => {
    if (role.id !== roleId) {
      return role;
    }

    updatedRole = {
      ...role,
      applicationId: input.applicationId,
      applicationName: application.name,
      name: input.name,
      code: input.code,
      description: input.description,
      status: input.status,
      updatedAt: now,
    };
    return updatedRole;
  });

  if (!updatedRole) {
    throw new Error('role not found');
  }

  appendRoleAuditLog(`更新角色 ${updatedRole.name}`, updatedRole.applicationId);
  return cloneRole(updatedRole);
}

export async function updateRoleAuthorization(input: UpdateRoleAuthorizationInput): Promise<IamRole> {
  await wait();

  const now = new Date().toISOString();
  let updatedRole: IamRole | undefined;
  mockIamStore.roles = mockIamStore.roles.map((role) => {
    if (role.id !== input.roleId) {
      return role;
    }

    updatedRole = {
      ...role,
      permissionKeys: [...input.permissionKeys],
      departmentIds: [...input.departmentIds],
      userIds: [...input.userIds],
      permissionGroupCount: countPermissionGroups(input.permissionKeys),
      permissionPointCount: countPermissionPoints(input.permissionKeys),
      departmentBindingCount: input.departmentIds.length,
      userBindingCount: input.userIds.length,
      updatedAt: now,
    };
    return updatedRole;
  });

  if (!updatedRole) {
    throw new Error('role not found');
  }

  appendRoleAuditLog(`更新角色授权 ${updatedRole.name}`, updatedRole.applicationId);
  return cloneRole(updatedRole);
}

export async function disableRoles(roleIds: string[]): Promise<IamRole[]> {
  await wait();

  const disabledIdSet = new Set(roleIds);
  const now = new Date().toISOString();
  mockIamStore.roles = mockIamStore.roles.map((role) =>
    disabledIdSet.has(role.id) ? { ...role, status: 'disabled', updatedAt: now } : role,
  );
  appendRoleAuditLog(`停用 ${roleIds.length} 个角色`);

  return mockIamStore.roles.filter((role) => disabledIdSet.has(role.id)).map(cloneRole);
}

export async function listIamPermissionTree(): Promise<IamPermissionNode[]> {
  await wait();
  return iamPermissionTree.map(clonePermissionNode);
}

export async function listFeishuDepartments(): Promise<FeishuDepartment[]> {
  await wait();
  return mockIamStore.departments.map(cloneDepartment);
}

export async function listDirectoryUsers(request: PageRequest & { departmentId?: string }): Promise<PageResult<DirectoryUser>> {
  await wait();

  const department = request.departmentId
    ? mockIamStore.departments.find((item) => item.id === request.departmentId)
    : undefined;
  const filtered =
    department && department.id !== 'dept_root'
      ? mockIamStore.directoryUsers.filter((item) => item.departmentPath.startsWith(department.path))
      : mockIamStore.directoryUsers;

  return paginate(filtered.map(cloneDirectoryUser), request);
}

export async function getApplication(applicationId: string): Promise<Application> {
  await wait();

  const application = mockIamStore.applications.find((item) => item.id === applicationId);
  if (!application) {
    throw new Error('application not found');
  }

  return cloneApplication(application);
}

export async function createApplication(input: CreateApplicationInput): Promise<Application> {
  await wait();

  const now = new Date().toISOString();
  const timestamp = Date.now();
  const app: Application = {
    id: createUniqueApplicationId(input.code),
    name: input.name,
    code: input.code,
    description: input.description,
    status: 'active',
    appKey: `app_${input.code}_${timestamp}`,
    appSecretPreview: 'sec_****_new',
    apiKey: `api_${input.code}_${timestamp}`,
    apiSecretPreview: 'api_****_new',
    callbackUrls: input.callbackUrls,
    allowedOrigins: input.allowedOrigins,
    ownerFeishuUserId: input.ownerFeishuUserId ?? mockCurrentSession.user.feishuUserId,
    ownerName: input.ownerFeishuUserId ? platformAdminSession.user.displayName : mockCurrentSession.user.displayName,
    permissionGroupCount: 0,
    permissionPointCount: 0,
    agentPrompt: [
      '使用环境变量接入 feishu-iam。',
      'IAM_APP_SECRET=${IAM_APP_SECRET}',
      'IAM_API_SECRET=${IAM_API_SECRET}',
      '禁止把真实 secret 写入 AGENTS.md、CLAUDE.md、README、示例代码或 Git。',
    ].join('\n'),
    createdAt: now,
    updatedAt: now,
  };

  mockIamStore.applications = [app, ...mockIamStore.applications];
  return cloneApplication(app);
}

export async function batchDisableApplications(applicationIds: string[]): Promise<Application[]> {
  await wait();

  const disabledIdSet = new Set(applicationIds);
  const now = new Date().toISOString();
  mockIamStore.applications = mockIamStore.applications.map((application) =>
    disabledIdSet.has(application.id) ? { ...application, status: 'disabled', updatedAt: now } : application,
  );

  return mockIamStore.applications.filter((application) => disabledIdSet.has(application.id)).map(cloneApplication);
}

export async function rotateApplicationSecret(applicationId: string, secretType: 'appsecret' | 'apiSecret'): Promise<Application> {
  await wait();

  const now = new Date().toISOString();
  let rotatedApplication: Application | undefined;
  mockIamStore.applications = mockIamStore.applications.map((application) => {
    if (application.id !== applicationId) {
      return application;
    }

    rotatedApplication = {
      ...application,
      appSecretPreview: secretType === 'appsecret' ? 'sec_****_rotated' : application.appSecretPreview,
      apiSecretPreview: secretType === 'apiSecret' ? 'api_****_rotated' : application.apiSecretPreview,
      updatedAt: now,
    };
    return rotatedApplication;
  });

  if (!rotatedApplication) {
    throw new Error('application not found');
  }

  mockIamStore.auditLogs = [
    {
      id: `audit_secret_rotate_${Date.now()}`,
      action: 'secret.rotate',
      result: 'success',
      actorFeishuUserId: mockCurrentSession.user.feishuUserId,
      applicationId,
      message: secretType === 'appsecret' ? '轮换 appsecret' : '轮换 API secret',
      requestId: `req_${Date.now()}`,
      createdAt: now,
    },
    ...mockIamStore.auditLogs,
  ];

  return cloneApplication(rotatedApplication);
}

export async function recordRuntimeSecretCopy(applicationId: string): Promise<AuditLog> {
  await wait();

  const now = new Date().toISOString();
  const auditLog: AuditLog = {
    id: `audit_secret_copy_${Date.now()}`,
    action: 'secret.copy',
    result: 'success',
    actorFeishuUserId: mockCurrentSession.user.feishuUserId,
    applicationId,
    message: '复制运行时环境变量',
    requestId: `req_${Date.now()}`,
    createdAt: now,
  };
  mockIamStore.auditLogs = [auditLog, ...mockIamStore.auditLogs];

  return cloneAuditLog(auditLog);
}

export async function listApplicationPermissionRegistrations(
  applicationId: string,
): Promise<ApplicationPermissionRegistration[]> {
  await wait();

  return mockIamStore.permissionRegistrations
    .filter((item) => item.applicationId === applicationId)
    .map(clonePermissionRegistration);
}

export async function listAuditLogs(
  request: PageRequest & {
    action?: AuditLog['action'];
    result?: AuditLog['result'];
    keyword?: string;
    applicationId?: string;
    createdAtFrom?: string;
    createdAtTo?: string;
  },
): Promise<PageResult<AuditLog>> {
  await wait();

  if (nextAuditLogsListError) {
    const error = nextAuditLogsListError;
    nextAuditLogsListError = undefined;
    throw error;
  }

  const keyword = request.keyword?.trim().toLowerCase();
  const filtered = mockIamStore.auditLogs.filter((item) => {
    const createdAt = new Date(item.createdAt).getTime();
    const createdAtFrom = request.createdAtFrom ? new Date(request.createdAtFrom).getTime() : undefined;
    const createdAtTo = request.createdAtTo ? new Date(request.createdAtTo).getTime() : undefined;
    const matchesKeyword = keyword
      ? [item.message, item.requestId, item.actorFeishuUserId, item.applicationId]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(keyword))
      : true;

    return (
      (!request.action || item.action === request.action) &&
      (!request.result || item.result === request.result) &&
      (!request.applicationId || item.applicationId === request.applicationId) &&
      (!createdAtFrom || createdAt >= createdAtFrom) &&
      (!createdAtTo || createdAt <= createdAtTo) &&
      matchesKeyword
    );
  });

  return paginate(filtered.map(cloneAuditLog), request);
}

export async function listSyncRuns(request: PageRequest): Promise<PageResult<SyncRun>> {
  await wait();
  return paginate(mockIamStore.syncRuns.map(cloneSyncRun), request);
}

export async function getLatestSyncRun(): Promise<SyncRun | undefined> {
  await wait();
  return mockIamStore.syncRuns[0] ? cloneSyncRun(mockIamStore.syncRuns[0]) : undefined;
}

export async function retrySyncRun(syncRunId: string): Promise<SyncRun> {
  await wait();

  const source = mockIamStore.syncRuns.find((item) => item.id === syncRunId);
  if (!source) {
    throw new Error('sync run not found');
  }

  const now = new Date().toISOString();
  const retryRun: SyncRun = {
    ...source,
    id: `sync_run_retry_${Date.now()}`,
    trigger: 'retry',
    status: 'running',
    startedAt: now,
    finishedAt: undefined,
    durationSeconds: undefined,
    errorMessage: undefined,
    failedCount: 0,
    diffSummary: { ...source.diffSummary, failedUsers: 0 },
  };

  mockIamStore.syncRuns = [retryRun, ...mockIamStore.syncRuns];
  return cloneSyncRun(retryRun);
}

export async function startManualSync(): Promise<SyncRun> {
  await wait();

  const now = new Date().toISOString();
  const syncRun: SyncRun = {
    id: `sync_run_manual_${Date.now()}`,
    trigger: 'manual',
    status: 'running',
    startedAt: now,
    userChanges: 0,
    departmentChanges: 0,
    operatorFeishuUserId: mockCurrentSession.user.feishuUserId,
    requestBatchCount: 1,
    successCount: 0,
    failedCount: 0,
    diffSummary: {
      createdUsers: 0,
      updatedUsers: 0,
      resignedUsers: 0,
      failedUsers: 0,
      createdDepartments: 0,
      updatedDepartments: 0,
    },
  };

  mockIamStore.syncRuns = [syncRun, ...mockIamStore.syncRuns];
  return cloneSyncRun(syncRun);
}
