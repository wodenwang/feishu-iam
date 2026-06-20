import type { Application } from './permission';

export class ApplicationApiError extends Error {
  readonly code?: string;
  readonly requestId?: string;
  readonly status: number;

  constructor(params: { status: number; message: string; code?: string; requestId?: string }) {
    const parts = [params.message, params.code, params.requestId ? `request id: ${params.requestId}` : null].filter(
      Boolean
    );
    super(parts.join(' / '));
    this.name = 'ApplicationApiError';
    this.status = params.status;
    this.code = params.code;
    this.requestId = params.requestId;
  }
}

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

async function readError(response: Response): Promise<ApplicationApiError> {
  try {
    const body = (await response.json()) as unknown;
    const errorPayload = readErrorPayload(body);
    if (errorPayload) {
      return new ApplicationApiError({
        status: response.status,
        code: errorPayload.code,
        message: fallbackErrorMessage(response.status, errorPayload.code),
        requestId: errorPayload.requestId
      });
    }
  } catch {
    // 使用统一兜底错误，避免把后端非 JSON 响应透出到页面。
  }

  return new ApplicationApiError({
    status: response.status,
    message: fallbackErrorMessage(response.status)
  });
}

function readErrorPayload(body: unknown): { code?: string; requestId?: string } | null {
  if (!isRecord(body)) {
    return null;
  }

  const error = isRecord(body.error) ? body.error : body;
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
  if (code && applicationErrorMessageByCode[code]) {
    return applicationErrorMessageByCode[code];
  }
  if (status === 401) {
    return '需要登录 Feishu IAM 管理后台';
  }
  if (status === 403) {
    return '当前管理员无权管理该应用';
  }
  if (status === 404) {
    return '应用不存在';
  }
  if (status === 422) {
    return '应用管理请求参数不符合要求';
  }
  return '应用管理请求失败';
}

const applicationErrorMessageByCode: Record<string, string> = {
  ADMIN_LOGIN_REQUIRED: '需要登录 Feishu IAM 管理后台',
  ADMIN_SESSION_REQUIRED: '需要登录 Feishu IAM 管理后台',
  ADMIN_FORBIDDEN: '当前管理员无权管理该应用',
  ADMIN_PERMISSION_DENIED: '当前管理员无权管理该应用',
  APPLICATION_BODY_INVALID: '应用请求体不合法',
  APPLICATION_KEY_INVALID: '应用 key 不符合规则',
  APPLICATION_KEY_CONFLICT: '应用 key 已存在',
  APPLICATION_NOT_FOUND: '应用不存在',
  NOT_FOUND: '应用不存在',
  VALIDATION_ERROR: '应用管理请求参数不符合要求',
  CONFLICT: '当前应用状态不允许执行该操作',
  UNKNOWN: '应用管理请求失败'
};

function applicationPath(appKey: string): string {
  return `/api/v1/admin/applications/${encodeURIComponent(appKey)}`;
}

export async function createApplication(input: {
  appKey: string;
  name: string;
  description?: string;
  ownerUserId?: string;
  silentSsoEnabled?: boolean;
  silentSsoAllowedOrigins?: string[];
}): Promise<Application> {
  return readJson<Application>('/api/v1/admin/applications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });
}

export async function updateApplication(
  appKey: string,
  input: {
    name?: string;
    description?: string | null;
    ownerUserId?: string | null;
    silentSsoEnabled?: boolean;
    silentSsoAllowedOrigins?: string[];
  }
): Promise<Application> {
  return readJson<Application>(applicationPath(appKey), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  });
}

export async function enableApplication(appKey: string): Promise<Application> {
  return readJson<Application>(`${applicationPath(appKey)}/enable`, { method: 'POST' });
}

export async function disableApplication(appKey: string): Promise<Application> {
  return readJson<Application>(`${applicationPath(appKey)}/disable`, { method: 'POST' });
}
