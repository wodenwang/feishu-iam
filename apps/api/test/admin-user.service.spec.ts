import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { AdminUserService } from '../src/admin/admin-user.service';
import { AdminDomainError, type AdminRoleKey } from '../src/admin/admin.types';

type PrismaMock = ReturnType<typeof makePrismaTables>;
type AuditMock = ReturnType<typeof makeAudit>;

const INTERNAL_OR_SENSITIVE_FIELD_PATTERN =
  /adminUserId|adminRoleId|applicationId|secret|token|cookie|password|clientSecretHash|rawPayload/i;

function makePrismaTables() {
  return {
    feishuUser: {
      findUnique: vi.fn()
    },
    adminUser: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn()
    },
    adminRole: {
      findMany: vi.fn()
    },
    adminUserRole: {
      createMany: vi.fn(),
      deleteMany: vi.fn()
    },
    adminApplicationScope: {
      createMany: vi.fn(),
      deleteMany: vi.fn()
    },
    adminSession: {
      updateMany: vi.fn()
    },
    application: {
      findMany: vi.fn()
    },
    auditLog: {
      create: vi.fn()
    }
  };
}

function makePrismaWithTx() {
  const root = {
    ...makePrismaTables(),
    $transaction: vi.fn()
  };
  const tx = makePrismaTables();

  root.$transaction.mockImplementation((operation: unknown) => {
    if (typeof operation === 'function') {
      return (operation as (txArg: typeof tx) => Promise<unknown>)(tx);
    }

    return Promise.resolve(operation);
  });

  return { root, tx };
}

function makeAudit() {
  return {
    record: vi.fn().mockResolvedValue(undefined)
  };
}

function makeService(root: PrismaMock & { $transaction: ReturnType<typeof vi.fn> }, audit: AuditMock = makeAudit()) {
  return new AdminUserService(root as never, audit as never);
}

async function expectAdminError(action: Promise<unknown>, code: string, status?: number): Promise<AdminDomainError> {
  try {
    await action;
  } catch (error) {
    expect(error).toBeInstanceOf(AdminDomainError);
    expect((error as AdminDomainError).code).toBe(code);
    if (status !== undefined) {
      expect((error as AdminDomainError).status).toBe(status);
    }
    return error as AdminDomainError;
  }

  throw new Error(`Expected AdminDomainError ${code}`);
}

function mockAvailableFeishuUser(prisma: PrismaMock): void {
  prisma.feishuUser.findUnique.mockResolvedValue({
    userId: 'ou_admin',
    name: '管理员',
    isActive: true,
    isDeleted: false
  });
}

function mockRole(prisma: PrismaMock, id: string, roleKey: AdminRoleKey): void {
  prisma.adminRole.findMany.mockResolvedValue([{ id, roleKey }]);
}

function mockCreatedAdmin(prisma: PrismaMock): void {
  prisma.adminUser.create.mockResolvedValue({
    id: 'admin-created',
    feishuUserId: 'ou_admin',
    displayName: '管理员',
    status: 'active'
  });
}

function expectRootTablesUnused(root: PrismaMock): void {
  expect(root.feishuUser.findUnique).not.toHaveBeenCalled();
  expect(root.adminUser.create).not.toHaveBeenCalled();
  expect(root.adminUser.findUnique).not.toHaveBeenCalled();
  expect(root.adminUser.update).not.toHaveBeenCalled();
  expect(root.adminRole.findMany).not.toHaveBeenCalled();
  expect(root.adminUserRole.createMany).not.toHaveBeenCalled();
  expect(root.adminUserRole.deleteMany).not.toHaveBeenCalled();
  expect(root.adminApplicationScope.createMany).not.toHaveBeenCalled();
  expect(root.adminApplicationScope.deleteMany).not.toHaveBeenCalled();
  expect(root.adminSession.updateMany).not.toHaveBeenCalled();
  expect(root.application.findMany).not.toHaveBeenCalled();
  expect(root.auditLog.create).not.toHaveBeenCalled();
}

