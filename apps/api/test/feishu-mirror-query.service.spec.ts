import { describe, expect, it } from 'vitest';
import {
  FeishuMirrorQueryService,
  maskEmail,
  maskMobile
} from '../src/feishu/feishu-mirror-query.service';

const syncedAt = new Date('2026-05-27T08:00:00.000Z');

describe('FeishuMirrorQueryService', () => {
  it('脱敏邮箱和手机号', () => {
    expect(maskEmail('zhangsan@example.com')).toBe('z***n@example.com');
    expect(maskEmail('ab@example.com')).toBe('***@example.com');
    expect(maskEmail(null)).toBeNull();
    expect(maskMobile('13800138000')).toBe('138****8000');
    expect(maskMobile(null)).toBeNull();
  });

  it('查询用户列表时返回安全 DTO 且不暴露 rawPayload', async () => {
    const service = new FeishuMirrorQueryService(makePrisma() as never);

    const result = await service.listUsers({ keyword: '张三', page: 1, pageSize: 20 });

    expect(result).toMatchObject({
      page: 1,
      pageSize: 20,
      total: 1,
      items: [
        {
          userId: 'ou_zhangsan',
          name: '张三',
          emailMasked: 'z***n@example.com',
          mobileMasked: '138****8000',
          isActive: true,
          isDeleted: false,
          lastSyncedAt: syncedAt
        }
      ]
    });
    expect(JSON.stringify(result)).not.toContain('rawPayload');
  });

  it('查询用户详情时返回所属部门和登录资格，不暴露 rawPayload', async () => {
    const service = new FeishuMirrorQueryService(makePrisma() as never);

    const result = await service.getUser('ou_zhangsan');

    expect(result).toMatchObject({
      userId: 'ou_zhangsan',
      openId: 'ou-open',
      unionId: 'on-union',
      name: '张三',
      emailMasked: 'z***n@example.com',
      mobileMasked: '138****8000',
      loginEligible: true,
      loginBlockReason: null,
      departments: [
        {
          departmentId: 'D001',
          name: '销售部',
          isPrimary: true,
          isDeleted: false
        }
      ]
    });
    expect(JSON.stringify(result)).not.toContain('rawPayload');
  });

  it('查询部门详情时返回父部门、直属子部门和直属用户摘要', async () => {
    const service = new FeishuMirrorQueryService(makePrisma() as never);

    const result = await service.getDepartment('D001');

    expect(result).toMatchObject({
      departmentId: 'D001',
      name: '销售部',
      parent: {
        departmentId: '0',
        name: '根部门'
      },
      children: [
        {
          departmentId: 'D002',
          name: '华东销售'
        }
      ],
      users: [
        {
          userId: 'ou_zhangsan',
          name: '张三',
          emailMasked: 'z***n@example.com'
        }
      ]
    });
    expect(JSON.stringify(result)).not.toContain('rawPayload');
  });
});

function makePrisma() {
  const users = [
    {
      userId: 'ou_zhangsan',
      openId: 'ou-open',
      unionId: 'on-union',
      name: '张三',
      enName: 'Zhang San',
      email: 'zhangsan@example.com',
      mobile: '13800138000',
      mobileVisible: true,
      employeeNo: 'E001',
      employeeType: 1,
      jobTitle: '销售经理',
      leaderUserId: null,
      isActive: true,
      isDeleted: false,
      lastSyncedAt: syncedAt,
      rawPayload: { token: 'should-not-leak' },
      userDepartments: [
        {
          departmentId: 'D001',
          isPrimary: true,
          department: {
            departmentId: 'D001',
            name: '销售部',
            isDeleted: false
          }
        }
      ]
    }
  ];
  const departments = [
    {
      departmentId: '0',
      openDepartmentId: 'od-root',
      parentDepartmentId: null,
      name: '根部门',
      leaderUserId: null,
      isDeleted: false,
      lastSyncedAt: syncedAt,
      rawPayload: { secret: 'should-not-leak' }
    },
    {
      departmentId: 'D001',
      openDepartmentId: 'od-sales',
      parentDepartmentId: '0',
      name: '销售部',
      leaderUserId: 'ou_leader',
      isDeleted: false,
      lastSyncedAt: syncedAt,
      rawPayload: { secret: 'should-not-leak' }
    },
    {
      departmentId: 'D002',
      openDepartmentId: 'od-east',
      parentDepartmentId: 'D001',
      name: '华东销售',
      leaderUserId: null,
      isDeleted: false,
      lastSyncedAt: syncedAt,
      rawPayload: { secret: 'should-not-leak' }
    }
  ];

  return {
    feishuUser: {
      count: () => Promise.resolve(users.length),
      findMany: () => Promise.resolve(users),
      findUnique: ({ where }: { where: { userId: string } }) =>
        Promise.resolve(users.find((user) => user.userId === where.userId) ?? null)
    },
    feishuDepartment: {
      count: () => Promise.resolve(departments.length),
      findMany: ({ where }: { where?: { parentDepartmentId?: string } } = {}) =>
        Promise.resolve(
          where && 'parentDepartmentId' in where
            ? departments.filter((department) => department.parentDepartmentId === where.parentDepartmentId)
            : departments
        ),
      findUnique: ({ where }: { where: { departmentId: string } }) =>
        Promise.resolve(departments.find((department) => department.departmentId === where.departmentId) ?? null)
    },
    feishuUserDepartment: {
      findMany: () =>
        Promise.resolve([
          {
            userId: 'ou_zhangsan',
            departmentId: 'D001',
            isPrimary: true,
            user: users[0]
          }
        ])
    }
  };
}
