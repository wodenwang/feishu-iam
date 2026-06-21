import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseFilters,
  UseGuards,
} from "@nestjs/common";
import type { Application, Prisma } from "@prisma/client";
import type { Request } from "express";
import { ApplicationService } from "../permission/application.service";
import { IamRoleService } from "../permission/iam-role.service";
import { PermissionCatalogService } from "../permission/permission-catalog.service";
import { PermissionErrorFilter } from "../permission/permission-error.filter";
import {
  EntityStatus,
  type IamSubjectType,
  type PermissionAuditContext,
  PermissionDomainError,
} from "../permission/permission.types";
import { PrismaService } from "../prisma/prisma.service";
import { ApplicationOnboardingService } from "../oauth/application-onboarding.service";
import { AdminErrorFilter } from "./admin-error.filter";
import { AdminPermissionService } from "./admin-permission.service";
import { getAdminRequestId, readAdminContext } from "./admin-request-context";
import { AdminSessionGuard } from "./admin-session.guard";
import { AdminDomainError, type AdminContext } from "./admin.types";

type IamRoleResponse = Awaited<
  ReturnType<IamRoleService["listRoles"]>
>[number] & {
  app_key: string;
};

type IamRoleMutationResponse = Awaited<
  ReturnType<IamRoleService["createRole"]>
> & {
  app_key: string;
};

type FeishuUserCandidateResponse = {
  userId: string;
  name: string;
  isActive: boolean;
  isDeleted: boolean;
};

type FeishuDepartmentCandidateResponse = {
  departmentId: string;
  name: string;
  parentDepartmentId: string | null;
  isDeleted: boolean;
};

type CreateApplicationBody = {
  appKey: string;
  name: string;
  description?: string;
  ownerUserId?: string;
  redirectUris?: string[];
  silentSsoEnabled?: boolean;
  silentSsoAllowedOrigins?: string[];
};

type UpdateApplicationBody = {
  name?: string;
  description?: string | null;
  ownerUserId?: string | null;
  silentSsoEnabled?: boolean;
  silentSsoAllowedOrigins?: string[];
};

type CreateRoleBody = {
  key: string;
  name: string;
  description?: string;
};

type UpdateRoleBody = {
  name?: string;
  description?: string | null;
};

type ApplicationBindingBody = {
  status: EntityStatus;
};

type ApplicationIntegrationSummary = {
  redirectUriCount: number;
  activeRedirectUriCount: number;
  oauthClientCount: number;
  activeOauthClientCount: number;
  developerCredentialCount: number;
  activeDeveloperCredentialCount: number;
  iamRoleCount: number;
  activeIamRoleCount: number;
};

type ApplicationListItemResponse = Application & {
  integrationSummary: ApplicationIntegrationSummary;
};

type ApplicationListResponse = Omit<
  Awaited<ReturnType<ApplicationService["listApplications"]>>,
  "items"
> & {
  items: ApplicationListItemResponse[];
};

type PageResponse<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

