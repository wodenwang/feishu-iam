import type { PageResult } from "../admin-types";

export type EntityStatus = "active" | "disabled";

export type Application = {
  id: string;
  appKey: string;
  name: string;
  description?: string | null;
  ownerUserId?: string | null;
  status: EntityStatus;
  silentSsoEnabled?: boolean;
  silentSsoAllowedOrigins?: string[];
  createdAt: string;
  updatedAt: string;
  integrationSummary?: ApplicationIntegrationSummary;
};

export type ApplicationIntegrationSummary = {
  redirectUriCount: number;
  activeRedirectUriCount: number;
  oauthClientCount: number;
  activeOauthClientCount: number;
  developerCredentialCount: number;
  activeDeveloperCredentialCount: number;
  iamRoleCount: number;
  activeIamRoleCount: number;
};

export type ApplicationPage = PageResult<Application>;

export type ApplicationOnboardingPackage = {
  application: Application;
  redirectUris: Array<{
    id: string;
    redirectUri: string;
    status: EntityStatus;
  }>;
  oauthCredential: { id: string; clientId: string; status: EntityStatus };
  clientSecret: string;
  developerCredential: { id: string; name: string; status: EntityStatus };
  developerApiToken: string;
  integrationPrompt: string;
};

export type PermissionGroup = {
  id: string;
  applicationId: string;
  key: string;
  name: string;
  description?: string | null;
  status: EntityStatus;
  permissionPoints?: PermissionPoint[];
  createdAt: string;
  updatedAt: string;
};

export type PermissionPoint = {
  id: string;
  applicationId: string;
  key: string;
  name: string;
  description?: string | null;
  status: EntityStatus;
  createdAt: string;
  updatedAt: string;
};

export type IamRole = {
  id: string;
  applicationId?: string;
  appKey: string;
  applications?: IamRoleApplicationSummary[];
  applicationIds?: string[];
  appKeys?: string[];
  key: string;
  name: string;
  description?: string | null;
  status: EntityStatus;
  permissionGroups?: PermissionGroup[];
  permissionGroupIds?: string[];
  permissionPoints?: PermissionPoint[];
  subjects?: IamRoleSubject[];
  createdAt: string;
  updatedAt: string;
};

export type IamRoleApplicationSummary = {
  applicationId: string;
  appKey: string;
  name: string;
  status: EntityStatus;
  bindingStatus: EntityStatus;
};

export type IamRoleSubject = {
  type: "feishu_user" | "feishu_department";
  id: string;
  isOrphaned?: boolean;
  displayName?: string;
  avatarLabel?: string;
  subjectKindLabel?: "组织" | "用户";
  displayPath?: string;
};

export type PermissionMatrixSubjectType = "user" | "department";

export type PermissionMatrixResult = {
  subject: { type: PermissionMatrixSubjectType; id: string; name: string };
  scope_note: string;
  applications: PermissionMatrixApplication[];
  computed_at: string;
};

export type PermissionMatrixApplication = {
  app_key: string;
  name: string;
  matched_roles: Array<{ key: string; name: string; match_type: string }>;
  permission_groups: Array<{ key: string; name: string; source_roles: string[] }>;
  permission_points: Array<{
    key: string;
    name: string;
    source_roles: string[];
    source_groups: string[];
    status: "active";
  }>;
  computed_at: string;
};

export class PermissionApiError extends Error {
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
    this.name = "PermissionApiError";
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
  const fallback = new PermissionApiError({
    status: response.status,
    message: safeErrorMessage(response.status),
  });