describe('AdminUserService', () => {
  it('飞书用户不存在时抛 ADMIN_FEISHU_USER_NOT_FOUND', async () => {
    const { root, tx } = makePrismaWithTx();
    tx.feishuUser.findUnique.mockResolvedValue(null);
    const service = makeService(root);

    const error = await expectAdminError(
      service.createAdminUser({
        feishuUserId: 'ou_missing',
        roleKeys: ['platform_admin'],
        applicationIds: []
      }),
      'ADMIN_FEISHU_USER_NOT_FOUND',
      404
    );

    expect(error.message).toBe('飞书用户不存在');
    expect(tx.adminUser.create).not.toHaveBeenCalled();
    expectRootTablesUnused(root);
  });

  it('拒绝绑定禁用飞书用户，抛 ADMIN_FEISHU_USER_UNAVAILABLE', async () => {
    const { root, tx } = makePrismaWithTx();
    tx.feishuUser.findUnique.mockResolvedValue({
      userId: 'ou_admin',
      name: '管理员',
      isActive: false,
      isDeleted: false
    });
    const service = makeService(root);

    await expectAdminError(
      service.createAdminUser({
        feishuUserId: 'ou_admin',
        roleKeys: ['platform_admin'],
        applicationIds: []
      }),
      'ADMIN_FEISHU_USER_UNAVAILABLE',
      422
    );

    expect(tx.adminUser.create).not.toHaveBeenCalled();
    expectRootTablesUnused(root);
  });

  it('拒绝绑定删除态飞书用户，抛 ADMIN_FEISHU_USER_UNAVAILABLE', async () => {
    const { root, tx } = makePrismaWithTx();
    tx.feishuUser.findUnique.mockResolvedValue({
      userId: 'ou_admin',
      name: '管理员',
      isActive: true,
      isDeleted: true
    });
    const service = makeService(root);

    await expectAdminError(
      service.createAdminUser({
        feishuUserId: 'ou_admin',
        roleKeys: ['platform_admin'],
        applicationIds: []
      }),
      'ADMIN_FEISHU_USER_UNAVAILABLE',
      422
    );

    expect(tx.adminUser.create).not.toHaveBeenCalled();
    expectRootTablesUnused(root);
  });

  it('创建应用管理员时在 transaction 内写入 admin user、单一角色、应用 scope 和审计，并去重范围', async () => {
    const { root, tx } = makePrismaWithTx();
    const audit = makeAudit();
    mockAvailableFeishuUser(tx);
    tx.adminRole.findMany.mockResolvedValue([{ id: 'role-app', roleKey: 'application_admin' }]);
    tx.application.findMany.mockResolvedValue([{ id: 'app-finance' }, { id: 'app-hr' }]);
    mockCreatedAdmin(tx);
    const service = makeService(root, audit);

    const created = await service.createAdminUser(
      {
        feishuUserId: 'ou_admin',
        roleKeys: ['application_admin'],
        applicationIds: ['app-finance', 'app-hr', 'app-finance']
      },
      {
        actorType: 'admin_user',
        actorId: 'admin-operator',
        source: 'admin_web',
        ip: '127.0.0.1',
        userAgent: 'vitest',
        requestId: 'req-1'
      }
    );

    expect(created).toMatchObject({
      id: 'admin-created',
      feishuUserId: 'ou_admin',
      displayName: '管理员'
    });
    expect(tx.adminUser.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: expect.any(String) as unknown,
        feishuUserId: 'ou_admin',
        displayName: '管理员',
        status: 'active'
      }) as unknown
    });
    expect(tx.adminRole.findMany).toHaveBeenCalledWith({
      where: {
        roleKey: {
          in: ['application_admin']
        }
      }
    });
    expect(tx.application.findMany).toHaveBeenCalledWith({
      where: {
        id: {
          in: ['app-finance', 'app-hr']
        }
      },
      select: {
        id: true
      }
    });
    expect(tx.adminUserRole.createMany).toHaveBeenCalledWith({
      data: [
        { adminUserId: 'admin-created', adminRoleId: 'role-app' }
      ],
      skipDuplicates: true
    });
    expect(tx.adminApplicationScope.createMany).toHaveBeenCalledWith({
      data: [
        { adminUserId: 'admin-created', applicationId: 'app-finance' },
        { adminUserId: 'admin-created', applicationId: 'app-hr' }
      ],
      skipDuplicates: true
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorType: 'admin_user',
        actorId: 'admin-operator',
        source: 'admin_web',
        resourceType: 'admin_user',
        resourceId: 'admin-created',
        action: 'create',
        result: 'success',
        after: {
          adminUserId: 'admin-created',
          feishuUserId: 'ou_admin',
          roleKeys: ['application_admin'],
          applicationIds: ['app-finance', 'app-hr']
        }
      }),
      tx
    );
    const auditPayload = JSON.stringify(audit.record.mock.calls[0]);
    expect(auditPayload).not.toMatch(/secret|token|cookie|password/i);
    expectRootTablesUnused(root);
  });

  it('未传审计上下文时使用部署初始化 system 上下文', async () => {
    const { root, tx } = makePrismaWithTx();
    const audit = makeAudit();
    mockAvailableFeishuUser(tx);
    mockRole(tx, 'role-platform', 'platform_admin');
    mockCreatedAdmin(tx);
    const service = makeService(root, audit);

    await service.createAdminUser({
      feishuUserId: 'ou_admin',
      roleKeys: ['platform_admin'],
      applicationIds: []
    });

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorType: 'system',
        actorId: 'deployment',
        source: 'deployment_init',
        resourceType: 'admin_user',
        resourceId: 'admin-created',
        action: 'create',
        result: 'success'
      }),
      tx
    );
    expectRootTablesUnused(root);
  });

  it('角色 key 不存在或为空时抛 ADMIN_ROLE_INVALID', async () => {
    const { root } = makePrismaWithTx();
    const service = makeService(root);

    await expectAdminError(
      service.createAdminUser({
        feishuUserId: 'ou_admin',
        roleKeys: [],
        applicationIds: []
      }),
      'ADMIN_ROLE_INVALID',
      422
    );

    await expectAdminError(
      service.createAdminUser({
        feishuUserId: 'ou_admin',
        roleKeys: ['application_admin', '' as AdminRoleKey],
        applicationIds: []
      }),
      'ADMIN_ROLE_INVALID',
      422
    );

    await expectAdminError(
      service.createAdminUser({
        feishuUserId: 'ou_admin',
        roleKeys: ['application_admin', 'missing_role' as AdminRoleKey],
        applicationIds: []
      }),
      'ADMIN_ROLE_INVALID',
      422
    );
  });

  it.each(['audit_viewer', 'sync_admin'] as const)('创建管理员拒绝维护历史角色 %s', async (roleKey) => {
    const { root } = makePrismaWithTx();
    const service = makeService(root);

    await expectAdminError(
      service.createAdminUser({
        feishuUserId: 'ou_admin',
        roleKeys: [roleKey],
        applicationIds: []
      }),
      'ADMIN_ROLE_INVALID',
      422
    );

    expectRootTablesUnused(root);
  });

  it('创建管理员拒绝多角色组合', async () => {
    const { root } = makePrismaWithTx();
    const service = makeService(root);

    await expectAdminError(
      service.createAdminUser({
        feishuUserId: 'ou_admin',
        roleKeys: ['platform_admin', 'application_admin'],
        applicationIds: ['app-finance']
      }),
      'ADMIN_ROLE_INVALID',
      422
    );

    expectRootTablesUnused(root);
  });

  it('创建应用管理员拒绝空应用范围', async () => {
    const { root } = makePrismaWithTx();
    const service = makeService(root);

    await expectAdminError(
      service.createAdminUser({
        feishuUserId: 'ou_admin',
        roleKeys: ['application_admin'],
        applicationIds: []
      }),
      'ADMIN_APPLICATION_SCOPE_INVALID',
      422
    );

    expectRootTablesUnused(root);
  });

  it('创建平台管理员拒绝携带应用范围', async () => {
    const { root } = makePrismaWithTx();
    const service = makeService(root);

    await expectAdminError(
      service.createAdminUser({
        feishuUserId: 'ou_admin',
        roleKeys: ['platform_admin'],
        applicationIds: ['app-finance']
      }),
      'ADMIN_APPLICATION_SCOPE_INVALID',
      422
    );

    expectRootTablesUnused(root);
  });

  it('角色 DB 解析缺失时抛 ADMIN_ROLE_INVALID', async () => {
    const { root, tx } = makePrismaWithTx();
    mockAvailableFeishuUser(tx);
    tx.adminRole.findMany.mockResolvedValue([{ id: 'role-app', roleKey: 'application_admin' }]);
    const service = makeService(root);

    await expectAdminError(
      service.createAdminUser({
        feishuUserId: 'ou_admin',
        roleKeys: ['application_admin', 'audit_viewer'],
        applicationIds: []
      }),
      'ADMIN_ROLE_INVALID',
      422
    );

    expect(tx.adminUser.create).not.toHaveBeenCalled();
    expectRootTablesUnused(root);
  });

  it('applicationIds 中有不存在应用时抛 ADMIN_APPLICATION_SCOPE_INVALID', async () => {
    const { root, tx } = makePrismaWithTx();
    mockAvailableFeishuUser(tx);
    mockRole(tx, 'role-app', 'application_admin');
    tx.application.findMany.mockResolvedValue([{ id: 'app-finance' }]);
    const service = makeService(root);

    await expectAdminError(
      service.createAdminUser({
        feishuUserId: 'ou_admin',
        roleKeys: ['application_admin'],
        applicationIds: ['app-finance', 'app-missing']
      }),
      'ADMIN_APPLICATION_SCOPE_INVALID',
      422
    );

    expect(tx.adminUser.create).not.toHaveBeenCalled();
    expectRootTablesUnused(root);
  });

  it('输入非数组、空字符串或非 string 元素时抛稳定 AdminDomainError', async () => {
    const { root } = makePrismaWithTx();
    const service = makeService(root);

    await expectAdminError(
      service.createAdminUser({
        feishuUserId: 'ou_admin',
        roleKeys: 'platform_admin' as unknown as AdminRoleKey[],
        applicationIds: []
      }),
      'ADMIN_ROLE_INVALID',
      422
    );
    await expectAdminError(
      service.createAdminUser({
        feishuUserId: 'ou_admin',
        roleKeys: ['platform_admin', 1 as unknown as AdminRoleKey],
        applicationIds: []
      }),
      'ADMIN_ROLE_INVALID',
      422
    );
    await expectAdminError(
      service.createAdminUser({
        feishuUserId: 'ou_admin',
        roleKeys: ['platform_admin'],
        applicationIds: 'app-finance' as unknown as string[]
      }),
      'ADMIN_APPLICATION_SCOPE_INVALID',
      422
    );
    await expectAdminError(
      service.createAdminUser({
        feishuUserId: 'ou_admin',
        roleKeys: ['platform_admin'],
        applicationIds: ['app-finance', '']
      }),
      'ADMIN_APPLICATION_SCOPE_INVALID',
      422
    );
    await expectAdminError(
      service.createAdminUser({
        feishuUserId: 'ou_admin',
        roleKeys: ['platform_admin'],
        applicationIds: ['app-finance', 1 as unknown as string]
      }),
      'ADMIN_APPLICATION_SCOPE_INVALID',
      422
    );
  });

  it('重复绑定同一个飞书用户时映射 P2002 为 ADMIN_USER_ALREADY_EXISTS', async () => {
    const { root, tx } = makePrismaWithTx();
    mockAvailableFeishuUser(tx);
    mockRole(tx, 'role-platform', 'platform_admin');
    tx.adminUser.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test'
      })
    );
    const service = makeService(root);

    await expectAdminError(
      service.createAdminUser({
        feishuUserId: 'ou_admin',
        roleKeys: ['platform_admin'],
        applicationIds: []
      }),
      'ADMIN_USER_ALREADY_EXISTS',
      409
    );

    expect(tx.adminUserRole.createMany).not.toHaveBeenCalled();
    expectRootTablesUnused(root);
  });

  it('按创建时间倒序列出管理员，并序列化为安全 DTO', async () => {
    const { root } = makePrismaWithTx();
    const service = makeService(root);
    const createdAt = new Date('2026-05-17T02:00:00.000Z');
    const updatedAt = new Date('2026-05-17T02:10:00.000Z');
    const items = [
      {
        id: 'admin-new',
        feishuUserId: 'ou_new',
        displayName: '新管理员',
        status: 'active',
        lastLoginAt: null,
        createdAt,
        updatedAt,
        password: 'must-not-leak',
        rawPayload: { must: 'not leak' },
        roles: [
          {
            adminUserId: 'admin-new',
            adminRoleId: 'role-platform',
            createdAt,
            token: 'must-not-leak',
            adminRole: {
              id: 'role-platform',
              roleKey: 'platform_admin',
              name: '平台管理员',
              description: null,
              createdAt,
              updatedAt,
              clientSecretHash: 'must-not-leak'
            }
          }
        ],
        applicationScopes: [
          {
            adminUserId: 'admin-new',
            applicationId: 'app-finance',
            createdAt,
            cookie: 'must-not-leak',
            application: {
              id: 'app-finance',
              appKey: 'finance',
              name: '财务系统',
              description: null,
              ownerUserId: null,
              status: 'active',
              createdAt,
              updatedAt,
              clientSecretHash: 'must-not-leak',
              rawPayload: { must: 'not leak' }
            }
          }
        ]
      }
    ];
    root.adminUser.findMany.mockResolvedValue(items);

    const result = await service.listAdminUsers();

    expect(result).toEqual([
      {
        id: 'admin-new',
        feishuUserId: 'ou_new',
        displayName: '新管理员',
        status: 'active',
        lastLoginAt: null,
        createdAt,
        updatedAt,
        roles: [
          {
            roleKey: 'platform_admin',
            name: '平台管理员'
          }
        ],
        applicationScopes: [
          {
            id: 'app-finance',
            appKey: 'finance',
            name: '财务系统',
            status: 'active'
          }
        ]
      }
    ]);
    expect(JSON.stringify(result)).not.toMatch(INTERNAL_OR_SENSITIVE_FIELD_PATTERN);

    expect(root.adminUser.findMany).toHaveBeenCalledWith({
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        roles: {
          include: {
            adminRole: true
          }
        },
        applicationScopes: {
          include: {
            application: true
          }
        }
      }
    });
  });

  it('replaceApplicationScopes 事务内校验应用、替换 scope、写审计并返回列表 DTO', async () => {
    const { root, tx } = makePrismaWithTx();
    const audit = makeAudit();
    const service = makeService(root, audit);
    const createdAt = new Date('2026-05-17T02:00:00.000Z');
    const updatedAt = new Date('2026-05-17T02:10:00.000Z');
    tx.adminUser.findUnique
      .mockResolvedValueOnce(makeAdminUserRecord(['app-old'], 'active', createdAt, updatedAt))
      .mockResolvedValueOnce(makeAdminUserRecord(['app-finance', 'app-hr'], 'active', createdAt, updatedAt));
    tx.application.findMany.mockResolvedValue([{ id: 'app-finance' }, { id: 'app-hr' }]);

    const result = await service.replaceApplicationScopes(
      'admin-app',
      ['app-finance', 'app-hr', 'app-finance'],
      {
        actorType: 'admin_user',
        actorId: 'admin-platform',
        source: 'admin_web',
        requestId: 'req-scopes',
        ip: '127.0.0.1',
        userAgent: 'vitest'
      }
    );

    expect(tx.application.findMany).toHaveBeenCalledWith({
      where: {
        id: {
          in: ['app-finance', 'app-hr']
        }
      },
      select: {
        id: true
      }
    });
    expect(tx.adminApplicationScope.deleteMany).toHaveBeenCalledWith({
      where: {
        adminUserId: 'admin-app'
      }
    });
    expect(tx.adminApplicationScope.createMany).toHaveBeenCalledWith({
      data: [
        { adminUserId: 'admin-app', applicationId: 'app-finance' },
        { adminUserId: 'admin-app', applicationId: 'app-hr' }
      ],
      skipDuplicates: true
    });
    expect(result.applicationScopes.map((scope) => scope.id)).toEqual(['app-finance', 'app-hr']);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorType: 'admin_user',
        actorId: 'admin-platform',
        source: 'admin_web',
        resourceType: 'admin_user',
        resourceId: 'admin-app',
        action: 'replace_application_scopes',
        before: {
          applicationIds: ['app-old']
        },
        after: {
          applicationIds: ['app-finance', 'app-hr']
        },
        result: 'success'
      }),
      tx
    );
    expectRootTablesUnused(root);
  });

  it('replaceAuthorization 替换角色和应用范围并写审计', async () => {
    const { root, tx } = makePrismaWithTx();
    const audit = makeAudit();
    const service = makeService(root, audit);
    const createdAt = new Date('2026-05-17T02:00:00.000Z');
    const updatedAt = new Date('2026-05-17T02:10:00.000Z');
    tx.adminUser.findUnique
      .mockResolvedValueOnce(makeAdminUserRecord(['app-old'], 'active', createdAt, updatedAt))
      .mockResolvedValueOnce(makeAdminUserRecord(['app-finance'], 'active', createdAt, updatedAt));
    tx.adminRole.findMany.mockResolvedValue([{ id: 'role-app', roleKey: 'application_admin' }]);
    tx.application.findMany.mockResolvedValue([{ id: 'app-finance' }]);

    const result = await service.replaceAuthorization(
      'admin-app',
      { roleKeys: ['application_admin'], applicationIds: ['app-finance'] },
      {
        actorType: 'admin_user',
        actorId: 'admin-platform',
        source: 'admin_web',
        requestId: 'req-authz',
        ip: '127.0.0.1',
        userAgent: 'vitest'
      }
    );

    expect(tx.adminUserRole.deleteMany).toHaveBeenCalledWith({
      where: {
        adminUserId: 'admin-app'
      }
    });
    expect(tx.adminUserRole.createMany).toHaveBeenCalledWith({
      data: [{ adminUserId: 'admin-app', adminRoleId: 'role-app' }],
      skipDuplicates: true
    });
    expect(tx.adminApplicationScope.deleteMany).toHaveBeenCalledWith({
      where: {
        adminUserId: 'admin-app'
      }
    });
    expect(tx.adminApplicationScope.createMany).toHaveBeenCalledWith({
      data: [{ adminUserId: 'admin-app', applicationId: 'app-finance' }],
      skipDuplicates: true
    });
    expect(result.roles.map((role) => role.roleKey)).toEqual(['application_admin']);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorType: 'admin_user',
        actorId: 'admin-platform',
        source: 'admin_web',
        resourceType: 'admin_user',
        resourceId: 'admin-app',
        action: 'replace_authorization',
        before: {
          roleKeys: ['application_admin'],
          applicationIds: ['app-old']
        },
        after: {
          roleKeys: ['application_admin'],
          applicationIds: ['app-finance']
        },
        result: 'success'
      }),
      tx
    );
    expectRootTablesUnused(root);
  });

  it.each([
    ['platform_admin', []],
    ['application_admin', ['app-finance']]
  ] as const)('replaceAuthorization 拒绝把历史角色目标改成 %s', async (nextRoleKey, applicationIds) => {
    const { root, tx } = makePrismaWithTx();
    const service = makeService(root);
    const createdAt = new Date('2026-05-17T02:00:00.000Z');
    const updatedAt = new Date('2026-05-17T02:10:00.000Z');
    tx.adminUser.findUnique.mockResolvedValueOnce(
      makeAdminUserRecord([], 'active', createdAt, updatedAt, ['audit_viewer'])
    );

    const error = await expectAdminError(
      service.replaceAuthorization('admin-audit', {
        roleKeys: [nextRoleKey],
        applicationIds: [...applicationIds]
      }),
      'ADMIN_USER_NOT_EDITABLE',
      422
    );

    expect(error.message).toBe('该管理员当前角色不支持维护');
    expect(tx.adminRole.findMany).not.toHaveBeenCalled();
    expect(tx.application.findMany).not.toHaveBeenCalled();
    expect(tx.adminUserRole.deleteMany).not.toHaveBeenCalled();
    expect(tx.adminUserRole.createMany).not.toHaveBeenCalled();
    expect(tx.adminApplicationScope.deleteMany).not.toHaveBeenCalled();
    expect(tx.adminApplicationScope.createMany).not.toHaveBeenCalled();
    expectRootTablesUnused(root);
  });

  it('replaceAuthorization 拒绝混合角色目标', async () => {
    const { root, tx } = makePrismaWithTx();
    const service = makeService(root);
    const createdAt = new Date('2026-05-17T02:00:00.000Z');
    const updatedAt = new Date('2026-05-17T02:10:00.000Z');
    tx.adminUser.findUnique.mockResolvedValueOnce(
      makeAdminUserRecord(['app-finance'], 'active', createdAt, updatedAt, ['application_admin', 'audit_viewer'])
    );

    await expectAdminError(
      service.replaceAuthorization('admin-mixed', {
        roleKeys: ['platform_admin'],
        applicationIds: []
      }),
      'ADMIN_USER_NOT_EDITABLE',
      422
    );

    expect(tx.adminRole.findMany).not.toHaveBeenCalled();
    expect(tx.application.findMany).not.toHaveBeenCalled();
    expect(tx.adminUserRole.deleteMany).not.toHaveBeenCalled();
    expect(tx.adminUserRole.createMany).not.toHaveBeenCalled();
    expect(tx.adminApplicationScope.deleteMany).not.toHaveBeenCalled();
    expect(tx.adminApplicationScope.createMany).not.toHaveBeenCalled();
    expectRootTablesUnused(root);
  });

  it('setAdminUserStatus 禁用管理员时撤销未撤销 session 并写审计', async () => {
    const { root, tx } = makePrismaWithTx();
    const audit = makeAudit();
    const service = makeService(root, audit);
    const createdAt = new Date('2026-05-17T02:00:00.000Z');
    const updatedAt = new Date('2026-05-17T02:10:00.000Z');
    tx.adminUser.findUnique
      .mockResolvedValueOnce(makeAdminUserRecord(['app-finance'], 'active', createdAt, updatedAt))
      .mockResolvedValueOnce(makeAdminUserRecord(['app-finance'], 'disabled', createdAt, updatedAt));
    tx.adminUser.update.mockResolvedValue({ id: 'admin-app', status: 'disabled' });
    tx.adminSession.updateMany.mockResolvedValue({ count: 2 });

    const result = await service.setAdminUserStatus('admin-app', 'disabled', {
      actorType: 'admin_user',
      actorId: 'admin-platform',
      source: 'admin_web',
      requestId: 'req-disable',
      ip: '127.0.0.1',
      userAgent: 'vitest'
    });

    expect(tx.adminUser.update).toHaveBeenCalledWith({
      where: {
        id: 'admin-app'
      },
      data: {
        status: 'disabled'
      }
    });
    expect(tx.adminSession.updateMany).toHaveBeenCalledWith({
      where: {
        adminUserId: 'admin-app',
        revokedAt: null
      },
      data: {
        revokedAt: expect.any(Date) as unknown
      }
    });
    expect(result.status).toBe('disabled');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorType: 'admin_user',
        actorId: 'admin-platform',
        source: 'admin_web',
        resourceType: 'admin_user',
        resourceId: 'admin-app',
        action: 'set_status',
        before: {
          status: 'active'
        },
        after: {
          status: 'disabled'
        },
        result: 'success'
      }),
      tx
    );
    expectRootTablesUnused(root);
  });

  it.each([
    ['audit_viewer', 'active'],
    ['audit_viewer', 'disabled'],
    ['sync_admin', 'active'],
    ['sync_admin', 'disabled']
  ] as const)('setAdminUserStatus 拒绝 %s 目标切换为 %s', async (roleKey, status) => {
    const { root, tx } = makePrismaWithTx();
    const service = makeService(root);
    const createdAt = new Date('2026-05-17T02:00:00.000Z');
    const updatedAt = new Date('2026-05-17T02:10:00.000Z');
    tx.adminUser.findUnique.mockResolvedValueOnce(makeAdminUserRecord([], 'active', createdAt, updatedAt, [roleKey]));

    const error = await expectAdminError(
      service.setAdminUserStatus(`admin-${roleKey}`, status),
      'ADMIN_USER_NOT_EDITABLE',
      422
    );

    expect(error.message).toBe('该管理员当前角色不支持维护');
    expect(tx.adminUser.update).not.toHaveBeenCalled();
    expect(tx.adminSession.updateMany).not.toHaveBeenCalled();
    expectRootTablesUnused(root);
  });

  it.each(['active', 'disabled'] as const)('setAdminUserStatus 拒绝混合角色目标切换为 %s', async (status) => {
    const { root, tx } = makePrismaWithTx();
    const service = makeService(root);
    const createdAt = new Date('2026-05-17T02:00:00.000Z');
    const updatedAt = new Date('2026-05-17T02:10:00.000Z');
    tx.adminUser.findUnique.mockResolvedValueOnce(
      makeAdminUserRecord(['app-finance'], 'active', createdAt, updatedAt, ['application_admin', 'sync_admin'])
    );

    await expectAdminError(service.setAdminUserStatus('admin-mixed', status), 'ADMIN_USER_NOT_EDITABLE', 422);

    expect(tx.adminUser.update).not.toHaveBeenCalled();
    expect(tx.adminSession.updateMany).not.toHaveBeenCalled();
    expectRootTablesUnused(root);
  });

  it('replaceApplicationScopes 应用不存在时抛 ADMIN_APPLICATION_SCOPE_INVALID 且不改绑定', async () => {
    const { root, tx } = makePrismaWithTx();
    const service = makeService(root);
    const createdAt = new Date('2026-05-17T02:00:00.000Z');
    const updatedAt = new Date('2026-05-17T02:10:00.000Z');
    tx.adminUser.findUnique.mockResolvedValueOnce(makeAdminUserRecord(['app-old'], 'active', createdAt, updatedAt));
    tx.application.findMany.mockResolvedValue([{ id: 'app-finance' }]);

    await expectAdminError(
      service.replaceApplicationScopes('admin-app', ['app-finance', 'app-missing']),
      'ADMIN_APPLICATION_SCOPE_INVALID',
      422
    );

    expect(tx.adminApplicationScope.deleteMany).not.toHaveBeenCalled();
    expect(tx.adminApplicationScope.createMany).not.toHaveBeenCalled();
    expectRootTablesUnused(root);
  });

  it('replaceApplicationScopes 拒绝给非单一应用管理员设置范围', async () => {
    const { root, tx } = makePrismaWithTx();
    const service = makeService(root);
    const createdAt = new Date('2026-05-17T02:00:00.000Z');
    const updatedAt = new Date('2026-05-17T02:10:00.000Z');
    tx.adminUser.findUnique.mockResolvedValueOnce(
      makeAdminUserRecord(['app-old'], 'active', createdAt, updatedAt, ['platform_admin'])
    );

    await expectAdminError(
      service.replaceApplicationScopes('admin-platform', ['app-finance']),
      'ADMIN_APPLICATION_SCOPE_INVALID',
      422
    );

    expect(tx.application.findMany).not.toHaveBeenCalled();
    expect(tx.adminApplicationScope.deleteMany).not.toHaveBeenCalled();
    expect(tx.adminApplicationScope.createMany).not.toHaveBeenCalled();
    expectRootTablesUnused(root);
  });

  it('replaceApplicationScopes 拒绝应用管理员空范围', async () => {
    const { root, tx } = makePrismaWithTx();
    const service = makeService(root);
    const createdAt = new Date('2026-05-17T02:00:00.000Z');
    const updatedAt = new Date('2026-05-17T02:10:00.000Z');
    tx.adminUser.findUnique.mockResolvedValueOnce(makeAdminUserRecord(['app-old'], 'active', createdAt, updatedAt));

    await expectAdminError(service.replaceApplicationScopes('admin-app', []), 'ADMIN_APPLICATION_SCOPE_INVALID', 422);

    expect(tx.application.findMany).not.toHaveBeenCalled();
    expect(tx.adminApplicationScope.deleteMany).not.toHaveBeenCalled();
    expect(tx.adminApplicationScope.createMany).not.toHaveBeenCalled();
    expectRootTablesUnused(root);
  });

  it('replaceAuthorization 拒绝历史角色、多角色、角色范围不一致输入', async () => {
    const { root } = makePrismaWithTx();
    const service = makeService(root);

    await expectAdminError(
      service.replaceAuthorization('admin-app', { roleKeys: ['audit_viewer'], applicationIds: [] }),
      'ADMIN_ROLE_INVALID',
      422
    );
    await expectAdminError(
      service.replaceAuthorization('admin-app', {
        roleKeys: ['platform_admin', 'application_admin'],
        applicationIds: ['app-finance']
      }),
      'ADMIN_ROLE_INVALID',
      422
    );
    await expectAdminError(
      service.replaceAuthorization('admin-app', { roleKeys: ['application_admin'], applicationIds: [] }),
      'ADMIN_APPLICATION_SCOPE_INVALID',
      422
    );
    await expectAdminError(
      service.replaceAuthorization('admin-app', { roleKeys: ['platform_admin'], applicationIds: ['app-finance'] }),
      'ADMIN_APPLICATION_SCOPE_INVALID',
      422
    );

    expectRootTablesUnused(root);
  });
});

function makeAdminUserRecord(
  applicationIds: string[],
  status: string,
  createdAt: Date,
  updatedAt: Date,
  roleKeys: AdminRoleKey[] = ['application_admin']
): unknown {
  return {
    id: 'admin-app',
    feishuUserId: 'ou_app',
    displayName: '应用管理员',
    status,
    lastLoginAt: null,
    createdAt,
    updatedAt,
    roles: roleKeys.map((roleKey) => ({
      adminUserId: 'admin-app',
      adminRoleId: `role-${roleKey}`,
      createdAt,
      adminRole: {
        id: `role-${roleKey}`,
        roleKey,
        name: roleKey === 'platform_admin' ? '平台管理员' : roleKey === 'application_admin' ? '应用管理员' : null,
        description: null,
        createdAt,
        updatedAt
      }
    })),
    applicationScopes: applicationIds.map((applicationId) => ({
      adminUserId: 'admin-app',
      applicationId,
      createdAt,
      application: {
        id: applicationId,
        appKey: applicationId.replace(/^app-/, ''),
        name: `${applicationId} 系统`,
        description: null,
        ownerUserId: null,
        status: 'active',
        createdAt,
        updatedAt
      }
    }))
  };
}