@Controller("/api/v1/admin/applications")
@UseGuards(AdminSessionGuard)
@UseFilters(AdminErrorFilter, PermissionErrorFilter)
export class AdminPermissionController {
  constructor(
    @Inject(ApplicationService)
    private readonly applications: ApplicationService,
    @Inject(PermissionCatalogService)
    private readonly catalog: PermissionCatalogService,
    @Inject(IamRoleService)
    private readonly iamRoles: IamRoleService,
    @Inject(AdminPermissionService)
    private readonly permission: AdminPermissionService,
    @Inject(ApplicationOnboardingService)
    private readonly onboarding: ApplicationOnboardingService,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async listApplications(
    @Req() request: Request,
    @Query() query: Record<string, unknown>,
  ): Promise<ApplicationListResponse> {
    const context = readRequiredAdminContext(request);
    const page = await this.applications.listApplications({
      page: parsePositiveIntegerQuery(query.page),
      pageSize: parsePositiveIntegerQuery(query.pageSize),
      query: parseStringQuery(query.query),
      status: parseApplicationStatusQuery(query.status),
      applicationIds: canViewAllApplications(context)
        ? undefined
        : context.applicationIds,
    });
    return {
      ...page,
      items: await this.addIntegrationSummaries(page.items),
    };
  }

  @Post()
  async createApplication(
    @Body() body: unknown,
    @Req() request: Request,
  ): Promise<
    Awaited<ReturnType<ApplicationOnboardingService["createOnboardingPackage"]>>
  > {
    const context = readRequiredAdminContext(request);
    this.permission.assertCanManageAdmins(context);
    const input = readCreateApplicationBody(body);
    if (!input.redirectUris || input.redirectUris.length === 0) {
      throw new PermissionDomainError(
        "APPLICATION_REDIRECT_URI_REQUIRED",
        "至少需要一个回调地址",
        400,
      );
    }
    return this.onboarding.createOnboardingPackage(
      {
        appKey: input.appKey,
        name: input.name,
        description: input.description,
        ownerUserId: input.ownerUserId,
        silentSsoEnabled: input.silentSsoEnabled,
        silentSsoAllowedOrigins: input.silentSsoAllowedOrigins,
        redirectUris: input.redirectUris,
      },
      buildPermissionAuditContext(request, context),
    );
  }

  @Patch("/:appKey")
  async updateApplication(
    @Param("appKey") appKey: string,
    @Body() body: unknown,
    @Req() request: Request,
  ): Promise<Awaited<ReturnType<ApplicationService["updateApplication"]>>> {
    const { context } = await this.assertCanManageApplication(appKey, request);
    return this.applications.updateApplication(
      appKey,
      readUpdateApplicationBody(body),
      buildPermissionAuditContext(request, context),
    );
  }

  @Post("/:appKey/enable")
  async enableApplication(
    @Param("appKey") appKey: string,
    @Req() request: Request,
  ): Promise<Awaited<ReturnType<ApplicationService["setApplicationStatus"]>>> {
    return this.setApplicationStatus(appKey, "active", request);
  }

  @Post("/:appKey/disable")
  async disableApplication(
    @Param("appKey") appKey: string,
    @Req() request: Request,
  ): Promise<Awaited<ReturnType<ApplicationService["setApplicationStatus"]>>> {
    return this.setApplicationStatus(appKey, "disabled", request);
  }

  @Get("/:appKey/permission-points")
  async listPermissionPoints(
    @Param("appKey") appKey: string,
    @Req() request: Request,
  ): Promise<{
    items: Awaited<
      ReturnType<PermissionCatalogService["listPermissionPoints"]>
    >;
  }> {
    await this.assertCanManageApplication(appKey, request);
    return { items: await this.catalog.listPermissionPoints(appKey) };
  }

  @Get("/:appKey/permission-groups")
  async listPermissionGroups(
    @Param("appKey") appKey: string,
    @Req() request: Request,
  ): Promise<{
    items: Awaited<
      ReturnType<PermissionCatalogService["listPermissionGroups"]>
    >;
  }> {
    await this.assertCanManageApplication(appKey, request);
    return { items: await this.catalog.listPermissionGroups(appKey) };
  }

  @Get("/:appKey/iam-roles")
  async listRoles(
    @Param("appKey") appKey: string,
    @Req() request: Request,
  ): Promise<{ items: IamRoleResponse[] }> {
    const { context } = await this.assertCanManageApplication(appKey, request);
    const roles = await this.iamRoles.listRoles(appKey);
    return {
      items: roles.map((role) => serializeRoleForAdmin(role, appKey, context)),
    };
  }

  @Get("/:appKey/feishu/users")
  async searchFeishuUsers(
    @Param("appKey") appKey: string,
    @Query() query: Record<string, unknown>,
    @Req() request: Request,
  ): Promise<PageResponse<FeishuUserCandidateResponse>> {
    await this.assertCanManageApplication(appKey, request);
    const normalizedKeyword = normalizeKeyword(parseStringQuery(query.keyword));
    const page = parsePositiveIntegerQuery(query.page) ?? 1;
    const pageSize = Math.min(
      100,
      parsePositiveIntegerQuery(query.page_size ?? query.pageSize) ?? 20,
    );
    const departmentId = parseStringQuery(
      query.department_id ?? query.departmentId,
    );
    const where = {
      isDeleted: false,
      ...(normalizedKeyword
        ? {
            OR: [
              {
                userId: {
                  contains: normalizedKeyword,
                  mode: "insensitive" as const,
                },
              },
              {
                name: {
                  contains: normalizedKeyword,
                  mode: "insensitive" as const,
                },
              },
              {
                email: {
                  contains: normalizedKeyword,
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {}),
      ...(departmentId
        ? {
            userDepartments: {
              some: {
                departmentId,
                isDeleted: false,
              },
            },
          }
        : {}),
    };
    const [total, users] = await Promise.all([
      this.prisma.feishuUser.count({ where }),
      this.prisma.feishuUser.findMany({
        where,
        select: {
          userId: true,
          name: true,
          isActive: true,
          isDeleted: true,
        },
        orderBy: [{ isDeleted: "asc" }, { name: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: users.map((user) => ({
        userId: user.userId,
        name: user.name,
        isActive: user.isActive,
        isDeleted: user.isDeleted,
      })),
      page,
      pageSize,
      total,
    };
  }

  @Get("/:appKey/feishu/departments")
  async searchFeishuDepartments(
    @Param("appKey") appKey: string,
    @Query() query: Record<string, unknown>,
    @Req() request: Request,
  ): Promise<PageResponse<FeishuDepartmentCandidateResponse>> {
    await this.assertCanManageApplication(appKey, request);
    const normalizedKeyword = normalizeKeyword(parseStringQuery(query.keyword));
    const page = parsePositiveIntegerQuery(query.page) ?? 1;
    const pageSize = Math.min(
      100,
      parsePositiveIntegerQuery(query.page_size ?? query.pageSize) ?? 20,
    );
    const parentDepartmentId = normalizeParentDepartmentId(parseStringQuery(
      query.parent_department_id ?? query.parentDepartmentId,
    ));
    const where = buildFeishuDepartmentCandidateWhere(
      normalizedKeyword,
      parentDepartmentId,
    );
    const [total, departments] = await Promise.all([
      this.prisma.feishuDepartment.count({ where }),
      this.prisma.feishuDepartment.findMany({
        where,
        select: {
          departmentId: true,
          name: true,
          parentDepartmentId: true,
          isDeleted: true,
        },
        orderBy: [{ isDeleted: "asc" }, { name: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: departments.map((department) => ({
        departmentId: department.departmentId,
        name: department.name,
        parentDepartmentId: department.parentDepartmentId,
        isDeleted: department.isDeleted,
      })),
      page,
      pageSize,
      total,
    };
  }

  @Post("/:appKey/iam-roles")
  async createRole(
    @Param("appKey") appKey: string,
    @Body() body: unknown,
    @Req() request: Request,
  ): Promise<IamRoleMutationResponse> {
    const { context } = await this.assertCanManageApplication(appKey, request);
    this.permission.assertCanManageGlobalIamRoles(context);
    const role = await this.iamRoles.createRole(
      appKey,
      readCreateRoleBody(body),
      buildPermissionAuditContext(request, context),
    );
    return serializeRoleMutation(role, appKey);
  }

  @Patch("/:appKey/iam-roles/:roleId")
  async updateRole(
    @Param("appKey") appKey: string,
    @Param("roleId") roleId: string,
    @Body() body: unknown,
    @Req() request: Request,
  ): Promise<IamRoleMutationResponse> {
    const { context } = await this.assertCanManageApplication(appKey, request);
    this.permission.assertCanManageGlobalIamRoles(context);
    const role = await this.iamRoles.updateRole(
      appKey,
      roleId,
      readUpdateRoleBody(body),
      buildPermissionAuditContext(request, context),
    );
    return serializeRoleMutation(role, appKey);
  }

  @Post("/:appKey/iam-roles/:roleId/application-binding")
  async bindRoleApplication(
    @Param("appKey") appKey: string,
    @Param("roleId") roleId: string,
    @Req() request: Request,
  ): Promise<IamRoleMutationResponse> {
    const { context } = await this.assertCanManageApplication(appKey, request);
    this.permission.assertCanManageGlobalIamRoles(context);
    const role = await this.iamRoles.bindRoleToApplication(
      appKey,
      roleId,
      buildPermissionAuditContext(request, context),
    );
    return serializeRoleMutation(role, appKey);
  }

  @Patch("/:appKey/iam-roles/:roleId/application-binding")
  async setRoleApplicationBindingStatus(
    @Param("appKey") appKey: string,
    @Param("roleId") roleId: string,
    @Body() body: unknown,
    @Req() request: Request,
  ): Promise<IamRoleMutationResponse> {
    const { context } = await this.assertCanManageApplication(appKey, request);
    this.permission.assertCanManageGlobalIamRoles(context);
    const role = await this.iamRoles.setRoleApplicationBindingStatus(
      appKey,
      roleId,
      readApplicationBindingBody(body).status,
      buildPermissionAuditContext(request, context),
    );
    return serializeRoleMutation(role, appKey);
  }

  @Post("/:appKey/iam-roles/:roleId/enable")
  async enableRole(
    @Param("appKey") appKey: string,
    @Param("roleId") roleId: string,
    @Req() request: Request,
  ): Promise<IamRoleMutationResponse> {
    return this.setRoleStatus(appKey, roleId, "active", request);
  }

  @Post("/:appKey/iam-roles/:roleId/disable")
  async disableRole(
    @Param("appKey") appKey: string,
    @Param("roleId") roleId: string,
    @Req() request: Request,
  ): Promise<IamRoleMutationResponse> {
    return this.setRoleStatus(appKey, roleId, "disabled", request);
  }

  @Put("/:appKey/iam-roles/:roleId/permission-groups")
  async replaceRolePermissionGroups(
    @Param("appKey") appKey: string,
    @Param("roleId") roleId: string,
    @Body() body: unknown,
    @Req() request: Request,
  ): Promise<{ ok: true }> {
    const { context } = await this.assertCanManageApplication(appKey, request);
    await this.iamRoles.replaceRolePermissionGroups(
      appKey,
      roleId,
      readRolePermissionGroupIds(body),
      buildPermissionAuditContext(request, context),
    );
    return { ok: true };
  }

  @Put("/:appKey/iam-roles/:roleId/subjects")
  async replaceRoleSubjects(
    @Param("appKey") appKey: string,
    @Param("roleId") roleId: string,
    @Body() body: unknown,
    @Req() request: Request,
  ): Promise<{ ok: true }> {
    const { context } = await this.assertCanManageApplication(appKey, request);
    this.permission.assertCanManageGlobalIamRoles(context);
    const input = readObjectBody(
      body,
      "IAM_ROLE_SUBJECTS_INVALID",
      "IAM 角色主体列表不合法",
    );
    await this.iamRoles.replaceRoleSubjects(
      appKey,
      roleId,
      readRoleSubjects(input),
      buildPermissionAuditContext(request, context),
    );
    return { ok: true };
  }

  private async setApplicationStatus(
    appKey: string,
    status: EntityStatus,
    request: Request,
  ): Promise<Awaited<ReturnType<ApplicationService["setApplicationStatus"]>>> {
    const { context } = await this.assertCanManageApplication(appKey, request);
    return this.applications.setApplicationStatus(
      appKey,
      status,
      buildPermissionAuditContext(request, context),
    );
  }

  private async setRoleStatus(
    appKey: string,
    roleId: string,
    status: EntityStatus,
    request: Request,
  ): Promise<IamRoleMutationResponse> {
    const { context } = await this.assertCanManageApplication(appKey, request);
    this.permission.assertCanManageGlobalIamRoles(context);
    const role = await this.iamRoles.setRoleStatus(
      appKey,
      roleId,
      status,
      buildPermissionAuditContext(request, context),
    );
    return serializeRoleMutation(role, appKey);
  }

  private async assertCanManageApplication(
    appKey: string,
    request: Request,
  ): Promise<{ context: AdminContext; application: Application }> {
    const context = readRequiredAdminContext(request);
    const application = await this.applications.getApplicationByKey(appKey);
    this.permission.assertCanManageApplication(context, application.id);
    return { context, application };
  }

  private async addIntegrationSummaries(
    items: Application[],
  ): Promise<ApplicationListItemResponse[]> {
    return Promise.all(
      items.map(async (application) => ({
        ...application,
        integrationSummary: await this.getIntegrationSummary(application.id),
      })),
    );
  }

  private async getIntegrationSummary(
    applicationId: string,
  ): Promise<ApplicationIntegrationSummary> {
    const [
      redirectUriCount,
      activeRedirectUriCount,
      oauthClientCount,
      activeOauthClientCount,
      developerCredentialCount,
      activeDeveloperCredentialCount,
      iamRoleCount,
      activeIamRoleCount,
    ] = await Promise.all([
      this.prisma.applicationRedirectUri.count({ where: { applicationId } }),
      this.prisma.applicationRedirectUri.count({
        where: { applicationId, status: "active" },
      }),
      this.prisma.applicationClient.count({ where: { applicationId } }),
      this.prisma.applicationClient.count({
        where: { applicationId, status: "active" },
      }),
      this.prisma.applicationDeveloperCredential.count({
        where: { applicationId },
      }),
      this.prisma.applicationDeveloperCredential.count({
        where: { applicationId, status: "active" },
      }),
      this.prisma.iamRoleApplication.count({ where: { applicationId } }),
      this.prisma.iamRoleApplication.count({
        where: {
          applicationId,
          status: "active",
          iamRole: {
            status: "active",
          },
        },
      }),
    ]);

    return {
      redirectUriCount,
      activeRedirectUriCount,
      oauthClientCount,
      activeOauthClientCount,
      developerCredentialCount,
      activeDeveloperCredentialCount,
      iamRoleCount,
      activeIamRoleCount,
    };
  }
}

function serializeRoleMutation(
  role: Awaited<ReturnType<IamRoleService["createRole"]>>,
  appKey: string,
): IamRoleMutationResponse {
  return {
    ...role,
    app_key: appKey,
  };
}

function serializeRoleForAdmin(
  role: Awaited<ReturnType<IamRoleService["listRoles"]>>[number],
  appKey: string,
  context: AdminContext,
): IamRoleResponse {
  if (context.roles.includes("platform_admin")) {
    return {
      ...role,
      app_key: appKey,
    };
  }

  const allowedApplicationIds = new Set(context.applicationIds);
  const applications = role.applications.filter((application) =>
    allowedApplicationIds.has(application.applicationId),
  );

  return {
    ...role,
    applications,
    applicationIds: applications.map((application) => application.applicationId),
    appKeys: applications.map((application) => application.appKey),
    app_key: appKey,
  };
}

function readRequiredAdminContext(request: Request): AdminContext {
  const context = readAdminContext(request);

  if (!context) {
    throw new AdminDomainError(
      "ADMIN_SESSION_REQUIRED",
      "需要登录 Feishu IAM 管理后台",
      401,
    );
  }

  return context;
}

function canViewAllApplications(context: AdminContext): boolean {
  return (
    context.roles.includes("platform_admin") ||
    context.roles.includes("audit_viewer")
  );
}

function normalizeKeyword(keyword: string | undefined): string {
  return keyword?.trim().slice(0, 80) ?? "";
}

function parseStringQuery(value: unknown): string | undefined {
  const raw = Array.isArray(value) ? (value as readonly unknown[])[0] : value;
  if (typeof raw !== "string") {
    return undefined;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeParentDepartmentId(value: string | undefined): string | null | undefined {
  return value === "__root__" ? null : value;
}

function buildFeishuDepartmentCandidateWhere(
  keyword: string,
  parentDepartmentId: string | null | undefined,
): Prisma.FeishuDepartmentWhereInput {
  const filters: Prisma.FeishuDepartmentWhereInput[] = [];
  if (keyword) {
    filters.push({
      OR: [
        {
          departmentId: {
            contains: keyword,
            mode: "insensitive",
          },
        },
        {
          name: {
            contains: keyword,
            mode: "insensitive",
          },
        },
      ],
    });
  }
  const parentWhere = buildDepartmentParentWhere(parentDepartmentId);
  if (parentWhere) {
    filters.push(parentWhere);
  }
  return {
    isDeleted: false,
    ...(filters.length === 1 ? filters[0] : {}),
    ...(filters.length > 1 ? { AND: filters } : {}),
  };
}

function buildDepartmentParentWhere(
  parentDepartmentId: string | null | undefined,
): Prisma.FeishuDepartmentWhereInput | null {
  if (parentDepartmentId === undefined) {
    return null;
  }
  if (parentDepartmentId === null) {
    return { OR: [{ parentDepartmentId: "0" }, { parentDepartmentId: null }] };
  }
  return { parentDepartmentId };
}

function parsePositiveIntegerQuery(value: unknown): number | undefined {
  const raw = parseStringQuery(value);
  if (!raw) {
    return undefined;
  }
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function parseApplicationStatusQuery(
  value: unknown,
): EntityStatus | "all" | undefined {
  const status = parseStringQuery(value);
  if (status === "active" || status === "disabled" || status === "all") {
    return status;
  }
  return undefined;
}

function buildPermissionAuditContext(
  request: Request,
  context: AdminContext,
): PermissionAuditContext {
  return {
    actorType: "admin_user",
    actorId: context.adminUserId,
    source: "admin_web",
    requestId: getAdminRequestId(request),
    ip: request.ip ?? null,
    userAgent: request.header("user-agent") ?? null,
  };
}

function readStringArray(
  values: unknown,
  code: string,
  message: string,
): string[] {
  if (
    !Array.isArray(values) ||
    values.some(
      (value) => typeof value !== "string" || value.trim().length === 0,
    )
  ) {
    throw new PermissionDomainError(code, message, 422);
  }

  return values.map((value) => value as string);
}

function readOptionalStringArray(
  values: unknown,
  code: string,
  message: string,
): string[] | undefined {
  if (values === undefined) {
    return undefined;
  }

  return readStringArray(values, code, message);
}

function readOptionalBoolean(
  value: unknown,
  code: string,
  message: string,
): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "boolean") {
    throw new PermissionDomainError(code, message, 422);
  }
  return value;
}

function readObjectBody(
  body: unknown,
  code: string,
  message: string,
): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new PermissionDomainError(code, message, 422);
  }

  return body as Record<string, unknown>;
}

function readRolePermissionGroupIds(body: unknown): string[] {
  const input = readObjectBody(
    body,
    "PERMISSION_GROUP_IDS_INVALID",
    "权限组 ID 列表不合法",
  );
  return readStringArray(
    input.groupIds ?? input.permissionGroupIds,
    "PERMISSION_GROUP_IDS_INVALID",
    "权限组 ID 列表不合法",
  );
}

function readCreateApplicationBody(body: unknown): CreateApplicationBody {
  const input = readObjectBody(
    body,
    "APPLICATION_BODY_INVALID",
    "应用请求体不合法",
  );
  return {
    appKey: readRequiredBodyString(
      input.appKey,
      "APPLICATION_BODY_INVALID",
      "应用请求体不合法",
    ),
    name: readRequiredBodyString(
      input.name,
      "APPLICATION_BODY_INVALID",
      "应用请求体不合法",
    ),
    ...readOptionalBodyStrings(
      input,
      ["description", "ownerUserId"],
      "APPLICATION_BODY_INVALID",
      "应用请求体不合法",
    ),
    redirectUris: readOptionalStringArray(
      input.redirectUris,
      "APPLICATION_BODY_INVALID",
      "应用请求体不合法",
    ),
    silentSsoEnabled: readOptionalBoolean(
      input.silentSsoEnabled,
      "APPLICATION_BODY_INVALID",
      "应用请求体不合法",
    ),
    silentSsoAllowedOrigins: readOptionalStringArray(
      input.silentSsoAllowedOrigins,
      "APPLICATION_BODY_INVALID",
      "应用请求体不合法",
    ),
  };
}

function readUpdateApplicationBody(body: unknown): UpdateApplicationBody {
  const input = readObjectBody(
    body,
    "APPLICATION_BODY_INVALID",
    "应用请求体不合法",
  );
  return {
    ...readOptionalBodyStrings(
      input,
      ["name"],
      "APPLICATION_BODY_INVALID",
      "应用请求体不合法",
    ),
    ...readOptionalNullableBodyStrings(
      input,
      ["description", "ownerUserId"],
      "APPLICATION_BODY_INVALID",
      "应用请求体不合法",
    ),
    silentSsoEnabled: readOptionalBoolean(
      input.silentSsoEnabled,
      "APPLICATION_BODY_INVALID",
      "应用请求体不合法",
    ),
    silentSsoAllowedOrigins: readOptionalStringArray(
      input.silentSsoAllowedOrigins,
      "APPLICATION_BODY_INVALID",
      "应用请求体不合法",
    ),
  };
}

function readCreateRoleBody(body: unknown): CreateRoleBody {
  const input = readObjectBody(
    body,
    "IAM_ROLE_BODY_INVALID",
    "IAM 角色请求体不合法",
  );
  return {
    key: readRequiredBodyString(
      input.key,
      "IAM_ROLE_BODY_INVALID",
      "IAM 角色请求体不合法",
    ),
    name: readRequiredBodyString(
      input.name,
      "IAM_ROLE_BODY_INVALID",
      "IAM 角色请求体不合法",
    ),
    ...readOptionalBodyStrings(
      input,
      ["description"],
      "IAM_ROLE_BODY_INVALID",
      "IAM 角色请求体不合法",
    ),
  };
}

function readUpdateRoleBody(body: unknown): UpdateRoleBody {
  const input = readObjectBody(
    body,
    "IAM_ROLE_BODY_INVALID",
    "IAM 角色请求体不合法",
  );
  return {
    ...readOptionalBodyStrings(
      input,
      ["name"],
      "IAM_ROLE_BODY_INVALID",
      "IAM 角色请求体不合法",
    ),
    ...readOptionalNullableBodyStrings(
      input,
      ["description"],
      "IAM_ROLE_BODY_INVALID",
      "IAM 角色请求体不合法",
    ),
  };
}

function readApplicationBindingBody(body: unknown): ApplicationBindingBody {
  const input = readObjectBody(
    body,
    "IAM_ROLE_APPLICATION_BINDING_BODY_INVALID",
    "角色应用绑定请求体不合法",
  );
  const status = input.status;
  if (status !== "active" && status !== "disabled") {
    throw new PermissionDomainError(
      "IAM_ROLE_APPLICATION_BINDING_BODY_INVALID",
      "角色应用绑定状态不合法",
      422,
    );
  }
  return { status };
}

function readRequiredBodyString(
  value: unknown,
  code: string,
  message: string,
): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new PermissionDomainError(code, message, 422);
  }

  return value;
}

function readOptionalNullableBodyStrings<T extends string>(
  input: Record<string, unknown>,
  keys: T[],
  code: string,
  message: string,
): Partial<Record<T, string | null>> {
  const data: Partial<Record<T, string | null>> = {};

  for (const key of keys) {
    const value = input[key];
    if (value === undefined) {
      continue;
    }

    if (value !== null && typeof value !== "string") {
      throw new PermissionDomainError(code, message, 422);
    }

    data[key] = value;
  }

  return data;
}

function readOptionalBodyStrings<T extends string>(
  input: Record<string, unknown>,
  keys: T[],
  code: string,
  message: string,
): Partial<Record<T, string>> {
  const data: Partial<Record<T, string>> = {};

  for (const key of keys) {
    const value = input[key];
    if (value === undefined) {
      continue;
    }

    if (typeof value !== "string") {
      throw new PermissionDomainError(code, message, 422);
    }

    data[key] = value;
  }

  return data;
}

function readRoleSubjects(
  input: Record<string, unknown>,
): Array<{ type: IamSubjectType; id: string }> {
  if (input.org_subjects !== undefined || input.user_subjects !== undefined) {
    return [
      ...readStringArray(
        input.org_subjects ?? [],
        "IAM_ROLE_SUBJECTS_INVALID",
        "IAM 角色主体列表不合法",
      ).map((id) => ({ type: "feishu_department" as const, id })),
      ...readStringArray(
        input.user_subjects ?? [],
        "IAM_ROLE_SUBJECTS_INVALID",
        "IAM 角色主体列表不合法",
      ).map((id) => ({ type: "feishu_user" as const, id })),
    ];
  }

  const values = input.subjects;
  if (!Array.isArray(values)) {
    throw new PermissionDomainError(
      "IAM_ROLE_SUBJECTS_INVALID",
      "IAM 角色主体列表不合法",
      422,
    );
  }

  const subjects: Array<{ type: IamSubjectType; id: string }> = [];

  for (const subject of values) {
    if (
      typeof subject !== "object" ||
      subject === null ||
      Array.isArray(subject)
    ) {
      throw new PermissionDomainError(
        "IAM_ROLE_SUBJECTS_INVALID",
        "IAM 角色主体列表不合法",
        422,
      );
    }

    const type = (subject as { type?: unknown }).type;
    const id = (subject as { id?: unknown }).id;
    if (
      (type !== "feishu_user" && type !== "feishu_department") ||
      typeof id !== "string" ||
      id.trim().length === 0
    ) {
      throw new PermissionDomainError(
        "IAM_ROLE_SUBJECTS_INVALID",
        "IAM 角色主体列表不合法",
        422,
      );
    }

    subjects.push({ type, id });
  }

  return subjects;
}
