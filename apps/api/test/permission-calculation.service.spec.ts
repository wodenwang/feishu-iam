import { describe, expect, it, vi } from 'vitest';
import { PermissionCalculationService } from '../src/permission/permission-calculation.service';

type PrismaMock = ReturnType<typeof makePrisma>;

function makePrisma() {
  return {
    application: {
      findUnique: vi.fn()
    },
    feishuUser: {
      findFirst: vi.fn()
    },
    feishuUserDepartment: {
      findMany: vi.fn()
    },
    iamRole: {
      findMany: vi.fn()
    }
  };
}

function makeService(prisma: PrismaMock = makePrisma()) {
  return new PermissionCalculationService(prisma as never);
}

function mockActiveApplication(prisma: PrismaMock) {
  prisma.application.findUnique.mockResolvedValue({
    id: 'app-finance',
    appKey: 'finance',
    name: '财务系统',
    status: 'active'
  });
}

function mockActiveUser(prisma: PrismaMock) {
  prisma.feishuUser.findFirst.mockResolvedValue({
    userId: 'user-1',
    name: '张三',
    isActive: true,
    isDeleted: false
  });
}

function mockDirectDepartments(prisma: PrismaMock, departmentIds: string[]) {
  prisma.feishuUserDepartment.findMany.mockResolvedValue(
    departmentIds.map((departmentId) => ({
      userId: 'user-1',
      departmentId,
      isDeleted: false
    }))
  );
}

function makeRole(input: {
  key: string;
  name: string;
  status?: string;
  subjects?: Array<{ subjectType: string; subjectId: string; isOrphaned?: boolean }>;
  permissionGroups?: Array<{
    permissionGroup: {
      key: string;
      name: string;
      status?: string;
      permissionPoints?: Array<{ permissionPoint: { key: string; name: string; status?: string } }>;
    };
  }>;
  permissionPoints?: Array<{ permissionPoint: { key: string; name: string; status?: string } }>;
}) {
  return {
    key: input.key,
    name: input.name,
    status: input.status ?? 'active',
    subjects: input.subjects ?? [],
    permissionGroups: input.permissionGroups ?? [],
    permissionPoints: input.permissionPoints ?? []
  };
}

function activeGroup(
  key: string,
  name: string,
  permissionPoints: Array<{ key: string; name: string; status?: string }> = []
) {
  return {
    permissionGroup: {
      key,
      name,
      status: 'active',
      permissionPoints: permissionPoints.map((permissionPoint) => ({
        permissionPoint: {
          ...permissionPoint,
          status: permissionPoint.status ?? 'active'
        }
      }))
    }
  };
}

function activePoint(key: string, name: string, status = 'active') {
  return {
    permissionPoint: {
      key,
      name,
      status
    }
  };
}

