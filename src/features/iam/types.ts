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
export type SyncRunStatus = 'running' | 'succeeded' | 'failed';
export type SyncTrigger = 'manual' | 'scheduled' | 'retry';
export type SyncOperatorType = 'feishu_user' | 'system';
export type SyncHealthStatus = 'healthy' | 'warning' | 'failed' | 'unknown';
export type SyncEventStatus = 'pending_sync' | 'processed' | 'failed' | 'ignored';
export type SyncPreflightStageName = 'token' | 'departments' | 'users';
export type SyncPreflightStageStatus = 'passed' | 'failed';
export type RedirectUriEnvironment = 'production' | 'staging' | 'local';
export type RedirectUriStatus = 'active' | 'disabled';
export type SecretKind = 'app_secret' | 'api_secret';
export type AuditAction =
  | 'login'
  | 'application.create'
  | 'application.api_call'
  | 'application.diagnostics.copy'
  | 'application.admin.add'
  | 'application.admin.bind'
  | 'application.admin.remove'
  | 'oauth.redirect_uri.create'
  | 'oauth.redirect_uri.disable'
  | 'oauth.redirect_uri.enable'
  | 'role.create'
  | 'secret.copy'
  | 'secret.rotate'
  | 'role.update'
  | 'role.authorization.update'
  | 'permission.query'
  | 'sync.event.receive'
  | 'sync.event.retry'
  | 'sync.run'
  | 'sync.preflight';
export type AuditResult = 'success' | 'failed';

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
  redirectUriCount?: number;
  activeRedirectUriCount?: number;
  adminCount?: number;
  appSecretRotatedAt?: string;
  apiSecretRotatedAt?: string;
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

export interface ApplicationRedirectUri {
  applicationId: string;
  redirectUri: string;
  environment: RedirectUriEnvironment;
  status: RedirectUriStatus;
  note: string;
  createdByFeishuUserId?: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  disabledAt?: string;
}

export type DiagnosticSeverity = 'info' | 'warning' | 'critical';
export type DiagnosticStatus = 'healthy' | 'warning' | 'failed';

export interface ApplicationDiagnosticFinding {
  code: string;
  severity: DiagnosticSeverity;
  title: string;
  description: string;
  nextAction: string;
  relatedRequestId?: string;
}

export interface ApplicationDiagnosticEvent {
  action: string;
  result: 'success' | 'failed';
  requestId: string;
  createdAt: string;
  message: string;
}

export interface ApplicationDiagnostics {
  applicationId: string;
  appKey: string;
  status: DiagnosticStatus;
  checkedAt: string;
  endpoints: {
    oauthAuthorize: string;
    oauthToken: string;
    applicationPermissions: string;
  };
  redirectUris: {
    active: string[];
    disabled: string[];
  };
  secrets: {
    appSecret: { status: 'issued' | 'missing'; rotatedAt?: string };
    apiSecret: { status: 'issued' | 'missing'; rotatedAt?: string };
  };
  counts: {
    applicationAdmins: number;
    permissionGroups: number;
    permissionPoints: number;
    roles: number;
    roleBindings: number;
    syncedUsers: number;
  };
  findings: ApplicationDiagnosticFinding[];
  recentEvents: ApplicationDiagnosticEvent[];
}

export interface CreateApplicationRedirectUriInput {
  redirectUri: string;
  environment: RedirectUriEnvironment;
  note?: string;
}

export interface UpdateApplicationRedirectUriStatusInput {
  redirectUri: string;
  status: RedirectUriStatus;
}

export interface RotateSecretResult {
  kind: SecretKind;
  secret: string;
  rotatedAt: string;
}

export interface ApplicationAdmin {
  applicationId: string;
  feishuUserId: string;
  name: string;
  email?: string;
  status: 'active' | 'disabled' | 'resigned';
  role: 'primary' | 'application_admin';
  createdByFeishuUserId?: string;
  createdByName: string;
  createdAt: string;
}

export interface AddApplicationAdminInput {
  feishuUserId: string;
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

export interface UpsertRoleInput {
  applicationId: string;
  name: string;
  code: string;
  description?: string;
  status: RoleStatus;
}

export interface UpdateRoleAuthorizationInput {
  roleId: string;
  permissionGroupKeys?: string[];
  permissionKeys: string[];
  departmentIds: string[];
  userIds: string[];
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
  ownerFeishuUserId?: string;
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
  result: AuditResult;
  actorFeishuUserId: string;
  applicationId?: string;
  message: string;
  requestId: string;
  createdAt: string;
}

export interface SyncDiffSummary {
  createdUsers: number;
  updatedUsers: number;
  resignedUsers: number;
  failedUsers: number;
  createdDepartments: number;
  updatedDepartments: number;
}

export interface SyncRun {
  id: string;
  trigger: SyncTrigger;
  status: SyncRunStatus;
  operatorType: SyncOperatorType;
  startedAt: string;
  finishedAt?: string;
  durationSeconds?: number;
  userChanges: number;
  departmentChanges: number;
  operatorFeishuUserId: string | null;
  requestBatchCount: number;
  successCount: number;
  failedCount: number;
  diffSummary: SyncDiffSummary;
  requestId?: string;
  errorMessage?: string;
  auditLogId?: string;
}

export interface SyncStatusOverview {
  latestRun: SyncRun | null;
  latestSuccessfulRun: SyncRun | null;
  latestFailedRun: SyncRun | null;
  isRunning: boolean;
  directoryUserCount: number;
  directoryDepartmentCount: number;
  healthStatus: SyncHealthStatus;
  healthReasons: string[];
}

export interface SyncEvent {
  id: string;
  eventId: string;
  eventType: string;
  resourceType?: string;
  resourceId?: string;
  status: SyncEventStatus;
  requestId: string;
  receivedAt: string;
  processedAt?: string;
  syncRunId?: string;
  errorMessage?: string;
}

export interface SyncEventStatusOverview {
  latestEvent: SyncEvent | null;
  latestFailedEvent: SyncEvent | null;
  pendingCount: number;
  failedCount: number;
  processedCount: number;
  ignoredCount: number;
  healthStatus: SyncHealthStatus;
  healthReasons: string[];
}

export interface SyncPreflightStage {
  name: SyncPreflightStageName;
  status: SyncPreflightStageStatus;
  message?: string;
}

export interface SyncPreflightResult {
  status: SyncPreflightStageStatus;
  checkedAt: string;
  requestBatchCount: number;
  stages: SyncPreflightStage[];
  requestId: string;
  errorCode?: string;
  message?: string;
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

export type ApiMode = 'mock' | 'http';

export interface IamHttpError extends Error {
  name: 'IamHttpError';
  status: number;
  code: string;
  requestId?: string;
  fieldErrors?: Record<string, string>;
  details?: unknown;
}

export interface CreateApplicationResult {
  application: Application;
  appSecret: string;
  apiSecret: string;
}