  try {
    const body = (await response.json()) as unknown;
    const errorPayload = readErrorPayload(body);
    if (!errorPayload) {
      return fallback;
    }

    return new PermissionApiError({
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
    ADMIN_LOGIN_REQUIRED: "需要登录 Feishu IAM 管理后台",
    ADMIN_FORBIDDEN: "当前管理员无权访问该权限资源",
    APPLICATION_NOT_FOUND: "应用不存在",
    APPLICATION_REDIRECT_URI_REQUIRED: "至少需要一个回调地址",
    APPLICATION_BODY_INVALID: "应用请求体不合法",
    PERMISSION_GROUP_NOT_FOUND: "权限组不存在",
    PERMISSION_POINT_NOT_FOUND: "权限点不存在",
    IAM_ROLE_NOT_FOUND: "IAM 角色不存在",
    IAM_ROLE_KEY_INVALID: "IAM 角色 key 不符合规则",
    IAM_ROLE_KEY_CONFLICT: "IAM 角色 key 已存在",
    IAM_ROLE_SUBJECT_DUPLICATED: "IAM 角色成员重复",
    PERMISSION_GROUP_DUPLICATED: "权限组重复",
    IAM_ROLE_BODY_INVALID: "IAM 角色请求体不合法",
    IAM_ROLE_APPLICATION_BINDING_BODY_INVALID: "角色应用绑定请求体不合法",
    IAM_ROLE_APPLICATION_BINDING_NOT_FOUND: "角色未绑定该应用",
    PERMISSION_MATRIX_QUERY_INVALID: "权限矩阵查询参数不合法",
  };

  if (code && codeMessages[code]) {
    return codeMessages[code];
  }

  if (status === 401) {
    return "需要登录 Feishu IAM 管理后台";
  }
  if (status === 403) {
    return "当前管理员无权访问平台权限接口";
  }
  if (status === 404) {
    return "权限资源不存在";
  }
  return "应用与权限请求失败";
}

export type FetchApplicationPageInput = {
  page?: number;
  pageSize?: number;
  query?: string;
  status?: EntityStatus | "all";
};

export async function fetchApplicationPage(
  inputOrPage: FetchApplicationPageInput | number = 1,
  legacyPageSize = 100,
): Promise<ApplicationPage> {
  const input =
    typeof inputOrPage === "number"
      ? { page: inputOrPage, pageSize: legacyPageSize }
      : inputOrPage;
  const params = new URLSearchParams({
    page: String(input.page ?? 1),
    pageSize: String(input.pageSize ?? 100),
  });

  const query = input.query?.trim();
  if (query) {
    params.set("query", query);
  }

  if (input.status && input.status !== "all") {
    params.set("status", input.status);
  }

  return readJson<ApplicationPage>(
    `/api/v1/admin/applications?${params.toString()}`,
  );
}

export async function fetchApplications(
  pageSize = 100,
): Promise<Application[]> {
  const firstPage = await fetchApplicationPage(1, pageSize);
  const applications = [...firstPage.items];
  const total =
    typeof firstPage.total === "number" ? firstPage.total : applications.length;
  const normalizedPageSize =
    typeof firstPage.pageSize === "number" && firstPage.pageSize > 0
      ? firstPage.pageSize
      : pageSize;
  let page =
    typeof firstPage.page === "number" && firstPage.page > 0
      ? firstPage.page
      : 1;

  while (applications.length < total) {
    page += 1;
    const nextPage = await fetchApplicationPage(page, normalizedPageSize);
    if (nextPage.items.length === 0) {
      break;
    }
    applications.push(...nextPage.items);
  }

  return applications;
}

export async function createApplication(input: {
  appKey: string;
  name: string;
  description?: string;
  ownerUserId?: string;
  silentSsoEnabled?: boolean;
  silentSsoAllowedOrigins?: string[];
  redirectUris: string[];
}): Promise<ApplicationOnboardingPackage> {
  return readJson<ApplicationOnboardingPackage>("/api/v1/admin/applications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function updateApplication(
  appKey: string,
  input: {
    name?: string;
    description?: string | null;
    ownerUserId?: string | null;
    silentSsoEnabled?: boolean;
    silentSsoAllowedOrigins?: string[];
  },
): Promise<Application> {
  return readJson<Application>(
    `/api/v1/admin/applications/${encodeURIComponent(appKey)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
}

export async function enableApplication(appKey: string): Promise<Application> {
  return setApplicationStatus(appKey, "enable");
}

export async function disableApplication(appKey: string): Promise<Application> {
  return setApplicationStatus(appKey, "disable");
}

async function setApplicationStatus(
  appKey: string,
  action: "enable" | "disable",
): Promise<Application> {
  return readJson<Application>(
    `/api/v1/admin/applications/${encodeURIComponent(appKey)}/${action}`,
    {
      method: "POST",
    },
  );
}

export async function fetchPermissionGroups(
  appKey: string,
): Promise<PermissionGroup[]> {
  const result = await readJson<{ items: PermissionGroup[] }>(
    `/api/v1/admin/applications/${encodeURIComponent(appKey)}/permission-groups`,
  );
  return result.items;
}

export async function fetchPermissionPoints(
  appKey: string,
): Promise<PermissionPoint[]> {
  const result = await readJson<{ items: PermissionPoint[] }>(
    `/api/v1/admin/applications/${encodeURIComponent(appKey)}/permission-points`,
  );
  return result.items;
}

export async function fetchIamRoles(appKey: string): Promise<IamRole[]> {
  const result = await readJson<{ items: RawIamRole[] }>(
    `/api/v1/admin/applications/${encodeURIComponent(appKey)}/iam-roles`,
  );
  return result.items.map((role) => normalizeIamRole(role, appKey));
}

export async function fetchIamRolesAcrossApplications(
  applications: Application[],
): Promise<IamRole[]> {
  const roleLists = await Promise.all(
    applications.map((application) => fetchIamRoles(application.appKey)),
  );
  const rolesById = new Map<string, IamRole>();

  for (const role of roleLists.flat()) {
    const current = rolesById.get(role.id);
    if (!current) {
      rolesById.set(role.id, role);
      continue;
    }
    rolesById.set(role.id, mergeRoleApplications(current, role));
  }

  return [...rolesById.values()].sort((left, right) =>
    left.key.localeCompare(right.key),
  );
}

export async function createIamRole(
  appKey: string,
  input: { key: string; name: string; description?: string },
): Promise<IamRole> {
  const role = await readJson<RawIamRole>(
    `/api/v1/admin/applications/${encodeURIComponent(appKey)}/iam-roles`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  return normalizeIamRole(role, appKey);
}

export async function updateIamRole(
  appKey: string,
  roleId: string,
  input: { name?: string; description?: string | null },
): Promise<IamRole> {
  const role = await readJson<RawIamRole>(
    `/api/v1/admin/applications/${encodeURIComponent(appKey)}/iam-roles/${encodeURIComponent(roleId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  return normalizeIamRole(role, appKey);
}

export async function enableIamRole(
  appKey: string,
  roleId: string,
): Promise<IamRole> {
  return setIamRoleStatus(appKey, roleId, "enable");
}

export async function disableIamRole(
  appKey: string,
  roleId: string,
): Promise<IamRole> {
  return setIamRoleStatus(appKey, roleId, "disable");
}

export async function bindIamRoleApplication(
  appKey: string,
  roleId: string,
): Promise<IamRole> {
  const role = await readJson<RawIamRole>(
    `/api/v1/admin/applications/${encodeURIComponent(appKey)}/iam-roles/${encodeURIComponent(roleId)}/application-binding`,
    {
      method: "POST",
    },
  );
  return normalizeIamRole(role, appKey);
}

export async function setIamRoleApplicationBindingStatus(
  appKey: string,
  roleId: string,
  status: EntityStatus,
): Promise<IamRole> {
  const role = await readJson<RawIamRole>(
    `/api/v1/admin/applications/${encodeURIComponent(appKey)}/iam-roles/${encodeURIComponent(roleId)}/application-binding`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    },
  );
  return normalizeIamRole(role, appKey);
}

export async function fetchPermissionMatrix(input: {
  subjectType: PermissionMatrixSubjectType;
  subjectId: string;
}): Promise<PermissionMatrixResult> {
  const params = new URLSearchParams({
    subjectType: input.subjectType,
    subjectId: input.subjectId,
  });
  return readJson<PermissionMatrixResult>(`/api/v1/admin/permission-matrix?${params.toString()}`);
}

async function setIamRoleStatus(
  appKey: string,
  roleId: string,
  action: "enable" | "disable",
): Promise<IamRole> {
  const role = await readJson<RawIamRole>(
    `/api/v1/admin/applications/${encodeURIComponent(appKey)}/iam-roles/${encodeURIComponent(roleId)}/${action}`,
    {
      method: "POST",
    },
  );
  return normalizeIamRole(role, appKey);
}

export async function replaceIamRolePermissionGroups(
  appKey: string,
  roleId: string,
  permissionGroupIds: string[],
): Promise<void> {
  await readJson<{ ok: true }>(
    `/api/v1/admin/applications/${encodeURIComponent(appKey)}/iam-roles/${encodeURIComponent(roleId)}/permission-groups`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupIds: permissionGroupIds }),
    },
  );
}

export async function replaceIamRoleSubjects(
  appKey: string,
  roleId: string,
  subjects: IamRoleSubject[],
): Promise<void> {
  const orgSubjects = subjects
    .filter((subject) => subject.type === "feishu_department")
    .map((subject) => subject.id);
  const userSubjects = subjects
    .filter((subject) => subject.type === "feishu_user")
    .map((subject) => subject.id);

  await readJson<{ ok: true }>(
    `/api/v1/admin/applications/${encodeURIComponent(appKey)}/iam-roles/${encodeURIComponent(roleId)}/subjects`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        org_subjects: orgSubjects,
        user_subjects: userSubjects,
      }),
    },
  );
}

