export type AdminRole = 'platform_admin' | 'application_admin';

export type PermissionCode =
  | 'dashboard:view'
  | 'application:view'
  | 'application:create'
  | 'application:update'
  | 'application:disable'
  | 'application:secret'
  | 'role:view'
  | 'role:update'
  | 'directory:view'
  | 'sync:view'
  | 'sync:run'
  | 'audit:view';

export type ApplicationStatus = 'active' | 'disabled' | 'draft';
export type SyncStatus = 'success' | 'partial_failed' | 'failed' | 'running';
export type AuditAction =
  | 'login'
  | 'application.create'
  | 'secret.copy'
  | 'secret.rotate'
  | 'role.update'
  | 'permission.query'
  | 'sync.run';

export interface FeishuUser {
  feishuUserId: string;
  displayName: string;
  departmentPath: string;
  status: 'active' | 'disabled' | 'resigned';
}

export interface CurrentSession {
  user: FeishuUser;
  roles: AdminRole[];
  permissions: PermissionCode[];
  applicationIds: string[];
}

export interface Application {
  id: string;
  name: string;
  code: string;
  status: ApplicationStatus;
  appKey: string;
  appSecretPreview: string;
  apiKey: string;
  apiSecretPreview: string;
  callbackUrls: string[];
  allowedOrigins: string[];
  ownerFeishuUserId: string;
  agentPrompt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateApplicationInput {
  name: string;
  code: string;
  callbackUrls: string[];
  allowedOrigins: string[];
  ownerFeishuUserId: string;
}

export interface PageRequest {
  page: number;
  pageSize: number;
}

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AuditLog {
  id: string;
  action: AuditAction;
  actorFeishuUserId: string;
  applicationId?: string;
  message: string;
  requestId: string;
  createdAt: string;
}
