import { describe, expect, it, vi } from 'vitest';
import { ApplicationService } from '../src/permission/application.service';
import { IamRoleService } from '../src/permission/iam-role.service';

type PrismaMock = ReturnType<typeof makePrisma>;
type AuditMock = ReturnType<typeof makeAudit>;

function makePrisma() {
  const prisma = {
    application: {
      findUnique: vi.fn()
    },
    iamRole: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn()
    },
    iamRoleApplication: {
      create: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn()
    },
    iamRoleSubject: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn()
    },
    iamRolePermissionGroup: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn()
    },
    iamRolePermissionPoint: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn()
    },
    permissionGroup: {
      findMany: vi.fn()
    },
    permissionPoint: {
      findMany: vi.fn()
    },
    feishuUser: {
      findFirst: vi.fn(),
      findMany: vi.fn()
    },
    feishuDepartment: {
      findFirst: vi.fn(),
      findMany: vi.fn()
    },
    auditLog: {
      create: vi.fn()
    },
    $transaction: vi.fn()
  };

  prisma.$transaction.mockImplementation((operation: unknown) => {
    if (typeof operation === 'function') {
      return (operation as (tx: typeof prisma) => Promise<unknown>)(prisma);
    }

    return Promise.resolve(operation);
  });
  prisma.iamRoleSubject.findMany.mockResolvedValue([]);
  prisma.iamRolePermissionGroup.findMany.mockResolvedValue([]);
  prisma.iamRolePermissionPoint.findMany.mockResolvedValue([]);
  prisma.feishuUser.findMany.mockResolvedValue([]);
  prisma.feishuDepartment.findMany.mockResolvedValue([]);

  return prisma;
}

function makeAudit() {
  return {
    record: vi.fn().mockResolvedValue(undefined)
  };
}

function makeService(prisma: PrismaMock = makePrisma(), audit: AuditMock = makeAudit()) {
  const applicationService = new ApplicationService(prisma as never, audit as never);
  return new IamRoleService(prisma as never, applicationService, audit as never);
}

function mockApplication(prisma: PrismaMock, applicationId = 'app-finance') {
  prisma.application.findUnique.mockResolvedValue({
    id: applicationId,
    appKey: 'finance',
    name: '财务系统'
  });
}

function mockRole(prisma: PrismaMock, applicationId = 'app-finance') {
  prisma.iamRole.findFirst.mockResolvedValue({
    id: 'role-1',
    key: 'invoice_manager',
    name: '发票管理员',
    status: 'active',
    applications: [
      {
        applicationId
      }
    ]
  });
}

