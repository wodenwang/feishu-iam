export type FeishuSyncRun = {
  id: string;
  status: "running" | "success" | "failed";
  triggerSource: string;
  startedAt: string;
  finishedAt?: string | null;
  departmentCreatedCount: number;
  departmentUpdatedCount: number;
  departmentDeletedCount: number;
  userCreatedCount: number;
  userUpdatedCount: number;
  userDeletedCount: number;
  relationCreatedCount: number;
  relationUpdatedCount: number;
  relationDeletedCount: number;
  errorCode?: string | null;
  errorMessage?: string | null;
  errorStage?: string | null;
  requestId?: string | null;
};

export type FeishuStatus = {
  configStatus: "not_configured" | "configured" | "connected" | "failed";
  running: boolean;
  latestRun: FeishuSyncRun | null;
  counts: {
    departments: number;
    activeDepartments: number;
    users: number;
    activeUsers: number;
    relations: number;
  };
};

export type FeishuDiagnosticStatus =
  | "passed"
  | "warning"
  | "failed"
  | "not_configured";

export type FeishuDiagnosticFieldStatus =
  | "present"
  | "empty"
  | "missing"
  | "not_sampled";

export type FeishuDiagnosticRequiredLevel =
  | "blocking"
  | "strong_warning"
  | "warning";

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

export type FeishuUserCandidate = {
  userId: string;
  name: string;
  email?: string | null;
  active?: boolean;
  isActive?: boolean;
  isDeleted?: boolean;
};

export type FeishuDepartmentCandidate = {
  departmentId: string;
  name: string;
  parentDepartmentId?: string | null;
  status?: unknown;
  isDeleted?: boolean;
};

export type PageResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

export type FeishuMirrorUserSummary = {
  userId: string;
  name: string;
  emailMasked: string | null;
  mobileMasked: string | null;
  isActive: boolean;
  isDeleted: boolean;
  lastSyncedAt: string;
};

export type FeishuMirrorDepartmentSummary = {
  departmentId: string;
  openDepartmentId: string | null;
  parentDepartmentId: string | null;
  name: string;
  isDeleted: boolean;
  lastSyncedAt: string;
};

export type FeishuMirrorUserDetail = FeishuMirrorUserSummary & {
  openId: string | null;
  unionId: string | null;
  enName: string | null;
  employeeNo: string | null;
  employeeType: number | null;
  jobTitle: string | null;
  leaderUserId: string | null;
  loginEligible: boolean;
  loginBlockReason: string | null;
  departments: Array<{
    departmentId: string;
    name: string;
    isPrimary: boolean;
    isDeleted: boolean;
  }>;
};

export type FeishuMirrorDepartmentDetail = FeishuMirrorDepartmentSummary & {
  leaderUserId: string | null;
  parent: FeishuMirrorDepartmentSummary | null;
  children: FeishuMirrorDepartmentSummary[];
  users: Array<FeishuMirrorUserSummary & { isPrimary: boolean }>;
};

export type FeishuFullSyncPreflight = {
  running: boolean;
  latestRun: FeishuSyncRun | null;
  counts: FeishuStatus["counts"];
  requiredLatestRunId: string;
};

export class FeishuApiError extends Error {
  readonly code?: string;
  readonly requestId?: string;
  readonly status: number;

  constructor(params: {
    status: number;
    message: string;
    code?: string;
    requestId?: string;
  }) {
    const parts = [
      params.code,
      params.message,
      params.requestId ? `request id: ${params.requestId}` : null,
    ].filter(Boolean);
    super(parts.join(" / "));
    this.name = "FeishuApiError";
    this.status = params.status;
    this.code = params.code;
    this.requestId = params.requestId;
  }
}

async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: "include",
  });

  if (!response.ok) {
    throw await readError(response);
  }

  return response.json() as Promise<T>;
}

async function readError(response: Response): Promise<Error> {
  const fallback = new FeishuApiError({
    status: response.status,
    message: safeErrorMessage(response.status),
  });

  try {
    const body = (await response.json()) as unknown;
    const errorPayload = readErrorPayload(body);
    if (!errorPayload) {
      return fallback;
    }

    return new FeishuApiError({
      status: response.status,
      code: errorPayload.code,
      message: safeErrorMessage(response.status, errorPayload.code),
      requestId: errorPayload.requestId,
    });
  } catch {
    return fallback;
  }
}

