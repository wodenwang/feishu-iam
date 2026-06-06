import type { AdminMe, PageResult } from '../admin-types';

export class AdminApiError extends Error {
  readonly code?: string;
  readonly requestId?: string;
  readonly status: number;

  constructor(params: { status: number; message: string; code?: string; requestId?: string }) {
    const parts = [params.message, params.code, params.requestId ? `request id: ${params.requestId}` : null].filter(Boolean);
    super(parts.join(' / '));
    this.name = 'AdminApiError';
    this.status = params.status;
    this.code = params.code;
    this.requestId = params.requestId;
  }
}

export type AdminAuditLog = {
  id: string;
  actorType: string;
  actorId: string;
  source: string;
  applicationId?: string | null;
  resourceType: string;
  resourceId: string;
  action: string;
  before?: unknown;
  after?: unknown;
  result: string;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  createdAt: string;
};

export type AdminSecurityEvent = {
  id: string;
  applicationId?: string | null;
  clientId?: string | null;
  feishuUserId?: string | null;
  eventType: string;
  reasonCode: string;
  result: string;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  createdAt: string;
};

export type AdminTraceTimelineItem = {
  id: string;
  source:
    | 'audit_log'
    | 'security_event'
    | 'feishu_sync_run'
    | 'oauth_token_context';
  stage: string;
  result: string;
  occurredAt: string;
  title: string;
  summary: string;
  requestId?: string | null;
  applicationId?: string | null;
  clientId?: string | null;
  feishuUserId?: string | null;
  details: unknown;
};

export type AdminTraceResult = {
  summary: {
    status: 'complete' | 'partial' | 'empty' | 'forbidden';
    diagnosis: string;
    matchedEventCount: number;
    missingStages: string[];
    nextActions: string[];
  };
  context: {
    requestId?: string;
    application?: { id: string; appKey: string; name: string } | null;
    applicationId?: string;
    appKey?: string;
    clientId?: string;
    feishuUserId?: string;
    timeWindow: { from: string; to: string };
  };
  timeline: AdminTraceTimelineItem[];
  coverage: {
    auditLogs: number;
    securityEvents: number;
    feishuSyncRuns: number;
    oauthContexts: number;
  };
};

export type AdminUserRole = {
  roleKey: string;
  name?: string | null;
};

export type AdminUserApplicationScope = {
  id: string;
  appKey: string;
  name?: string | null;
  status?: string | null;
};

export type AdminUser = {
  id: string;
  feishuUserId: string;
  displayName: string;
  roles: AdminUserRole[];
  applicationScopes: AdminUserApplicationScope[];
  status?: string;
  createdAt?: string;
};

export type FeishuDepartmentSearchItem = {
  departmentId: string;
  openDepartmentId?: string | null;
  parentDepartmentId?: string | null;
  name: string;
  status?: string | null;
};

export type CreateAdminUserInput = {
  feishuUserId: string;
  roleKeys: string[];
  applicationIds: string[];
};

export type UpdateAdminUserAuthorizationInput = {
  roleKeys: string[];
  applicationIds: string[];
};

export type AdminAuditLogQuery = {
  page?: number;
  pageSize?: number;
  requestId?: string;
  result?: string;
  action?: string;
  resourceType?: string;
  applicationId?: string;
};

export type AdminSecurityEventQuery = {
  page?: number;
  pageSize?: number;
  requestId?: string;
  result?: string;
  eventType?: string;
  eventTypes?: string[] | string;
  reasonCode?: string;
  applicationId?: string;
  clientId?: string;
  feishuUserId?: string;
};

export type AdminTraceQuery = {
  requestId?: string;
  applicationId?: string;
  appKey?: string;
  clientId?: string;
  feishuUserId?: string;
  from?: string;
  to?: string;
  result?: string;
};

async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: 'include'
  });

  if (!response.ok) {
    throw await readError(response);
  }

  return response.json() as Promise<T>;
}

async function readError(response: Response): Promise<AdminApiError> {
  try {
    const body = (await response.json()) as unknown;
    const errorPayload = readErrorPayload(body);
    if (errorPayload) {
      return new AdminApiError({
        status: response.status,
        code: errorPayload.code,
        message: fallbackErrorMessage(response.status, errorPayload.code),
        requestId: errorPayload.requestId
      });
    }
  } catch {
    // 使用统一兜底错误，避免把后端非 JSON 响应透出到页面。
  }

  return new AdminApiError({
    status: response.status,
    message: fallbackErrorMessage(response.status)
  });
}

