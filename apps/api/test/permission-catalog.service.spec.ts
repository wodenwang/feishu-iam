import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { ApplicationService } from "../src/permission/application.service";
import { PermissionCatalogService } from "../src/permission/permission-catalog.service";

type PrismaMock = ReturnType<typeof makePrisma>;
type AuditMock = ReturnType<typeof makeAudit>;

function makePrisma() {
  const prisma = {
    application: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    permissionGroup: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    permissionPoint: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    permissionGroupPoint: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  prisma.$transaction.mockImplementation((operation: unknown) => {
    if (typeof operation === "function") {
      return (operation as (tx: typeof prisma) => Promise<unknown>)(prisma);
    }

    return Promise.resolve(operation);
  });

  return prisma;
}

function makeAudit() {
  return {
    record: vi.fn().mockResolvedValue(undefined),
  };
}

function makeApplicationService(
  prisma: PrismaMock = makePrisma(),
  audit: AuditMock = makeAudit(),
) {
  return new ApplicationService(prisma as never, audit as never);
}

function makeCatalogService(
  prisma: PrismaMock = makePrisma(),
  audit: AuditMock = makeAudit(),
) {
  const applicationService = makeApplicationService(prisma, audit);
  return new PermissionCatalogService(
    prisma as never,
    applicationService,
    audit as never,
  );
}

describe("ApplicationService", () => {
  it("创建应用时校验 app_key", async () => {
    const service = makeApplicationService();

    await expect(
      service.createApplication({
        appKey: "Finance",
        name: "财务系统",
      }),
    ).rejects.toMatchObject({ code: "APPLICATION_KEY_INVALID" });
  });

  it("创建应用成功时写入 prisma 并记录审计", async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    const created = {
      id: "app-1",
      appKey: "finance",
      name: "财务系统",
      description: "费用和发票",
      ownerUserId: "ou_owner",
      status: "active",
    };
    prisma.application.create.mockResolvedValue(created);
    const service = makeApplicationService(prisma, audit);

    await expect(
      service.createApplication({
        appKey: "finance",
        name: "财务系统",
        description: "费用和发票",
        ownerUserId: "ou_owner",
      }),
    ).resolves.toBe(created);

    expect(prisma.application.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: expect.any(String) as unknown,
        appKey: "finance",
        name: "财务系统",
        description: "费用和发票",
        ownerUserId: "ou_owner",
      }) as unknown,
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorType: "platform_token",
        actorId: "platform-admin-token",
        source: "platform_api",
        applicationId: "app-1",
        resourceType: "application",
        resourceId: "app-1",
        action: "create",
        after: created,
        result: "success",
      }),
      prisma,
    );
  });

  it("创建应用审计失败时事务 reject 并向外抛错", async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    const error = new Error("audit unavailable");
    const created = {
      id: "app-1",
      appKey: "finance",
      name: "财务系统",
      description: null,
      ownerUserId: null,
      status: "active",
    };
    prisma.application.create.mockResolvedValue(created);
    audit.record.mockRejectedValue(error);
    const service = makeApplicationService(prisma, audit);

    await expect(
      service.createApplication({
        appKey: "finance",
        name: "财务系统",
      }),
    ).rejects.toThrow(error);

    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function));
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ resourceType: "application" }),
      prisma,
    );
  });

  it("分页列出应用时在数据库层应用查询、状态和应用范围过滤", async () => {
    const prisma = makePrisma();
    prisma.application.findMany.mockResolvedValue([
      { id: "app-1", appKey: "finance" },
    ]);
    prisma.application.count.mockResolvedValue(1);
    const service = makeApplicationService(prisma);

    await expect(
      service.listApplications({
        page: 2,
        pageSize: 10,
        query: "财务",
        status: "active",
        applicationIds: ["app-1", "app-2"],
      }),
    ).resolves.toMatchObject({
      items: [{ id: "app-1", appKey: "finance" }],
      total: 1,
      page: 2,
      pageSize: 10,
    });

    const expectedWhere = {
      OR: [
        { name: { contains: "财务", mode: "insensitive" } },
        { appKey: { contains: "财务", mode: "insensitive" } },
        { description: { contains: "财务", mode: "insensitive" } },
        { ownerUserId: { contains: "财务", mode: "insensitive" } },
      ],
      status: "active",
      id: { in: ["app-1", "app-2"] },
    };
    expect(prisma.application.findMany).toHaveBeenCalledWith({
      where: expectedWhere,
      orderBy: { appKey: "asc" },
      skip: 10,
      take: 10,
    });
    expect(prisma.application.count).toHaveBeenCalledWith({
      where: expectedWhere,
    });
  });

  it("应用范围为空数组时直接返回空页，不查询全量应用", async () => {
    const prisma = makePrisma();
    const service = makeApplicationService(prisma);

    await expect(
      service.listApplications({ applicationIds: [] }),
    ).resolves.toEqual({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });

    expect(prisma.application.findMany).not.toHaveBeenCalled();
    expect(prisma.application.count).not.toHaveBeenCalled();
  });

  it("listAllApplications 保留旧全量列表语义，不设置分页参数", async () => {
    const prisma = makePrisma();
    prisma.application.findMany.mockResolvedValue([
      { id: "app-1", appKey: "finance" },
    ]);
    const service = makeApplicationService(prisma);

    await expect(service.listAllApplications()).resolves.toEqual([
      { id: "app-1", appKey: "finance" },
    ]);

    expect(prisma.application.findMany).toHaveBeenCalledWith({
      orderBy: {
        appKey: "asc",
      },
    });
    expect(prisma.application.count).not.toHaveBeenCalled();
  });

  it("创建应用遇到重复 app_key 时返回稳定领域错误", async () => {
    const prisma = makePrisma();
    prisma.application.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError(
        "Unique constraint failed on the fields: (`app_key`)",
        {
          code: "P2002",
          clientVersion: "test",
        },
      ),
    );
    const service = makeApplicationService(prisma);

    await expect(
      service.createApplication({
        appKey: "finance",
        name: "财务系统",
      }),
    ).rejects.toMatchObject({
      code: "APPLICATION_KEY_CONFLICT",
      status: 409,
    });
  });

  it("更新应用时只允许计划字段进入 Prisma data", async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    prisma.application.findUnique.mockResolvedValue({
      id: "app-1",
      appKey: "finance",
      name: "财务系统",
      status: "active",
    });
    prisma.application.update.mockResolvedValue({
      id: "app-1",
      appKey: "finance",
      name: "财务系统 V2",
      status: "active",
    });
    const service = makeApplicationService(prisma, audit);

    await service.updateApplication("finance", {
      id: "evil",
      appKey: "evil",
      name: "财务系统 V2",
      status: "disabled",
      applicationId: "evil-app",
    } as never);

    expect(prisma.application.update).toHaveBeenCalledWith({
      where: { appKey: "finance" },
      data: {
        name: "财务系统 V2",
      },
    });
  });

  it("启用和停用应用时写入明确审计动作", async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    prisma.application.findUnique.mockResolvedValueOnce({
      id: "app-finance",
      appKey: "finance",
      name: "财务系统",
      status: "active",
    });
    prisma.application.update.mockResolvedValueOnce({
      id: "app-finance",
      appKey: "finance",
      name: "财务系统",
      status: "disabled",
    });
    prisma.application.findUnique.mockResolvedValueOnce({
      id: "app-finance",
      appKey: "finance",
      name: "财务系统",
      status: "disabled",
    });
    prisma.application.update.mockResolvedValueOnce({
      id: "app-finance",
      appKey: "finance",
      name: "财务系统",
      status: "active",
    });
    const service = makeApplicationService(prisma, audit);

    await service.setApplicationStatus("finance", "disabled");
    await service.setApplicationStatus("finance", "active");

    expect(audit.record).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        applicationId: "app-finance",
        resourceType: "application",
        action: "disable",
      }),
      prisma,
    );
    expect(audit.record).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        applicationId: "app-finance",
        resourceType: "application",
        action: "enable",
      }),
      prisma,
    );
  });
});

