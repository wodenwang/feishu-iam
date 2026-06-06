export type OauthEntityStatus = 'active' | 'disabled';
export type OauthEnvironmentKey = 'dev' | 'test' | 'prod';
export type OauthResult = 'success' | 'failed';
export type OauthErrorHttpStatus = 400 | 401 | 403 | 404 | 409 | 422 | 500;

export type OauthAuditContext = {
  requestId: string;
  ip: string | null;
  userAgent: string | null;
  actorType?: string;
  actorId?: string;
  source?: string;
};

export type TokenInput = {
  grantType?: unknown;
  code?: unknown;
  redirectUri?: unknown;
  clientId?: unknown;
  clientSecret?: unknown;
};

export type TokenResponse = {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  scope: string;
};

export type RevokeInput = {
  token?: unknown;
  clientId?: unknown;
  clientSecret?: unknown;
};

export type RevokeResponse = {
  revoked: true;
};

export type AppTokenContext = {
  applicationId: string;
  appKey: string;
  environmentId: string | null;
  clientId: string;
  feishuUserId: string;
  scope: string;
};

export type UserinfoResponse = {
  sub: string;
  user_id: string;
  open_id: string | null;
  union_id: string | null;
  name: string;
  avatar: unknown;
  email: string | null;
  employee_no: string | null;
  job_title: string | null;
};

export type IntegrationPromptInput = {
  baseIamUrl: string;
  appKey: string;
  applicationName: string;
  redirectUris: string[];
  clientId: string;
};

export type FullIntegrationPromptInput = IntegrationPromptInput & {
  clientSecret: string;
  developerApiToken: string;
};

export type CreateApplicationOnboardingInput = {
  appKey: string;
  name: string;
  description?: string;
  ownerUserId?: string;
  redirectUris: string[];
};

export class OauthDomainError extends Error {
  readonly status: OauthErrorHttpStatus;

  constructor(
    readonly code: string,
    message: string,
    status = 400
  ) {
    super(message);
    this.name = 'OauthDomainError';
    this.status = assertOauthErrorHttpStatus(status);
  }
}

function assertOauthErrorHttpStatus(status: number): OauthErrorHttpStatus {
  if ([400, 401, 403, 404, 409, 422, 500].includes(status)) {
    return status as OauthErrorHttpStatus;
  }

  throw new Error('OauthDomainError status must be an error HTTP status');
}
