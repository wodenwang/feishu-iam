import { applications, auditLogs, dashboardSummary, platformAdminSession } from './mockData';
import type {
  Application,
  ApplicationStatus,
  AuditLog,
  CreateApplicationInput,
  CurrentSession,
  DashboardSummary,
  PageRequest,
  PageResult,
} from './types';

interface MockIamStore {
  applications: Application[];
  auditLogs: AuditLog[];
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

const createMockIamStore = (): MockIamStore => ({
  applications: applications.map(cloneApplication),
  auditLogs: auditLogs.map(cloneAuditLog),
});

let mockIamStore = createMockIamStore();
let mockCurrentSession = platformAdminSession;
let nextApplicationsListError: Error | undefined;

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

export function resetMockIamStore() {
  mockIamStore = createMockIamStore();
  mockCurrentSession = platformAdminSession;
  nextApplicationsListError = undefined;
}

export function setMockCurrentSession(session: CurrentSession) {
  mockCurrentSession = cloneCurrentSession(session);
}

export function rejectNextApplicationsList(error: Error) {
  nextApplicationsListError = error;
}

export async function getCurrentSession(): Promise<CurrentSession> {
  await wait();
  return cloneCurrentSession(mockCurrentSession);
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
  request: PageRequest & { keyword?: string; status?: ApplicationStatus },
): Promise<PageResult<Application>> {
  await wait();

  if (nextApplicationsListError) {
    const error = nextApplicationsListError;
    nextApplicationsListError = undefined;
    throw error;
  }

  const keyword = request.keyword?.trim().toLowerCase();
  const keywordFiltered = keyword
    ? mockIamStore.applications.filter(
        (item) => item.name.toLowerCase().includes(keyword) || item.code.toLowerCase().includes(keyword),
      )
    : mockIamStore.applications;
  const filtered = request.status ? keywordFiltered.filter((item) => item.status === request.status) : keywordFiltered;

  return paginate(filtered.map(cloneApplication), request);
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
    ownerFeishuUserId: input.ownerFeishuUserId,
    ownerName: platformAdminSession.user.displayName,
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

export async function listAuditLogs(request: PageRequest & { action?: AuditLog['action'] }): Promise<PageResult<AuditLog>> {
  await wait();

  const filtered = request.action ? mockIamStore.auditLogs.filter((item) => item.action === request.action) : mockIamStore.auditLogs;

  return paginate(filtered.map(cloneAuditLog), request);
}