function readErrorPayload(
  body: unknown,
): { code?: string; requestId?: string } | null {
  if (!isRecord(body)) {
    return null;
  }

  const nested = isRecord(body.error) ? body.error : body;
  const code = typeof nested.code === "string" ? nested.code : undefined;
  const requestId =
    typeof nested.requestId === "string"
      ? nested.requestId
      : typeof nested.request_id === "string"
        ? nested.request_id
        : undefined;

  if (!code && !requestId) {
    return null;
  }

  return { code, requestId };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function safeErrorMessage(status: number, code?: string): string {
  const codeMessages: Record<string, string> = {
    FEISHU_CONFIG_MISSING: "飞书应用配置缺失",
    FEISHU_PERMISSION_DENIED: "飞书应用缺少只读通讯录权限或可见范围不足",
    FEISHU_SYNC_ALREADY_RUNNING: "已有飞书同步正在运行",
    FEISHU_SYNC_RUNNING: "已有飞书同步正在运行",
    FEISHU_NETWORK_ERROR: "飞书接口网络请求失败",
  };

  if (code && codeMessages[code]) {
    return codeMessages[code];
  }

  if (status === 401) {
    return "需要登录 Feishu IAM 管理后台";
  }
  if (status === 403) {
    return "当前管理员无权访问飞书同步资源";
  }
  if (status === 404) {
    return "飞书同步资源不存在";
  }
  return "飞书同步请求失败";
}

export async function fetchFeishuStatus(): Promise<FeishuStatus> {
  return readJson<FeishuStatus>("/api/v1/admin/feishu/status");
}

export async function fetchFeishuFieldDiagnostics(): Promise<FeishuFieldDiagnostics> {
  return readJson<FeishuFieldDiagnostics>(
    "/api/v1/admin/feishu/field-diagnostics",
  );
}

export async function fetchFeishuSyncRuns(): Promise<FeishuSyncRun[]> {
  const result = await readJson<{ items: FeishuSyncRun[] }>(
    "/api/v1/admin/feishu/sync-runs",
  );
  return result.items;
}

export async function fetchFeishuSyncRun(id: string): Promise<FeishuSyncRun> {
  return readJson<FeishuSyncRun>(
    `/api/v1/admin/feishu/sync-runs/${encodeURIComponent(id)}`,
  );
}

export async function triggerFeishuSync(confirmLatestRunId: string): Promise<FeishuSyncRun> {
  return readJson<FeishuSyncRun>("/api/v1/admin/feishu/sync-runs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ confirmLatestRunId }),
  });
}

export async function triggerFeishuUserSync(userId: string): Promise<FeishuSyncRun> {
  return readJson<FeishuSyncRun>(
    `/api/v1/admin/feishu/users/${encodeURIComponent(userId)}/sync`,
    { method: "POST" },
  );
}

export async function triggerFeishuDepartmentSync(departmentId: string): Promise<FeishuSyncRun> {
  return readJson<FeishuSyncRun>(
    `/api/v1/admin/feishu/departments/${encodeURIComponent(departmentId)}/sync`,
    { method: "POST" },
  );
}

export async function fetchFeishuOverview(): Promise<FeishuStatus> {
  return readJson<FeishuStatus>("/api/v1/admin/feishu/overview");
}

export async function fetchFeishuUsers(query: {
  keyword?: string;
  departmentId?: string;
  page?: number;
  pageSize?: number;
}): Promise<PageResult<FeishuMirrorUserSummary>> {
  const params = new URLSearchParams();
  if (query.keyword?.trim()) {
    params.set("keyword", query.keyword.trim());
  }
  if (query.departmentId) {
    params.set("department_id", query.departmentId);
  }
  if (query.page) {
    params.set("page", String(query.page));
  }
  if (query.pageSize) {
    params.set("page_size", String(query.pageSize));
  }
  return readJson<PageResult<FeishuMirrorUserSummary>>(
    `/api/v1/admin/feishu/users?${params.toString()}`,
  );
}

export async function fetchFeishuUser(userId: string): Promise<FeishuMirrorUserDetail> {
  return readJson<FeishuMirrorUserDetail>(
    `/api/v1/admin/feishu/users/${encodeURIComponent(userId)}`,
  );
}

export async function fetchFeishuDepartments(query: {
  keyword?: string;
  parentDepartmentId?: string | null;
  page?: number;
  pageSize?: number;
}): Promise<PageResult<FeishuMirrorDepartmentSummary>> {
  const params = new URLSearchParams();
  if (query.keyword?.trim()) {
    params.set("keyword", query.keyword.trim());
  }
  if (query.parentDepartmentId !== undefined) {
    params.set("parent_department_id", query.parentDepartmentId === null ? "__root__" : query.parentDepartmentId);
  }
  if (query.page) {
    params.set("page", String(query.page));
  }
  if (query.pageSize) {
    params.set("page_size", String(query.pageSize));
  }
  return readJson<PageResult<FeishuMirrorDepartmentSummary>>(
    `/api/v1/admin/feishu/departments?${params.toString()}`,
  );
}