function readErrorPayload(body: unknown): { code?: string; requestId?: string } | null {
  if (!isRecord(body) || !isRecord(body.error)) {
    return null;
  }

  const error = body.error;
  const code = typeof error.code === 'string' ? error.code : undefined;
  const requestId =
    typeof error.request_id === 'string'
      ? error.request_id
      : typeof error.requestId === 'string'
        ? error.requestId
        : undefined;

  if (!code && !requestId) {
    return null;
  }

  return { code, requestId };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function fallbackErrorMessage(status: number, code?: string): string {
  if (status === 401) {
    return '需要登录 Feishu IAM 管理后台';
  }
  if (status === 403) {
    return '当前管理员无权访问该资源';
  }
  if (code) {
    return adminErrorMessageByCode[code] ?? '管理后台接口请求失败';
  }
  return '管理后台接口请求失败';
}

const adminErrorMessageByCode: Record<string, string> = {
  ADMIN_LOGIN_REQUIRED: '需要登录 Feishu IAM 管理后台',
  ADMIN_FORBIDDEN: '当前管理员无权访问该资源',
  VALIDATION_ERROR: '请求参数不符合要求',
  NOT_FOUND: '请求的资源不存在',
  CONFLICT: '当前资源状态不允许执行该操作',
  UNKNOWN: '管理后台接口请求失败'
};

type QueryValue = string | number | readonly string[] | undefined;

function buildQuery(query?: Record<string, QueryValue>): string {
  if (!query) {
    return '';
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      const values = value as string[];
      const joined = values.map((item) => item.trim()).filter(Boolean).join(',');
      if (joined) {
        params.set(key, joined);
      }
    } else if (value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  }

  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

export async function fetchAdminMe(): Promise<AdminMe> {
  return readJson<AdminMe>('/api/v1/admin/me');
}

export async function fetchAdminAuditLogs(query?: AdminAuditLogQuery): Promise<PageResult<AdminAuditLog>> {
  return readJson<PageResult<AdminAuditLog>>(`/api/v1/admin/audit-logs${buildQuery(query)}`);
}

export async function fetchAdminSecurityEvents(
  query?: AdminSecurityEventQuery
): Promise<PageResult<AdminSecurityEvent>> {
  return readJson<PageResult<AdminSecurityEvent>>(`/api/v1/admin/security-events${buildQuery(query)}`);
}

export async function fetchAdminTrace(query?: AdminTraceQuery): Promise<AdminTraceResult> {
  return readJson<AdminTraceResult>(`/api/v1/admin/traces${buildQuery(query)}`);
}

export async function fetchAdminUsers(): Promise<PageResult<AdminUser>> {
  return readJson<PageResult<AdminUser>>('/api/v1/admin/admin-users');
}

export async function createAdminUser(input: CreateAdminUserInput): Promise<AdminUser> {
  return readJson<AdminUser>('/api/v1/admin/admin-users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(input)
  });
}

export async function replaceAdminUserScopes(adminUserId: string, applicationIds: string[]): Promise<AdminUser> {
  return readJson<AdminUser>(`/api/v1/admin/admin-users/${encodeURIComponent(adminUserId)}/scopes`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ applicationIds })
  });
}

export async function updateAdminUserAuthorization(
  adminUserId: string,
  input: UpdateAdminUserAuthorizationInput
): Promise<AdminUser> {
  return readJson<AdminUser>(`/api/v1/admin/admin-users/${encodeURIComponent(adminUserId)}/authorization`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });
}

export async function enableAdminUser(adminUserId: string): Promise<AdminUser> {
  return readJson<AdminUser>(`/api/v1/admin/admin-users/${encodeURIComponent(adminUserId)}/enable`, {
    method: 'POST'
  });
}

export async function disableAdminUser(adminUserId: string): Promise<AdminUser> {
  return readJson<AdminUser>(`/api/v1/admin/admin-users/${encodeURIComponent(adminUserId)}/disable`, {
    method: 'POST'
  });
}