type RawIamRole = Omit<
  IamRole,
  | "appKey"
  | "applications"
  | "applicationIds"
  | "appKeys"
  | "permissionGroups"
  | "permissionGroupIds"
  | "subjects"
> & {
  app_key?: string;
  appKey?: string;
  applications?: RawIamRoleApplicationSummary[];
  application_ids?: string[];
  applicationIds?: string[];
  app_keys?: string[];
  appKeys?: string[];
  permissionGroups?: PermissionGroup[];
  permission_groups?: PermissionGroup[];
  permissionPoints?: PermissionPoint[];
  permission_points?: PermissionPoint[];
  permissionGroupIds?: string[];
  permission_group_ids?: string[];
  subjects?: IamRoleSubject[];
};

type RawIamRoleApplicationSummary = Partial<IamRoleApplicationSummary> & {
  application_id?: string;
  app_key?: string;
  binding_status?: EntityStatus;
};

function normalizeIamRole(role: RawIamRole, appKey: string): IamRole {
  const applications = normalizeRoleApplications(role, appKey);
  return {
    ...role,
    appKey: role.appKey ?? role.app_key ?? appKey,
    applications,
    applicationIds:
      role.applicationIds ??
      role.application_ids ??
      applications.map((application) => application.applicationId),
    appKeys:
      role.appKeys ??
      role.app_keys ??
      applications.map((application) => application.appKey),
    permissionGroups: (role.permissionGroups ?? role.permission_groups)?.map(
      normalizePermissionGroup,
    ),
    permissionGroupIds: role.permissionGroupIds ?? role.permission_group_ids,
    permissionPoints: role.permissionPoints ?? role.permission_points ?? [],
    subjects: role.subjects,
  };
}

