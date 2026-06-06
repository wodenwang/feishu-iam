import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import type { App as SupertestApp } from "supertest/types";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { AdminAuthService } from "../src/admin/admin-auth.service";
import { AdminModule } from "../src/admin/admin.module";
import { AdminQueryService } from "../src/admin/admin-query.service";
import { AdminTraceService } from "../src/admin/admin-trace.service";
import { AdminDomainError } from "../src/admin/admin.types";
import { AdminUserService } from "../src/admin/admin-user.service";
import { FeishuDiagnosticsService } from "../src/feishu/feishu-diagnostics.service";
import { FeishuStatusService } from "../src/feishu/feishu-status.service";
import { FeishuSyncService } from "../src/feishu/feishu-sync.service";
import { ApplicationOnboardingService } from "../src/oauth/application-onboarding.service";
import { DeveloperCredentialService } from "../src/oauth/developer-credential.service";
import { IntegrationPromptService } from "../src/oauth/integration-prompt.service";
import { OauthConfigService } from "../src/oauth/oauth-config.service";
import { SecurityEventService } from "../src/oauth/security-event.service";
import { ApplicationService } from "../src/permission/application.service";
import { AuditLogService } from "../src/permission/audit-log.service";
import { IamRoleService } from "../src/permission/iam-role.service";
import { PermissionCatalogService } from "../src/permission/permission-catalog.service";
import { PrismaService } from "../src/prisma/prisma.service";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getField(body: unknown, field: string): unknown {
  return isRecord(body) ? body[field] : undefined;
}

function getErrorCode(body: unknown): unknown {
  const error = getField(body, "error");
  return isRecord(error) ? error.code : undefined;
}

function getErrorMessage(body: unknown): unknown {
  const error = getField(body, "error");
  return isRecord(error) ? error.message : undefined;
}

