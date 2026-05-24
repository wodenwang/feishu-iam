import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getIamApiMode } from './apiMode';
import { logout as httpLogout } from './httpApi';
import { iamService } from './iamService';
import type {
  ApplicationStatus,
  AuditAction,
  AuditResult,
  Application,
  CreateApplicationInput,
  CreateApplicationResult,
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
  initializationStatus: ['iam', 'initializationStatus'] as const,
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
    queryFn: iamService.getCurrentSession,
  });
}

export function useInitializationStatus() {
  return useQuery({
    queryKey: iamQueryKeys.initializationStatus,
    queryFn: iamService.getInitializationStatus,
  });
}

export function useBindPlatformAdmin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: iamService.bindPlatformAdmin,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: iamQueryKeys.initializationStatus });
      queryClient.invalidateQueries({ queryKey: iamQueryKeys.session });
    },
  });
}

export function useLogout(options: { onSuccess?: () => void | Promise<void> } = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (getIamApiMode() !== 'http') {
        return;
      }
      await httpLogout();
    },
    onSuccess: async () => {
      queryClient.clear();
      await options.onSuccess?.();
    },
  });
}

export function useDashboardSummary() {
  return useQuery({
    queryKey: iamQueryKeys.dashboardSummary,
    queryFn: iamService.getDashboardSummary,
  });
}

export function useApplications(params: ListApplicationsParams) {
  return useQuery({
    queryKey: iamQueryKeys.applications(params),
    queryFn: () => iamService.listApplications(params),
  });
}

export function useRoles(params: ListRolesParams) {
  const { enabled = true, ...request } = params;

  return useQuery({
    queryKey: iamQueryKeys.roles(request),
    queryFn: () => iamService.listRoles(request satisfies ListRolesRequest),
    enabled,
  });
}

export function useIamPermissionTree() {
  return useQuery({
    queryKey: iamQueryKeys.iamPermissionTree,
    queryFn: iamService.listIamPermissionTree,
  });
}

export function useFeishuDepartments() {
  return useQuery({
    queryKey: iamQueryKeys.feishuDepartments,
    queryFn: iamService.listFeishuDepartments,
  });
}

export function useDirectoryUsers(params: ListDirectoryUsersParams) {
  return useQuery({
    queryKey: iamQueryKeys.directoryUsers(params),
    queryFn: () => iamService.listDirectoryUsers(params),
  });
}

export function useApplication(applicationId: string) {
  return useQuery({
    queryKey: iamQueryKeys.application(applicationId),
    queryFn: () => iamService.getApplication(applicationId),
  });
}

export function useCreateApplication() {
  const queryClient = useQueryClient();

  return useMutation<Application | CreateApplicationResult, Error, CreateApplicationInput>({
    mutationFn: (input: CreateApplicationInput) => iamService.createApplication(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['iam', 'applications'] }),
  });
}

export function useBatchDisableApplications() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (applicationIds: string[]) => iamService.batchDisableApplications(applicationIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['iam', 'applications'] }),
  });
}

export function useRotateApplicationSecret() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ applicationId, secretType }: { applicationId: string; secretType: 'appsecret' | 'apiSecret' }) =>
      iamService.rotateApplicationSecret(applicationId, secretType),
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
    mutationFn: (applicationId: string) => iamService.recordRuntimeSecretCopy(applicationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['iam', 'auditLogs'] }),
  });
}

export function useApplicationPermissionRegistrations(applicationId: string) {
  return useQuery({
    queryKey: iamQueryKeys.applicationPermissionRegistrations(applicationId),
    queryFn: () => iamService.listApplicationPermissionRegistrations(applicationId),
  });
}

export function useCreateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpsertRoleInput) => iamService.createRole(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iam', 'roles'] });
      queryClient.invalidateQueries({ queryKey: ['iam', 'auditLogs'] });
    },
  });
}

export function useUpdateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ roleId, input }: { roleId: string; input: UpsertRoleInput }) => iamService.updateRole(roleId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iam', 'roles'] });
      queryClient.invalidateQueries({ queryKey: ['iam', 'auditLogs'] });
    },
  });
}

export function useUpdateRoleAuthorization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateRoleAuthorizationInput) => iamService.updateRoleAuthorization(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iam', 'roles'] });
      queryClient.invalidateQueries({ queryKey: ['iam', 'auditLogs'] });
    },
  });
}

export function useDisableRoles() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (roleIds: string[]) => iamService.disableRoles(roleIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iam', 'roles'] });
      queryClient.invalidateQueries({ queryKey: ['iam', 'auditLogs'] });
    },
  });
}

export function useAuditLogs(params: ListAuditLogsParams) {
  return useQuery({
    queryKey: iamQueryKeys.auditLogs(params),
    queryFn: () => iamService.listAuditLogs(params),
  });
}

export function useSyncRuns(params: { page: number; pageSize: number }) {
  return useQuery({
    queryKey: iamQueryKeys.syncRuns(params),
    queryFn: () => iamService.listSyncRuns(params),
  });
}

export function useLatestSyncRun() {
  return useQuery({
    queryKey: iamQueryKeys.latestSyncRun,
    queryFn: iamService.getLatestSyncRun,
  });
}

export function useStartManualSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: iamService.startManualSync,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iam', 'syncRuns'] });
      queryClient.invalidateQueries({ queryKey: iamQueryKeys.latestSyncRun });
    },
  });
}

export function useRetrySyncRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (syncRunId: string) => iamService.retrySyncRun(syncRunId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iam', 'syncRuns'] });
      queryClient.invalidateQueries({ queryKey: iamQueryKeys.latestSyncRun });
    },
  });
}
