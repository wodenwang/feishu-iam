export type AdminRoleKey = 'platform_admin' | 'application_admin' | 'audit_viewer' | 'sync_admin';
export type AdminErrorHttpStatus = 400 | 401 | 403 | 404 | 409 | 422 | 500;

export type AdminContext = {
  adminUserId: string;
  feishuUserId: string;
  displayName: string;
  roles: AdminRoleKey[];
  applicationIds: string[];
};

export type AdminAuditContext = {
  actorType: 'admin_user' | 'system';
  actorId: string;
  source: 'admin_web' | 'deployment_init';
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
};

export class AdminDomainError extends Error {
  readonly status: AdminErrorHttpStatus;

  constructor(
    readonly code: string,
    message: string,
    status = 400
  ) {
    super(message);
    this.name = 'AdminDomainError';
    this.status = assertAdminErrorHttpStatus(status);
  }
}

function assertAdminErrorHttpStatus(status: number): AdminErrorHttpStatus {
  if ([400, 401, 403, 404, 409, 422, 500].includes(status)) {
    return status as AdminErrorHttpStatus;
  }

  throw new Error('AdminDomainError status must be an error HTTP status');
}
