export type EntityStatus = "active" | "disabled";

export type ApplicationRedirectUri = {
  id: string;
  environmentId?: string | null;
  redirectUri: string;
  status: EntityStatus;
};

export type ApplicationOauthCredential = {
  id: string;
  clientId: string;
  status: EntityStatus;
  lastUsedAt?: string | null;
};

export type ApplicationClientSecretResult = {
  clientId: string;
  clientSecret: string;
};

export type ApplicationDeveloperCredential = {
  id: string;
  name: string;
  status: EntityStatus;
  lastUsedAt?: string | null;
  rotatedAt?: string | null;
};

export class OauthApiError extends Error {
  readonly code?: string;
  readonly requestId?: string;
  readonly status: number;

  constructor(params: {
    status: number;
    message: string;
    code?: string;
    requestId?: string;
  }) {
    const parts = [
      params.code,
      params.message,
      params.requestId ? `request id: ${params.requestId}` : null,
    ].filter(Boolean);
    super(parts.join(" / "));
    this.name = "OauthApiError";
    this.status = params.status;
    this.code = params.code;
    this.requestId = params.requestId;
  }
}

async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: "include",
  });

  if (!response.ok) {
    throw await readError(response);
  }

  return response.json() as Promise<T>;
}

async function writeJson<T>(url: string, body?: unknown): Promise<T> {
  return readJson<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function readError(response: Response): Promise<Error> {
  const fallback = new OauthApiError({
    status: response.status,
    message: safeErrorMessage(response.status),
  });

  try {
    const body = (await response.json()) as unknown;
    const errorPayload = readErrorPayload(body);
    if (!errorPayload) {
      return fallback;
    }

    return new OauthApiError({
      status: response.status,
      code: errorPayload.code,
      message: safeErrorMessage(response.status, errorPayload.code),
      requestId: errorPayload.requestId,
    });
  } catch {
    return fallback;
  }
}

function readErrorPayload(
  body: unknown,
): { code?: string; requestId?: string } | null {
  if (!isRecord(body)) {
    return null;
  }

  const nested = isRecord(body.error) ? body.error : body;
  const code = typeof nested.code === "string" ? nested.code : undefined;
  const requestId =
    typeof nested.requestId === "string"
      ? nested.requestId
      : typeof nested.request_id === "string"
        ? nested.request_id
        : undefined;

  if (!code && !requestId) {
    return null;
  }

  return { code, requestId };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function safeErrorMessage(status: number, code?: string): string {
  const codeMessages: Record<string, string> = {
    ADMIN_LOGIN_REQUIRED: "需要登录 Feishu IAM 管理后台",
    ADMIN_FORBIDDEN: "当前管理员无权访问接入配置资源",
    APPLICATION_NOT_FOUND: "应用不存在",
    OAUTH_REDIRECT_URI_INVALID: "回调地址必须是完整 URL",
    OAUTH_REDIRECT_URI_CONFLICT: "回调地址已存在",
    OAUTH_CLIENT_NOT_FOUND: "OAuth 凭证不存在",
    OAUTH_APPLICATION_DISABLED: "应用已停用，接入和凭证能力暂不可用",
    OAUTH_TOKEN_CONTEXT_DISABLED: "应用或 OAuth 凭证已停用",
    DEVELOPER_APPLICATION_DISABLED: "开发者 API 所属应用已停用",
  };

  if (code && codeMessages[code]) {
    return codeMessages[code];
  }

  if (status === 401) {
    return "需要登录 Feishu IAM 管理后台";
  }
  if (status === 403) {
    return "当前管理员无权访问接入配置接口";
  }
  if (status === 404) {
    return "接入配置资源不存在";
  }
  return "接入配置请求失败";
}

function applicationPath(appKey: string): string {
  return `/api/v1/admin/applications/${encodeURIComponent(appKey)}`;
}

function clientPath(appKey: string, clientReference: string): string {
  return `${applicationPath(appKey)}/clients/${encodeURIComponent(clientReference)}`;
}

export async function fetchApplicationRedirectUris(
  appKey: string,
): Promise<ApplicationRedirectUri[]> {
  const result = await readJson<{ items: ApplicationRedirectUri[] }>(
    `${applicationPath(appKey)}/redirect-uris`,
  );
  return result.items;
}

export async function createApplicationRedirectUri(
  appKey: string,
  input: { redirectUri: string },
): Promise<ApplicationRedirectUri> {
  return writeJson<ApplicationRedirectUri>(
    `${applicationPath(appKey)}/redirect-uris`,
    input,
  );
}

export async function disableApplicationRedirectUri(
  appKey: string,
  redirectUriId: string,
): Promise<ApplicationRedirectUri> {
  return writeJson<ApplicationRedirectUri>(
    `${applicationPath(appKey)}/redirect-uris/${encodeURIComponent(redirectUriId)}/disable`,
  );
}

export async function fetchApplicationOauthCredential(
  appKey: string,
): Promise<ApplicationOauthCredential | null> {
  const result = await readJson<{ items: ApplicationOauthCredential[] }>(
    `${applicationPath(appKey)}/clients`,
  );
  return result.items[0] ?? null;
}

export async function viewApplicationClientSecret(
  appKey: string,
  clientReference: string,
): Promise<ApplicationClientSecretResult> {
  return writeJson<ApplicationClientSecretResult>(
    `${clientPath(appKey, clientReference)}/view-secret`,
  );
}

export async function rotateApplicationClientSecret(
  appKey: string,
  clientReference: string,
): Promise<ApplicationClientSecretResult> {
  return writeJson<ApplicationClientSecretResult>(
    `${clientPath(appKey, clientReference)}/rotate-secret`,
  );
}

export async function fetchApplicationDeveloperCredential(
  appKey: string,
): Promise<ApplicationDeveloperCredential | null> {
  const result = await readJson<{ items: ApplicationDeveloperCredential[] }>(
    `${applicationPath(appKey)}/developer-credentials`,
  );
  return result.items[0] ?? null;
}

export async function fetchIntegrationPrompt(
  appKey: string,
): Promise<{ integrationPrompt: string }> {
  return readJson<{ integrationPrompt: string }>(
    `${applicationPath(appKey)}/integration-prompt`,
  );
}
