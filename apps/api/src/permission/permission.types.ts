export type EntityStatus = 'active' | 'disabled';
export type IamSubjectType = 'feishu_user' | 'feishu_department';
export type AuditResult = 'success' | 'failed';
export type PermissionErrorHttpStatus = 400 | 401 | 403 | 404 | 409 | 422 | 500;

export type PermissionAuditContext = {
  actorType?: 'platform_token' | 'admin_user' | 'application_developer_credential';
  actorId?: string;
  source?: 'platform_api' | 'admin_web' | 'developer_api';
  requestId: string;
  ip: string | null;
  userAgent: string | null;
};

export class PermissionDomainError extends Error {
  readonly status: PermissionErrorHttpStatus;

  constructor(
    readonly code: string,
    message: string,
    status = 400
  ) {
    super(message);
    this.name = 'PermissionDomainError';
    this.status = assertPermissionErrorHttpStatus(status);
  }
}

function assertPermissionErrorHttpStatus(status: number): PermissionErrorHttpStatus {
  if ([400, 401, 403, 404, 409, 422, 500].includes(status)) {
    return status as PermissionErrorHttpStatus;
  }

  throw new Error('PermissionDomainError status must be an error HTTP status');
}
