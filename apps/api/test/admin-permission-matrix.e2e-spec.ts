import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import type { App as SupertestApp } from "supertest/types";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminAuthService } from "../src/admin/admin-auth.service";
import { AdminPermissionMatrixController } from "../src/admin/admin-permission-matrix.controller";
import { AdminPermissionMatrixService } from "../src/admin/admin-permission-matrix.service";
import { AdminPermissionService } from "../src/admin/admin-permission.service";
import { AdminSessionGuard } from "../src/admin/admin-session.guard";
import { PrismaService } from "../src/prisma/prisma.service";

describe("AdminPermissionMatrixController", () => {
  let app: INestApplication;

  const auth = {
    getContextFromSessionSecret: vi.fn<AdminAuthService["getContextFromSessionSecret"]>(),
  };
  const prisma = {
    feishuUser: {
      findUnique: vi.fn(),
    },
    feishuDepartment: {
      findUnique: vi.fn(),
    },
    feishuUserDepartment: {
      findMany: vi.fn(),
    },
    iamRole: {
      findMany: vi.fn(),
    },
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AdminPermissionMatrixController],
      providers: [
        AdminPermissionMatrixService,
        AdminPermissionService,
        AdminSessionGuard,
        { provide: AdminAuthService, useValue: auth },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-platform",
      feishuUserId: "ou_admin",
      displayName: "平台管理员",
      roles: ["platform_admin"],
      applicationIds: [],
    });
    prisma.feishuUser.findUnique.mockResolvedValue({
      userId: "user-1",
      name: "张三",
    });
    prisma.feishuDepartment.findUnique.mockResolvedValue({
      departmentId: "dept-1",
      name: "销售部",
    });
    prisma.feishuUserDepartment.findMany.mockResolvedValue([
      { departmentId: "dept-1" },
    ]);
    prisma.iamRole.findMany.mockResolvedValue([userRole(), departmentRole()]);
  });

  it("returns user direct and department-inherited permissions grouped by application", async () => {
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .get("/api/v1/admin/permission-matrix")
      .query({ subjectType: "user", subjectId: "user-1" })
      .set("Cookie", ["feishu_iam_admin_session=session_platform"])
      .expect(200)
      .expect((response) => {
        const body = response.body as PermissionMatrixBody;
        expect(body.scope_note).toContain("用户查询包含直接用户绑定和用户所属组织绑定");
        expect(body.applications).toHaveLength(1);
        expect(body.applications[0]?.app_key).toBe("crm");
        expect(body.applications[0]?.matched_roles).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ key: "crm.operator", match_type: "direct_user" }),
            expect.objectContaining({ key: "crm.dept_sales", match_type: "user_department" }),
          ]),
        );
        const readPoint = body.applications[0]?.permission_points.find(
          (point) => point.key === "crm.customer.read",
        );
        const exportPoint = body.applications[0]?.permission_points.find(
          (point) => point.key === "crm.customer.export",
        );
        expect(readPoint?.source_roles).toEqual(expect.arrayContaining(["crm.operator", "crm.dept_sales"]));
        expect(readPoint?.source_groups).toEqual(expect.arrayContaining(["crm.sales"]));
        expect(exportPoint?.source_roles).toEqual(["crm.dept_sales"]);
      });

    const findManyArg = readFindManyArg(prisma.iamRole.findMany.mock.calls[0]?.[0]);
    expect(findManyArg?.where?.status).toBe("active");
  });

  it("returns department matrix with direct department roles only", async () => {
    prisma.iamRole.findMany.mockResolvedValue([departmentRole(), userRole()]);
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .get("/api/v1/admin/permission-matrix")
      .query({ subjectType: "department", subjectId: "dept-1" })
      .set("Cookie", ["feishu_iam_admin_session=session_platform"])
      .expect(200)
      .expect((response) => {
        const body = response.body as PermissionMatrixBody;
        expect(body.scope_note).toContain("不展开组织下用户");
        expect(body.applications[0]?.matched_roles).toEqual([
          expect.objectContaining({ key: "crm.dept_sales", match_type: "direct_department" }),
        ]);
        expect(body.applications[0]?.permission_points.map((point) => point.key)).toContain("crm.customer.export");
      });
  });

  it("excludes disabled applications, role bindings, roles, groups, and points", async () => {
    prisma.iamRole.findMany.mockResolvedValue([
      userRole({ applicationStatus: "disabled" }),
      userRole({ bindingStatus: "disabled" }),
      userRole({ roleStatus: "disabled" }),
      userRole({ groupStatus: "disabled" }),
      userRole({ pointStatus: "disabled" }),
    ]);
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .get("/api/v1/admin/permission-matrix")
      .query({ subjectType: "user", subjectId: "user-1" })
      .set("Cookie", ["feishu_iam_admin_session=session_platform"])
      .expect(200)
      .expect((response) => {
        const body = response.body as PermissionMatrixBody;
        expect(body.applications).toEqual([]);
      });
  });

  it("does not expose sensitive fields", async () => {
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .get("/api/v1/admin/permission-matrix")
      .query({ subjectType: "user", subjectId: "user-1" })
      .set("Cookie", ["feishu_iam_admin_session=session_platform"])
      .expect(200)
      .expect((response) => {
        const serialized = JSON.stringify(response.body);
        expect(serialized).not.toMatch(/secret|token|cookie|authorization|raw_payload|state_hash/i);
      });
  });

  it("rejects non-platform admins", async () => {
    auth.getContextFromSessionSecret.mockResolvedValue({
      adminUserId: "admin-app",
      feishuUserId: "ou_admin",
      displayName: "应用管理员",
      roles: ["application_admin"],
      applicationIds: ["app-crm"],
    });
    const httpServer = app.getHttpServer() as SupertestApp;

    await request(httpServer)
      .get("/api/v1/admin/permission-matrix")
      .query({ subjectType: "user", subjectId: "user-1" })
      .set("Cookie", ["feishu_iam_admin_session=session_app"])
      .expect(403)
      .expect((response) => {
        expect((response.body as { error?: { code?: string } }).error?.code).toBe("ADMIN_PERMISSION_DENIED");
      });
  });
});