describe("PermissionCatalogService", () => {
  it("创建权限点时必须以 app_key. 开头", async () => {
    const service = makeCatalogService();

    await expect(
      service.createPermissionPoint("finance", {
        key: "invoice.read",
        name: "查看发票",
      }),
    ).rejects.toMatchObject({ code: "PERMISSION_POINT_KEY_INVALID" });
  });

  it("创建权限组时必须以 app_key. 开头", async () => {
    const service = makeCatalogService();

    await expect(
      service.createPermissionGroup("finance", {
        key: "invoice_manager",
        name: "发票管理员",
      }),
    ).rejects.toMatchObject({ code: "PERMISSION_GROUP_KEY_INVALID" });
  });

  it("权限组只能绑定同应用权限点", async () => {
    const prisma = makePrisma();
    prisma.application.findUnique.mockResolvedValue({
      id: "app-finance",
      appKey: "finance",
      name: "财务系统",
    });
    prisma.permissionGroup.findFirst.mockResolvedValue({
      id: "group-1",
      applicationId: "app-finance",
      key: "finance.invoice_manager",
    });
    prisma.permissionPoint.findMany.mockResolvedValue([
      {
        id: "point-1",
        applicationId: "app-other",
        key: "crm.customer.read",
      },
    ]);
    const service = makeCatalogService(prisma);

    await expect(
      service.replacePermissionGroupPoints("finance", "group-1", ["point-1"]),
    ).rejects.toMatchObject({
      code: "CROSS_APPLICATION_BINDING_FORBIDDEN",
    });
  });

  it("replacePermissionGroupPoints 使用事务替换绑定并写入 applicationId", async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    prisma.application.findUnique.mockResolvedValue({
      id: "app-finance",
      appKey: "finance",
      name: "财务系统",
    });
    prisma.permissionGroup.findFirst.mockResolvedValue({
      id: "group-1",
      applicationId: "app-finance",
      key: "finance.invoice_manager",
    });
    prisma.permissionPoint.findMany.mockResolvedValue([
      {
        id: "point-1",
        applicationId: "app-finance",
        key: "finance.invoice.read",
      },
      {
        id: "point-2",
        applicationId: "app-finance",
        key: "finance.invoice.write",
      },
    ]);
    const service = makeCatalogService(prisma, audit);

    await service.replacePermissionGroupPoints("finance", "group-1", [
      "point-1",
      "point-2",
    ]);

    expect(prisma.permissionGroupPoint.deleteMany).toHaveBeenCalledWith({
      where: {
        applicationId: "app-finance",
        permissionGroupId: "group-1",
      },
    });
    expect(prisma.permissionGroupPoint.createMany).toHaveBeenCalledWith({
      data: [
        {
          applicationId: "app-finance",
          permissionGroupId: "group-1",
          permissionPointId: "point-1",
        },
        {
          applicationId: "app-finance",
          permissionGroupId: "group-1",
          permissionPointId: "point-2",
        },
      ],
      skipDuplicates: true,
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function));
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        applicationId: "app-finance",
        resourceType: "permission_group",
        resourceId: "group-1",
        action: "replace_permission_points",
        after: { permissionPointIds: ["point-1", "point-2"] },
        result: "success",
      }),
      prisma,
    );
  });

  it("replacePermissionGroupPoints 审计失败时事务 reject 并向外抛错", async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    const error = new Error("audit unavailable");
    prisma.application.findUnique.mockResolvedValue({
      id: "app-finance",
      appKey: "finance",
      name: "财务系统",
    });
    prisma.permissionGroup.findFirst.mockResolvedValue({
      id: "group-1",
      applicationId: "app-finance",
      key: "finance.invoice_manager",
    });
    prisma.permissionPoint.findMany.mockResolvedValue([
      {
        id: "point-1",
        applicationId: "app-finance",
        key: "finance.invoice.read",
      },
    ]);
    audit.record.mockRejectedValue(error);
    const service = makeCatalogService(prisma, audit);

    await expect(
      service.replacePermissionGroupPoints("finance", "group-1", ["point-1"]),
    ).rejects.toThrow(error);

    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function));
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "replace_permission_points",
        after: { permissionPointIds: ["point-1"] },
      }),
      prisma,
    );
  });

  it("replacePermissionGroupPoints 拒绝重复权限点", async () => {
    const prisma = makePrisma();
    prisma.application.findUnique.mockResolvedValue({
      id: "app-finance",
      appKey: "finance",
      name: "财务系统",
    });
    prisma.permissionGroup.findFirst.mockResolvedValue({
      id: "group-1",
      applicationId: "app-finance",
      key: "finance.invoice_manager",
    });
    const service = makeCatalogService(prisma);

    await expect(
      service.replacePermissionGroupPoints("finance", "group-1", [
        "point-1",
        "point-1",
      ]),
    ).rejects.toMatchObject({
      code: "PERMISSION_POINT_DUPLICATED",
      status: 422,
    });

    expect(prisma.permissionPoint.findMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("replacePermissionGroupPoints 支持空数组并审计空结果", async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    prisma.application.findUnique.mockResolvedValue({
      id: "app-finance",
      appKey: "finance",
      name: "财务系统",
    });
    prisma.permissionGroup.findFirst.mockResolvedValue({
      id: "group-1",
      applicationId: "app-finance",
      key: "finance.invoice_manager",
    });
    prisma.permissionPoint.findMany.mockResolvedValue([]);
    const service = makeCatalogService(prisma, audit);

    await service.replacePermissionGroupPoints("finance", "group-1", []);

    expect(prisma.permissionGroupPoint.deleteMany).toHaveBeenCalledWith({
      where: {
        applicationId: "app-finance",
        permissionGroupId: "group-1",
      },
    });
    expect(prisma.permissionGroupPoint.createMany).toHaveBeenCalledWith({
      data: [],
      skipDuplicates: true,
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        after: { permissionPointIds: [] },
      }),
      prisma,
    );
  });

  it("更新权限组时只允许计划字段进入 Prisma data", async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    prisma.application.findUnique.mockResolvedValue({
      id: "app-finance",
      appKey: "finance",
      name: "财务系统",
    });
    prisma.permissionGroup.findFirst.mockResolvedValue({
      id: "group-1",
      applicationId: "app-finance",
      key: "finance.invoice_manager",
      name: "发票管理员",
    });
    prisma.permissionGroup.update.mockResolvedValue({
      id: "group-1",
      applicationId: "app-finance",
      key: "finance.invoice_manager",
      name: "发票管理员 V2",
    });
    const service = makeCatalogService(prisma, audit);

    await service.updatePermissionGroup("finance", "group-1", {
      id: "evil",
      applicationId: "evil-app",
      key: "finance.invoice_manager",
      name: "发票管理员 V2",
      status: "disabled",
    } as never);

    expect(prisma.permissionGroup.update).toHaveBeenCalledWith({
      where: {
        applicationId_id: {
          applicationId: "app-finance",
          id: "group-1",
        },
      },
      data: {
        key: "finance.invoice_manager",
        name: "发票管理员 V2",
      },
    });
  });

  it("更新权限点时只允许计划字段进入 Prisma data", async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    prisma.application.findUnique.mockResolvedValue({
      id: "app-finance",
      appKey: "finance",
      name: "财务系统",
    });
    prisma.permissionPoint.findFirst.mockResolvedValue({
      id: "point-1",
      applicationId: "app-finance",
      key: "finance.invoice.read",
      name: "查看发票",
    });
    prisma.permissionPoint.update.mockResolvedValue({
      id: "point-1",
      applicationId: "app-finance",
      key: "finance.invoice.read",
      name: "查看发票 V2",
    });
    const service = makeCatalogService(prisma, audit);

    await service.updatePermissionPoint("finance", "point-1", {
      id: "evil",
      applicationId: "evil-app",
      key: "finance.invoice.read",
      name: "查看发票 V2",
      status: "disabled",
    } as never);

    expect(prisma.permissionPoint.update).toHaveBeenCalledWith({
      where: {
        applicationId_id: {
          applicationId: "app-finance",
          id: "point-1",
        },
      },
      data: {
        key: "finance.invoice.read",
        name: "查看发票 V2",
      },
    });
  });

  it("setPermissionPointStatus 写审计", async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    prisma.application.findUnique.mockResolvedValue({
      id: "app-finance",
      appKey: "finance",
      name: "财务系统",
    });
    prisma.permissionPoint.findFirst.mockResolvedValue({
      id: "point-1",
      applicationId: "app-finance",
      key: "finance.invoice.read",
      status: "active",
    });
    prisma.permissionPoint.update.mockResolvedValue({
      id: "point-1",
      applicationId: "app-finance",
      key: "finance.invoice.read",
      status: "disabled",
    });
    const service = makeCatalogService(prisma, audit);

    await service.setPermissionPointStatus("finance", "point-1", "disabled");

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        applicationId: "app-finance",
        resourceType: "permission_point",
        resourceId: "point-1",
        action: "set_status",
        before: expect.objectContaining({ status: "active" }) as unknown,
        after: expect.objectContaining({ status: "disabled" }) as unknown,
        result: "success",
      }),
      prisma,
    );
  });

  it("setPermissionGroupStatus 写审计", async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    prisma.application.findUnique.mockResolvedValue({
      id: "app-finance",
      appKey: "finance",
      name: "财务系统",
    });
    prisma.permissionGroup.findFirst.mockResolvedValue({
      id: "group-1",
      applicationId: "app-finance",
      key: "finance.invoice_manager",
      status: "active",
    });
    prisma.permissionGroup.update.mockResolvedValue({
      id: "group-1",
      applicationId: "app-finance",
      key: "finance.invoice_manager",
      status: "disabled",
    });
    const service = makeCatalogService(prisma, audit);

    await service.setPermissionGroupStatus("finance", "group-1", "disabled");

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        applicationId: "app-finance",
        resourceType: "permission_group",
        resourceId: "group-1",
        action: "set_status",
        before: expect.objectContaining({ status: "active" }) as unknown,
        after: expect.objectContaining({ status: "disabled" }) as unknown,
        result: "success",
      }),
      prisma,
    );
  });
});