function basicAuth(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

function getSetCookieHeader(response: {
  headers: Record<string, unknown>;
}): string {
  return readSetCookieHeaders(response.headers["set-cookie"]).join(";");
}

function readSetCookieHeaders(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  return typeof value === "string" ? [value] : [];
}

const INTERNAL_OR_SENSITIVE_FIELD_PATTERN =
  /adminUserId|adminRoleId|applicationId|secret|token|cookie|password|clientSecretHash|rawPayload/i;

describe("Admin auth controller", () => {
  let app: INestApplication;

  const auth = {
    startFeishuLogin: vi.fn<AdminAuthService["startFeishuLogin"]>(),
    handleFeishuCallback: vi.fn<AdminAuthService["handleFeishuCallback"]>(),
    getContextFromSessionSecret:
      vi.fn<AdminAuthService["getContextFromSessionSecret"]>(),
    logout: vi.fn<AdminAuthService["logout"]>(),
  };
  const adminUsers = {
    createAdminUser: vi.fn<AdminUserService["createAdminUser"]>(),
    listAdminUsers: vi.fn<AdminUserService["listAdminUsers"]>(),
    replaceApplicationScopes:
      vi.fn<AdminUserService["replaceApplicationScopes"]>(),
    replaceAuthorization: vi.fn<AdminUserService["replaceAuthorization"]>(),
    setAdminUserStatus: vi.fn<AdminUserService["setAdminUserStatus"]>(),
  };
  const adminQueries = {
    listAuditLogs: vi.fn<AdminQueryService["listAuditLogs"]>(),
    listSecurityEvents: vi.fn<AdminQueryService["listSecurityEvents"]>(),
  };
  const adminTraces = {
    getTrace: vi.fn<AdminTraceService["getTrace"]>(),
  };
  const applications = {
    createApplication: vi.fn<ApplicationService["createApplication"]>(),
    listApplications: vi.fn<ApplicationService["listApplications"]>(),
    getApplicationByKey: vi.fn<ApplicationService["getApplicationByKey"]>(),
    updateApplication: vi.fn<ApplicationService["updateApplication"]>(),
    setApplicationStatus: vi.fn<ApplicationService["setApplicationStatus"]>(),
  };
  const catalog = {
    listPermissionPoints:
      vi.fn<PermissionCatalogService["listPermissionPoints"]>(),
    listPermissionGroups:
      vi.fn<PermissionCatalogService["listPermissionGroups"]>(),
  };
  const iamRoles = {
    createRole: vi.fn<IamRoleService["createRole"]>(),
    listRoles: vi.fn<IamRoleService["listRoles"]>(),
    updateRole: vi.fn<IamRoleService["updateRole"]>(),
    setRoleStatus: vi.fn<IamRoleService["setRoleStatus"]>(),
    replaceRolePermissionGroups:
      vi.fn<IamRoleService["replaceRolePermissionGroups"]>(),
    replaceRoleSubjects: vi.fn<IamRoleService["replaceRoleSubjects"]>(),
  };
  const oauthConfig = {
    listEnvironments: vi.fn<OauthConfigService["listEnvironments"]>(),
    createEnvironment: vi.fn<OauthConfigService["createEnvironment"]>(),
    listRedirectUris: vi.fn<OauthConfigService["listRedirectUris"]>(),
    createRedirectUri: vi.fn<OauthConfigService["createRedirectUri"]>(),
    disableRedirectUri: vi.fn<OauthConfigService["disableRedirectUri"]>(),
    listClients: vi.fn<OauthConfigService["listClients"]>(),
    createClient: vi.fn<OauthConfigService["createClient"]>(),
    viewClientSecret: vi.fn<OauthConfigService["viewClientSecret"]>(),
    rotateClientSecret: vi.fn<OauthConfigService["rotateClientSecret"]>(),
    setClientStatus: vi.fn<OauthConfigService["setClientStatus"]>(),
  };
  const onboarding = {
    createOnboardingPackage:
      vi.fn<ApplicationOnboardingService["createOnboardingPackage"]>(),
  };
  const developerCredentials = {
    listCredentials: vi.fn<DeveloperCredentialService["listCredentials"]>(),
  };
  const integrationPrompts = {
    generateSafePrompt: vi.fn<IntegrationPromptService["generateSafePrompt"]>(),
  };
  const feishuStatus = {
    getStatus: vi.fn<FeishuStatusService["getStatus"]>(),
    listRuns: vi.fn<FeishuStatusService["listRuns"]>(),
    getRun: vi.fn<FeishuStatusService["getRun"]>(),
  };
  const feishuSync = {
    runFullSync: vi.fn<FeishuSyncService["runFullSync"]>(),
    runUserLightSync: vi.fn<FeishuSyncService["runUserLightSync"]>(),
    runDepartmentLightSync:
      vi.fn<FeishuSyncService["runDepartmentLightSync"]>(),
  };
  const feishuDiagnostics = {
    getFieldDiagnostics:
      vi.fn<FeishuDiagnosticsService["getFieldDiagnostics"]>(),
  };
  const audit = {
    record: vi.fn<AuditLogService["record"]>(),
  };
  const securityEvents = {
    record: vi.fn<SecurityEventService["record"]>().mockResolvedValue(undefined),
  };
  const prisma = {
    isReady: vi.fn().mockResolvedValue(true),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    feishuUser: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    feishuDepartment: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    feishuUserDepartment: {
      findMany: vi.fn(),
    },
    applicationRedirectUri: {
      count: vi.fn(),
    },
    applicationClient: {
      count: vi.fn(),
    },
    applicationDeveloperCredential: {
      count: vi.fn(),
    },
    iamRole: {
      count: vi.fn(),
    },
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AdminModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(AdminAuthService)
      .useValue(auth)
      .overrideProvider(AdminUserService)
      .useValue(adminUsers)
      .overrideProvider(AdminQueryService)
      .useValue(adminQueries)
      .overrideProvider(AdminTraceService)
      .useValue(adminTraces)
      .overrideProvider(ApplicationService)
      .useValue(applications)
      .overrideProvider(PermissionCatalogService)
      .useValue(catalog)
      .overrideProvider(IamRoleService)
      .useValue(iamRoles)
      .overrideProvider(OauthConfigService)
      .useValue(oauthConfig)
      .overrideProvider(ApplicationOnboardingService)
      .useValue(onboarding)
      .overrideProvider(DeveloperCredentialService)
      .useValue(developerCredentials)
      .overrideProvider(IntegrationPromptService)
      .useValue(integrationPrompts)
      .overrideProvider(FeishuStatusService)
      .useValue(feishuStatus)
      .overrideProvider(FeishuSyncService)
      .useValue(feishuSync)
      .overrideProvider(FeishuDiagnosticsService)
      .useValue(feishuDiagnostics)
      .overrideProvider(AuditLogService)
      .useValue(audit)
      .overrideProvider(SecurityEventService)
      .useValue(securityEvents)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    auth.startFeishuLogin.mockReturnValue({
      state: "bias_login_state",
      redirectUri: "https://iam.example.com/admin/auth/feishu/callback",
      redirectTo:
        "https://accounts.feishu.cn/open-apis/authen/v1/authorize?state=bias_login_state",
    });
    auth.handleFeishuCallback.mockResolvedValue({
      sessionSecret: "bias_admin_session",
      context: {
        adminUserId: "admin-platform",
        feishuUserId: "ou_platform",
        displayName: "平台管理员",
        roles: ["platform_admin"],
        applicationIds: [],
      },
    });
    auth.logout.mockResolvedValue(undefined);
    securityEvents.record.mockReset();
    securityEvents.record.mockResolvedValue(undefined);
    adminUsers.createAdminUser.mockResolvedValue({
      id: "admin-created",
      feishuUserId: "ou_created",
      displayName: "新管理员",
      status: "active",
      lastLoginAt: null,
      createdAt: new Date("2026-05-17T01:00:00.000Z"),
      updatedAt: new Date("2026-05-17T01:00:00.000Z"),
    });
    adminUsers.listAdminUsers.mockResolvedValue([
      {
        id: "admin-1",
        feishuUserId: "ou_1",
        displayName: "平台管理员",
        status: "active",
        lastLoginAt: null,
        createdAt: new Date("2026-05-17T01:00:00.000Z"),
        updatedAt: new Date("2026-05-17T01:00:00.000Z"),
        roles: [
          {
            roleKey: "platform_admin",
            name: "平台管理员",
          },
        ],
        applicationScopes: [
          {
            id: "app-finance",
            appKey: "finance",
            name: "财务系统",
            status: "active",
          },
        ],
      },
    ]);
    adminUsers.replaceApplicationScopes.mockResolvedValue({
      id: "admin-app-demo",
      feishuUserId: "ou_app_demo",
      displayName: "Demo 应用管理员",
      status: "active",
      lastLoginAt: null,
      createdAt: new Date("2026-05-17T01:00:00.000Z"),
      updatedAt: new Date("2026-05-17T01:00:00.000Z"),
      roles: [
        {
          roleKey: "application_admin",
          name: "应用管理员",
        },
      ],
      applicationScopes: [
        {
          id: "app-finance",
          appKey: "finance",
          name: "财务系统",
          status: "active",
        },
      ],
    });
    adminUsers.replaceAuthorization.mockResolvedValue({
      id: "admin-app-demo",
      feishuUserId: "ou_app_demo",
      displayName: "Demo 应用管理员",
      status: "active",
      lastLoginAt: null,
      createdAt: new Date("2026-05-17T01:00:00.000Z"),
      updatedAt: new Date("2026-05-17T01:00:00.000Z"),
      roles: [
        {
          roleKey: "application_admin",
          name: "应用管理员",
        },
      ],
      applicationScopes: [
        {
          id: "app-finance",
          appKey: "finance",
          name: "财务系统",
          status: "active",
        },
      ],
    });
    adminUsers.setAdminUserStatus.mockResolvedValue({
      id: "admin-app-demo",
      feishuUserId: "ou_app_demo",
      displayName: "Demo 应用管理员",
      status: "disabled",
      lastLoginAt: null,
      createdAt: new Date("2026-05-17T01:00:00.000Z"),
      updatedAt: new Date("2026-05-17T01:00:00.000Z"),
      roles: [
        {
          roleKey: "application_admin",
          name: "应用管理员",
        },
      ],
      applicationScopes: [],
    });
    adminQueries.listAuditLogs.mockResolvedValue({
      items: [
        {
          id: "audit-1",
          actorType: "admin_user",
          actorId: "admin-platform",
          source: "admin_web",
          applicationId: "app-finance",
          action: "update",
          resourceType: "application",
          resourceId: "app-finance",
          requestId: "req-audit-1",
          result: "success",
          before: null,
          after: null,
          ip: null,
          userAgent: null,
          createdAt: new Date("2026-05-17T01:00:00.000Z"),
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    adminQueries.listSecurityEvents.mockResolvedValue({
      items: [
        {
          id: "event-1",
          eventType: "oauth_token_invalid",
          applicationId: "app-finance",
          clientId: "bic_finance_dev",
          feishuUserId: "ou_user",
          result: "failed",
          reasonCode: "TOKEN_INVALID",
          summary: "令牌无效",
          ip: null,
          userAgent: null,
          requestId: "req-event-1",
          createdAt: new Date("2026-05-17T01:00:00.000Z"),
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    adminTraces.getTrace.mockResolvedValue({
      summary: {
        status: "complete",
        diagnosis: "已找到可见追踪记录",
        matchedEventCount: 1,
        missingStages: [],
        nextActions: [],
      },
      context: {
        requestId: "req-1",
        timeWindow: {
          from: "2026-05-29T00:00:00.000Z",
          to: "2026-05-29T01:00:00.000Z",
        },
      },
      timeline: [],
      coverage: {
        auditLogs: 0,
        securityEvents: 1,
        feishuSyncRuns: 0,
        oauthContexts: 0,
      },
    });
    applications.listApplications.mockResolvedValue({
      items: [
        {
          id: "app-finance",
          appKey: "finance",
          name: "财务系统",
          description: null,
          ownerUserId: null,
          status: "active",
          createdAt: new Date("2026-05-17T01:00:00.000Z"),
          updatedAt: new Date("2026-05-17T01:00:00.000Z"),
        },
        {
          id: "app-hr",
          appKey: "hr",
          name: "人事系统",
          description: null,
          ownerUserId: null,
          status: "active",
          createdAt: new Date("2026-05-17T01:00:00.000Z"),
          updatedAt: new Date("2026-05-17T01:00:00.000Z"),
        },
      ],
      total: 2,
      page: 1,
      pageSize: 20,
    });
    applications.createApplication.mockResolvedValue({
      id: "app-demo",
      appKey: "demo",
      name: "Demo 系统",
      description: null,
      ownerUserId: null,
      status: "active",
      createdAt: new Date("2026-05-17T01:00:00.000Z"),
      updatedAt: new Date("2026-05-17T01:00:00.000Z"),
    });
    onboarding.createOnboardingPackage.mockResolvedValue({
      application: {
        id: "app-demo",
        appKey: "demo",
        name: "Demo 系统",
        description: null,
        ownerUserId: null,
        status: "active",
        createdAt: new Date("2026-05-17T01:00:00.000Z"),
        updatedAt: new Date("2026-05-17T01:00:00.000Z"),
      },
      redirectUris: [
        {
          id: "redirect-demo",
          applicationId: "app-demo",
          environmentId: null,
          sourceEnvironmentId: null,
          redirectUri: "http://localhost:5173/auth/callback",
          status: "active",
          createdAt: new Date("2026-05-17T01:00:00.000Z"),
          updatedAt: new Date("2026-05-17T01:00:00.000Z"),
        },
      ],
      oauthCredential: {
        id: "credential-demo",
        clientId: "bic_demo",
        name: "默认登录凭证",
        status: "active",
        isPrimary: true,
        createdAt: new Date("2026-05-17T01:00:00.000Z"),
        updatedAt: new Date("2026-05-17T01:00:00.000Z"),
      },
      clientSecret: "bics_demo_secret",
      developerCredential: {
        id: "developer-credential-demo",
        applicationId: "app-demo",
        name: "默认开发者 API 凭证",
        status: "active",
        lastUsedAt: null,
        rotatedAt: null,
        createdAt: new Date("2026-05-17T01:00:00.000Z"),
        updatedAt: new Date("2026-05-17T01:00:00.000Z"),
      },
      developerApiToken: "biad_demo_token",
      integrationPrompt: "full prompt",
    });
    applications.updateApplication.mockResolvedValue({
      id: "app-demo",
      appKey: "demo",
      name: "Demo 系统 V2",
      description: "更新后的 Demo",
      ownerUserId: "ou_owner",
      status: "active",
      createdAt: new Date("2026-05-17T01:00:00.000Z"),
      updatedAt: new Date("2026-05-17T01:00:00.000Z"),
    });
    applications.setApplicationStatus.mockImplementation((appKey, status) =>
      Promise.resolve({
        id: `app-${appKey}`,
        appKey,
        name: `${appKey} 系统`,
        description: null,
        ownerUserId: null,
        status,
        createdAt: new Date("2026-05-17T01:00:00.000Z"),
        updatedAt: new Date("2026-05-17T01:00:00.000Z"),
      }),
    );
    applications.getApplicationByKey.mockImplementation(async (appKey) => {
      const result = await applications.listApplications();
      const application = result.items.find((item) => item.appKey === appKey);
      if (!application) {
        throw new Error("应用不存在");
      }
      return application;
    });
    catalog.listPermissionPoints.mockResolvedValue([
      {
        id: "point-finance-read",
        applicationId: "app-finance",
        key: "finance.invoice.read",
        name: "查看发票",
        description: null,
        status: "active",
        createdAt: new Date("2026-05-17T01:00:00.000Z"),
        updatedAt: new Date("2026-05-17T01:00:00.000Z"),
      },
    ]);
    catalog.listPermissionGroups.mockResolvedValue([
      {
        id: "group-finance-admin",
        applicationId: "app-finance",
        key: "finance.admin",
        name: "财务管理员",
        description: null,
        status: "active",
        createdAt: new Date("2026-05-17T01:00:00.000Z"),
        updatedAt: new Date("2026-05-17T01:00:00.000Z"),
      },
    ]);
    iamRoles.listRoles.mockResolvedValue([
      {
        id: "role-finance-admin",
        applicationId: "app-finance",
        key: "finance-admin",
        name: "财务角色",
        description: null,
        status: "active",
        permissionGroupIds: ["group-finance-admin"],
        permissionGroups: [
          {
            id: "group-finance-admin",
            applicationId: "app-finance",
            key: "finance.admin",
            name: "财务管理员",
            description: null,
            status: "active",
            permissionPoints: [
              {
                id: "point-finance-read",
                applicationId: "app-finance",
                key: "finance.invoice.read",
                name: "查看发票",
                description: null,
                status: "active",
                createdAt: new Date("2026-05-17T01:00:00.000Z"),
                updatedAt: new Date("2026-05-17T01:00:00.000Z"),
              },
            ],
            createdAt: new Date("2026-05-17T01:00:00.000Z"),
            updatedAt: new Date("2026-05-17T01:00:00.000Z"),
          },
        ],
        permissionPoints: [
          {
            id: "point-finance-export",
            applicationId: "app-finance",
            key: "finance.invoice.export",
            name: "导出发票",
            description: null,
            status: "active",
            createdAt: new Date("2026-05-17T01:00:00.000Z"),
            updatedAt: new Date("2026-05-17T01:00:00.000Z"),
          },
        ],
        subjects: [
          {
            type: "feishu_user",
            id: "ou-wang",
            isOrphaned: false,
            displayName: "王文哲",
            avatarLabel: "王",
            subjectKindLabel: "用户",
            displayPath: "唐群座椅 / 财务部",
          },
          {
            type: "feishu_department",
            id: "od-missing",
            isOrphaned: true,
            displayName: "od-missing",
            avatarLabel: "o",
            subjectKindLabel: "组织",
            displayPath: "已失效或未同步",
          },
        ],
        createdAt: new Date("2026-05-17T01:00:00.000Z"),
        updatedAt: new Date("2026-05-17T01:00:00.000Z"),
      },
    ]);
    iamRoles.createRole.mockResolvedValue({
      id: "role-demo-admin",
      applicationId: "app-finance",
      key: "finance.admin",
      name: "财务管理员",
      description: null,
      status: "active",
      createdAt: new Date("2026-05-17T01:00:00.000Z"),
      updatedAt: new Date("2026-05-17T01:00:00.000Z"),
    });
    iamRoles.updateRole.mockResolvedValue({
      id: "role-demo-admin",
      applicationId: "app-finance",
      key: "finance.admin",
      name: "财务管理员 V2",
      description: null,
      status: "active",
      createdAt: new Date("2026-05-17T01:00:00.000Z"),
      updatedAt: new Date("2026-05-17T01:00:00.000Z"),
    });
    iamRoles.setRoleStatus.mockImplementation((_appKey, roleId, status) =>
      Promise.resolve({
        id: roleId,
        applicationId: "app-finance",
        key: "finance.admin",
        name: "财务管理员",
        description: null,
        status,
        createdAt: new Date("2026-05-17T01:00:00.000Z"),
        updatedAt: new Date("2026-05-17T01:00:00.000Z"),
      }),
    );
    iamRoles.replaceRolePermissionGroups.mockResolvedValue(undefined);
    iamRoles.replaceRoleSubjects.mockResolvedValue(undefined);
    oauthConfig.listEnvironments.mockResolvedValue([
      {
        id: "env-finance-dev",
        applicationId: "app-finance",
        environmentKey: "dev",
        name: "开发环境",
        status: "active",
        createdAt: new Date("2026-05-17T01:00:00.000Z"),
        updatedAt: new Date("2026-05-17T01:00:00.000Z"),
      },
    ]);
    oauthConfig.createEnvironment.mockResolvedValue({
      id: "env-finance-dev",
      applicationId: "app-finance",
      environmentKey: "dev",
      name: "开发环境",
      status: "active",
      createdAt: new Date("2026-05-17T01:00:00.000Z"),
      updatedAt: new Date("2026-05-17T01:00:00.000Z"),
    });
    oauthConfig.listRedirectUris.mockResolvedValue([]);
    oauthConfig.createRedirectUri.mockResolvedValue({
      id: "redirect-1",
      applicationId: "app-finance",
      environmentId: "env-finance-dev",
      sourceEnvironmentId: "env-finance-dev",
      redirectUri: "http://localhost:5173/callback",
      status: "active",
      createdAt: new Date("2026-05-17T01:00:00.000Z"),
      updatedAt: new Date("2026-05-17T01:00:00.000Z"),
    });
    oauthConfig.disableRedirectUri.mockResolvedValue({
      id: "redirect-1",
      applicationId: "app-finance",
      environmentId: null,
      sourceEnvironmentId: null,
      redirectUri: "http://localhost:5173/callback",
      status: "disabled",
      createdAt: new Date("2026-05-17T01:00:00.000Z"),
      updatedAt: new Date("2026-05-17T02:00:00.000Z"),
    });
    oauthConfig.listClients.mockResolvedValue([
      {
        id: "client-row-1",
        applicationId: "app-finance",
        environmentId: "env-finance-dev",
        sourceEnvironmentId: "env-finance-dev",
        clientId: "bic_finance_dev",
        name: "Web Client",
        status: "active",
        isPrimary: true,
        revokedAt: null,
        lastUsedAt: null,
        createdAt: new Date("2026-05-17T01:00:00.000Z"),
        updatedAt: new Date("2026-05-17T01:00:00.000Z"),
      },
    ]);
    oauthConfig.createClient.mockResolvedValue({
      id: "client-row-1",
      applicationId: "app-finance",
      environmentId: "env-finance-dev",
      sourceEnvironmentId: "env-finance-dev",
      clientId: "bic_finance_dev",
      clientSecretHash: "hash-redacted",
      clientSecretCiphertext: "cipher-redacted",
      clientSecretIv: "iv-redacted",
      clientSecretAuthTag: "tag-redacted",
      clientSecretAlgorithm: "aes-256-gcm",
      clientSecret: "secret-once",
      name: "Web Client",
      status: "active",
      isPrimary: true,
      revokedAt: null,
      lastUsedAt: null,
      createdAt: new Date("2026-05-17T01:00:00.000Z"),
      updatedAt: new Date("2026-05-17T01:00:00.000Z"),
    });
    oauthConfig.rotateClientSecret.mockResolvedValue({
      clientId: "bic_finance_dev",
      clientSecret: "secret-rotated",
    });
    oauthConfig.viewClientSecret.mockResolvedValue({
      clientId: "bic_finance_dev",
      clientSecret: "secret-viewed",
    });
    oauthConfig.setClientStatus.mockResolvedValue({
      id: "client-row-1",
      applicationId: "app-finance",
      environmentId: "env-finance-dev",
      sourceEnvironmentId: "env-finance-dev",
      clientId: "bic_finance_dev",
      name: "Web Client",
      status: "active",
      isPrimary: true,
      revokedAt: null,
      lastUsedAt: null,
      createdAt: new Date("2026-05-17T01:00:00.000Z"),
      updatedAt: new Date("2026-05-17T01:00:00.000Z"),
    });
    developerCredentials.listCredentials.mockResolvedValue([
      {
        id: "developer-credential-1",
        applicationId: "app-finance",
        name: "默认开发者 API 凭证",
        status: "active",
        lastUsedAt: null,
        rotatedAt: null,
        createdAt: new Date("2026-05-17T01:00:00.000Z"),
        updatedAt: new Date("2026-05-17T01:00:00.000Z"),
      },
    ]);
    integrationPrompts.generateSafePrompt.mockReturnValue(
      "safe prompt with AGENTS.md and placeholders",
    );
    feishuStatus.getStatus.mockResolvedValue({
      configStatus: "connected",
      running: false,
      latestRun: null,
      counts: {
        departments: 2,
        activeDepartments: 2,
        users: 3,
        activeUsers: 2,
        relations: 3,
      },
    });
    feishuStatus.listRuns.mockResolvedValue([
      {
        id: "run-admin-1",
        triggerSource: "admin_web",
        status: "success",
        startedAt: new Date("2026-05-17T01:00:00.000Z"),
        finishedAt: new Date("2026-05-17T01:01:00.000Z"),
        departmentCreatedCount: 0,
        departmentUpdatedCount: 0,
        departmentDeletedCount: 0,
        userCreatedCount: 0,
        userUpdatedCount: 0,
        userDeletedCount: 0,
        relationCreatedCount: 0,
        relationUpdatedCount: 0,
        relationDeletedCount: 0,
        errorCode: null,
        errorMessage: null,
      },
    ]);
    feishuStatus.getRun.mockResolvedValue({
      id: "run-admin-1",
      triggerSource: "admin_web",
      status: "success",
      startedAt: new Date("2026-05-17T01:00:00.000Z"),
      finishedAt: new Date("2026-05-17T01:01:00.000Z"),
      departmentCreatedCount: 0,
      departmentUpdatedCount: 0,
      departmentDeletedCount: 0,
      userCreatedCount: 0,
      userUpdatedCount: 0,
      userDeletedCount: 0,
      relationCreatedCount: 0,
      relationUpdatedCount: 0,
      relationDeletedCount: 0,
      errorCode: null,
      errorMessage: null,
    });
    feishuSync.runFullSync.mockResolvedValue({
      id: "run-admin-1",
      status: "success",
      departmentCreatedCount: 0,
      departmentUpdatedCount: 0,
      departmentDeletedCount: 0,
      userCreatedCount: 0,
      userUpdatedCount: 0,
      userDeletedCount: 0,
      relationCreatedCount: 0,
      relationUpdatedCount: 0,
      relationDeletedCount: 0,
    });
    feishuSync.runUserLightSync.mockResolvedValue({
      id: "run-user-light-1",
      status: "success",
      departmentCreatedCount: 0,
      departmentUpdatedCount: 0,
      departmentDeletedCount: 0,
      userCreatedCount: 0,
      userUpdatedCount: 1,
      userDeletedCount: 0,
      relationCreatedCount: 0,
      relationUpdatedCount: 1,
      relationDeletedCount: 0,
    });
    feishuSync.runDepartmentLightSync.mockResolvedValue({
      id: "run-department-light-1",
      status: "success",
      departmentCreatedCount: 0,
      departmentUpdatedCount: 1,
      departmentDeletedCount: 0,
      userCreatedCount: 0,
      userUpdatedCount: 1,
      userDeletedCount: 0,
      relationCreatedCount: 0,
      relationUpdatedCount: 1,
      relationDeletedCount: 0,
    });
    feishuDiagnostics.getFieldDiagnostics.mockResolvedValue({
      status: "passed",
      loginReadiness: {
        ready: true,
        reason: "字段满足后续 SSO 准备要求",
      },
      sampleCounts: {
        departments: 1,
        users: 1,
        activeUsers: 1,
      },
      departmentFields: [],
      userFields: [],
      blockingIssues: [],
      warnings: [],
      nextActions: [],
    });
    prisma.feishuUser.count.mockResolvedValue(1);
    prisma.feishuUser.findMany.mockResolvedValue([
      {
        userId: "ou-wang",
        name: "王文哲",
        email: "wang@example.com",
        mobile: "13800138000",
        isActive: true,
        isDeleted: false,
        lastSyncedAt: new Date("2026-05-17T01:00:00.000Z"),
      },
    ]);
    prisma.feishuUser.findUnique.mockResolvedValue({
      userId: "ou-wang",
      openId: "ou-open",
      unionId: "on-union",
      name: "王文哲",
      enName: null,
      email: "wang@example.com",
      mobile: "13800138000",
      employeeNo: "E001",
      employeeType: 1,
      jobTitle: "财务经理",
      leaderUserId: null,
      isActive: true,
      isDeleted: false,
      lastSyncedAt: new Date("2026-05-17T01:00:00.000Z"),
      userDepartments: [
        {
          departmentId: "od-finance",
          isPrimary: true,
          department: {
            name: "财务部",
            isDeleted: false,
          },
        },
      ],
    });
    prisma.feishuDepartment.count.mockResolvedValue(1);
    prisma.feishuDepartment.findMany.mockResolvedValue([
      {
        departmentId: "od-finance",
        openDepartmentId: "od-finance-open",
        parentDepartmentId: "od-root",
        name: "财务部",
        isDeleted: false,
        lastSyncedAt: new Date("2026-05-17T01:00:00.000Z"),
      },
    ]);
    prisma.feishuDepartment.findUnique.mockResolvedValue({
      departmentId: "od-finance",
      openDepartmentId: "od-finance-open",
      parentDepartmentId: "od-root",
      name: "财务部",
      leaderUserId: "ou-wang",
      isDeleted: false,
      lastSyncedAt: new Date("2026-05-17T01:00:00.000Z"),
    });
    prisma.feishuUserDepartment.findMany.mockResolvedValue([
      {
        userId: "ou-wang",
        departmentId: "od-finance",
        isPrimary: true,
        user: {
          userId: "ou-wang",
          name: "王文哲",
          email: "wang@example.com",
          mobile: "13800138000",
          isActive: true,
          isDeleted: false,
          lastSyncedAt: new Date("2026-05-17T01:00:00.000Z"),
        },
      },
    ]);
    prisma.applicationRedirectUri.count.mockResolvedValue(1);
    prisma.applicationClient.count.mockResolvedValue(1);
    prisma.applicationDeveloperCredential.count.mockResolvedValue(1);
    prisma.iamRole.count.mockResolvedValue(1);
    audit.record.mockResolvedValue(undefined);
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /admin/auth/login 跳转飞书并写入后台登录 state cookie", async () => {
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .get("/admin/auth/login")
      .expect(302)
      .expect(
        "Location",
        "https://accounts.feishu.cn/open-apis/authen/v1/authorize?state=bias_login_state",
      )
      .expect((response) => {
        const setCookie = response.headers["set-cookie"];
        const cookieHeader = Array.isArray(setCookie)
          ? setCookie.join(";")
          : setCookie;
        expect(cookieHeader).toContain(
          "feishu_iam_admin_login_state=bias_login_state",
        );
        expect(cookieHeader).toContain("Path=/");
        expect(cookieHeader).toContain("HttpOnly");
        expect(cookieHeader).toContain("SameSite=Lax");
      });

    expect(auth.startFeishuLogin).toHaveBeenCalled();
  });

  it("GET /admin/auth/feishu/callback 校验 state 后写入后台 session cookie 并跳回首页", async () => {
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .get(
        "/admin/auth/feishu/callback?code=feishu-code&state=bias_login_state",
      )
      .set("Cookie", ["feishu_iam_admin_login_state=bias_login_state"])
      .expect(302)
      .expect("Location", "/")
      .expect((response) => {
        const setCookie = response.headers["set-cookie"];
        const cookieHeader = Array.isArray(setCookie)
          ? setCookie.join(";")
          : setCookie;
        expect(cookieHeader).toContain(
          "feishu_iam_admin_session=bias_admin_session",
        );
        expect(cookieHeader).toContain("feishu_iam_admin_login_state=");
        expect(cookieHeader).toContain("Path=/");
        expect(cookieHeader).toContain("HttpOnly");
        expect(cookieHeader).toContain("SameSite=Lax");
      });

    expect(auth.handleFeishuCallback).toHaveBeenCalledWith(
      {
        code: "feishu-code",
        state: "bias_login_state",
        expectedState: "bias_login_state",
      },
      expect.objectContaining({
        ip: expect.any(String) as unknown,
      }),
    );
  });

  it("GET /admin/auth/feishu/callback 缺少登录 state cookie 时返回稳定错误且不创建 session", async () => {
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .get(
        "/admin/auth/feishu/callback?code=feishu-code&state=bias_login_state",
      )
      .expect(400)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe(
          "ADMIN_LOGIN_STATE_INVALID",
        );
      });

    expect(auth.handleFeishuCallback).not.toHaveBeenCalled();
  });

  it("GET 废弃后台初始化入口返回 404", async () => {
    const httpServer = app.getHttpServer() as SupertestApp;
    const removedPath = ["/admin/auth", "bootstrap"].join("/");

    await request(httpServer)
      .get(removedPath)
      .expect(404)
      .expect((response) => {
        expect(response.text).not.toContain("超级管理员登录");
      });
  });

  it("POST 废弃后台初始化入口返回 404", async () => {
    const httpServer = app.getHttpServer() as SupertestApp;
    const removedPath = ["/admin/auth", "bootstrap"].join("/");

    await request(httpServer)
      .post(removedPath)
      .type("form")
      .send({
        username: "removed",
        password: "removed",
      })
      .expect(404)
      .expect((response) => {
        expect(getSetCookieHeader(response)).toBe("");
      });

    expect(auth.getContextFromSessionSecret).not.toHaveBeenCalled();
  });

  it("GET /api/v1/admin/me 带 Basic Auth 不会绕过真实后台 session", async () => {
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .get("/api/v1/admin/me")
      .set("Authorization", basicAuth("removed", "removed"))
      .expect(401)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe(
          "ADMIN_SESSION_REQUIRED",
        );
      });

    expect(auth.getContextFromSessionSecret).not.toHaveBeenCalled();
  });

  it("GET /api/v1/admin/me 带 feishu_iam_admin_session cookie 返回当前管理员上下文", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-1",
      feishuUserId: "ou_1",
      displayName: "张三",
      roles: ["platform_admin"],
      applicationIds: [],
    });

    const httpServer = app.getHttpServer() as SupertestApp;
    await request(httpServer)
      .get("/api/v1/admin/me")
      .set("Cookie", ["feishu_iam_admin_session=bias_valid"])
      .expect(200)
      .expect((response) => {
        expect(getField(response.body as unknown, "displayName")).toBe("张三");
        expect(getField(response.body as unknown, "roles")).toEqual([
          "platform_admin",
        ]);
      });

    expect(auth.getContextFromSessionSecret).toHaveBeenCalledWith("bias_valid");
  });

  it("GET /api/v1/admin/me 可读取 URL encoded cookie", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-1",
      feishuUserId: "ou_1",
      displayName: "张三",
      roles: ["platform_admin"],
      applicationIds: [],
    });

    const httpServer = app.getHttpServer() as SupertestApp;
    await request(httpServer)
      .get("/api/v1/admin/me")
      .set("Cookie", ["feishu_iam_admin_session=bias_%E4%B8%AD"])
      .expect(200);

    expect(auth.getContextFromSessionSecret).toHaveBeenCalledWith("bias_中");
  });

  it("GET /api/v1/admin/me 无 cookie 返回 ADMIN_SESSION_REQUIRED 稳定错误", async () => {
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .get("/api/v1/admin/me")
      .expect(401)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe(
          "ADMIN_SESSION_REQUIRED",
        );
      });

    expect(auth.getContextFromSessionSecret).not.toHaveBeenCalled();
  });

  it("GET /api/v1/admin/me 空白 cookie 视为缺失", async () => {
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .get("/api/v1/admin/me")
      .set("Cookie", ["feishu_iam_admin_session=%20%20"])
      .expect(401)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe(
          "ADMIN_SESSION_REQUIRED",
        );
      });

    expect(auth.getContextFromSessionSecret).not.toHaveBeenCalled();
  });

  it("GET /api/v1/admin/me 重复 cookie 返回 ADMIN_SESSION_INVALID 且不查询 session", async () => {
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .get("/api/v1/admin/me")
      .set("Cookie", [
        "feishu_iam_admin_session=bias_first; feishu_iam_admin_session=bias_second",
      ])
      .expect(401)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe(
          "ADMIN_SESSION_INVALID",
        );
      });

    expect(auth.getContextFromSessionSecret).not.toHaveBeenCalled();
  });

  it("GET /api/v1/admin/me 空值和有效值混合重复 cookie 返回 ADMIN_SESSION_INVALID", async () => {
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .get("/api/v1/admin/me")
      .set("Cookie", [
        "feishu_iam_admin_session=; feishu_iam_admin_session=bias_valid",
      ])
      .expect(401)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe(
          "ADMIN_SESSION_INVALID",
        );
      });

    expect(auth.getContextFromSessionSecret).not.toHaveBeenCalled();
  });

  it("GET /api/v1/admin/me 非法 URL encoding cookie 返回 ADMIN_SESSION_INVALID", async () => {
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .get("/api/v1/admin/me")
      .set("Cookie", ["feishu_iam_admin_session=%E0%A4%A"])
      .expect(401)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe(
          "ADMIN_SESSION_INVALID",
        );
      });

    expect(auth.getContextFromSessionSecret).not.toHaveBeenCalled();
  });

  it("POST /admin/auth/logout 调用 logout 并 clear cookie", async () => {
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .post("/admin/auth/logout")
      .set("Cookie", ["feishu_iam_admin_session=bias_logout"])
      .expect(200)
      .expect((response) => {
        expect(getField(response.body as unknown, "ok")).toBe(true);
        const setCookie = response.headers["set-cookie"];
        const cookieHeader = Array.isArray(setCookie)
          ? setCookie.join(";")
          : setCookie;
        expect(cookieHeader).toContain("feishu_iam_admin_session=");
        expect(cookieHeader).toContain("Expires=Thu, 01 Jan 1970");
        expect(cookieHeader).toContain("Path=/");
        expect(cookieHeader).toContain("HttpOnly");
        expect(cookieHeader).toContain("SameSite=Lax");
      });

    expect(auth.logout).toHaveBeenCalledWith("bias_logout");
  });

  it("GET /admin/auth/logout 清理后台 session cookie 后跳回首页", async () => {
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .get("/admin/auth/logout")
      .set("Cookie", [
        "feishu_iam_admin_session=bias_logout; unrelated_session=bias_other",
      ])
      .expect(302)
      .expect("Location", "/")
      .expect((response) => {
        const cookieHeader = getSetCookieHeader(response);
        expect(cookieHeader).toContain("feishu_iam_admin_session=");
        expect(cookieHeader).toContain("Expires=Thu, 01 Jan 1970");
      });

    expect(auth.logout).toHaveBeenCalledWith("bias_logout");
  });

  it("POST /admin/auth/logout 无 cookie 时仍 clear cookie 并返回 ok", async () => {
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .post("/admin/auth/logout")
      .expect(200)
      .expect((response) => {
        expect(getField(response.body as unknown, "ok")).toBe(true);
        const setCookie = response.headers["set-cookie"];
        const cookieHeader = Array.isArray(setCookie)
          ? setCookie.join(";")
          : setCookie;
        expect(cookieHeader).toContain("feishu_iam_admin_session=");
        expect(cookieHeader).toContain("Path=/");
        expect(cookieHeader).toContain("HttpOnly");
        expect(cookieHeader).toContain("SameSite=Lax");
      });

    expect(auth.logout).not.toHaveBeenCalled();
  });

  it("POST /admin/auth/logout 重复 cookie 不撤销不确定 session，但仍 clear cookie", async () => {
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .post("/admin/auth/logout")
      .set("Cookie", [
        "feishu_iam_admin_session=bias_first; feishu_iam_admin_session=bias_second",
      ])
      .expect(200)
      .expect((response) => {
        expect(getField(response.body as unknown, "ok")).toBe(true);
        const setCookie = response.headers["set-cookie"];
        const cookieHeader = Array.isArray(setCookie)
          ? setCookie.join(";")
          : setCookie;
        expect(cookieHeader).toContain("feishu_iam_admin_session=");
        expect(cookieHeader).toContain("Path=/");
        expect(cookieHeader).toContain("HttpOnly");
        expect(cookieHeader).toContain("SameSite=Lax");
      });

    expect(auth.logout).not.toHaveBeenCalled();
  });

  it("POST /admin/auth/logout 非法 URL encoding cookie 不撤销 session，但仍 clear cookie", async () => {
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .post("/admin/auth/logout")
      .set("Cookie", ["feishu_iam_admin_session=%E0%A4%A"])
      .expect(200)
      .expect((response) => {
        expect(getField(response.body as unknown, "ok")).toBe(true);
        const setCookie = response.headers["set-cookie"];
        const cookieHeader = Array.isArray(setCookie)
          ? setCookie.join(";")
          : setCookie;
        expect(cookieHeader).toContain("feishu_iam_admin_session=");
      });

    expect(auth.logout).not.toHaveBeenCalled();
  });

  it("POST /api/v1/admin/admin-users 非平台管理员返回 ADMIN_PERMISSION_DENIED，且不调用创建服务", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-audit",
      feishuUserId: "ou_audit",
      displayName: "审计员",
      roles: ["audit_viewer"],
      applicationIds: [],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .post("/api/v1/admin/admin-users")
      .set("Cookie", ["feishu_iam_admin_session=bias_audit"])
      .send({
        feishuUserId: "ou_new",
        roleKeys: ["application_admin"],
        applicationIds: ["app-finance"],
      })
      .expect(403)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe(
          "ADMIN_PERMISSION_DENIED",
        );
      });

    expect(adminUsers.createAdminUser).not.toHaveBeenCalled();
  });

  it("POST /api/v1/admin/admin-users 平台管理员可创建管理员，并传入 body 与审计上下文", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-platform",
      feishuUserId: "ou_platform",
      displayName: "平台管理员",
      roles: ["platform_admin"],
      applicationIds: [],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .post("/api/v1/admin/admin-users")
      .set("Cookie", ["feishu_iam_admin_session=bias_platform"])
      .set("x-request-id", "req-create-admin-user")
      .set("user-agent", "vitest-admin-console")
      .send({
        feishuUserId: "ou_new",
        roleKeys: ["application_admin"],
        applicationIds: ["app-finance"],
      })
      .expect(201)
      .expect((response) => {
        expect(getField(response.body as unknown, "id")).toBe("admin-created");
      });

    expect(adminUsers.createAdminUser).toHaveBeenCalledWith(
      {
        feishuUserId: "ou_new",
        roleKeys: ["application_admin"],
        applicationIds: ["app-finance"],
      },
      {
        actorType: "admin_user",
        actorId: "admin-platform",
        source: "admin_web",
        requestId: "req-create-admin-user",
        ip: expect.any(String) as unknown,
        userAgent: "vitest-admin-console",
      },
    );
  });

  it("POST /api/v1/admin/admin-users 带 Basic Auth 不能创建管理员", async () => {
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .post("/api/v1/admin/admin-users")
      .set("Authorization", basicAuth("removed", "removed"))
      .send({
        feishuUserId: "ou_first_admin",
        roleKeys: ["platform_admin"],
      })
      .expect(401)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe(
          "ADMIN_SESSION_REQUIRED",
        );
      });

    expect(auth.getContextFromSessionSecret).not.toHaveBeenCalled();
    expect(adminUsers.createAdminUser).not.toHaveBeenCalled();
  });

  it("POST /api/v1/admin/admin-users 真实管理员创建管理员时写 admin_web 审计上下文", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-platform",
      feishuUserId: "ou_platform",
      displayName: "平台管理员",
      roles: ["platform_admin"],
      applicationIds: [],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .post("/api/v1/admin/admin-users")
      .set("Cookie", ["feishu_iam_admin_session=bias_platform"])
      .set("x-request-id", "req-real-admin-user")
      .send({
        feishuUserId: "ou_first_admin",
        roleKeys: ["platform_admin"],
      })
      .expect(201)
      .expect((response) => {
        expect(getField(response.body as unknown, "id")).toBe("admin-created");
      });

    expect(adminUsers.createAdminUser).toHaveBeenCalledWith(
      {
        feishuUserId: "ou_first_admin",
        roleKeys: ["platform_admin"],
        applicationIds: [],
      },
      {
        actorType: "admin_user",
        actorId: "admin-platform",
        source: "admin_web",
        requestId: "req-real-admin-user",
        ip: expect.any(String) as unknown,
        userAgent: null,
      },
    );
  });

  it("PATCH /api/v1/admin/admin-users/:adminUserId/scopes 平台管理员可编辑应用管理员范围", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-platform",
      feishuUserId: "ou_platform",
      displayName: "平台管理员",
      roles: ["platform_admin"],
      applicationIds: [],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .patch("/api/v1/admin/admin-users/admin-app-demo/scopes")
      .set("Cookie", ["feishu_iam_admin_session=bias_platform"])
      .set("x-request-id", "req-replace-admin-scopes")
      .set("user-agent", "vitest-admin-console")
      .send({ applicationIds: ["app-finance"] })
      .expect(200)
      .expect((response) => {
        expect(getField(response.body as unknown, "id")).toBe("admin-app-demo");
      });

    expect(adminUsers.replaceApplicationScopes).toHaveBeenCalledWith(
      "admin-app-demo",
      ["app-finance"],
      {
        actorType: "admin_user",
        actorId: "admin-platform",
        source: "admin_web",
        requestId: "req-replace-admin-scopes",
        ip: expect.any(String) as unknown,
        userAgent: "vitest-admin-console",
      },
    );
  });

  it("PATCH /api/v1/admin/admin-users/:adminUserId/authorization 平台管理员可编辑角色和应用范围", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-platform",
      feishuUserId: "ou_platform",
      displayName: "平台管理员",
      roles: ["platform_admin"],
      applicationIds: [],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .patch("/api/v1/admin/admin-users/admin-app-demo/authorization")
      .set("Cookie", ["feishu_iam_admin_session=bias_platform"])
      .set("x-request-id", "req-replace-admin-authz")
      .set("user-agent", "vitest-admin-console")
      .send({
        roleKeys: ["application_admin"],
        applicationIds: ["app-finance"],
      })
      .expect(200)
      .expect((response) => {
        expect(getField(response.body as unknown, "id")).toBe("admin-app-demo");
      });

    expect(adminUsers.replaceAuthorization).toHaveBeenCalledWith(
      "admin-app-demo",
      { roleKeys: ["application_admin"], applicationIds: ["app-finance"] },
      {
        actorType: "admin_user",
        actorId: "admin-platform",
        source: "admin_web",
        requestId: "req-replace-admin-authz",
        ip: expect.any(String) as unknown,
        userAgent: "vitest-admin-console",
      },
    );
  });

  it.each([
    ["platform_admin", []],
    ["application_admin", ["app-finance"]],
  ] as const)(
    "PATCH /api/v1/admin/admin-users/:adminUserId/authorization 拒绝把 audit_viewer 目标改成 %s",
    async (roleKey, applicationIds) => {
      auth.getContextFromSessionSecret.mockResolvedValue({
        adminUserId: "admin-platform",
        feishuUserId: "ou_platform",
        displayName: "平台管理员",
        roles: ["platform_admin"],
        applicationIds: [],
      });
      adminUsers.replaceAuthorization.mockRejectedValueOnce(
        new AdminDomainError(
          "ADMIN_USER_NOT_EDITABLE",
          "该管理员当前角色不支持维护",
          422,
        ),
      );
      const httpServer = app.getHttpServer() as SupertestApp;

      await request(httpServer)
        .patch("/api/v1/admin/admin-users/admin-audit/authorization")
        .set("Cookie", ["feishu_iam_admin_session=bias_platform"])
        .set("x-request-id", "req-reject-audit-authz")
        .send({ roleKeys: [roleKey], applicationIds })
        .expect(422)
        .expect((response) => {
          expect(getErrorCode(response.body as unknown)).toBe(
            "ADMIN_USER_NOT_EDITABLE",
          );
          expect(getErrorMessage(response.body as unknown)).toBe(
            "该管理员当前角色不支持维护",
          );
        });

      expect(adminUsers.replaceAuthorization).toHaveBeenCalledWith(
        "admin-audit",
        { roleKeys: [roleKey], applicationIds },
        expect.objectContaining({
          actorType: "admin_user",
          actorId: "admin-platform",
          source: "admin_web",
          requestId: "req-reject-audit-authz",
        }),
      );
    },
  );

  it("PATCH /api/v1/admin/admin-users/:adminUserId/authorization 拒绝混合角色目标", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-platform",
      feishuUserId: "ou_platform",
      displayName: "平台管理员",
      roles: ["platform_admin"],
      applicationIds: [],
    });
    adminUsers.replaceAuthorization.mockRejectedValueOnce(
      new AdminDomainError(
        "ADMIN_USER_NOT_EDITABLE",
        "该管理员当前角色不支持维护",
        422,
      ),
    );
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .patch("/api/v1/admin/admin-users/admin-mixed/authorization")
      .set("Cookie", ["feishu_iam_admin_session=bias_platform"])
      .set("x-request-id", "req-reject-mixed-authz")
      .send({ roleKeys: ["platform_admin"], applicationIds: [] })
      .expect(422)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe(
          "ADMIN_USER_NOT_EDITABLE",
        );
        expect(getErrorMessage(response.body as unknown)).toBe(
          "该管理员当前角色不支持维护",
        );
      });

    expect(adminUsers.replaceAuthorization).toHaveBeenCalledWith(
      "admin-mixed",
      { roleKeys: ["platform_admin"], applicationIds: [] },
      expect.objectContaining({
        actorType: "admin_user",
        actorId: "admin-platform",
        source: "admin_web",
        requestId: "req-reject-mixed-authz",
      }),
    );
  });

  it("POST /api/v1/admin/admin-users/:adminUserId/disable 和 enable 平台管理员可切换管理员状态", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-platform",
      feishuUserId: "ou_platform",
      displayName: "平台管理员",
      roles: ["platform_admin"],
      applicationIds: [],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .post("/api/v1/admin/admin-users/admin-app-demo/disable")
      .set("Cookie", ["feishu_iam_admin_session=bias_platform"])
      .set("x-request-id", "req-disable-admin")
      .expect(201)
      .expect((response) => {
        expect(getField(response.body as unknown, "id")).toBe("admin-app-demo");
      });

    await request(httpServer)
      .post("/api/v1/admin/admin-users/admin-app-demo/enable")
      .set("Cookie", ["feishu_iam_admin_session=bias_platform"])
      .set("x-request-id", "req-enable-admin")
      .expect(201);

    expect(adminUsers.setAdminUserStatus).toHaveBeenCalledWith(
      "admin-app-demo",
      "disabled",
      expect.objectContaining({
        actorType: "admin_user",
        actorId: "admin-platform",
        source: "admin_web",
        requestId: "req-disable-admin",
      }),
    );
    expect(adminUsers.setAdminUserStatus).toHaveBeenCalledWith(
      "admin-app-demo",
      "active",
      expect.objectContaining({
        actorType: "admin_user",
        actorId: "admin-platform",
        source: "admin_web",
        requestId: "req-enable-admin",
      }),
    );
  });

  it.each([
    ["audit_viewer", "enable", "active"],
    ["audit_viewer", "disable", "disabled"],
    ["sync_admin", "enable", "active"],
    ["sync_admin", "disable", "disabled"],
  ] as const)(
    "POST /api/v1/admin/admin-users/:adminUserId/enable-disable 拒绝历史角色目标 %s 执行 %s",
    async (roleKey, action, status) => {
      auth.getContextFromSessionSecret.mockResolvedValue({
        adminUserId: "admin-platform",
        feishuUserId: "ou_platform",
        displayName: "平台管理员",
        roles: ["platform_admin"],
        applicationIds: [],
      });
      adminUsers.setAdminUserStatus.mockRejectedValueOnce(
        new AdminDomainError(
          "ADMIN_USER_NOT_EDITABLE",
          "该管理员当前角色不支持维护",
          422,
        ),
      );
      const httpServer = app.getHttpServer() as SupertestApp;

      await request(httpServer)
        .post(`/api/v1/admin/admin-users/admin-${roleKey}/${action}`)
        .set("Cookie", ["feishu_iam_admin_session=bias_platform"])
        .set("x-request-id", `req-reject-${roleKey}-${action}`)
        .expect(422)
        .expect((response) => {
          expect(getErrorCode(response.body as unknown)).toBe(
            "ADMIN_USER_NOT_EDITABLE",
          );
          expect(getErrorMessage(response.body as unknown)).toBe(
            "该管理员当前角色不支持维护",
          );
        });

      expect(adminUsers.setAdminUserStatus).toHaveBeenCalledWith(
        `admin-${roleKey}`,
        status,
        expect.objectContaining({
          actorType: "admin_user",
          actorId: "admin-platform",
          source: "admin_web",
          requestId: `req-reject-${roleKey}-${action}`,
        }),
      );
    },
  );

  it.each([
    ["enable", "active"],
    ["disable", "disabled"],
  ] as const)(
    "POST /api/v1/admin/admin-users/:adminUserId/%s 拒绝混合角色目标",
    async (action, status) => {
      auth.getContextFromSessionSecret.mockResolvedValue({
        adminUserId: "admin-platform",
        feishuUserId: "ou_platform",
        displayName: "平台管理员",
        roles: ["platform_admin"],
        applicationIds: [],
      });
      adminUsers.setAdminUserStatus.mockRejectedValueOnce(
        new AdminDomainError(
          "ADMIN_USER_NOT_EDITABLE",
          "该管理员当前角色不支持维护",
          422,
        ),
      );
      const httpServer = app.getHttpServer() as SupertestApp;

      await request(httpServer)
        .post(`/api/v1/admin/admin-users/admin-mixed/${action}`)
        .set("Cookie", ["feishu_iam_admin_session=bias_platform"])
        .set("x-request-id", `req-reject-mixed-${action}`)
        .expect(422)
        .expect((response) => {
          expect(getErrorCode(response.body as unknown)).toBe(
            "ADMIN_USER_NOT_EDITABLE",
          );
          expect(getErrorMessage(response.body as unknown)).toBe(
            "该管理员当前角色不支持维护",
          );
        });

      expect(adminUsers.setAdminUserStatus).toHaveBeenCalledWith(
        "admin-mixed",
        status,
        expect.objectContaining({
          actorType: "admin_user",
          actorId: "admin-platform",
          source: "admin_web",
          requestId: `req-reject-mixed-${action}`,
        }),
      );
    },
  );

  it("PATCH /api/v1/admin/admin-users/:adminUserId/scopes 非平台管理员返回 ADMIN_PERMISSION_DENIED", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-app",
      feishuUserId: "ou_app",
      displayName: "应用管理员",
      roles: ["application_admin"],
      applicationIds: ["app-finance"],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .patch("/api/v1/admin/admin-users/admin-app-demo/scopes")
      .set("Cookie", ["feishu_iam_admin_session=bias_app"])
      .send({ applicationIds: ["app-finance"] })
      .expect(403)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe(
          "ADMIN_PERMISSION_DENIED",
        );
      });

    expect(adminUsers.replaceApplicationScopes).not.toHaveBeenCalled();
  });

  it("PATCH /api/v1/admin/admin-users/:adminUserId/authorization 非平台管理员返回 ADMIN_PERMISSION_DENIED", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-app",
      feishuUserId: "ou_app",
      displayName: "应用管理员",
      roles: ["application_admin"],
      applicationIds: ["app-finance"],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .patch("/api/v1/admin/admin-users/admin-app-demo/authorization")
      .set("Cookie", ["feishu_iam_admin_session=bias_app"])
      .send({
        roleKeys: ["application_admin"],
        applicationIds: ["app-finance"],
      })
      .expect(403)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe(
          "ADMIN_PERMISSION_DENIED",
        );
      });

    expect(adminUsers.replaceAuthorization).not.toHaveBeenCalled();
  });

  it("POST /api/v1/admin/admin-users body 为 null 时返回稳定错误", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-platform",
      feishuUserId: "ou_platform",
      displayName: "平台管理员",
      roles: ["platform_admin"],
      applicationIds: [],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .post("/api/v1/admin/admin-users")
      .set("Cookie", ["feishu_iam_admin_session=bias_platform"])
      .send(null as unknown as object)
      .expect(422)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe(
          "ADMIN_REQUEST_INVALID",
        );
      });

    expect(adminUsers.createAdminUser).not.toHaveBeenCalled();
  });

  it("POST /api/v1/admin/admin-users body 为数组时返回稳定错误", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-platform",
      feishuUserId: "ou_platform",
      displayName: "平台管理员",
      roles: ["platform_admin"],
      applicationIds: [],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .post("/api/v1/admin/admin-users")
      .set("Cookie", ["feishu_iam_admin_session=bias_platform"])
      .send([])
      .expect(422)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe(
          "ADMIN_REQUEST_INVALID",
        );
      });

    expect(adminUsers.createAdminUser).not.toHaveBeenCalled();
  });

  it("POST /api/v1/admin/admin-users body 为字符串时返回稳定错误", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-platform",
      feishuUserId: "ou_platform",
      displayName: "平台管理员",
      roles: ["platform_admin"],
      applicationIds: [],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .post("/api/v1/admin/admin-users")
      .set("Cookie", ["feishu_iam_admin_session=bias_platform"])
      .type("text")
      .send("invalid-body")
      .expect(422)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe(
          "ADMIN_REQUEST_INVALID",
        );
      });

    expect(adminUsers.createAdminUser).not.toHaveBeenCalled();
  });

  it("GET /api/v1/admin/admin-users 非平台管理员返回 ADMIN_PERMISSION_DENIED", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-audit",
      feishuUserId: "ou_audit",
      displayName: "审计员",
      roles: ["audit_viewer"],
      applicationIds: [],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .get("/api/v1/admin/admin-users")
      .set("Cookie", ["feishu_iam_admin_session=bias_audit"])
      .expect(403)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe(
          "ADMIN_PERMISSION_DENIED",
        );
      });

    expect(adminUsers.listAdminUsers).not.toHaveBeenCalled();
  });

  it("GET /api/v1/admin/admin-users 平台管理员返回分页响应", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-platform",
      feishuUserId: "ou_platform",
      displayName: "平台管理员",
      roles: ["platform_admin"],
      applicationIds: [],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .get("/api/v1/admin/admin-users")
      .set("Cookie", ["feishu_iam_admin_session=bias_platform"])
      .expect(200)
      .expect((response) => {
        const items = getField(response.body as unknown, "items");
        expect(Array.isArray(items)).toBe(true);
        expect(getField(response.body as unknown, "total")).toBe(1);
        expect(getField(response.body as unknown, "page")).toBe(1);
        expect(getField(response.body as unknown, "pageSize")).toBe(1);
        expect(items).toEqual([
          {
            id: "admin-1",
            feishuUserId: "ou_1",
            displayName: "平台管理员",
            status: "active",
            lastLoginAt: null,
            createdAt: "2026-05-17T01:00:00.000Z",
            updatedAt: "2026-05-17T01:00:00.000Z",
            roles: [
              {
                roleKey: "platform_admin",
                name: "平台管理员",
              },
            ],
            applicationScopes: [
              {
                id: "app-finance",
                appKey: "finance",
                name: "财务系统",
                status: "active",
              },
            ],
          },
        ]);
        expect(JSON.stringify(response.body)).not.toMatch(
          INTERNAL_OR_SENSITIVE_FIELD_PATTERN,
        );
      });

    expect(adminUsers.listAdminUsers).toHaveBeenCalledWith();
  });

  it("GET /api/v1/admin/admin-users 无 cookie 返回 ADMIN_SESSION_REQUIRED", async () => {
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .get("/api/v1/admin/admin-users")
      .expect(401)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe(
          "ADMIN_SESSION_REQUIRED",
        );
      });

    expect(auth.getContextFromSessionSecret).not.toHaveBeenCalled();
    expect(adminUsers.listAdminUsers).not.toHaveBeenCalled();
  });

  it("GET /api/v1/admin/applications/hr/permission-points 应用管理员不能读取未授权应用", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-app",
      feishuUserId: "ou_app",
      displayName: "应用管理员",
      roles: ["application_admin"],
      applicationIds: ["app-finance"],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .get("/api/v1/admin/applications/hr/permission-points")
      .set("Cookie", ["feishu_iam_admin_session=bias_app"])
      .expect(403)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe(
          "ADMIN_PERMISSION_DENIED",
        );
      });

    expect(applications.getApplicationByKey).toHaveBeenCalledWith("hr");
    expect(catalog.listPermissionPoints).not.toHaveBeenCalled();
  });

  it("GET /api/v1/admin/applications/finance/permission-points 应用管理员可读取授权应用权限点", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-app",
      feishuUserId: "ou_app",
      displayName: "应用管理员",
      roles: ["application_admin"],
      applicationIds: ["app-finance"],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .get("/api/v1/admin/applications/finance/permission-points")
      .set("Cookie", ["feishu_iam_admin_session=bias_app"])
      .expect(200)
      .expect((response) => {
        expect(getField(response.body as unknown, "items")).toEqual([
          expect.objectContaining({
            id: "point-finance-read",
            key: "finance.invoice.read",
          }),
        ]);
      });

    expect(applications.getApplicationByKey).toHaveBeenCalledWith("finance");
    expect(catalog.listPermissionPoints).toHaveBeenCalledWith("finance");
  });

  it("GET /api/v1/admin/applications/finance/permission-groups 应用管理员可读取授权应用权限组", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-app",
      feishuUserId: "ou_app",
      displayName: "应用管理员",
      roles: ["application_admin"],
      applicationIds: ["app-finance"],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .get("/api/v1/admin/applications/finance/permission-groups")
      .set("Cookie", ["feishu_iam_admin_session=bias_app"])
      .expect(200)
      .expect((response) => {
        expect(getField(response.body as unknown, "items")).toEqual([
          expect.objectContaining({
            id: "group-finance-admin",
            key: "finance.admin",
          }),
        ]);
      });

    expect(applications.getApplicationByKey).toHaveBeenCalledWith("finance");
    expect(catalog.listPermissionGroups).toHaveBeenCalledWith("finance");
  });

  it("GET /api/v1/admin/applications/finance/iam-roles 应用管理员可读取授权应用角色", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-app",
      feishuUserId: "ou_app",
      displayName: "应用管理员",
      roles: ["application_admin"],
      applicationIds: ["app-finance"],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .get("/api/v1/admin/applications/finance/iam-roles")
      .set("Cookie", ["feishu_iam_admin_session=bias_app"])
      .expect(200)
      .expect((response) => {
        expect(getField(response.body as unknown, "items")).toEqual([
          expect.objectContaining({
            id: "role-finance-admin",
            key: "finance-admin",
            app_key: "finance",
            permissionGroupIds: ["group-finance-admin"],
            permissionGroups: [
              expect.objectContaining({
                id: "group-finance-admin",
                key: "finance.admin",
                permissionPoints: [
                  expect.objectContaining({
                    key: "finance.invoice.read",
                    name: "查看发票",
                    status: "active",
                  }),
                ],
              }),
            ],
            permissionPoints: [
              expect.objectContaining({
                key: "finance.invoice.export",
                name: "导出发票",
                status: "active",
              }),
            ],
            subjects: [
              expect.objectContaining({
                type: "feishu_user",
                id: "ou-wang",
                isOrphaned: false,
                displayName: "王文哲",
                subjectKindLabel: "用户",
                displayPath: "唐群座椅 / 财务部",
              }),
              expect.objectContaining({
                type: "feishu_department",
                id: "od-missing",
                isOrphaned: true,
                subjectKindLabel: "组织",
                displayPath: "已失效或未同步",
              }),
            ],
          }),
        ]);
      });

    expect(applications.getApplicationByKey).toHaveBeenCalledWith("finance");
    expect(iamRoles.listRoles).toHaveBeenCalledWith("finance");
  });

  it("GET /api/v1/admin/applications/finance/feishu/users 应用管理员可搜索授权应用成员候选", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-app",
      feishuUserId: "ou_app",
      displayName: "应用管理员",
      roles: ["application_admin"],
      applicationIds: ["app-finance"],
    });
    prisma.feishuUser.findMany.mockResolvedValueOnce([
      {
        userId: "ou-wang",
        name: "王文哲",
        email: "wang@example.com",
        isActive: true,
      },
    ]);
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .get("/api/v1/admin/applications/finance/feishu/users?keyword=%E7%8E%8B")
      .set("Cookie", ["feishu_iam_admin_session=bias_app"])
      .expect(200)
      .expect((response) => {
        expect(getField(response.body as unknown, "items")).toEqual([
          {
            userId: "ou-wang",
            name: "王文哲",
            isActive: true,
          },
        ]);
        expect(JSON.stringify(response.body)).not.toContain("wang@example.com");
        expect(JSON.stringify(response.body)).not.toMatch(
          INTERNAL_OR_SENSITIVE_FIELD_PATTERN,
        );
      });

    expect(applications.getApplicationByKey).toHaveBeenCalledWith("finance");
    expect(prisma.feishuUser.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: {
          userId: true,
          name: true,
          isActive: true,
          isDeleted: true,
        },
        take: 20,
      }),
    );
  });

  it("GET /api/v1/admin/applications/finance/feishu/departments 应用管理员可搜索授权应用部门候选", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-app",
      feishuUserId: "ou_app",
      displayName: "应用管理员",
      roles: ["application_admin"],
      applicationIds: ["app-finance"],
    });
    prisma.feishuDepartment.findMany.mockResolvedValueOnce([
      {
        departmentId: "od-finance",
        name: "财务部",
        parentDepartmentId: "od-root",
        status: { is_deleted: false },
      },
    ]);
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .get(
        "/api/v1/admin/applications/finance/feishu/departments?keyword=%E8%B4%A2%E5%8A%A1",
      )
      .set("Cookie", ["feishu_iam_admin_session=bias_app"])
      .expect(200)
      .expect((response) => {
        expect(getField(response.body as unknown, "items")).toEqual([
          {
            departmentId: "od-finance",
            name: "财务部",
            parentDepartmentId: "od-root",
          },
        ]);
        expect(JSON.stringify(response.body)).not.toContain("is_deleted");
        expect(JSON.stringify(response.body)).not.toMatch(
          INTERNAL_OR_SENSITIVE_FIELD_PATTERN,
        );
      });

    expect(applications.getApplicationByKey).toHaveBeenCalledWith("finance");
    expect(prisma.feishuDepartment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: {
          departmentId: true,
          name: true,
          parentDepartmentId: true,
          isDeleted: true,
        },
        take: 20,
      }),
    );
  });

  it("GET /api/v1/admin/applications/finance/feishu/departments 顶层组织兼容飞书根父节点", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-app",
      feishuUserId: "ou_app",
      displayName: "应用管理员",
      roles: ["application_admin"],
      applicationIds: ["app-finance"],
    });
    prisma.feishuDepartment.findMany.mockResolvedValueOnce([
      {
        departmentId: "od-huizhou",
        name: "惠州唐群",
        parentDepartmentId: "0",
        isDeleted: false,
      },
    ]);
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .get(
        "/api/v1/admin/applications/finance/feishu/departments?parent_department_id=__root__",
      )
      .set("Cookie", ["feishu_iam_admin_session=bias_app"])
      .expect(200)
      .expect((response) => {
        expect(getField(response.body as unknown, "items")).toEqual([
          {
            departmentId: "od-huizhou",
            isDeleted: false,
            name: "惠州唐群",
            parentDepartmentId: "0",
          },
        ]);
      });

    expect(applications.getApplicationByKey).toHaveBeenCalledWith("finance");
    expect(prisma.feishuDepartment.count).toHaveBeenCalledWith({
      where: {
        isDeleted: false,
        OR: [{ parentDepartmentId: "0" }, { parentDepartmentId: null }],
      },
    });
    expect(prisma.feishuDepartment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isDeleted: false,
          OR: [{ parentDepartmentId: "0" }, { parentDepartmentId: null }],
        },
        take: 20,
      }),
    );
  });

  it.each([
    ["users", "feishuUser"],
    ["departments", "feishuDepartment"],
  ] as const)(
    "GET /api/v1/admin/applications/hr/feishu/%s 应用管理员不能搜索未授权应用绑定候选",
    async (resource, prismaModel) => {
      auth.getContextFromSessionSecret.mockResolvedValue({
        adminUserId: "admin-app",
        feishuUserId: "ou_app",
        displayName: "应用管理员",
        roles: ["application_admin"],
        applicationIds: ["app-finance"],
      });
      const httpServer = app.getHttpServer() as SupertestApp;

      await request(httpServer)
        .get(
          `/api/v1/admin/applications/hr/feishu/${resource}?keyword=%E7%8E%8B`,
        )
        .set("Cookie", ["feishu_iam_admin_session=bias_app"])
        .expect(403)
        .expect((response) => {
          expect(getErrorCode(response.body as unknown)).toBe(
            "ADMIN_PERMISSION_DENIED",
          );
        });

      expect(applications.getApplicationByKey).toHaveBeenCalledWith("hr");
      expect(prisma[prismaModel].findMany).not.toHaveBeenCalled();
    },
  );

  it.each(["audit_viewer", "sync_admin"] as const)(
    "GET /api/v1/admin/applications/finance/feishu/users 不允许 %s 获取权限管理成员候选",
    async (role) => {
      auth.getContextFromSessionSecret.mockResolvedValue({
        adminUserId: `admin-${role}`,
        feishuUserId: `ou_${role}`,
        displayName: role,
        roles: [role],
        applicationIds: ["app-finance"],
      });
      const httpServer = app.getHttpServer() as SupertestApp;

      await request(httpServer)
        .get(
          "/api/v1/admin/applications/finance/feishu/users?keyword=%E7%8E%8B",
        )
        .set("Cookie", [`feishu_iam_admin_session=bias_${role}`])
        .expect(403)
        .expect((response) => {
          expect(getErrorCode(response.body as unknown)).toBe(
            "ADMIN_PERMISSION_DENIED",
          );
        });

      expect(applications.getApplicationByKey).toHaveBeenCalledWith("finance");
      expect(prisma.feishuUser.findMany).not.toHaveBeenCalled();
    },
  );

  it.each(["audit_viewer", "sync_admin"] as const)(
    "GET /api/v1/admin/applications/finance/feishu/departments 不允许 %s 获取权限管理部门候选",
    async (role) => {
      auth.getContextFromSessionSecret.mockResolvedValue({
        adminUserId: `admin-${role}`,
        feishuUserId: `ou_${role}`,
        displayName: role,
        roles: [role],
        applicationIds: ["app-finance"],
      });
      const httpServer = app.getHttpServer() as SupertestApp;

      await request(httpServer)
        .get(
          "/api/v1/admin/applications/finance/feishu/departments?keyword=%E8%B4%A2%E5%8A%A1",
        )
        .set("Cookie", [`feishu_iam_admin_session=bias_${role}`])
        .expect(403)
        .expect((response) => {
          expect(getErrorCode(response.body as unknown)).toBe(
            "ADMIN_PERMISSION_DENIED",
          );
        });

      expect(applications.getApplicationByKey).toHaveBeenCalledWith("finance");
      expect(prisma.feishuDepartment.findMany).not.toHaveBeenCalled();
    },
  );

  it("POST /api/v1/admin/applications/:appKey/iam-roles 平台管理员可创建 IAM 角色并传入 admin 审计上下文", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-platform",
      feishuUserId: "ou_platform",
      displayName: "平台管理员",
      roles: ["platform_admin"],
      applicationIds: [],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .post("/api/v1/admin/applications/finance/iam-roles")
      .set("Cookie", ["feishu_iam_admin_session=bias_platform"])
      .set("x-request-id", "req-create-role")
      .set("user-agent", "vitest-admin-console")
      .send({ key: "finance.admin", name: "财务管理员" })
      .expect(201)
      .expect((response) => {
        expect(getField(response.body as unknown, "key")).toBe("finance.admin");
        expect(getField(response.body as unknown, "app_key")).toBe("finance");
      });

    expect(iamRoles.createRole).toHaveBeenCalledWith(
      "finance",
      { key: "finance.admin", name: "财务管理员" },
      {
        actorType: "admin_user",
        actorId: "admin-platform",
        source: "admin_web",
        requestId: "req-create-role",
        ip: expect.any(String) as unknown,
        userAgent: "vitest-admin-console",
      },
    );
  });

  it("POST /api/v1/admin/applications/:appKey/iam-roles/:roleId/disable 和 enable 授权应用管理员可切换角色状态", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-app",
      feishuUserId: "ou_app",
      displayName: "应用管理员",
      roles: ["application_admin"],
      applicationIds: ["app-finance"],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .post(
        "/api/v1/admin/applications/finance/iam-roles/role-finance-admin/disable",
      )
      .set("Cookie", ["feishu_iam_admin_session=bias_app"])
      .set("x-request-id", "req-disable-role")
      .expect(201)
      .expect((response) => {
        expect(getField(response.body as unknown, "id")).toBe(
          "role-finance-admin",
        );
        expect(getField(response.body as unknown, "status")).toBe("disabled");
        expect(getField(response.body as unknown, "app_key")).toBe("finance");
      });

    await request(httpServer)
      .post(
        "/api/v1/admin/applications/finance/iam-roles/role-finance-admin/enable",
      )
      .set("Cookie", ["feishu_iam_admin_session=bias_app"])
      .set("x-request-id", "req-enable-role")
      .expect(201)
      .expect((response) => {
        expect(getField(response.body as unknown, "id")).toBe(
          "role-finance-admin",
        );
        expect(getField(response.body as unknown, "status")).toBe("active");
        expect(getField(response.body as unknown, "app_key")).toBe("finance");
      });

    expect(applications.getApplicationByKey).toHaveBeenCalledWith("finance");
    expect(iamRoles.setRoleStatus).toHaveBeenCalledWith(
      "finance",
      "role-finance-admin",
      "disabled",
      expect.objectContaining({
        actorType: "admin_user",
        actorId: "admin-app",
        source: "admin_web",
        requestId: "req-disable-role",
      }) as unknown,
    );
    expect(iamRoles.setRoleStatus).toHaveBeenCalledWith(
      "finance",
      "role-finance-admin",
      "active",
      expect.objectContaining({
        actorType: "admin_user",
        actorId: "admin-app",
        source: "admin_web",
        requestId: "req-enable-role",
      }) as unknown,
    );
  });

  it("POST /api/v1/admin/applications/:appKey/iam-roles/:roleId/disable 未授权应用管理员不能切换其他应用角色状态", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-app",
      feishuUserId: "ou_app",
      displayName: "应用管理员",
      roles: ["application_admin"],
      applicationIds: ["app-hr"],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .post(
        "/api/v1/admin/applications/finance/iam-roles/role-finance-admin/disable",
      )
      .set("Cookie", ["feishu_iam_admin_session=bias_app"])
      .expect(403)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe(
          "ADMIN_PERMISSION_DENIED",
        );
      });

    expect(applications.getApplicationByKey).toHaveBeenCalledWith("finance");
    expect(iamRoles.setRoleStatus).not.toHaveBeenCalled();
  });

  it.each(["audit_viewer", "sync_admin"] as const)(
    "POST /api/v1/admin/applications/:appKey/iam-roles/:roleId/enable 拒绝 %s 切换角色状态",
    async (role) => {
      auth.getContextFromSessionSecret.mockResolvedValue({
        adminUserId: `admin-${role}`,
        feishuUserId: `ou_${role}`,
        displayName: role,
        roles: [role],
        applicationIds: ["app-finance"],
      });
      const httpServer = app.getHttpServer() as SupertestApp;

      await request(httpServer)
        .post(
          "/api/v1/admin/applications/finance/iam-roles/role-finance-admin/enable",
        )
        .set("Cookie", [`feishu_iam_admin_session=bias_${role}`])
        .expect(403)
        .expect((response) => {
          expect(getErrorCode(response.body as unknown)).toBe(
            "ADMIN_PERMISSION_DENIED",
          );
        });

      expect(applications.getApplicationByKey).toHaveBeenCalledWith("finance");
      expect(iamRoles.setRoleStatus).not.toHaveBeenCalled();
    },
  );

  it("PUT /api/v1/admin/applications/:appKey/iam-roles/:roleId 权限组和主体 授权应用管理员可替换", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-app",
      feishuUserId: "ou_app",
      displayName: "应用管理员",
      roles: ["application_admin"],
      applicationIds: ["app-finance"],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .put(
        "/api/v1/admin/applications/finance/iam-roles/role-finance-admin/permission-groups",
      )
      .set("Cookie", ["feishu_iam_admin_session=bias_app"])
      .set("x-request-id", "req-replace-role-groups")
      .send({ permissionGroupIds: ["group-finance-admin"] })
      .expect(200)
      .expect({ ok: true });

    await request(httpServer)
      .put(
        "/api/v1/admin/applications/finance/iam-roles/role-finance-admin/subjects",
      )
      .set("Cookie", ["feishu_iam_admin_session=bias_app"])
      .set("x-request-id", "req-replace-role-subjects")
      .send({
        subjects: [
          { type: "feishu_user", id: "5be616gc" },
          { type: "feishu_department", id: "od-demo" },
        ],
      })
      .expect(200)
      .expect({ ok: true });

    expect(iamRoles.replaceRolePermissionGroups).toHaveBeenCalledWith(
      "finance",
      "role-finance-admin",
      ["group-finance-admin"],
      expect.objectContaining({
        actorType: "admin_user",
        actorId: "admin-app",
        source: "admin_web",
        requestId: "req-replace-role-groups",
      }),
    );
    expect(iamRoles.replaceRoleSubjects).toHaveBeenCalledWith(
      "finance",
      "role-finance-admin",
      [
        { type: "feishu_user", id: "5be616gc" },
        { type: "feishu_department", id: "od-demo" },
      ],
      expect.objectContaining({
        actorType: "admin_user",
        actorId: "admin-app",
        source: "admin_web",
        requestId: "req-replace-role-subjects",
      }),
    );
  });

  it("PUT /api/v1/admin/applications/:appKey/iam-roles/:roleId/subjects 兼容 org_subjects 和 user_subjects", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-app",
      feishuUserId: "ou_app",
      displayName: "应用管理员",
      roles: ["application_admin"],
      applicationIds: ["app-finance"],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .put(
        "/api/v1/admin/applications/finance/iam-roles/role-finance-admin/subjects",
      )
      .set("Cookie", ["feishu_iam_admin_session=bias_app"])
      .set("x-request-id", "req-replace-role-subjects-explicit")
      .send({
        org_subjects: ["od-demo"],
        user_subjects: ["5be616gc"],
      })
      .expect(200)
      .expect({ ok: true });

    expect(iamRoles.replaceRoleSubjects).toHaveBeenCalledWith(
      "finance",
      "role-finance-admin",
      [
        { type: "feishu_department", id: "od-demo" },
        { type: "feishu_user", id: "5be616gc" },
      ],
      expect.objectContaining({
        requestId: "req-replace-role-subjects-explicit",
      }),
    );
  });

  it("PUT /api/v1/admin/applications/:appKey/iam-roles/:roleId/permission-groups 缺少或非数组字段时返回稳定 422", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-app",
      feishuUserId: "ou_app",
      displayName: "应用管理员",
      roles: ["application_admin"],
      applicationIds: ["app-finance"],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .put(
        "/api/v1/admin/applications/finance/iam-roles/role-finance-admin/permission-groups",
      )
      .set("Cookie", ["feishu_iam_admin_session=bias_app"])
      .send({})
      .expect(422)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe(
          "PERMISSION_GROUP_IDS_INVALID",
        );
      });

    await request(httpServer)
      .put(
        "/api/v1/admin/applications/finance/iam-roles/role-finance-admin/permission-groups",
      )
      .set("Cookie", ["feishu_iam_admin_session=bias_app"])
      .send({ permissionGroupIds: "group-finance-admin" })
      .expect(422)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe(
          "PERMISSION_GROUP_IDS_INVALID",
        );
      });

    expect(iamRoles.replaceRolePermissionGroups).not.toHaveBeenCalled();
  });

  it("PUT /api/v1/admin/applications/:appKey/iam-roles/:roleId/subjects 包含 null 元素时返回稳定 422", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-app",
      feishuUserId: "ou_app",
      displayName: "应用管理员",
      roles: ["application_admin"],
      applicationIds: ["app-finance"],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .put(
        "/api/v1/admin/applications/finance/iam-roles/role-finance-admin/subjects",
      )
      .set("Cookie", ["feishu_iam_admin_session=bias_app"])
      .send({ subjects: [null] })
      .expect(422)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe(
          "IAM_ROLE_SUBJECTS_INVALID",
        );
      });

    expect(iamRoles.replaceRoleSubjects).not.toHaveBeenCalled();
  });

  it("PUT /api/v1/admin/applications/:appKey/iam-roles/:roleId 未授权应用管理员不能管理其他应用角色", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-app",
      feishuUserId: "ou_app",
      displayName: "应用管理员",
      roles: ["application_admin"],
      applicationIds: ["app-hr"],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .put(
        "/api/v1/admin/applications/finance/iam-roles/role-finance-admin/permission-groups",
      )
      .set("Cookie", ["feishu_iam_admin_session=bias_app"])
      .send({ permissionGroupIds: ["group-finance-admin"] })
      .expect(403)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe(
          "ADMIN_PERMISSION_DENIED",
        );
      });

    expect(iamRoles.replaceRolePermissionGroups).not.toHaveBeenCalled();
  });

  it("POST/PATCH /api/v1/admin/applications 平台管理员可创建更新禁用启用应用", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-platform",
      feishuUserId: "ou_platform",
      displayName: "平台管理员",
      roles: ["platform_admin"],
      applicationIds: [],
    });
    applications.getApplicationByKey.mockResolvedValue({
      id: "app-demo",
      appKey: "demo",
      name: "Demo 系统",
      description: null,
      ownerUserId: null,
      status: "active",
      createdAt: new Date("2026-05-17T01:00:00.000Z"),
      updatedAt: new Date("2026-05-17T01:00:00.000Z"),
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .post("/api/v1/admin/applications")
      .set("Cookie", ["feishu_iam_admin_session=bias_platform"])
      .set("x-request-id", "req-create-app")
      .send({
        appKey: "demo",
        name: "Demo 系统",
        redirectUris: ["http://localhost:5173/auth/callback"],
      })
      .expect(201)
      .expect((response) => {
        expect(
          getField(getField(response.body as unknown, "application"), "appKey"),
        ).toBe("demo");
        expect(getField(response.body as unknown, "clientSecret")).toBe(
          "bics_demo_secret",
        );
        expect(getField(response.body as unknown, "developerApiToken")).toBe(
          "biad_demo_token",
        );
        expect(getField(response.body as unknown, "integrationPrompt")).toBe(
          "full prompt",
        );
        expect(JSON.stringify(response.body)).not.toContain("clientSecretHash");
        expect(JSON.stringify(response.body)).not.toContain("tokenHash");
      });
    await request(httpServer)
      .patch("/api/v1/admin/applications/demo")
      .set("Cookie", ["feishu_iam_admin_session=bias_platform"])
      .set("x-request-id", "req-update-app")
      .send({
        name: "Demo 系统 V2",
        description: "更新后的 Demo",
        ownerUserId: "ou_owner",
      })
      .expect(200)
      .expect((response) => {
        expect(getField(response.body as unknown, "name")).toBe("Demo 系统 V2");
      });
    await request(httpServer)
      .post("/api/v1/admin/applications/demo/disable")
      .set("Cookie", ["feishu_iam_admin_session=bias_platform"])
      .set("x-request-id", "req-disable-app")
      .expect(201)
      .expect((response) => {
        expect(getField(response.body as unknown, "status")).toBe("disabled");
      });
    await request(httpServer)
      .post("/api/v1/admin/applications/demo/enable")
      .set("Cookie", ["feishu_iam_admin_session=bias_platform"])
      .set("x-request-id", "req-enable-app")
      .expect(201)
      .expect((response) => {
        expect(getField(response.body as unknown, "status")).toBe("active");
      });

    expect(onboarding.createOnboardingPackage).toHaveBeenCalledWith(
      {
        appKey: "demo",
        name: "Demo 系统",
        redirectUris: ["http://localhost:5173/auth/callback"],
      },
      expect.objectContaining({
        actorType: "admin_user",
        actorId: "admin-platform",
        source: "admin_web",
        requestId: "req-create-app",
      }),
    );
    expect(applications.createApplication).not.toHaveBeenCalled();
    expect(applications.updateApplication).toHaveBeenCalledWith(
      "demo",
      {
        name: "Demo 系统 V2",
        description: "更新后的 Demo",
        ownerUserId: "ou_owner",
      },
      expect.objectContaining({
        actorType: "admin_user",
        actorId: "admin-platform",
        source: "admin_web",
        requestId: "req-update-app",
      }),
    );
    expect(applications.setApplicationStatus).toHaveBeenCalledWith(
      "demo",
      "disabled",
      expect.objectContaining({
        actorId: "admin-platform",
        requestId: "req-disable-app",
      }),
    );
    expect(applications.setApplicationStatus).toHaveBeenCalledWith(
      "demo",
      "active",
      expect.objectContaining({
        actorId: "admin-platform",
        requestId: "req-enable-app",
      }),
    );
  });

  it("POST /api/v1/admin/applications 非法 body 返回稳定 422 且不调用创建服务", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-platform",
      feishuUserId: "ou_platform",
      displayName: "平台管理员",
      roles: ["platform_admin"],
      applicationIds: [],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .post("/api/v1/admin/applications")
      .set("Cookie", ["feishu_iam_admin_session=bias_platform"])
      .send({})
      .expect(422)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe(
          "APPLICATION_BODY_INVALID",
        );
      });

    expect(applications.createApplication).not.toHaveBeenCalled();
    expect(onboarding.createOnboardingPackage).not.toHaveBeenCalled();
  });

  it("POST /api/v1/admin/applications 缺少回调地址返回稳定 400 且不调用 onboarding", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-platform",
      feishuUserId: "ou_platform",
      displayName: "平台管理员",
      roles: ["platform_admin"],
      applicationIds: [],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .post("/api/v1/admin/applications")
      .set("Cookie", ["feishu_iam_admin_session=bias_platform"])
      .send({ appKey: "demo", name: "Demo 系统", redirectUris: [] })
      .expect(400)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe(
          "APPLICATION_REDIRECT_URI_REQUIRED",
        );
        expect(getErrorMessage(response.body as unknown)).toBe(
          "至少需要一个回调地址",
        );
      });

    expect(onboarding.createOnboardingPackage).not.toHaveBeenCalled();
  });

  it("POST/PATCH /api/v1/admin/applications/:appKey/iam-roles 非法 body 返回稳定 422 且不调用角色写服务", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-platform",
      feishuUserId: "ou_platform",
      displayName: "平台管理员",
      roles: ["platform_admin"],
      applicationIds: [],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .post("/api/v1/admin/applications/finance/iam-roles")
      .set("Cookie", ["feishu_iam_admin_session=bias_platform"])
      .send({ name: "缺少 key 的角色" })
      .expect(422)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe(
          "IAM_ROLE_BODY_INVALID",
        );
      });

    await request(httpServer)
      .patch("/api/v1/admin/applications/finance/iam-roles/role-finance-admin")
      .set("Cookie", ["feishu_iam_admin_session=bias_platform"])
      .send([])
      .expect(422)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe(
          "IAM_ROLE_BODY_INVALID",
        );
      });

    expect(iamRoles.createRole).not.toHaveBeenCalled();
    expect(iamRoles.updateRole).not.toHaveBeenCalled();
  });

  it("POST/PATCH /api/v1/admin/applications 应用管理员不能创建应用但可更新授权应用", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-app",
      feishuUserId: "ou_app",
      displayName: "应用管理员",
      roles: ["application_admin"],
      applicationIds: ["app-finance"],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .post("/api/v1/admin/applications")
      .set("Cookie", ["feishu_iam_admin_session=bias_app"])
      .send({ appKey: "demo", name: "Demo 系统" })
      .expect(403)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe(
          "ADMIN_PERMISSION_DENIED",
        );
      });
    await request(httpServer)
      .patch("/api/v1/admin/applications/finance")
      .set("Cookie", ["feishu_iam_admin_session=bias_app"])
      .send({ name: "财务系统 V2" })
      .expect(200)
      .expect((response) => {
        expect(getField(response.body as unknown, "name")).toBe("Demo 系统 V2");
      });

    expect(applications.createApplication).not.toHaveBeenCalled();
    expect(onboarding.createOnboardingPackage).not.toHaveBeenCalled();
    expect(applications.updateApplication).toHaveBeenCalledWith(
      "finance",
      { name: "财务系统 V2" },
      expect.objectContaining({
        actorType: "admin_user",
        actorId: "admin-app",
        source: "admin_web",
      }),
    );
  });

  it("PATCH /api/v1/admin/applications/:appKey 未授权应用管理员不能更新其他应用", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-app",
      feishuUserId: "ou_app",
      displayName: "应用管理员",
      roles: ["application_admin"],
      applicationIds: ["app-hr"],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .patch("/api/v1/admin/applications/finance")
      .set("Cookie", ["feishu_iam_admin_session=bias_app"])
      .send({ name: "财务系统 V2" })
      .expect(403)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe(
          "ADMIN_PERMISSION_DENIED",
        );
      });

    expect(applications.updateApplication).not.toHaveBeenCalled();
  });

  it("POST /api/v1/admin/applications/:appKey/disable 和 enable 授权应用管理员可切换应用状态", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-app",
      feishuUserId: "ou_app",
      displayName: "应用管理员",
      roles: ["application_admin"],
      applicationIds: ["app-finance"],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .post("/api/v1/admin/applications/finance/disable")
      .set("Cookie", ["feishu_iam_admin_session=bias_app"])
      .expect(201)
      .expect((response) => {
        expect(getField(response.body as unknown, "status")).toBe("disabled");
      });

    await request(httpServer)
      .post("/api/v1/admin/applications/finance/enable")
      .set("Cookie", ["feishu_iam_admin_session=bias_app"])
      .expect(201)
      .expect((response) => {
        expect(getField(response.body as unknown, "status")).toBe("active");
      });

    expect(applications.setApplicationStatus).toHaveBeenCalledWith(
      "finance",
      "disabled",
      expect.objectContaining({ actorId: "admin-app" }),
    );
    expect(applications.setApplicationStatus).toHaveBeenCalledWith(
      "finance",
      "active",
      expect.objectContaining({ actorId: "admin-app" }),
    );
  });

  it("POST /api/v1/admin/applications/:appKey/disable 未授权应用管理员不能切换其他应用状态", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-app",
      feishuUserId: "ou_app",
      displayName: "应用管理员",
      roles: ["application_admin"],
      applicationIds: ["app-hr"],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .post("/api/v1/admin/applications/finance/disable")
      .set("Cookie", ["feishu_iam_admin_session=bias_app"])
      .expect(403)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe(
          "ADMIN_PERMISSION_DENIED",
        );
      });

    expect(applications.setApplicationStatus).not.toHaveBeenCalled();
  });

  it.each(["platform_admin", "audit_viewer"] as const)(
    "GET /api/v1/admin/applications 按 %s 下推分页筛选并返回分页对象",
    async (role) => {
      auth.getContextFromSessionSecret.mockResolvedValue({
        adminUserId: `admin-${role}`,
        feishuUserId: `ou_${role}`,
        displayName: role,
        roles: [role],
        applicationIds: ["app-finance"],
      });
      applications.listApplications.mockResolvedValueOnce({
        items: [
          {
            id: "app-finance",
            appKey: "finance",
            name: "财务系统",
            description: null,
            ownerUserId: null,
            status: "active",
            createdAt: new Date("2026-05-17T01:00:00.000Z"),
            updatedAt: new Date("2026-05-17T01:00:00.000Z"),
          },
        ],
        total: 1,
        page: 2,
        pageSize: 5,
      });
      const httpServer = app.getHttpServer() as SupertestApp;

      await request(httpServer)
        .get(
          "/api/v1/admin/applications?page=2&pageSize=5&query=%E8%B4%A2%E5%8A%A1&status=active",
        )
        .set("Cookie", [`feishu_iam_admin_session=bias_${role}`])
        .expect(200)
        .expect((response) => {
          expect(response.body).toMatchObject({
            total: 1,
            page: 2,
            pageSize: 5,
          });
          const items = getField(response.body as unknown, "items");
          expect(Array.isArray(items)).toBe(true);
          expect(
            (items as Array<{ id: string }>).map((item) => item.id),
          ).toEqual(["app-finance"]);
          expect(
            (items as Array<{ integrationSummary?: unknown }>)[0]
              ?.integrationSummary,
          ).toEqual({
            redirectUriCount: 1,
            activeRedirectUriCount: 1,
            oauthClientCount: 1,
            activeOauthClientCount: 1,
            developerCredentialCount: 1,
            activeDeveloperCredentialCount: 1,
            iamRoleCount: 1,
            activeIamRoleCount: 1,
          });
        });

      expect(applications.listApplications).toHaveBeenCalledWith({
        page: 2,
        pageSize: 5,
        query: "财务",
        status: "active",
        applicationIds: undefined,
      });
    },
  );

  it("GET /api/v1/admin/applications 非法分页参数不传给 service，应用管理员范围下推到 service", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-application",
      feishuUserId: "ou_application",
      displayName: "应用管理员",
      roles: ["application_admin"],
      applicationIds: ["app-finance"],
    });
    applications.listApplications.mockResolvedValueOnce({
      items: [
        {
          id: "app-hr",
          appKey: "hr",
          name: "人事系统",
          description: null,
          ownerUserId: null,
          status: "disabled",
          createdAt: new Date("2026-05-17T01:00:00.000Z"),
          updatedAt: new Date("2026-05-17T01:00:00.000Z"),
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .get(
        "/api/v1/admin/applications?page=abc&pageSize=-1&query=hr&status=all",
      )
      .set("Cookie", ["feishu_iam_admin_session=bias_application"])
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          total: 1,
          page: 1,
          pageSize: 20,
        });
        const items = getField(response.body as unknown, "items");
        expect(Array.isArray(items)).toBe(true);
        expect((items as Array<{ id: string }>).map((item) => item.id)).toEqual(
          ["app-hr"],
        );
      });

    expect(applications.listApplications).toHaveBeenCalledWith({
      page: undefined,
      pageSize: undefined,
      query: "hr",
      status: "all",
      applicationIds: ["app-finance"],
    });
  });

  it("POST /api/v1/admin/applications/finance/environments 未授权应用管理员拒绝", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-app",
      feishuUserId: "ou_app",
      displayName: "应用管理员",
      roles: ["application_admin"],
      applicationIds: ["app-hr"],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .post("/api/v1/admin/applications/finance/environments")
      .set("Cookie", ["feishu_iam_admin_session=bias_app"])
      .send({
        environmentKey: "dev",
        name: "开发环境",
      })
      .expect(403)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe(
          "ADMIN_PERMISSION_DENIED",
        );
      });

    expect(applications.getApplicationByKey).toHaveBeenCalledWith("finance");
    expect(oauthConfig.createEnvironment).not.toHaveBeenCalled();
  });

  it("POST /api/v1/admin/applications/finance/environments 授权应用管理员调用底层服务并传入 admin 审计上下文", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-app",
      feishuUserId: "ou_app",
      displayName: "应用管理员",
      roles: ["application_admin"],
      applicationIds: ["app-finance"],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .post("/api/v1/admin/applications/finance/environments")
      .set("Cookie", ["feishu_iam_admin_session=bias_app"])
      .set("x-request-id", "req-admin-oauth-create-env")
      .set("user-agent", "vitest-admin-console")
      .send({
        environmentKey: "dev",
        name: "开发环境",
      })
      .expect(201)
      .expect((response) => {
        expect(getField(response.body as unknown, "id")).toBe(
          "env-finance-dev",
        );
      });

    expect(applications.getApplicationByKey).toHaveBeenCalledWith("finance");
    expect(oauthConfig.createEnvironment).toHaveBeenCalledWith(
      "finance",
      {
        environmentKey: "dev",
        name: "开发环境",
      },
      {
        actorType: "admin_user",
        actorId: "admin-app",
        source: "admin_web",
        requestId: "req-admin-oauth-create-env",
        ip: expect.any(String) as unknown,
        userAgent: "vitest-admin-console",
      },
    );
  });

  it("GET /api/v1/admin/applications/finance/environments 授权应用管理员调用底层环境列表服务", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-app",
      feishuUserId: "ou_app",
      displayName: "应用管理员",
      roles: ["application_admin"],
      applicationIds: ["app-finance"],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .get("/api/v1/admin/applications/finance/environments")
      .set("Cookie", ["feishu_iam_admin_session=bias_app"])
      .expect(200)
      .expect((response) => {
        expect(getField(response.body as unknown, "items")).toEqual([
          expect.objectContaining({
            id: "env-finance-dev",
            environmentKey: "dev",
          }),
        ]);
      });

    expect(applications.getApplicationByKey).toHaveBeenCalledWith("finance");
    expect(oauthConfig.listEnvironments).toHaveBeenCalledWith("finance");
  });

  it("GET /api/v1/admin/applications/finance/redirect-uris 返回应用级回调地址", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-app",
      feishuUserId: "ou_app",
      displayName: "应用管理员",
      roles: ["application_admin"],
      applicationIds: ["app-finance"],
    });
    oauthConfig.listRedirectUris.mockResolvedValue([
      {
        id: "redirect-1",
        applicationId: "app-finance",
        environmentId: null,
        sourceEnvironmentId: null,
        redirectUri: "http://localhost:5173/callback",
        status: "active",
        createdAt: new Date("2026-05-17T01:00:00.000Z"),
        updatedAt: new Date("2026-05-17T01:00:00.000Z"),
      },
    ]);
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .get("/api/v1/admin/applications/finance/redirect-uris")
      .set("Cookie", ["feishu_iam_admin_session=bias_app"])
      .expect(200)
      .expect((response) => {
        expect(getField(response.body as unknown, "items")).toEqual([
          expect.objectContaining({
            id: "redirect-1",
            redirectUri: "http://localhost:5173/callback",
          }),
        ]);
      });

    expect(oauthConfig.listRedirectUris).toHaveBeenCalledWith("finance");
  });

  it("POST /api/v1/admin/applications/finance/redirect-uris 创建应用级回调地址", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-app",
      feishuUserId: "ou_app",
      displayName: "应用管理员",
      roles: ["application_admin"],
      applicationIds: ["app-finance"],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .post("/api/v1/admin/applications/finance/redirect-uris")
      .set("Cookie", ["feishu_iam_admin_session=bias_app"])
      .set("x-request-id", "req-admin-create-app-redirect")
      .send({
        redirectUri: "http://localhost:5173/callback",
      })
      .expect(201)
      .expect((response) => {
        expect(getField(response.body as unknown, "id")).toBe("redirect-1");
      });

    expect(oauthConfig.createRedirectUri).toHaveBeenCalledWith(
      "finance",
      {
        redirectUri: "http://localhost:5173/callback",
      },
      expect.objectContaining({
        actorType: "admin_user",
        actorId: "admin-app",
        source: "admin_web",
        requestId: "req-admin-create-app-redirect",
      }),
    );
  });

  it("POST /api/v1/admin/applications/finance/redirect-uris/:id/disable 停用应用级回调地址", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-app",
      feishuUserId: "ou_app",
      displayName: "应用管理员",
      roles: ["application_admin"],
      applicationIds: ["app-finance"],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .post(
        "/api/v1/admin/applications/finance/redirect-uris/redirect-1/disable",
      )
      .set("Cookie", ["feishu_iam_admin_session=bias_app"])
      .set("x-request-id", "req-admin-disable-app-redirect")
      .expect(201)
      .expect((response) => {
        expect(getField(response.body as unknown, "id")).toBe("redirect-1");
        expect(getField(response.body as unknown, "status")).toBe("disabled");
      });

    expect(oauthConfig.disableRedirectUri).toHaveBeenCalledWith(
      "finance",
      "redirect-1",
      expect.objectContaining({
        actorType: "admin_user",
        actorId: "admin-app",
        source: "admin_web",
        requestId: "req-admin-disable-app-redirect",
      }),
    );
  });

  it("GET /api/v1/admin/applications/finance/clients 返回应用级 OAuth 凭证且不返回 secret material", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-app",
      feishuUserId: "ou_app",
      displayName: "应用管理员",
      roles: ["application_admin"],
      applicationIds: ["app-finance"],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .get("/api/v1/admin/applications/finance/clients")
      .set("Cookie", ["feishu_iam_admin_session=bias_app"])
      .expect(200)
      .expect((response) => {
        expect(getField(response.body as unknown, "items")).toEqual([
          expect.objectContaining({
            id: "client-row-1",
            clientId: "bic_finance_dev",
          }),
        ]);
        expect(JSON.stringify(response.body)).not.toContain("clientSecretHash");
      });

    expect(oauthConfig.listClients).toHaveBeenCalledWith("finance");
  });

  it("GET /api/v1/admin/applications/finance/developer-credentials 返回开发者 API 凭证且不返回 tokenHash", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-app",
      feishuUserId: "ou_app",
      displayName: "应用管理员",
      roles: ["application_admin"],
      applicationIds: ["app-finance"],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .get("/api/v1/admin/applications/finance/developer-credentials")
      .set("Cookie", ["feishu_iam_admin_session=bias_app"])
      .expect(200)
      .expect((response) => {
        expect(getField(response.body as unknown, "items")).toEqual([
          expect.objectContaining({
            id: "developer-credential-1",
            name: "默认开发者 API 凭证",
          }),
        ]);
        expect(JSON.stringify(response.body)).not.toContain("tokenHash");
      });

    expect(developerCredentials.listCredentials).toHaveBeenCalledWith(
      "finance",
    );
  });

  it("GET /api/v1/admin/applications/finance/integration-prompt 返回安全版 Codex 提示词", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-app",
      feishuUserId: "ou_app",
      displayName: "应用管理员",
      roles: ["application_admin"],
      applicationIds: ["app-finance"],
    });
    oauthConfig.listRedirectUris.mockResolvedValue([
      {
        id: "redirect-1",
        applicationId: "app-finance",
        environmentId: null,
        sourceEnvironmentId: null,
        redirectUri: "http://localhost:5173/callback",
        status: "active",
        createdAt: new Date("2026-05-17T01:00:00.000Z"),
        updatedAt: new Date("2026-05-17T01:00:00.000Z"),
      },
    ]);
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .get("/api/v1/admin/applications/finance/integration-prompt")
      .set("Cookie", ["feishu_iam_admin_session=bias_app"])
      .expect(200)
      .expect((response) => {
        expect(getField(response.body as unknown, "integrationPrompt")).toBe(
          "safe prompt with AGENTS.md and placeholders",
        );
      });

    expect(integrationPrompts.generateSafePrompt).toHaveBeenCalledWith({
      baseIamUrl: "http://localhost:8000",
      appKey: "finance",
      applicationName: "财务系统",
      redirectUris: ["http://localhost:5173/callback"],
      clientId: "bic_finance_dev",
    });
  });

  it("GET /api/v1/admin/applications/finance/environments/:id/clients 授权应用管理员调用底层 client 列表服务", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-app",
      feishuUserId: "ou_app",
      displayName: "应用管理员",
      roles: ["application_admin"],
      applicationIds: ["app-finance"],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .get(
        "/api/v1/admin/applications/finance/environments/env-finance-dev/clients",
      )
      .set("Cookie", ["feishu_iam_admin_session=bias_app"])
      .expect(200)
      .expect((response) => {
        expect(getField(response.body as unknown, "items")).toEqual([
          expect.objectContaining({
            id: "client-row-1",
            clientId: "bic_finance_dev",
          }),
        ]);
        expect(JSON.stringify(response.body)).not.toContain("clientSecretHash");
      });

    expect(applications.getApplicationByKey).toHaveBeenCalledWith("finance");
    expect(oauthConfig.listClients).toHaveBeenCalledWith(
      "finance",
      "env-finance-dev",
    );
  });

  it("POST /api/v1/admin/applications/finance/environments/:id/redirect-uris 授权应用管理员调用底层创建回调服务", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-app",
      feishuUserId: "ou_app",
      displayName: "应用管理员",
      roles: ["application_admin"],
      applicationIds: ["app-finance"],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .post(
        "/api/v1/admin/applications/finance/environments/env-finance-dev/redirect-uris",
      )
      .set("Cookie", ["feishu_iam_admin_session=bias_app"])
      .set("x-request-id", "req-admin-create-redirect")
      .send({
        redirectUri: "http://localhost:5173/callback",
      })
      .expect(201)
      .expect((response) => {
        expect(getField(response.body as unknown, "id")).toBe("redirect-1");
      });

    expect(applications.getApplicationByKey).toHaveBeenCalledWith("finance");
    expect(oauthConfig.createRedirectUri).toHaveBeenCalledWith(
      "finance",
      "env-finance-dev",
      {
        redirectUri: "http://localhost:5173/callback",
      },
      expect.objectContaining({
        actorType: "admin_user",
        actorId: "admin-app",
        source: "admin_web",
        requestId: "req-admin-create-redirect",
      }) as unknown,
    );
  });

  it("POST /api/v1/admin/applications/finance/environments/:id/clients 创建 client 不返回 clientSecretHash", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-app",
      feishuUserId: "ou_app",
      displayName: "应用管理员",
      roles: ["application_admin"],
      applicationIds: ["app-finance"],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .post(
        "/api/v1/admin/applications/finance/environments/env-finance-dev/clients",
      )
      .set("Cookie", ["feishu_iam_admin_session=bias_app"])
      .send({
        name: "Web Client",
      })
      .expect(201)
      .expect((response) => {
        expect(getField(response.body as unknown, "clientId")).toBe(
          "bic_finance_dev",
        );
        expect(JSON.stringify(response.body)).not.toContain("clientSecretHash");
        expect(JSON.stringify(response.body)).not.toContain(
          "clientSecretCiphertext",
        );
        expect(JSON.stringify(response.body)).not.toContain("cipher-redacted");
      });
  });

  it("POST /api/v1/admin/applications/finance/clients/:id/rotate-secret 授权应用管理员可轮换 secret 且不返回 hash", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-app",
      feishuUserId: "ou_app",
      displayName: "应用管理员",
      roles: ["application_admin"],
      applicationIds: ["app-finance"],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .post(
        "/api/v1/admin/applications/finance/clients/bic_finance_dev/rotate-secret",
      )
      .set("Cookie", ["feishu_iam_admin_session=bias_app"])
      .set("x-request-id", "req-admin-rotate-secret")
      .expect(201)
      .expect((response) => {
        expect(getField(response.body as unknown, "clientId")).toBe(
          "bic_finance_dev",
        );
        expect(JSON.stringify(response.body)).not.toContain("clientSecretHash");
      });

    expect(applications.getApplicationByKey).toHaveBeenCalledWith("finance");
    expect(oauthConfig.rotateClientSecret).toHaveBeenCalledWith(
      "finance",
      "bic_finance_dev",
      expect.objectContaining({
        actorType: "admin_user",
        actorId: "admin-app",
        source: "admin_web",
        requestId: "req-admin-rotate-secret",
      }) as unknown,
    );
  });

  it("POST /api/v1/admin/applications/finance/clients/:id/view-secret 授权应用管理员可查看 secret", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-app",
      feishuUserId: "ou_app",
      displayName: "应用管理员",
      roles: ["application_admin"],
      applicationIds: ["app-finance"],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .post(
        "/api/v1/admin/applications/finance/clients/bic_finance_dev/view-secret",
      )
      .set("Cookie", ["feishu_iam_admin_session=bias_app"])
      .set("x-request-id", "req-admin-view-secret")
      .expect(201)
      .expect((response) => {
        expect(getField(response.body as unknown, "clientId")).toBe(
          "bic_finance_dev",
        );
        expect(getField(response.body as unknown, "clientSecret")).toBe(
          "secret-viewed",
        );
        expect(JSON.stringify(response.body)).not.toContain("clientSecretHash");
        expect(JSON.stringify(response.body)).not.toContain(
          "clientSecretCiphertext",
        );
      });

    expect(applications.getApplicationByKey).toHaveBeenCalledWith("finance");
    expect(oauthConfig.viewClientSecret).toHaveBeenCalledWith(
      "finance",
      "bic_finance_dev",
      expect.objectContaining({
        actorType: "admin_user",
        actorId: "admin-app",
        source: "admin_web",
        requestId: "req-admin-view-secret",
      }) as unknown,
    );
  });

  it("POST /api/v1/admin/applications/finance/clients/:id/view-secret 未授权应用管理员拒绝", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-app",
      feishuUserId: "ou_app",
      displayName: "应用管理员",
      roles: ["application_admin"],
      applicationIds: ["app-hr"],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .post(
        "/api/v1/admin/applications/finance/clients/bic_finance_dev/view-secret",
      )
      .set("Cookie", ["feishu_iam_admin_session=bias_app"])
      .expect(403)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe(
          "ADMIN_PERMISSION_DENIED",
        );
      });

    expect(applications.getApplicationByKey).toHaveBeenCalledWith("finance");
    expect(oauthConfig.viewClientSecret).not.toHaveBeenCalled();
  });

  it("POST /api/v1/admin/applications/finance/clients/:id/enable 和 disable 调用底层状态服务", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-app",
      feishuUserId: "ou_app",
      displayName: "应用管理员",
      roles: ["application_admin"],
      applicationIds: ["app-finance"],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .post("/api/v1/admin/applications/finance/clients/bic_finance_dev/enable")
      .set("Cookie", ["feishu_iam_admin_session=bias_app"])
      .expect(201);

    await request(httpServer)
      .post(
        "/api/v1/admin/applications/finance/clients/bic_finance_dev/disable",
      )
      .set("Cookie", ["feishu_iam_admin_session=bias_app"])
      .expect(201);

    expect(oauthConfig.setClientStatus).toHaveBeenCalledWith(
      "finance",
      "bic_finance_dev",
      "active",
      expect.objectContaining({
        actorType: "admin_user",
        actorId: "admin-app",
        source: "admin_web",
      }) as unknown,
    );
    expect(oauthConfig.setClientStatus).toHaveBeenCalledWith(
      "finance",
      "bic_finance_dev",
      "disabled",
      expect.objectContaining({
        actorType: "admin_user",
        actorId: "admin-app",
        source: "admin_web",
      }) as unknown,
    );
  });

  it("GET /api/v1/admin/feishu/status 拒绝 application_admin", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-app",
      feishuUserId: "ou_app",
      displayName: "应用管理员",
      roles: ["application_admin"],
      applicationIds: ["app-finance"],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .get("/api/v1/admin/feishu/status")
      .set("Cookie", ["feishu_iam_admin_session=bias_app"])
      .expect(403)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe(
          "ADMIN_PERMISSION_DENIED",
        );
      });

    expect(feishuStatus.getStatus).not.toHaveBeenCalled();
  });

  it.each(["platform_admin", "audit_viewer", "sync_admin"] as const)(
    "GET /api/v1/admin/feishu/status 允许 %s",
    async (role) => {
      auth.getContextFromSessionSecret.mockResolvedValue({
        adminUserId: `admin-${role}`,
        feishuUserId: `ou_${role}`,
        displayName: role,
        roles: [role],
        applicationIds: [],
      });
      const httpServer = app.getHttpServer() as SupertestApp;

      await request(httpServer)
        .get("/api/v1/admin/feishu/status")
        .set("Cookie", [`feishu_iam_admin_session=bias_${role}`])
        .expect(200)
        .expect((response) => {
          expect(getField(response.body as unknown, "configStatus")).toBe(
            "connected",
          );
        });
    },
  );

  it("GET /api/v1/admin/feishu/status 不返回同步记录 errorDetail", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-sync",
      feishuUserId: "ou_sync",
      displayName: "同步管理员",
      roles: ["sync_admin"],
      applicationIds: [],
    });
    feishuStatus.getStatus.mockResolvedValueOnce({
      configStatus: "failed",
      running: false,
      latestRun: {
        id: "run-failed",
        triggeredBy: "admin-sync",
        triggerSource: "admin_web",
        status: "failed",
        requestId: "req-feishu-run",
        startedAt: new Date("2026-05-17T01:00:00.000Z"),
        finishedAt: new Date("2026-05-17T01:01:00.000Z"),
        departmentCreatedCount: 0,
        departmentUpdatedCount: 0,
        departmentDeletedCount: 0,
        userCreatedCount: 0,
        userUpdatedCount: 0,
        userDeletedCount: 0,
        relationCreatedCount: 0,
        relationUpdatedCount: 0,
        relationDeletedCount: 0,
        errorCode: "FEISHU_PERMISSION_DENIED",
        errorMessage: "飞书权限不足",
        errorDetail: { appSecret: "secret-value" },
        createdAt: new Date("2026-05-17T01:00:00.000Z"),
        updatedAt: new Date("2026-05-17T01:01:00.000Z"),
      } as never,
      counts: {
        departments: 2,
        activeDepartments: 2,
        users: 3,
        activeUsers: 2,
        relations: 3,
      },
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .get("/api/v1/admin/feishu/status")
      .set("Cookie", ["feishu_iam_admin_session=bias_sync"])
      .expect(200)
      .expect((response) => {
        const bodyText = JSON.stringify(response.body);
        expect(bodyText).toContain("FEISHU_PERMISSION_DENIED");
        expect(bodyText).not.toContain("errorDetail");
        expect(bodyText).not.toContain("secret-value");
      });
  });

  it("GET /api/v1/admin/feishu/sync-runs 允许 sync_admin 查看同步记录列表", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-sync",
      feishuUserId: "ou_sync",
      displayName: "同步管理员",
      roles: ["sync_admin"],
      applicationIds: [],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .get("/api/v1/admin/feishu/sync-runs")
      .set("Cookie", ["feishu_iam_admin_session=bias_sync"])
      .expect(200)
      .expect((response) => {
        const items = getField(response.body as unknown, "items");
        expect(Array.isArray(items)).toBe(true);
        expect((items as Array<{ id: string }>)[0]?.id).toBe("run-admin-1");
      });

    expect(feishuStatus.listRuns).toHaveBeenCalledWith();
  });

  it("GET /api/v1/admin/feishu/sync-runs 不返回同步记录 errorDetail", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-sync",
      feishuUserId: "ou_sync",
      displayName: "同步管理员",
      roles: ["sync_admin"],
      applicationIds: [],
    });
    feishuStatus.listRuns.mockResolvedValueOnce([
      {
        id: "run-failed",
        triggeredBy: "admin-sync",
        triggerSource: "admin_web",
        status: "failed",
        requestId: "req-feishu-run",
        startedAt: new Date("2026-05-17T01:00:00.000Z"),
        finishedAt: new Date("2026-05-17T01:01:00.000Z"),
        departmentCreatedCount: 0,
        departmentUpdatedCount: 0,
        departmentDeletedCount: 0,
        userCreatedCount: 0,
        userUpdatedCount: 0,
        userDeletedCount: 0,
        relationCreatedCount: 0,
        relationUpdatedCount: 0,
        relationDeletedCount: 0,
        errorCode: "FEISHU_PERMISSION_DENIED",
        errorMessage: "飞书权限不足",
        errorDetail: { appSecret: "secret-value" },
        createdAt: new Date("2026-05-17T01:00:00.000Z"),
        updatedAt: new Date("2026-05-17T01:01:00.000Z"),
      } as never,
    ]);
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .get("/api/v1/admin/feishu/sync-runs")
      .set("Cookie", ["feishu_iam_admin_session=bias_sync"])
      .expect(200)
      .expect((response) => {
        const bodyText = JSON.stringify(response.body);
        expect(bodyText).toContain("FEISHU_PERMISSION_DENIED");
        expect(bodyText).not.toContain("errorDetail");
        expect(bodyText).not.toContain("secret-value");
      });
  });

  it("GET /api/v1/admin/feishu/sync-runs/:id 允许 audit_viewer 查看同步记录详情", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-audit",
      feishuUserId: "ou_audit",
      displayName: "审计员",
      roles: ["audit_viewer"],
      applicationIds: [],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .get("/api/v1/admin/feishu/sync-runs/run-admin-1")
      .set("Cookie", ["feishu_iam_admin_session=bias_audit"])
      .expect(200)
      .expect((response) => {
        expect(getField(response.body as unknown, "id")).toBe("run-admin-1");
      });

    expect(feishuStatus.getRun).toHaveBeenCalledWith("run-admin-1");
  });

  it("GET /api/v1/admin/feishu/field-diagnostics 允许 platform_admin 查看字段诊断", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-platform",
      feishuUserId: "ou_platform",
      displayName: "平台管理员",
      roles: ["platform_admin"],
      applicationIds: [],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .get("/api/v1/admin/feishu/field-diagnostics")
      .set("Cookie", ["feishu_iam_admin_session=bias_platform"])
      .expect(200)
      .expect((response) => {
        expect(getField(response.body as unknown, "status")).toBe("passed");
      });

    expect(feishuDiagnostics.getFieldDiagnostics).toHaveBeenCalledWith();
  });

  it("GET /api/v1/admin/feishu/users 本地查询返回脱敏用户镜像 DTO", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-platform",
      feishuUserId: "ou_platform",
      displayName: "平台管理员",
      roles: ["platform_admin"],
      applicationIds: [],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .get("/api/v1/admin/feishu/users?keyword=%E7%8E%8B")
      .set("Cookie", ["feishu_iam_admin_session=bias_platform"])
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          page: 1,
          pageSize: 20,
          total: 1,
          items: [
            {
              userId: "ou-wang",
              name: "王文哲",
              emailMasked: "w***g@example.com",
              mobileMasked: "138****8000",
              isActive: true,
              isDeleted: false,
            },
          ],
        });
        expect(JSON.stringify(response.body)).not.toMatch(
          INTERNAL_OR_SENSITIVE_FIELD_PATTERN,
        );
      });

    expect(prisma.feishuUser.count).toHaveBeenCalled();
    expect(prisma.feishuUser.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: {
          userId: true,
          name: true,
          email: true,
          mobile: true,
          isActive: true,
          isDeleted: true,
          lastSyncedAt: true,
        },
        skip: 0,
        take: 20,
      }),
    );
  });

  it("GET /api/v1/admin/feishu/users/:userId 允许 sync_admin 查看用户镜像详情", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-sync",
      feishuUserId: "ou_sync",
      displayName: "同步管理员",
      roles: ["sync_admin"],
      applicationIds: [],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .get("/api/v1/admin/feishu/users/ou-wang")
      .set("Cookie", ["feishu_iam_admin_session=bias_sync"])
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          userId: "ou-wang",
          name: "王文哲",
          emailMasked: "w***g@example.com",
          departments: [
            {
              departmentId: "od-finance",
              name: "财务部",
              isPrimary: true,
            },
          ],
        });
        expect(JSON.stringify(response.body)).not.toMatch(
          INTERNAL_OR_SENSITIVE_FIELD_PATTERN,
        );
      });
  });

  it("GET /api/v1/admin/feishu/departments 本地查询返回部门镜像 DTO", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-platform",
      feishuUserId: "ou_platform",
      displayName: "平台管理员",
      roles: ["platform_admin"],
      applicationIds: [],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .get("/api/v1/admin/feishu/departments?keyword=%E8%B4%A2%E5%8A%A1")
      .set("Cookie", ["feishu_iam_admin_session=bias_platform"])
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          page: 1,
          pageSize: 20,
          total: 1,
          items: [
            {
              departmentId: "od-finance",
              openDepartmentId: "od-finance-open",
              parentDepartmentId: "od-root",
              name: "财务部",
              isDeleted: false,
            },
          ],
        });
        expect(JSON.stringify(response.body)).not.toMatch(
          INTERNAL_OR_SENSITIVE_FIELD_PATTERN,
        );
      });

    expect(prisma.feishuDepartment.count).toHaveBeenCalled();
    expect(prisma.feishuDepartment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: {
          departmentId: true,
          openDepartmentId: true,
          parentDepartmentId: true,
          name: true,
          isDeleted: true,
          lastSyncedAt: true,
        },
        skip: 0,
        take: 20,
      }),
    );
  });

  it.each([
    ["users", "feishuUser", "audit_viewer"],
    ["departments", "feishuDepartment", "audit_viewer"],
  ] as const)(
    "GET /api/v1/admin/feishu/%s 不允许 %s 查询本地镜像详情",
    async (resource, prismaModel, role) => {
      auth.getContextFromSessionSecret.mockResolvedValue({
        adminUserId: `admin-${role}`,
        feishuUserId: `ou_${role}`,
        displayName: role,
        roles: [role],
        applicationIds: [],
      });
      const httpServer = app.getHttpServer() as SupertestApp;

      await request(httpServer)
        .get(`/api/v1/admin/feishu/${resource}?keyword=%E7%8E%8B`)
        .set("Cookie", [`feishu_iam_admin_session=bias_${role}`])
        .expect(403)
        .expect((response) => {
          expect(getErrorCode(response.body as unknown)).toBe(
            "ADMIN_PERMISSION_DENIED",
          );
        });

      expect(prisma[prismaModel].findMany).not.toHaveBeenCalled();
    },
  );

  it.each(["platform_admin"] as const)(
    "POST /api/v1/admin/feishu/sync-runs 允许 %s",
    async (role) => {
      auth.getContextFromSessionSecret.mockResolvedValue({
        adminUserId: `admin-${role}`,
        feishuUserId: `ou_${role}`,
        displayName: role,
        roles: [role],
        applicationIds: [],
      });
      const httpServer = app.getHttpServer() as SupertestApp;

      await request(httpServer)
        .post("/api/v1/admin/feishu/sync-runs")
        .set("Cookie", [`feishu_iam_admin_session=bias_${role}`])
        .send({ confirmLatestRunId: "NO_SYNC_RUN" })
        .expect(201)
        .expect((response) => {
          expect(getField(response.body as unknown, "id")).toBe("run-admin-1");
        });

      expect(feishuSync.runFullSync).toHaveBeenCalledWith({
        triggeredBy: `admin-${role}`,
        triggerSource: "admin_web",
      });
    },
  );

  it.each(["platform_admin", "sync_admin"] as const)(
    "POST /api/v1/admin/feishu/users/:userId/sync 允许 %s 触发用户级轻量同步",
    async (role) => {
      auth.getContextFromSessionSecret.mockResolvedValue({
        adminUserId: `admin-${role}`,
        feishuUserId: `ou_${role}`,
        displayName: role,
        roles: [role],
        applicationIds: [],
      });
      const httpServer = app.getHttpServer() as SupertestApp;

      await request(httpServer)
        .post("/api/v1/admin/feishu/users/ou-wang/sync")
        .set("Cookie", [`feishu_iam_admin_session=bias_${role}`])
        .expect(201)
        .expect((response) => {
          expect(getField(response.body as unknown, "id")).toBe(
            "run-user-light-1",
          );
        });

      expect(feishuSync.runUserLightSync).toHaveBeenCalledWith({
        triggeredBy: `admin-${role}`,
        triggerSource: "admin_web_user_light",
        userId: "ou-wang",
      });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceType: "feishu_user",
          resourceId: "ou-wang",
          action: "sync_light_user",
          result: "success",
        }),
      );
    },
  );

  it.each(["platform_admin", "sync_admin"] as const)(
    "POST /api/v1/admin/feishu/departments/:departmentId/sync 允许 %s 触发部门级轻量同步",
    async (role) => {
      auth.getContextFromSessionSecret.mockResolvedValue({
        adminUserId: `admin-${role}`,
        feishuUserId: `ou_${role}`,
        displayName: role,
        roles: [role],
        applicationIds: [],
      });
      const httpServer = app.getHttpServer() as SupertestApp;

      await request(httpServer)
        .post("/api/v1/admin/feishu/departments/od-finance/sync")
        .set("Cookie", [`feishu_iam_admin_session=bias_${role}`])
        .expect(201)
        .expect((response) => {
          expect(getField(response.body as unknown, "id")).toBe(
            "run-department-light-1",
          );
        });

      expect(feishuSync.runDepartmentLightSync).toHaveBeenCalledWith({
        triggeredBy: `admin-${role}`,
        triggerSource: "admin_web_department_light",
        departmentId: "od-finance",
      });
    },
  );

  it("POST /api/v1/admin/feishu/users/:userId/sync 拒绝 audit_viewer", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-audit",
      feishuUserId: "ou_audit",
      displayName: "审计员",
      roles: ["audit_viewer"],
      applicationIds: [],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .post("/api/v1/admin/feishu/users/ou-wang/sync")
      .set("Cookie", ["feishu_iam_admin_session=bias_audit"])
      .expect(403)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe(
          "ADMIN_PERMISSION_DENIED",
        );
      });

    expect(feishuSync.runUserLightSync).not.toHaveBeenCalled();
  });

  it("POST /api/v1/admin/feishu/sync-runs 缺少确认 run id 时拒绝全量同步", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-platform",
      feishuUserId: "ou_platform",
      displayName: "平台管理员",
      roles: ["platform_admin"],
      applicationIds: [],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .post("/api/v1/admin/feishu/sync-runs")
      .set("Cookie", ["feishu_iam_admin_session=bias_platform"])
      .expect(400)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe(
          "FEISHU_FULL_SYNC_CONFIRMATION_REQUIRED",
        );
      });

    expect(feishuSync.runFullSync).not.toHaveBeenCalled();
  });

  it("POST /api/v1/admin/feishu/sync-runs 确认 run id 不匹配时拒绝全量同步", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-platform",
      feishuUserId: "ou_platform",
      displayName: "平台管理员",
      roles: ["platform_admin"],
      applicationIds: [],
    });
    feishuStatus.getStatus.mockResolvedValueOnce({
      configStatus: "connected",
      running: false,
      latestRun: {
        id: "latest-run",
        triggerSource: "admin_web",
        status: "success",
        startedAt: new Date("2026-05-17T01:00:00.000Z"),
        finishedAt: new Date("2026-05-17T01:01:00.000Z"),
        departmentCreatedCount: 0,
        departmentUpdatedCount: 0,
        departmentDeletedCount: 0,
        userCreatedCount: 0,
        userUpdatedCount: 0,
        userDeletedCount: 0,
        relationCreatedCount: 0,
        relationUpdatedCount: 0,
        relationDeletedCount: 0,
        errorCode: null,
        errorMessage: null,
      },
      counts: {
        departments: 2,
        activeDepartments: 2,
        users: 3,
        activeUsers: 2,
        relations: 3,
      },
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .post("/api/v1/admin/feishu/sync-runs")
      .set("Cookie", ["feishu_iam_admin_session=bias_platform"])
      .send({ confirmLatestRunId: "stale-run" })
      .expect(400)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe(
          "FEISHU_FULL_SYNC_CONFIRMATION_MISMATCH",
        );
      });

    expect(feishuSync.runFullSync).not.toHaveBeenCalled();
  });

  it("POST /api/v1/admin/feishu/sync-runs/preflight 返回全量同步确认口令", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-platform",
      feishuUserId: "ou_platform",
      displayName: "平台管理员",
      roles: ["platform_admin"],
      applicationIds: [],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .post("/api/v1/admin/feishu/sync-runs/preflight")
      .set("Cookie", ["feishu_iam_admin_session=bias_platform"])
      .expect(201)
      .expect((response) => {
        expect(getField(response.body as unknown, "requiredLatestRunId")).toBe(
          "NO_SYNC_RUN",
        );
      });
  });

  it("POST /api/v1/admin/feishu/sync-runs 拒绝 sync_admin 触发全量同步", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-sync",
      feishuUserId: "ou_sync",
      displayName: "同步管理员",
      roles: ["sync_admin"],
      applicationIds: [],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .post("/api/v1/admin/feishu/sync-runs")
      .set("Cookie", ["feishu_iam_admin_session=bias_sync"])
      .expect(403)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe(
          "ADMIN_PERMISSION_DENIED",
        );
      });

    expect(feishuSync.runFullSync).not.toHaveBeenCalled();
  });

  it("POST /api/v1/admin/feishu/sync-runs 拒绝 audit_viewer", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-audit",
      feishuUserId: "ou_audit",
      displayName: "审计员",
      roles: ["audit_viewer"],
      applicationIds: [],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .post("/api/v1/admin/feishu/sync-runs")
      .set("Cookie", ["feishu_iam_admin_session=bias_audit"])
      .expect(403)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe(
          "ADMIN_PERMISSION_DENIED",
        );
      });

    expect(feishuSync.runFullSync).not.toHaveBeenCalled();
  });

  it("GET /api/v1/admin/audit-logs 允许平台管理员查询并调用 service", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-platform",
      feishuUserId: "ou_platform",
      displayName: "平台管理员",
      roles: ["platform_admin"],
      applicationIds: [],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .get(
        "/api/v1/admin/audit-logs?page=2&pageSize=10&request_id=req-audit-1&requestId=ignored&action=update",
      )
      .set("Cookie", ["feishu_iam_admin_session=bias_platform"])
      .expect(200)
      .expect((response) => {
        expect(getField(response.body as unknown, "total")).toBe(1);
      });

    expect(adminQueries.listAuditLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        adminUserId: "admin-platform",
        roles: ["platform_admin"],
      }),
      expect.objectContaining({
        page: 2,
        pageSize: 10,
        requestId: "req-audit-1",
        action: "update",
      }),
    );
  });

  it("GET /api/v1/admin/audit-logs 应用管理员查询时传入其 context", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-app",
      feishuUserId: "ou_app",
      displayName: "应用管理员",
      roles: ["application_admin"],
      applicationIds: ["app-finance"],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .get("/api/v1/admin/audit-logs?applicationId=app-hr")
      .set("Cookie", ["feishu_iam_admin_session=bias_app"])
      .expect(200);

    expect(adminQueries.listAuditLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        adminUserId: "admin-app",
        applicationIds: ["app-finance"],
      }),
      expect.objectContaining({ applicationId: "app-hr" }),
    );
  });

  it("GET /api/v1/admin/security-events 查询成功", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-audit",
      feishuUserId: "ou_audit",
      displayName: "审计员",
      roles: ["audit_viewer"],
      applicationIds: [],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .get(
        "/api/v1/admin/security-events?event_type=oauth_token_invalid&eventType=ignored&reason_code=TOKEN_INVALID&client_id=bic_finance_dev&feishu_user_id=ou_user&page=abc&pageSize=nan",
      )
      .set("Cookie", ["feishu_iam_admin_session=bias_audit"])
      .expect(200)
      .expect((response) => {
        const items = getField(response.body as unknown, "items");
        expect(Array.isArray(items)).toBe(true);
      });

    expect(adminQueries.listSecurityEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        adminUserId: "admin-audit",
        roles: ["audit_viewer"],
      }),
      expect.objectContaining({
        eventType: "oauth_token_invalid",
        reasonCode: "TOKEN_INVALID",
        clientId: "bic_finance_dev",
        feishuUserId: "ou_user",
        page: undefined,
        pageSize: undefined,
      }),
    );
  });

  it("GET /api/v1/admin/security-events 支持 eventTypes 逗号分隔集合过滤", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-audit",
      feishuUserId: "ou_audit",
      displayName: "审计员",
      roles: ["audit_viewer"],
      applicationIds: [],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .get(
        "/api/v1/admin/security-events?eventTypes=oauth_authorize,oauth_token,oauth_userinfo&page=3&pageSize=20",
      )
      .set("Cookie", ["feishu_iam_admin_session=bias_audit"])
      .expect(200);

    expect(adminQueries.listSecurityEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        adminUserId: "admin-audit",
        roles: ["audit_viewer"],
      }),
      expect.objectContaining({
        eventTypes: ["oauth_authorize", "oauth_token", "oauth_userinfo"],
        page: 3,
        pageSize: 20,
      }),
    );
  });

  it("GET /api/v1/admin/security-events 支持 event_types 重复参数集合过滤并优先于 event_type", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-audit",
      feishuUserId: "ou_audit",
      displayName: "审计员",
      roles: ["audit_viewer"],
      applicationIds: [],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .get(
        "/api/v1/admin/security-events?event_type=ignored_single&event_types=oauth_authorize&event_types=oauth_token",
      )
      .set("Cookie", ["feishu_iam_admin_session=bias_audit"])
      .expect(200);

    expect(adminQueries.listSecurityEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        adminUserId: "admin-audit",
        roles: ["audit_viewer"],
      }),
      expect.objectContaining({
        eventType: "ignored_single",
        eventTypes: ["oauth_authorize", "oauth_token"],
      }),
    );
  });

  it("GET /api/v1/admin/traces 解析 snake_case 追踪查询参数", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-audit",
      feishuUserId: "ou_audit",
      displayName: "审计员",
      roles: ["audit_viewer"],
      applicationIds: [],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .get(
        "/api/v1/admin/traces?request_id=req-1&app_key=finance&client_id=client-finance&feishu_user_id=ou_user&from=2026-05-29T00:00:00.000Z&to=2026-05-29T01:00:00.000Z&result=failed",
      )
      .set("Cookie", ["feishu_iam_admin_session=bias_audit"])
      .expect(200)
      .expect((response) => {
        expect(getField(response.body as unknown, "summary")).toEqual(
          expect.objectContaining({ status: "complete" }),
        );
      });

    expect(adminTraces.getTrace).toHaveBeenCalledWith(
      expect.objectContaining({
        adminUserId: "admin-audit",
        roles: ["audit_viewer"],
      }),
      {
        requestId: "req-1",
        applicationId: undefined,
        appKey: "finance",
        clientId: "client-finance",
        feishuUserId: "ou_user",
        from: "2026-05-29T00:00:00.000Z",
        to: "2026-05-29T01:00:00.000Z",
        result: "failed",
      },
    );
  });

  it("GET /api/v1/admin/traces 支持 camelCase 参数", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-platform",
      feishuUserId: "ou_platform",
      displayName: "平台管理员",
      roles: ["platform_admin"],
      applicationIds: [],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .get(
        "/api/v1/admin/traces?requestId=req-2&applicationId=app-finance&appKey=ignored&clientId=client-finance&feishuUserId=ou_user",
      )
      .set("Cookie", ["feishu_iam_admin_session=bias_platform"])
      .expect(200);

    expect(adminTraces.getTrace).toHaveBeenCalledWith(
      expect.objectContaining({ adminUserId: "admin-platform" }),
      expect.objectContaining({
        requestId: "req-2",
        applicationId: "app-finance",
        appKey: "ignored",
        clientId: "client-finance",
        feishuUserId: "ou_user",
      }),
    );
  });

  it("GET /api/v1/admin/traces 无 cookie 返回 ADMIN_SESSION_REQUIRED", async () => {
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .get("/api/v1/admin/traces?request_id=req-1")
      .set("x-request-id", "req-admin-missing-session")
      .expect(401)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe(
          "ADMIN_SESSION_REQUIRED",
        );
        expect(
          isRecord(response.body)
            ? isRecord(response.body.error)
              ? response.body.error.request_id
              : undefined
            : undefined,
        ).toBe("req-admin-missing-session");
      });

    expect(adminTraces.getTrace).not.toHaveBeenCalled();
    expect(securityEvents.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "admin_auth_failure",
        result: "failed",
        reasonCode: "ADMIN_SESSION_REQUIRED",
        requestId: "req-admin-missing-session",
      }),
    );
    expect(JSON.stringify(securityEvents.record.mock.calls)).not.toMatch(
      /cookie|authorization|token|raw_payload|secret/i,
    );
  });

  it("GET /api/v1/admin/traces 服务层拒绝时透出 ADMIN_PERMISSION_DENIED", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-denied",
      feishuUserId: "ou_denied",
      displayName: "普通管理员",
      roles: [],
      applicationIds: [],
    });
    adminTraces.getTrace.mockRejectedValue(
      new AdminDomainError(
        "ADMIN_PERMISSION_DENIED",
        "当前管理员无权查看追踪数据",
        403,
      ),
    );
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .get("/api/v1/admin/traces?request_id=req-1")
      .set("Cookie", ["feishu_iam_admin_session=bias_denied"])
      .set("x-request-id", "req-admin-permission-denied")
      .expect(403)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe(
          "ADMIN_PERMISSION_DENIED",
        );
        expect(getErrorMessage(response.body as unknown)).toBe(
          "当前管理员无权查看追踪数据",
        );
        expect(
          isRecord(response.body)
            ? isRecord(response.body.error)
              ? response.body.error.request_id
              : undefined
            : undefined,
        ).toBe("req-admin-permission-denied");
      });

    expect(securityEvents.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "admin_auth_failure",
        result: "failed",
        reasonCode: "ADMIN_PERMISSION_DENIED",
        requestId: "req-admin-permission-denied",
        feishuUserId: "ou_denied",
      }),
    );
  });

  it("GET /api/v1/admin/traces 安全事件写入失败时仍返回原始 403", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-denied",
      feishuUserId: "ou_denied",
      displayName: "普通管理员",
      roles: [],
      applicationIds: [],
    });
    adminTraces.getTrace.mockRejectedValue(
      new AdminDomainError(
        "ADMIN_PERMISSION_DENIED",
        "当前管理员无权查看追踪数据",
        403,
      ),
    );
    securityEvents.record.mockRejectedValue(new Error("security event unavailable"));
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .get("/api/v1/admin/traces?request_id=req-1")
      .set("Cookie", ["feishu_iam_admin_session=bias_denied"])
      .set("x-request-id", "req-admin-security-event-failed")
      .expect(403)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe(
          "ADMIN_PERMISSION_DENIED",
        );
        expect(
          isRecord(response.body)
            ? isRecord(response.body.error)
              ? response.body.error.request_id
              : undefined
            : undefined,
        ).toBe("req-admin-security-event-failed");
      });
  });

  it("GET /api/v1/admin/audit-logs 无 cookie 返回 ADMIN_SESSION_REQUIRED", async () => {
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .get("/api/v1/admin/audit-logs")
      .expect(401)
      .expect((response) => {
        expect(getErrorCode(response.body as unknown)).toBe(
          "ADMIN_SESSION_REQUIRED",
        );
      });

    expect(adminQueries.listAuditLogs).not.toHaveBeenCalled();
  });
});