type PermissionMatrixBody = {
  scope_note: string;
  applications: Array<{
    app_key: string;
    matched_roles: Array<{ key: string; match_type: string }>;
    permission_points: Array<{ key: string; source_roles: string[]; source_groups: string[] }>;
  }>;
};

function readFindManyArg(value: unknown): { where?: { status?: string } } | undefined {
  return typeof value === "object" && value !== null
    ? value
    : undefined;
}

function userRole(options: {
  applicationStatus?: "active" | "disabled";
  bindingStatus?: "active" | "disabled";
  groupStatus?: "active" | "disabled";
  pointStatus?: "active" | "disabled";
  roleStatus?: "active" | "disabled";
} = {}) {
  return {
    id: "role-user",
    key: "crm.operator",
    name: "CRM 操作员",
    status: options.roleStatus ?? "active",
    applications: [
      {
        status: options.bindingStatus ?? "active",
        application: {
          appKey: "crm",
          name: "CRM 系统",
          status: options.applicationStatus ?? "active",
        },
      },
    ],
    subjects: [
      { subjectType: "feishu_user", subjectId: "user-1", isOrphaned: false },
    ],
    permissionGroups: [
      {
        permissionGroup: {
          key: "crm.sales",
          name: "销售权限组",
          status: options.groupStatus ?? "active",
          permissionPoints: [
            {
              permissionPoint: {
                key: "crm.customer.read",
                name: "查看客户",
                status: options.pointStatus ?? "active",
              },
            },
          ],
        },
      },
    ],
    permissionPoints: [],
  };
}

function departmentRole() {
  return {
    id: "role-department",
    key: "crm.dept_sales",
    name: "销售部角色",
    status: "active",
    applications: [
      {
        status: "active",
        application: {
          appKey: "crm",
          name: "CRM 系统",
          status: "active",
        },
      },
    ],
    subjects: [
      { subjectType: "feishu_department", subjectId: "dept-1", isOrphaned: false },
    ],
    permissionGroups: [
      {
        permissionGroup: {
          key: "crm.sales",
          name: "销售权限组",
          status: "active",
          permissionPoints: [
            {
              permissionPoint: {
                key: "crm.customer.read",
                name: "查看客户",
                status: "active",
              },
            },
          ],
        },
      },
    ],
    permissionPoints: [
      {
        permissionPoint: {
          key: "crm.customer.export",
          name: "导出客户",
          status: "active",
        },
      },
    ],
  };
}
