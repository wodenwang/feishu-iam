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
  applicationId: string;
  appKey: string;
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

export type IamRoleSubject = {
  type: "feishu_user" | "feishu_department";
  id: string;
  isOrphaned?: boolean;
  displayName?: string;
  avatarLabel?: string;
  subjectKindLabel?: "组织" | "用户";
  displayPath?: string;
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
      body: JSON.stringify({ permissionGroupIds }),
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
  "appKey" | "permissionGroups" | "permissionGroupIds" | "subjects"
> & {
  app_key?: string;
  appKey?: string;
  permissionGroups?: PermissionGroup[];
  permission_groups?: PermissionGroup[];
  permissionPoints?: PermissionPoint[];
  permission_points?: PermissionPoint[];
  permissionGroupIds?: string[];
  permission_group_ids?: string[];
  subjects?: IamRoleSubject[];
};

function normalizeIamRole(role: RawIamRole, appKey: string): IamRole {
  return {
    ...role,
    appKey: role.appKey ?? role.app_key ?? appKey,
    permissionGroups: (role.permissionGroups ?? role.permission_groups)?.map(
      normalizePermissionGroup,
    ),
    permissionGroupIds: role.permissionGroupIds ?? role.permission_group_ids,
    permissionPoints: role.permissionPoints ?? role.permission_points ?? [],
    subjects: role.subjects,
  };
}

function normalizePermissionGroup(
  group: PermissionGroup & { permission_points?: PermissionPoint[] },
): PermissionGroup {
  return {
    ...group,
    permissionPoints: group.permissionPoints ?? group.permission_points ?? [],
  };
}