export async function fetchFeishuDepartment(departmentId: string): Promise<FeishuMirrorDepartmentDetail> {
  return readJson<FeishuMirrorDepartmentDetail>(
    `/api/v1/admin/feishu/departments/${encodeURIComponent(departmentId)}`,
  );
}

export async function preflightFeishuFullSync(): Promise<FeishuFullSyncPreflight> {
  return readJson<FeishuFullSyncPreflight>(
    "/api/v1/admin/feishu/sync-runs/preflight",
    { method: "POST" },
  );
}

export async function searchFeishuUsers(
  keyword: string,
): Promise<FeishuUserCandidate[]> {
  const params = new URLSearchParams();
  if (keyword.trim()) {
    params.set("keyword", keyword.trim());
  }
  const result = await readJson<{ items: Array<FeishuMirrorUserSummary | FeishuUserCandidate> }>(
    `/api/v1/admin/feishu/users?${params.toString()}`,
  );
  return result.items.map((user) => ({
    userId: user.userId,
    name: user.name,
    email: "emailMasked" in user ? user.emailMasked : user.email,
    active: "isActive" in user ? user.isActive && !user.isDeleted : user.active,
  }));
}

export async function searchApplicationFeishuUsers(
  appKey: string,
  keyword: string,
): Promise<FeishuUserCandidate[]> {
  const result = await fetchApplicationFeishuUsers(appKey, {
    keyword,
    page: 1,
    pageSize: 20,
  });
  return result.items;
}

export async function fetchApplicationFeishuUsers(
  appKey: string,
  query: {
    keyword?: string;
    departmentId?: string;
    page?: number;
    pageSize?: number;
  },
): Promise<PageResult<FeishuUserCandidate>> {
  const params = new URLSearchParams();
  if (query.keyword?.trim()) {
    params.set("keyword", query.keyword.trim());
  }
  if (query.departmentId) {
    params.set("department_id", query.departmentId);
  }
  if (query.page) {
    params.set("page", String(query.page));
  }
  if (query.pageSize) {
    params.set("page_size", String(query.pageSize));
  }
  return readJson<PageResult<FeishuUserCandidate>>(
    `/api/v1/admin/applications/${encodeURIComponent(appKey)}/feishu/users?${params.toString()}`,
  );
}

export async function searchFeishuDepartments(
  keyword: string,
): Promise<FeishuDepartmentCandidate[]> {
  const params = new URLSearchParams();
  if (keyword.trim()) {
    params.set("keyword", keyword.trim());
  }
  const result = await readJson<{ items: Array<FeishuMirrorDepartmentSummary | FeishuDepartmentCandidate> }>(
    `/api/v1/admin/feishu/departments?${params.toString()}`,
  );
  return result.items.map((department) => ({
    departmentId: department.departmentId,
    name: department.name,
    parentDepartmentId: department.parentDepartmentId,
    status: "isDeleted" in department ? { is_deleted: department.isDeleted } : department.status,
  }));
}

export async function searchApplicationFeishuDepartments(
  appKey: string,
  keyword: string,
): Promise<FeishuDepartmentCandidate[]> {
  const result = await fetchApplicationFeishuDepartments(appKey, {
    keyword,
    page: 1,
    pageSize: 20,
  });
  return result.items;
}

export async function fetchApplicationFeishuDepartments(
  appKey: string,
  query: {
    keyword?: string;
    parentDepartmentId?: string | null;
    page?: number;
    pageSize?: number;
  },
): Promise<PageResult<FeishuDepartmentCandidate>> {
  const params = new URLSearchParams();
  if (query.keyword?.trim()) {
    params.set("keyword", query.keyword.trim());
  }
  if (query.parentDepartmentId !== undefined) {
    params.set("parent_department_id", query.parentDepartmentId === null ? "__root__" : query.parentDepartmentId);
  }
  if (query.page) {
    params.set("page", String(query.page));
  }
  if (query.pageSize) {
    params.set("page_size", String(query.pageSize));
  }
  return readJson<PageResult<FeishuDepartmentCandidate>>(
    `/api/v1/admin/applications/${encodeURIComponent(appKey)}/feishu/departments?${params.toString()}`,
  );
}