function normalizeRoleApplications(
  role: RawIamRole,
  fallbackAppKey: string,
): IamRoleApplicationSummary[] {
  if (Array.isArray(role.applications) && role.applications.length > 0) {
    return role.applications.map((application) => ({
      applicationId:
        application.applicationId ?? application.application_id ?? "",
      appKey: application.appKey ?? application.app_key ?? fallbackAppKey,
      name: application.name ?? application.appKey ?? fallbackAppKey,
      status: application.status ?? "active",
      bindingStatus:
        application.bindingStatus ?? application.binding_status ?? "active",
    }));
  }

  return [
    {
      applicationId: role.applicationId ?? "",
      appKey: role.appKey ?? role.app_key ?? fallbackAppKey,
      name: role.appKey ?? role.app_key ?? fallbackAppKey,
      status: "active",
      bindingStatus: "active",
    },
  ];
}

function mergeRoleApplications(left: IamRole, right: IamRole): IamRole {
  const applicationsByKey = new Map<string, IamRoleApplicationSummary>();
  for (const application of [
    ...(left.applications ?? []),
    ...(right.applications ?? []),
  ]) {
    applicationsByKey.set(application.appKey, application);
  }
  const applications = [...applicationsByKey.values()].sort((a, b) =>
    a.appKey.localeCompare(b.appKey),
  );
  const permissionGroups = mergeById(
    left.permissionGroups ?? [],
    right.permissionGroups ?? [],
  );
  const permissionPoints = mergeById(
    left.permissionPoints ?? [],
    right.permissionPoints ?? [],
  );
  const permissionGroupIds = [
    ...new Set([
      ...(left.permissionGroupIds ?? []),
      ...(right.permissionGroupIds ?? []),
      ...permissionGroups.map((group) => group.id),
    ]),
  ];

  return {
    ...left,
    applications,
    applicationIds: applications.map((application) => application.applicationId),
    appKeys: applications.map((application) => application.appKey),
    permissionGroups,
    permissionGroupIds,
    permissionPoints,
  };
}

function mergeById<T extends { id: string }>(left: T[], right: T[]): T[] {
  const byId = new Map<string, T>();
  for (const item of [...left, ...right]) {
    byId.set(item.id, item);
  }
  return [...byId.values()];
}

function normalizePermissionGroup(
  group: PermissionGroup & { permission_points?: PermissionPoint[] },
): PermissionGroup {
  return {
    ...group,
    permissionPoints: group.permissionPoints ?? group.permission_points ?? [],
  };
}