describe('PermissionCalculationService', () => {
  it('用户直接绑定角色命中权限组和权限点', async () => {
    const prisma = makePrisma();
    mockActiveApplication(prisma);
    mockActiveUser(prisma);
    mockDirectDepartments(prisma, []);
    prisma.iamRole.findMany.mockResolvedValue([
      makeRole({
        key: 'invoice_manager',
        name: '发票管理员',
        subjects: [{ subjectType: 'feishu_user', subjectId: 'user-1' }],
        permissionGroups: [activeGroup('finance.invoice_admin', '发票管理组')],
        permissionPoints: [activePoint('finance.invoice.read', '查看发票')]
      })
    ]);

    await expect(makeService(prisma).calculate('finance', 'user-1')).resolves.toMatchObject({
      appKey: 'finance',
      userId: 'user-1',
      permissionGroups: [{ key: 'finance.invoice_admin', name: '发票管理组' }],
      permissionPoints: [{ key: 'finance.invoice.read', name: '查看发票' }],
      matchedRoles: [{ key: 'invoice_manager', name: '发票管理员' }],
      computedAt: expect.any(String) as unknown
    });
  });

  it('只查询绑定当前应用且绑定启用的角色授权，并按当前应用过滤权限组和权限点', async () => {
    const prisma = makePrisma();
    mockActiveApplication(prisma);
    mockActiveUser(prisma);
    mockDirectDepartments(prisma, []);
    prisma.iamRole.findMany.mockResolvedValue([]);

    await makeService(prisma).calculate('finance', 'user-1');

    expect(prisma.iamRole.findMany).toHaveBeenCalledWith({
      where: {
        status: 'active',
        applications: {
          some: {
            applicationId: 'app-finance',
            status: 'active'
          }
        }
      },
      include: expect.objectContaining({
        subjects: true,
        permissionGroups: expect.objectContaining({
          where: {
            applicationId: 'app-finance'
          }
        }) as unknown,
        permissionPoints: expect.objectContaining({
          where: {
            applicationId: 'app-finance'
          }
        }) as unknown
      }) as unknown
    });
  });

  it('用户通过直接所属部门命中角色', async () => {
    const prisma = makePrisma();
    mockActiveApplication(prisma);
    mockActiveUser(prisma);
    mockDirectDepartments(prisma, ['dept-1']);
    prisma.iamRole.findMany.mockResolvedValue([
      makeRole({
        key: 'cashier',
        name: '出纳',
        subjects: [{ subjectType: 'feishu_department', subjectId: 'dept-1' }],
        permissionGroups: [activeGroup('finance.cashier', '出纳组')],
        permissionPoints: [activePoint('finance.payment.create', '创建付款')]
      })
    ]);

    await expect(makeService(prisma).calculate('finance', 'user-1')).resolves.toMatchObject({
      permissionGroups: [{ key: 'finance.cashier', name: '出纳组' }],
      permissionPoints: [{ key: 'finance.payment.create', name: '创建付款' }],
      matchedRoles: [{ key: 'cashier', name: '出纳' }]
    });
  });

  it('多个角色命中同一权限组和权限点时去重', async () => {
    const prisma = makePrisma();
    mockActiveApplication(prisma);
    mockActiveUser(prisma);
    mockDirectDepartments(prisma, ['dept-1']);
    prisma.iamRole.findMany.mockResolvedValue([
      makeRole({
        key: 'role_a',
        name: '角色 A',
        subjects: [{ subjectType: 'feishu_user', subjectId: 'user-1' }],
        permissionGroups: [activeGroup('finance.shared', '共享组', [{ key: 'finance.shared.read', name: '共享查看' }])],
        permissionPoints: [activePoint('finance.shared.read', '共享查看')]
      }),
      makeRole({
        key: 'role_b',
        name: '角色 B',
        subjects: [{ subjectType: 'feishu_department', subjectId: 'dept-1' }],
        permissionGroups: [activeGroup('finance.shared', '共享组', [{ key: 'finance.shared.read', name: '共享查看' }])],
        permissionPoints: [activePoint('finance.shared.read', '共享查看')]
      })
    ]);

    const result = await makeService(prisma).calculate('finance', 'user-1');

    expect(result.permissionGroups).toEqual([{ key: 'finance.shared', name: '共享组' }]);
    expect(result.permissionPoints).toEqual([{ key: 'finance.shared.read', name: '共享查看' }]);
    expect(result.matchedRoles).toEqual([
      { key: 'role_a', name: '角色 A' },
      { key: 'role_b', name: '角色 B' }
    ]);
  });

  it('禁用应用返回 APPLICATION_DISABLED', async () => {
    const prisma = makePrisma();
    prisma.application.findUnique.mockResolvedValue({
      id: 'app-finance',
      appKey: 'finance',
      name: '财务系统',
      status: 'disabled'
    });

    await expect(makeService(prisma).calculate('finance', 'user-1')).rejects.toMatchObject({
      code: 'APPLICATION_DISABLED'
    });
  });

  it('应用不存在返回 APPLICATION_NOT_FOUND', async () => {
    const prisma = makePrisma();
    prisma.application.findUnique.mockResolvedValue(null);

    await expect(makeService(prisma).calculate('finance', 'user-1')).rejects.toMatchObject({
      code: 'APPLICATION_NOT_FOUND',
      status: 404
    });
  });

  it('非活跃或已删除用户返回 FEISHU_USER_NOT_ACTIVE', async () => {
    const inactivePrisma = makePrisma();
    mockActiveApplication(inactivePrisma);
    inactivePrisma.feishuUser.findFirst.mockResolvedValue({
      userId: 'user-1',
      isActive: false,
      isDeleted: false
    });

    await expect(makeService(inactivePrisma).calculate('finance', 'user-1')).rejects.toMatchObject({
      code: 'FEISHU_USER_NOT_ACTIVE'
    });

    const deletedPrisma = makePrisma();
    mockActiveApplication(deletedPrisma);
    deletedPrisma.feishuUser.findFirst.mockResolvedValue(null);

    await expect(makeService(deletedPrisma).calculate('finance', 'user-1')).rejects.toMatchObject({
      code: 'FEISHU_USER_NOT_ACTIVE'
    });
    expect(deletedPrisma.feishuUser.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        isDeleted: false
      }
    });
  });

  it('禁用角色、权限组、权限点不进入结果', async () => {
    const prisma = makePrisma();
    mockActiveApplication(prisma);
    mockActiveUser(prisma);
    mockDirectDepartments(prisma, []);
    prisma.iamRole.findMany.mockResolvedValue([
      makeRole({
        key: 'disabled_role',
        name: '禁用角色',
        status: 'disabled',
        subjects: [{ subjectType: 'feishu_user', subjectId: 'user-1' }],
        permissionGroups: [activeGroup('finance.disabled_role_group', '禁用角色权限组')],
        permissionPoints: [activePoint('finance.disabled_role_point', '禁用角色权限点')]
      }),
      makeRole({
        key: 'active_role',
        name: '启用角色',
        subjects: [{ subjectType: 'feishu_user', subjectId: 'user-1' }],
        permissionGroups: [
          {
            permissionGroup: {
              key: 'finance.disabled_group',
              name: '禁用权限组',
              status: 'disabled',
              permissionPoints: [activePoint('finance.from_disabled_group', '禁用组内权限点')]
            }
          },
          activeGroup('finance.active_group', '启用权限组', [
            { key: 'finance.disabled_point_in_group', name: '禁用组内权限点', status: 'disabled' },
            { key: 'finance.active_point_in_group', name: '启用组内权限点' }
          ])
        ],
        permissionPoints: [
          activePoint('finance.disabled_direct_point', '禁用直接权限点', 'disabled'),
          activePoint('finance.active_direct_point', '启用直接权限点')
        ]
      })
    ]);

    const result = await makeService(prisma).calculate('finance', 'user-1');

    expect(result.matchedRoles).toEqual([{ key: 'active_role', name: '启用角色' }]);
    expect(result.permissionGroups).toEqual([{ key: 'finance.active_group', name: '启用权限组' }]);
    expect(result.permissionPoints).toEqual([
      { key: 'finance.active_direct_point', name: '启用直接权限点' },
      { key: 'finance.active_point_in_group', name: '启用组内权限点' }
    ]);
  });

  it('orphaned 主体不参与计算', async () => {
    const prisma = makePrisma();
    mockActiveApplication(prisma);
    mockActiveUser(prisma);
    mockDirectDepartments(prisma, ['dept-1']);
    prisma.iamRole.findMany.mockResolvedValue([
      makeRole({
        key: 'orphaned_user_role',
        name: '孤儿用户角色',
        subjects: [{ subjectType: 'feishu_user', subjectId: 'user-1', isOrphaned: true }],
        permissionPoints: [activePoint('finance.orphaned_user', '孤儿用户权限点')]
      }),
      makeRole({
        key: 'orphaned_department_role',
        name: '孤儿部门角色',
        subjects: [{ subjectType: 'feishu_department', subjectId: 'dept-1', isOrphaned: true }],
        permissionPoints: [activePoint('finance.orphaned_department', '孤儿部门权限点')]
      })
    ]);

    const result = await makeService(prisma).calculate('finance', 'user-1');

    expect(result.matchedRoles).toEqual([]);
    expect(result.permissionGroups).toEqual([]);
    expect(result.permissionPoints).toEqual([]);
  });

  it('不向上递归父部门，只使用用户直接部门', async () => {
    const prisma = makePrisma();
    mockActiveApplication(prisma);
    mockActiveUser(prisma);
    mockDirectDepartments(prisma, ['child-dept']);
    prisma.iamRole.findMany.mockResolvedValue([
      makeRole({
        key: 'parent_department_role',
        name: '父部门角色',
        subjects: [{ subjectType: 'feishu_department', subjectId: 'parent-dept' }],
        permissionPoints: [activePoint('finance.parent_department', '父部门权限点')]
      }),
      makeRole({
        key: 'child_department_role',
        name: '子部门角色',
        subjects: [{ subjectType: 'feishu_department', subjectId: 'child-dept' }],
        permissionPoints: [activePoint('finance.child_department', '子部门权限点')]
      })
    ]);

    const result = await makeService(prisma).calculate('finance', 'user-1');

    expect(result.matchedRoles).toEqual([{ key: 'child_department_role', name: '子部门角色' }]);
    expect(result.permissionPoints).toEqual([{ key: 'finance.child_department', name: '子部门权限点' }]);
  });

  it('结果按 key 稳定排序', async () => {
    const prisma = makePrisma();
    mockActiveApplication(prisma);
    mockActiveUser(prisma);
    mockDirectDepartments(prisma, ['dept-1']);
    prisma.iamRole.findMany.mockResolvedValue([
      makeRole({
        key: 'z_role',
        name: 'Z 角色',
        subjects: [{ subjectType: 'feishu_department', subjectId: 'dept-1' }],
        permissionGroups: [activeGroup('finance.z_group', 'Z 权限组')],
        permissionPoints: [activePoint('finance.z_point', 'Z 权限点')]
      }),
      makeRole({
        key: 'a_role',
        name: 'A 角色',
        subjects: [{ subjectType: 'feishu_user', subjectId: 'user-1' }],
        permissionGroups: [activeGroup('finance.a_group', 'A 权限组')],
        permissionPoints: [activePoint('finance.a_point', 'A 权限点')]
      })
    ]);

    const result = await makeService(prisma).calculate('finance', 'user-1');

    expect(result.matchedRoles).toEqual([
      { key: 'a_role', name: 'A 角色' },
      { key: 'z_role', name: 'Z 角色' }
    ]);
    expect(result.permissionGroups).toEqual([
      { key: 'finance.a_group', name: 'A 权限组' },
      { key: 'finance.z_group', name: 'Z 权限组' }
    ]);
    expect(result.permissionPoints).toEqual([
      { key: 'finance.a_point', name: 'A 权限点' },
      { key: 'finance.z_point', name: 'Z 权限点' }
    ]);
  });
});
