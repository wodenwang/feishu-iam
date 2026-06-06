export type FeishuSyncRunStatus = 'running' | 'success' | 'failed';

export type FeishuSyncTriggerSource =
  | 'platform_api'
  | 'admin_web'
  | 'admin_web_user_light'
  | 'admin_web_department_light'
  | 'test';

export type FeishuConnectionStatus =
  | 'not_configured'
  | 'configured'
  | 'connected'
  | 'failed';

export type FeishuDiagnosticStatus = 'passed' | 'warning' | 'failed' | 'not_configured';

export type FeishuDiagnosticFieldStatus = 'present' | 'empty' | 'missing' | 'not_sampled';

export type FeishuDiagnosticRequiredLevel = 'blocking' | 'strong_warning' | 'warning';

export type FeishuDiagnosticField = {
  field: string;
  status: FeishuDiagnosticFieldStatus;
  presentCount: number;
  missingCount: number;
  emptyCount: number;
  requiredLevel: FeishuDiagnosticRequiredLevel;
};

export type FeishuFieldDiagnostics = {
  status: FeishuDiagnosticStatus;
  loginReadiness: {
    ready: boolean;
    reason: string;
  };
  sampleCounts: {
    departments: number;
    users: number;
    activeUsers: number;
  };
  departmentFields: FeishuDiagnosticField[];
  userFields: FeishuDiagnosticField[];
  blockingIssues: string[];
  warnings: string[];
  nextActions: string[];
};

export type FeishuUserStatus = {
  is_frozen?: boolean;
  is_resigned?: boolean;
  is_activated?: boolean;
  is_exited?: boolean;
  is_unjoin?: boolean;
};

export type FeishuDepartmentItem = {
  department_id?: string;
  open_department_id?: string;
  parent_department_id?: string;
  name?: string;
  i18n_name?: Record<string, unknown>;
  leader_user_id?: string;
  order?: string;
  status?: Record<string, unknown>;
};

export type FeishuUserOrder = {
  department_id?: string;
  user_order?: number;
  department_order?: number;
  is_primary_dept?: boolean;
};

export type FeishuUserItem = {
  user_id: string;
  open_id?: string;
  union_id?: string;
  name?: string;
  en_name?: string;
  email?: string;
  mobile?: string;
  mobile_visible?: boolean;
  avatar?: Record<string, unknown>;
  employee_no?: string;
  employee_type?: number;
  job_title?: string;
  leader_user_id?: string;
  status?: FeishuUserStatus;
  department_ids?: string[];
  orders?: FeishuUserOrder[];
};

export type FeishuPage<T> = {
  items: T[];
  hasMore: boolean;
  pageToken?: string;
  requestId?: string;
};

export type FeishuClientErrorCode =
  | 'FEISHU_CONFIG_MISSING'
  | 'FEISHU_PERMISSION_DENIED'
  | 'FEISHU_API_ERROR'
  | 'FEISHU_NETWORK_ERROR';

export class FeishuClientError extends Error {
  constructor(
    public readonly code: FeishuClientErrorCode,
    message: string,
    public readonly detail?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'FeishuClientError';
  }
}

export function isFeishuUserActive(status: FeishuUserStatus | undefined): boolean {
  if (!status) {
    return false;
  }

  return (
    status.is_frozen !== true &&
    status.is_resigned !== true &&
    status.is_activated === true &&
    status.is_exited !== true &&
    status.is_unjoin !== true
  );
}
