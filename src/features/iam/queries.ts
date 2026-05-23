import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  batchDisableApplications,
  createRole,
  createApplication,
  disableRoles,
  getApplication,
  getLatestSyncRun,
  getCurrentSession,
  getDashboardSummary,
  listApplicationPermissionRegistrations,
  listApplications,
  listAuditLogs,
  listDirectoryUsers,
  listFeishuDepartments,
  listIamPermissionTree,
  listRoles,
  listSyncRuns,
  recordRuntimeSecretCopy,
  retrySyncRun,
  rotateApplicationSecret,
  startManualSync,
  updateRole,
  updateRoleAuthorization,
} from './mockApi';
import type {
  ApplicationStatus,
  AuditAction,
  AuditResult,
  CreateApplicationInput,
  ListRolesRequest,
  RoleStatus,
  UpdateRoleAuthorizationInput,
  UpsertRoleInput,
} from './types';

interface ListApplicationsParams {
  keyword?: string;
  status?: ApplicationStatus;
  createdAtFrom?: string;
  createdAtTo?: string;
  allowedApplicationIds?: string[];
  page: number;
  pageSize: number;
}

interface ListAuditLogsParams {
  action?: AuditAction;
  result?: AuditResult;
  keyword?: string;
  applicationId?: string;
  createdAtFrom?: string;
  createdAtTo?: string;
  page: number;
  pageSize: number;
}

interface ListRolesParams {
  keyword?: string;
  applicationId?: string;
  status?: RoleStatus;
  createdAtFrom?: string;
  createdAtTo?: string;
  allowedApplicationIds?: string[];
  enabled?: boolean;
  page: number;
  pageSize: number;
}

interface ListDirectoryUsersParams {
  departmentId?: string;
  page: number;
  pageSize: number;
}

export const iamQueryKeys = {
  session: ['iam', 'session'] as const,
  dashboardSummary: ['iam', 'dashboardSummary'] as const,
  applications: (params: ListApplicationsParams) => ['iam', 'applications', params] as const,
  application: (applicationId: string) => ['iam', 'application', applicationId] as const,
  applicationPermissionRegistrations: (applicationId: string) =>
    ['iam', 'applicationPermissionRegistrations', applicationId] as const,
  roles: (params: ListRolesParams) => ['iam', 'roles', params] as const,
  iamPermissionTree: ['iam', 'permissionTree'] as const,
  feishuDepartments: ['iam', 'feishuDepartments'] as const,
  directoryUsers: (params: ListDirectoryUsersParams) => ['iam', 'directoryUsers', params] as const,
  auditLogs: (params: ListAuditLogsParams) => ['iam', 'auditLogs', params] as const,
  syncRuns: (params: { page: number; pageSize: number }) => ['iam', 'syncRuns', params] as const,
  latestSyncRun: ['iam', 'latestSyncRun'] as const,
};

export function useCurrentSession() {
  return useQuery({
    queryKey: iamQueryKeys.session,
    queryFn: getCurrentSession,
  });
}

export function useDashboardSummary() {
  return useQuery({
    queryKey: iamQueryKeys.dashboardSummary,
    queryFn: getDashboardSummary,
  });
}

export function useApplications(params: ListApplicationsParams) {
  return useQuery({
    queryKey: iamQueryKeys.applications(params),
    queryFn: () => listApplications(params),
  });
}

export function useRoles(params: ListRolesParams) {
  const { enabled = true, ...request } = params;

  return useQuery({
    queryKey: iamQueryKeys.roles(request),
    queryFn: () => listRoles(request satisfies ListRolesRequest),
    enabled,
  });
}

export function useIamPermissionTree() {
  return useQuery({
    queryKey: iamQueryKeys.iamPermissionTree,
    queryFn: listIamPermissionTree,
  });
}

export function useFeishuDepartments() {
  return useQuery({
    queryKey: iamQueryKeys.feishuDepartments,
    queryFn: listFeishuDepartments,
  });
}

export function useDirectoryUsers(params: ListDirectoryUsersParams) {
  return useQuery({
    queryKey: iamQueryKeys.directoryUsers(params),
    queryFn: () => listDirectoryUsers(params),
  });
}

export function useApplication(applicationId: string) {
  return useQuery({
    queryKey: iamQueryKeys.application(applicationId),
    queryFn: () => getApplication(applicationId),
  });
}

export function useCreateApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateApplicationInput) => createApplication(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['iam', 'applications'] }),
  });
}

export function useBatchDisableApplications() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (applicationIds: string[]) => batchDisableApplications(applicationIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['iam', 'applications'] }),
  });
}

export function useRotateApplicationSecret() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ applicationId, secretType }: { applicationId: string; secretType: 'appsecret' | 'apiSecret' }) =>
      rotateApplicationSecret(applicationId, secretType),
    onSuccess: (application) => {
      queryClient.invalidateQueries({ queryKey: iamQueryKeys.application(application.id) });
      queryClient.invalidateQueries({ queryKey: ['iam', 'applications'] });
      queryClient.invalidateQueries({ queryKey: ['iam', 'auditLogs'] });
    },
  });
}

export function useRecordRuntimeSecretCopy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (applicationId: string) => recordRuntimeSecretCopy(applicationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['iam', 'auditLogs'] }),
  });
}

export function useApplicationPermissionRegistrations(applicationId: string) {
  return useQuery({
    queryKey: iamQueryKeys.applicationPermissionRegistrations(applicationId),
    queryFn: () => listApplicationPermissionRegistrations(applicationId),
  });
}

export function useCreateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpsertRoleInput) => createRole(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iam', 'roles'] });
      queryClient.invalidateQueries({ queryKey: ['iam', 'auditLogs'] });
    },
  });
}

export function useUpdateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ roleId, input }: { roleId: string; input: UpsertRoleInput }) => updateRole(roleId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iam', 'roles'] });
      queryClient.invalidateQueries({ queryKey: ['iam', 'auditLogs'] });
    },
  });
}

export function useUpdateRoleAuthorization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateRoleAuthorizationInput) => updateRoleAuthorization(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iam', 'roles'] });
      queryClient.invalidateQueries({ queryKey: ['iam', 'auditLogs'] });
    },
  });
}

export function useDisableRoles() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (roleIds: string[]) => disableRoles(roleIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iam', 'roles'] });
      queryClient.invalidateQueries({ queryKey: ['iam', 'auditLogs'] });
    },
  });
}

export function useAuditLogs(params: ListAuditLogsParams) {
  return useQuery({
    queryKey: iamQueryKeys.auditLogs(params),
    queryFn: () => listAuditLogs(params),
  });
}

export function useSyncRuns(params: { page: number; pageSize: number }) {
  return useQuery({
    queryKey: iamQueryKeys.syncRuns(params),
    queryFn: () => listSyncRuns(params),
  });
}

export function useLatestSyncRun() {
  return useQuery({
    queryKey: iamQueryKeys.latestSyncRun,
    queryFn: getLatestSyncRun,
  });
}

export function useStartManualSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: startManualSync,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iam', 'syncRuns'] });
      queryClient.invalidateQueries({ queryKey: iamQueryKeys.latestSyncRun });
    },
  });
}

export function useRetrySyncRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (syncRunId: string) => retrySyncRun(syncRunId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iam', 'syncRuns'] });
      queryClient.invalidateQueries({ queryKey: iamQueryKeys.latestSyncRun });
    },
  });
}