describe('IamRoleService', () => {
  it('创建角色时校验角色 key', async () => {
    const service = makeService();

    await expect(
      service.createRole('finance', {
        key: 'Invoice Manager',
        name: '发票管理员'
      })
    ).rejects.toMatchObject({ code: 'IAM_ROLE_KEY_INVALID' });
  });

  it('创建全局角色后绑定当前应用，并记录审计', async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    mockApplication(prisma);
    const created = {
      id: 'role-1',
      key: 'invoice_manager',
      name: '发票管理员',
      description: '管理发票权限',
      status: 'active'
    };
    prisma.iamRole.create.mockResolvedValue(created);
    const service = makeService(prisma, audit);

    await expect(
      service.createRole('finance', {
        key: 'invoice_manager',
        name: '发票管理员',
        description: '管理发票权限'
      })
    ).resolves.toBe(created);

    expect(prisma.iamRole.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: expect.any(String) as unknown,
        key: 'invoice_manager',
        name: '发票管理员',
        description: '管理发票权限'
      }) as unknown
    });
    expect(prisma.iamRoleApplication.create).toHaveBeenCalledWith({
      data: {
        iamRoleId: 'role-1',
        applicationId: 'app-finance',
        status: 'active'
      }
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        applicationId: 'app-finance',
        resourceType: 'iam_role',
        resourceId: 'role-1',
        action: 'create',
        after: expect.objectContaining({
          ...created,
          appKey: 'finance'
        }) as unknown,
        result: 'success'
      }),
      prisma
    );
  });

  it('创建角色传入审计上下文时使用上下文 actor 而不是系统 actor', async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    mockApplication(prisma);
    const created = {
      id: 'role-1',
      key: 'invoice_manager',
      name: '发票管理员',
      description: null,
      status: 'active'
    };
    prisma.iamRole.create.mockResolvedValue(created);
    const service = makeService(prisma, audit);

    await service.createRole(
      'finance',
      {
        key: 'invoice_manager',
        name: '发票管理员'
      },
      {
        actorType: 'admin_user',
        actorId: 'admin-platform',
        source: 'admin_web',
        requestId: 'req-admin-role',
        ip: '127.0.0.1',
        userAgent: 'vitest'
      }
    );

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorType: 'admin_user',
        actorId: 'admin-platform',
        source: 'admin_web',
        requestId: 'req-admin-role',
        applicationId: 'app-finance',
        resourceType: 'iam_role',
        resourceId: 'role-1',
        action: 'create'
      }),
      prisma
    );
  });

  it('listRoles 返回角色绑定的权限组 ID、权限组详情和成员详情', async () => {
    const prisma = makePrisma();
    mockApplication(prisma);
    prisma.iamRole.findMany.mockResolvedValue([
      {
        id: 'role-1',
        key: 'finance.admin',
        name: '财务管理员',
        description: null,
        status: 'active',
        createdAt: new Date('2026-05-20T00:00:00.000Z'),
        updatedAt: new Date('2026-05-20T00:00:00.000Z'),
        applications: [
          {
            applicationId: 'app-finance',
            status: 'active',
            application: {
              id: 'app-finance',
              appKey: 'finance',
              name: '财务系统',
              status: 'active'
            }
          },
          {
            applicationId: 'app-hr',
            status: 'active',
            application: {
              id: 'app-hr',
              appKey: 'hr',
              name: 'HR 系统',
              status: 'active'
            }
          }
        ],
        permissionGroups: [
          {
            permissionGroupId: 'group-finance-admin',
            permissionGroup: {
              id: 'group-finance-admin',
              applicationId: 'app-finance',
              key: 'finance.admin',
              name: '财务管理权限组',
              description: null,
              status: 'active',
              createdAt: new Date('2026-05-20T00:00:00.000Z'),
              updatedAt: new Date('2026-05-20T00:00:00.000Z'),
              permissionPoints: [
                {
                  permissionPointId: 'point-invoice-read',
                  permissionPoint: {
                    id: 'point-invoice-read',
                    applicationId: 'app-finance',
                    key: 'finance.invoice.read',
                    name: '查看发票',
                    description: null,
                    status: 'active',
                    createdAt: new Date('2026-05-20T00:00:00.000Z'),
                    updatedAt: new Date('2026-05-20T00:00:00.000Z')
                  }
                }
              ]
            }
          }
        ],
        permissionPoints: [
          {
            permissionPointId: 'point-invoice-export',
            permissionPoint: {
              id: 'point-invoice-export',
              applicationId: 'app-finance',
              key: 'finance.invoice.export',
              name: '导出发票',
              description: null,
              status: 'active',
              createdAt: new Date('2026-05-20T00:00:00.000Z'),
              updatedAt: new Date('2026-05-20T00:00:00.000Z')
            }
          }
        ],
        subjects: [
          {
            subjectType: 'feishu_department',
            subjectId: 'od-finance',
            isOrphaned: false
          },
          {
            subjectType: 'feishu_user',
            subjectId: 'ou-missing',
            isOrphaned: true
          }
        ]
      }
    ]);
    prisma.feishuDepartment.findMany
      .mockResolvedValueOnce([
        {
          departmentId: 'od-finance',
          name: '财务部',
          parentDepartmentId: 'od-root'
        }
      ])
      .mockResolvedValueOnce([
        {
          departmentId: 'od-root',
          name: '唐群座椅',
          parentDepartmentId: null
        },
        {
          departmentId: 'od-finance',
          name: '财务部',
          parentDepartmentId: 'od-root'
        }
      ]);
    prisma.feishuUser.findMany.mockResolvedValue([
      {
        userId: 'ou-missing',
        name: '张三',
        userDepartments: [
          {
            departmentId: 'od-finance',
            isPrimary: true,
            isDeleted: false,
            department: {
              departmentId: 'od-finance',
              name: '财务部',
              parentDepartmentId: 'od-root'
            }
          }
        ]
      }
    ]);
    const service = makeService(prisma);

    await expect(service.listRoles('finance')).resolves.toEqual([
      expect.objectContaining({
        id: 'role-1',
        applicationIds: ['app-finance', 'app-hr'],
        appKeys: ['finance', 'hr'],
        applications: [
          expect.objectContaining({
            applicationId: 'app-finance',
            appKey: 'finance',
            name: '财务系统',
            bindingStatus: 'active'
          }),
          expect.objectContaining({
            applicationId: 'app-hr',
            appKey: 'hr',
            name: 'HR 系统',
            bindingStatus: 'active'
          })
        ],
        permissionGroupIds: ['group-finance-admin'],
        permissionGroups: [
          expect.objectContaining({
            id: 'group-finance-admin',
            key: 'finance.admin',
            permissionPoints: [
              expect.objectContaining({
                key: 'finance.invoice.read',
                name: '查看发票'
              })
            ]
          })
        ],
        permissionPoints: [
          expect.objectContaining({
            key: 'finance.invoice.export',
            name: '导出发票'
          })
        ],
        subjects: [
          {
            type: 'feishu_department',
            id: 'od-finance',
            isOrphaned: false,
            displayName: '财务部',
            avatarLabel: '财',
            subjectKindLabel: '组织',
            displayPath: '唐群座椅 / 财务部'
          },
          {
            type: 'feishu_user',
            id: 'ou-missing',
            isOrphaned: true,
            displayName: '张三',
            avatarLabel: '张',
            subjectKindLabel: '用户',
            displayPath: '唐群座椅 / 财务部'
          }
        ]
      })
    ]);

    expect(prisma.iamRole.findMany).toHaveBeenCalledWith({
      where: {
        applications: {
          some: {
            applicationId: 'app-finance',
            status: 'active'
          }
        }
      },
      include: {
        applications: {
          include: {
            application: true
          },
          orderBy: {
            applicationId: 'asc'
          }
        },
        permissionGroups: {
          where: {
            applicationId: 'app-finance'
          },
          include: {
            permissionGroup: {
              include: {
                permissionPoints: {
                  include: {
                    permissionPoint: true
                  },
                  orderBy: {
                    permissionPointId: 'asc'
                  }
                }
              }
            }
          },
          orderBy: {
            permissionGroupId: 'asc'
          }
        },
        permissionPoints: {
          where: {
            applicationId: 'app-finance'
          },
          include: {
            permissionPoint: true
          },
          orderBy: {
            permissionPointId: 'asc'
          }
        },
        subjects: {
          orderBy: [
            { subjectType: 'asc' },
            { subjectId: 'asc' }
          ]
        }
      },
      orderBy: {
        key: 'asc'
      }
    });
  });

  it('updateRole 显式 data 白名单，不透传 id/applicationId/status 等额外字段', async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    mockApplication(prisma);
    mockRole(prisma);
    prisma.iamRole.update.mockResolvedValue({
      id: 'role-1',
      key: 'invoice_manager',
      name: '发票管理员 V2',
      description: null,
      status: 'active'
    });
    const service = makeService(prisma, audit);

    await service.updateRole(
      'finance',
      'role-1',
      {
        id: 'evil',
        applicationId: 'evil-app',
        key: 'another_key',
        name: '发票管理员 V2',
        status: 'disabled'
      } as never
    );

    expect(prisma.iamRole.update).toHaveBeenCalledWith({
      where: {
        id: 'role-1'
      },
      data: {
        name: '发票管理员 V2'
      }
    });
  });

  it('setRoleStatus 写审计且业务写和审计同一 transaction', async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    mockApplication(prisma);
    mockRole(prisma);
    prisma.iamRole.update.mockResolvedValue({
      id: 'role-1',
      key: 'invoice_manager',
      status: 'disabled'
    });
    const service = makeService(prisma, audit);

    await service.setRoleStatus('finance', 'role-1', 'disabled');

    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function));
    expect(prisma.iamRole.update).toHaveBeenCalledWith({
      where: {
        id: 'role-1'
      },
      data: {
        status: 'disabled'
      }
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        applicationId: 'app-finance',
        resourceType: 'iam_role',
        resourceId: 'role-1',
        action: 'set_status',
        before: expect.objectContaining({ status: 'active' }) as unknown,
        after: expect.objectContaining({ status: 'disabled' }) as unknown,
        result: 'success'
      }),
      prisma
    );
  });

  it('bindRoleToApplication 把已有全局角色绑定到当前应用并记录审计', async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    mockApplication(prisma);
    prisma.iamRole.findFirst.mockResolvedValue({
      id: 'role-1',
      key: 'invoice_manager',
      name: '发票管理员',
      description: null,
      status: 'active'
    });
    prisma.iamRoleApplication.findUnique.mockResolvedValue({
      iamRoleId: 'role-1',
      applicationId: 'app-finance',
      status: 'disabled'
    });
    const service = makeService(prisma, audit);

    await expect(service.bindRoleToApplication('finance', 'role-1')).resolves.toEqual(
      expect.objectContaining({ id: 'role-1' })
    );

    expect(prisma.iamRole.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'role-1'
      }
    });
    expect(prisma.iamRoleApplication.upsert).toHaveBeenCalledWith({
      where: {
        iamRoleId_applicationId: {
          iamRoleId: 'role-1',
          applicationId: 'app-finance'
        }
      },
      create: {
        iamRoleId: 'role-1',
        applicationId: 'app-finance',
        status: 'active'
      },
      update: {
        status: 'active'
      }
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        applicationId: 'app-finance',
        resourceType: 'iam_role',
        resourceId: 'role-1',
        action: 'bind_application',
        before: {
          applicationId: 'app-finance',
          bindingStatus: 'disabled'
        },
        after: {
          applicationId: 'app-finance',
          bindingStatus: 'active'
        },
        result: 'success'
      }),
      prisma
    );
  });

  it('bindRoleToApplication 找不到全局角色时返回 IAM_ROLE_NOT_FOUND', async () => {
    const prisma = makePrisma();
    mockApplication(prisma);
    prisma.iamRole.findFirst.mockResolvedValue(null);
    const service = makeService(prisma);

    await expect(service.bindRoleToApplication('finance', 'role-missing')).rejects.toMatchObject({
      code: 'IAM_ROLE_NOT_FOUND',
      status: 404
    });
    expect(prisma.iamRoleApplication.upsert).not.toHaveBeenCalled();
  });

  it('setRoleApplicationBindingStatus 停用已有绑定并记录审计', async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    mockApplication(prisma);
    prisma.iamRole.findFirst.mockResolvedValue({
      id: 'role-1',
      key: 'invoice_manager',
      name: '发票管理员',
      status: 'active'
    });
    prisma.iamRoleApplication.findUnique.mockResolvedValue({
      iamRoleId: 'role-1',
      applicationId: 'app-finance',
      status: 'active'
    });
    const service = makeService(prisma, audit);

    await expect(
      service.setRoleApplicationBindingStatus('finance', 'role-1', 'disabled')
    ).resolves.toEqual(expect.objectContaining({ id: 'role-1' }));

    expect(prisma.iamRoleApplication.upsert).toHaveBeenCalledWith({
      where: {
        iamRoleId_applicationId: {
          iamRoleId: 'role-1',
          applicationId: 'app-finance'
        }
      },
      create: {
        iamRoleId: 'role-1',
        applicationId: 'app-finance',
        status: 'disabled'
      },
      update: {
        status: 'disabled'
      }
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        applicationId: 'app-finance',
        resourceType: 'iam_role',
        resourceId: 'role-1',
        action: 'set_application_binding_status',
        before: {
          applicationId: 'app-finance',
          bindingStatus: 'active'
        },
        after: {
          applicationId: 'app-finance',
          bindingStatus: 'disabled'
        },
        result: 'success'
      }),
      prisma
    );
  });

  it('setRoleApplicationBindingStatus 停用不存在的绑定时返回 404', async () => {
    const prisma = makePrisma();
    mockApplication(prisma);
    prisma.iamRole.findFirst.mockResolvedValue({
      id: 'role-1',
      key: 'invoice_manager',
      name: '发票管理员',
      status: 'active'
    });
    prisma.iamRoleApplication.findUnique.mockResolvedValue(null);
    const service = makeService(prisma);

    await expect(
      service.setRoleApplicationBindingStatus('finance', 'role-1', 'disabled')
    ).rejects.toMatchObject({
      code: 'IAM_ROLE_APPLICATION_BINDING_NOT_FOUND',
      status: 404
    });
    expect(prisma.iamRoleApplication.upsert).not.toHaveBeenCalled();
  });

  it('replaceRoleSubjects 只接受 feishu_user 和 feishu_department', async () => {
    const service = makeService();

    await expect(
      service.replaceRoleSubjects('finance', 'role-1', [
        {
          type: 'feishu_group',
          id: 'group-1'
        } as never
      ])
    ).rejects.toMatchObject({
      code: 'IAM_SUBJECT_TYPE_INVALID',
      status: 422
    });
  });

  it('replaceRoleSubjects 绑定不存在或已删除主体时标记 orphaned，存在且未删除时为 false', async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    mockApplication(prisma);
    mockRole(prisma);
    prisma.feishuUser.findMany.mockResolvedValue([{ userId: 'ou_active' }]);
    prisma.feishuDepartment.findMany.mockResolvedValue([{ departmentId: 'dept_active' }]);
    const service = makeService(prisma, audit);

    await service.replaceRoleSubjects('finance', 'role-1', [
      { type: 'feishu_user', id: 'ou_active' },
      { type: 'feishu_user', id: 'ou_deleted' },
      { type: 'feishu_department', id: 'dept_active' },
      { type: 'feishu_department', id: 'dept_missing' }
    ]);

    expect(prisma.feishuUser.findMany).toHaveBeenCalledWith({
      where: {
        userId: {
          in: ['ou_active', 'ou_deleted']
        },
        isDeleted: false
      },
      select: {
        userId: true
      }
    });
    expect(prisma.feishuDepartment.findMany).toHaveBeenCalledWith({
      where: {
        departmentId: {
          in: ['dept_active', 'dept_missing']
        },
        isDeleted: false
      },
      select: {
        departmentId: true
      }
    });
    expect(prisma.iamRoleSubject.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          iamRoleId: 'role-1',
          subjectType: 'feishu_user',
          subjectId: 'ou_active',
          isOrphaned: false
        }),
        expect.objectContaining({
          iamRoleId: 'role-1',
          subjectType: 'feishu_user',
          subjectId: 'ou_deleted',
          isOrphaned: true
        }),
        expect.objectContaining({
          iamRoleId: 'role-1',
          subjectType: 'feishu_department',
          subjectId: 'dept_active',
          isOrphaned: false
        }),
        expect.objectContaining({
          iamRoleId: 'role-1',
          subjectType: 'feishu_department',
          subjectId: 'dept_missing',
          isOrphaned: true
        })
      ],
      skipDuplicates: true
    });
  });

  it('replaceRoleSubjects 使用 transaction deleteMany + createMany + audit', async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    mockApplication(prisma);
    mockRole(prisma);
    prisma.iamRoleSubject.findMany.mockResolvedValue([
      {
        subjectType: 'feishu_user',
        subjectId: 'ou_old',
        isOrphaned: false
      },
      {
        subjectType: 'feishu_department',
        subjectId: 'dept_deleted',
        isOrphaned: true
      }
    ]);
    prisma.feishuUser.findMany.mockResolvedValue([{ userId: 'ou_active' }]);
    prisma.feishuDepartment.findMany.mockResolvedValue([]);
    const service = makeService(prisma, audit);

    await service.replaceRoleSubjects('finance', 'role-1', [{ type: 'feishu_user', id: 'ou_active' }]);

    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function));
    expect(prisma.iamRoleSubject.findMany).toHaveBeenCalledWith({
      where: {
        iamRoleId: 'role-1'
      },
      orderBy: [
        { subjectType: 'asc' },
        { subjectId: 'asc' }
      ]
    });
    expect(prisma.iamRoleSubject.deleteMany).toHaveBeenCalledWith({
      where: {
        iamRoleId: 'role-1'
      }
    });
    expect(prisma.iamRoleSubject.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          id: expect.any(String) as unknown,
          iamRoleId: 'role-1',
          subjectType: 'feishu_user',
          subjectId: 'ou_active',
          isOrphaned: false
        })
      ],
      skipDuplicates: true
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        applicationId: 'app-finance',
        resourceType: 'iam_role',
        resourceId: 'role-1',
        action: 'replace_subjects',
        before: {
          subjects: [
            {
              type: 'feishu_user',
              id: 'ou_old',
              isOrphaned: false
            },
            {
              type: 'feishu_department',
              id: 'dept_deleted',
              isOrphaned: true
            }
          ]
        },
        after: {
          subjects: [
            {
              type: 'feishu_user',
              id: 'ou_active',
              isOrphaned: false
            }
          ]
        },
        result: 'success'
      }),
      prisma
    );
  });

  it('replaceRolePermissionGroups 跨应用抛 CROSS_APPLICATION_BINDING_FORBIDDEN，同应用写入 applicationId 并同事务审计', async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    mockApplication(prisma);
    mockRole(prisma);
    prisma.permissionGroup.findMany.mockResolvedValue([
      {
        id: 'group-1',
        applicationId: 'app-finance',
        key: 'finance.invoice_manager'
      },
      {
        id: 'group-2',
        applicationId: 'app-other',
        key: 'crm.customer_manager'
      }
    ]);
    const service = makeService(prisma, audit);

    await expect(
      service.replaceRolePermissionGroups('finance', 'role-1', ['group-1', 'group-2'])
    ).rejects.toMatchObject({
      code: 'CROSS_APPLICATION_BINDING_FORBIDDEN',
      status: 422
    });
    expect(prisma.iamRolePermissionGroup.createMany).not.toHaveBeenCalled();

    prisma.iamRolePermissionGroup.findMany.mockResolvedValue([
      {
        permissionGroupId: 'group-old'
      }
    ]);
    prisma.permissionGroup.findMany.mockResolvedValue([
      {
        id: 'group-1',
        applicationId: 'app-finance',
        key: 'finance.invoice_manager'
      }
    ]);

    await service.replaceRolePermissionGroups('finance', 'role-1', ['group-1']);

    expect(prisma.iamRolePermissionGroup.findMany).toHaveBeenLastCalledWith({
      where: {
        applicationId: 'app-finance',
        iamRoleId: 'role-1'
      },
      orderBy: {
        permissionGroupId: 'asc'
      }
    });
    expect(prisma.iamRolePermissionGroup.deleteMany).toHaveBeenCalledWith({
      where: {
        applicationId: 'app-finance',
        iamRoleId: 'role-1'
      }
    });
    expect(prisma.iamRolePermissionGroup.createMany).toHaveBeenCalledWith({
      data: [
        {
          applicationId: 'app-finance',
          iamRoleId: 'role-1',
          permissionGroupId: 'group-1'
        }
      ],
      skipDuplicates: true
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        applicationId: 'app-finance',
        resourceType: 'iam_role',
        resourceId: 'role-1',
        action: 'replace_permission_groups',
        before: { permissionGroupIds: ['group-old'] },
        after: { permissionGroupIds: ['group-1'] },
        result: 'success'
      }),
      prisma
    );
  });

  it('replaceRolePermissionGroups 对已软解除的应用绑定返回 IAM_ROLE_NOT_FOUND', async () => {
    const prisma = makePrisma();
    mockApplication(prisma);
    prisma.iamRole.findFirst.mockResolvedValue(null);
    const service = makeService(prisma);

    await expect(
      service.replaceRolePermissionGroups('finance', 'role-1', ['group-1'])
    ).rejects.toMatchObject({
      code: 'IAM_ROLE_NOT_FOUND',
      status: 404
    });
    expect(prisma.iamRole.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'role-1',
        applications: {
          some: {
            applicationId: 'app-finance',
            status: 'active'
          }
        }
      }
    });
    expect(prisma.iamRolePermissionGroup.deleteMany).not.toHaveBeenCalled();
  });

  it('replaceRolePermissionPoints 跨应用抛 CROSS_APPLICATION_BINDING_FORBIDDEN，同应用写入 applicationId 并同事务审计', async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    mockApplication(prisma);
    mockRole(prisma);
    prisma.permissionPoint.findMany.mockResolvedValue([
      {
        id: 'point-1',
        applicationId: 'app-finance',
        key: 'finance.invoice.read'
      },
      {
        id: 'point-2',
        applicationId: 'app-other',
        key: 'crm.customer.read'
      }
    ]);
    const service = makeService(prisma, audit);

    await expect(
      service.replaceRolePermissionPoints('finance', 'role-1', ['point-1', 'point-2'])
    ).rejects.toMatchObject({
      code: 'CROSS_APPLICATION_BINDING_FORBIDDEN',
      status: 422
    });
    expect(prisma.iamRolePermissionPoint.createMany).not.toHaveBeenCalled();

    prisma.iamRolePermissionPoint.findMany.mockResolvedValue([
      {
        permissionPointId: 'point-old'
      }
    ]);
    prisma.permissionPoint.findMany.mockResolvedValue([
      {
        id: 'point-1',
        applicationId: 'app-finance',
        key: 'finance.invoice.read'
      }
    ]);

    await service.replaceRolePermissionPoints('finance', 'role-1', ['point-1']);

    expect(prisma.iamRolePermissionPoint.findMany).toHaveBeenLastCalledWith({
      where: {
        applicationId: 'app-finance',
        iamRoleId: 'role-1'
      },
      orderBy: {
        permissionPointId: 'asc'
      }
    });
    expect(prisma.iamRolePermissionPoint.deleteMany).toHaveBeenCalledWith({
      where: {
        applicationId: 'app-finance',
        iamRoleId: 'role-1'
      }
    });
    expect(prisma.iamRolePermissionPoint.createMany).toHaveBeenCalledWith({
      data: [
        {
          applicationId: 'app-finance',
          iamRoleId: 'role-1',
          permissionPointId: 'point-1'
        }
      ],
      skipDuplicates: true
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        applicationId: 'app-finance',
        resourceType: 'iam_role',
        resourceId: 'role-1',
        action: 'replace_permission_points',
        before: { permissionPointIds: ['point-old'] },
        after: { permissionPointIds: ['point-1'] },
        result: 'success'
      }),
      prisma
    );
  });

  it('重复 subject/group/point 输入稳定拒绝', async () => {
    const service = makeService();

    await expect(
      service.replaceRoleSubjects('finance', 'role-1', [
        { type: 'feishu_user', id: 'ou_1' },
        { type: 'feishu_user', id: 'ou_1' }
      ])
    ).rejects.toMatchObject({
      code: 'IAM_ROLE_SUBJECT_DUPLICATED',
      status: 422
    });

    await expect(
      service.replaceRolePermissionGroups('finance', 'role-1', ['group-1', 'group-1'])
    ).rejects.toMatchObject({
      code: 'PERMISSION_GROUP_DUPLICATED',
      status: 422
    });

    await expect(
      service.replaceRolePermissionPoints('finance', 'role-1', ['point-1', 'point-1'])
    ).rejects.toMatchObject({
      code: 'PERMISSION_POINT_DUPLICATED',
      status: 422
    });
  });

  it('空数组替换表示清空绑定并记录审计', async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    mockApplication(prisma);
    mockRole(prisma);
    prisma.permissionGroup.findMany.mockResolvedValue([]);
    prisma.permissionPoint.findMany.mockResolvedValue([]);
    const service = makeService(prisma, audit);

    await service.replaceRoleSubjects('finance', 'role-1', []);
    await service.replaceRolePermissionGroups('finance', 'role-1', []);
    await service.replaceRolePermissionPoints('finance', 'role-1', []);

    expect(prisma.iamRoleSubject.deleteMany).toHaveBeenCalledWith({
      where: {
        iamRoleId: 'role-1'
      }
    });
    expect(prisma.iamRoleSubject.createMany).toHaveBeenCalledWith({
      data: [],
      skipDuplicates: true
    });
    expect(prisma.iamRolePermissionGroup.createMany).toHaveBeenCalledWith({
      data: [],
      skipDuplicates: true
    });
    expect(prisma.iamRolePermissionPoint.createMany).toHaveBeenCalledWith({
      data: [],
      skipDuplicates: true
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'replace_subjects',
        after: { subjects: [] }
      }),
      prisma
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'replace_permission_groups',
        after: { permissionGroupIds: [] }
      }),
      prisma
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'replace_permission_points',
        after: { permissionPointIds: [] }
      }),
      prisma
    );
  });
});
