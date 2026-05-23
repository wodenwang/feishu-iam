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
export type RoleStatus = 'active' | 'disabled';
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
  description?: string;
  status: ApplicationStatus;
  appKey: string;
  appSecretPreview: string;
  apiKey: string;
  apiSecretPreview: string;
  callbackUrls: string[];
  allowedOrigins: string[];
  ownerFeishuUserId: string;
  ownerName: string;
  permissionGroupCount: number;
  permissionPointCount: number;
  lastApiCalledAt?: string;
  agentPrompt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationPermissionRegistration {
  id: string;
  applicationId: string;
  groupCode: string;
  groupName: string;
  permissionCode: string;
  permissionName: string;
  status: 'active' | 'disabled';
  updatedAt: string;
}

export interface IamPermissionNode {
  key: string;
  title: string;
  children?: IamPermissionNode[];
}

export interface IamRole {
  id: string;
  applicationId: string;
  applicationName: string;
  name: string;
  code: string;
  description?: string;
  status: RoleStatus;
  permissionGroupCount: number;
  permissionPointCount: number;
  departmentBindingCount: number;
  userBindingCount: number;
  permissionKeys: string[];
  departmentIds: string[];
  userIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ListRolesRequest extends PageRequest {
  keyword?: string;
  applicationId?: string;
  status?: RoleStatus;
  createdAtFrom?: string;
  createdAtTo?: string;
  allowedApplicationIds?: string[];
}

export interface FeishuDepartment {
  id: string;
  name: string;
  parentId?: string;
  path: string;
  userCount: number;
  updatedAt: string;
}

export interface DirectoryUser extends FeishuUser {
  departmentId: string;
  departmentName: string;
  email?: string;
  mobile?: string;
  syncedAt: string;
  localRoleSummary: string;
  lastLoginAt?: string;
  lastPermissionQueriedAt?: string;
}

export interface CreateApplicationInput {
  name: string;
  code: string;
  description?: string;
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

export interface SyncSummary {
  status: SyncStatus;
  startedAt: string;
  finishedAt?: string;
  departmentTotal: number;
  userTotal: number;
  failedCount: number;
  message: string;
}

export interface DashboardSummary {
  applicationCount: number;
  permissionPointCount: number;
  lastSync: SyncSummary;
  auditEventCount24h: number;
}
