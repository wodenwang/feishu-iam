import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  batchDisableApplications,
  createApplication,
  getCurrentSession,
  getDashboardSummary,
  listApplications,
  listAuditLogs,
} from './mockApi';
import type { ApplicationStatus, AuditAction, CreateApplicationInput } from './types';

interface ListApplicationsParams {
  keyword?: string;
  status?: ApplicationStatus;
  page: number;
  pageSize: number;
}

interface ListAuditLogsParams {
  action?: AuditAction;
  page: number;
  pageSize: number;
}

export const iamQueryKeys = {
  session: ['iam', 'session'] as const,
  dashboardSummary: ['iam', 'dashboardSummary'] as const,
  applications: (params: ListApplicationsParams) => ['iam', 'applications', params] as const,
  auditLogs: (params: ListAuditLogsParams) => ['iam', 'auditLogs', params] as const,
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

export function useAuditLogs(params: ListAuditLogsParams) {
  return useQuery({
    queryKey: iamQueryKeys.auditLogs(params),
    queryFn: () => listAuditLogs(params),
  });
}
