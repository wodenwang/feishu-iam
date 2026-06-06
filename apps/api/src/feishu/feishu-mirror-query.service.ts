import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { FeishuDepartment, FeishuUser, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type PageInput = {
  page?: number;
  pageSize?: number;
};

export type PageResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

export type FeishuMirrorUserSummary = {
  userId: string;
  name: string;
  emailMasked: string | null;
  mobileMasked: string | null;
  isActive: boolean;
  isDeleted: boolean;
  lastSyncedAt: Date;
};

export type FeishuMirrorDepartmentSummary = {
  departmentId: string;
  openDepartmentId: string | null;
  parentDepartmentId: string | null;
  name: string;
  isDeleted: boolean;
  lastSyncedAt: Date;
};

@Injectable()
export class FeishuMirrorQueryService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listUsers(
    input: PageInput & { keyword?: string; departmentId?: string }
  ): Promise<PageResult<FeishuMirrorUserSummary>> {
    const { page, pageSize, skip, take } = normalizePage(input);
    const keyword = normalizeKeyword(input.keyword);
    const where: Prisma.FeishuUserWhereInput = {
      ...(keyword
        ? {
            OR: [
              { userId: { contains: keyword, mode: 'insensitive' } },
              { name: { contains: keyword, mode: 'insensitive' } },
              { email: { contains: keyword, mode: 'insensitive' } }
            ]
          }
        : {}),
      ...(input.departmentId
        ? {
            userDepartments: {
              some: {
                departmentId: input.departmentId,
                isDeleted: false
              }
            }
          }
        : {})
    };

    const [total, users] = await Promise.all([
      this.prisma.feishuUser.count({ where }),
      this.prisma.feishuUser.findMany({
        where,
        orderBy: [{ isDeleted: 'asc' }, { name: 'asc' }],
        skip,
        take,
        select: {
          userId: true,
          name: true,
          email: true,
          mobile: true,
          isActive: true,
          isDeleted: true,
          lastSyncedAt: true
        }
      })
    ]);

    return {
      items: users.map(toUserSummary),
      page,
      pageSize,
      total
    };
  }

  async getUser(userId: string) {
    const user = await this.prisma.feishuUser.findUnique({
      where: { userId },
      include: {
        userDepartments: {
          where: { isDeleted: false },
          include: {
            department: true
          },
          orderBy: [{ isPrimary: 'desc' }, { departmentId: 'asc' }]
        }
      }
    });

    if (!user) {
      throw new NotFoundException({
        error: {
          code: 'FEISHU_USER_NOT_FOUND',
          message: '飞书用户不存在'
        }
      });
    }

    return {
      ...toUserSummary(user),
      openId: user.openId,
      unionId: user.unionId,
      enName: user.enName,
      employeeNo: user.employeeNo,
      employeeType: user.employeeType,
      jobTitle: user.jobTitle,
      leaderUserId: user.leaderUserId,
      loginEligible: user.isActive && !user.isDeleted,
      loginBlockReason: user.isActive && !user.isDeleted ? null : '该用户在本地镜像中不可登录',
      departments: user.userDepartments.map((relation) => ({
        departmentId: relation.departmentId,
        name: relation.department.name,
        isPrimary: relation.isPrimary,
        isDeleted: relation.department.isDeleted
      }))
    };
  }

  async listDepartments(
    input: PageInput & { keyword?: string; parentDepartmentId?: string | null }
  ): Promise<PageResult<FeishuMirrorDepartmentSummary>> {
    const { page, pageSize, skip, take } = normalizePage(input);
    const keyword = normalizeKeyword(input.keyword);
    const where = buildDepartmentWhere(keyword, input.parentDepartmentId);

    const [total, departments] = await Promise.all([
      this.prisma.feishuDepartment.count({ where }),
      this.prisma.feishuDepartment.findMany({
        where,
        orderBy: [{ isDeleted: 'asc' }, { name: 'asc' }],
        skip,
        take,
        select: {
          departmentId: true,
          openDepartmentId: true,
          parentDepartmentId: true,
          name: true,
          isDeleted: true,
          lastSyncedAt: true
        }
      })
    ]);

    return {
      items: departments.map(toDepartmentSummary),
      page,
      pageSize,
      total
    };
  }

  async getDepartment(departmentId: string) {
    const department = await this.prisma.feishuDepartment.findUnique({
      where: { departmentId }
    });

    if (!department) {
      throw new NotFoundException({
        error: {
          code: 'FEISHU_DEPARTMENT_NOT_FOUND',
          message: '飞书部门不存在'
        }
      });
    }

    const [parent, children, userRelations] = await Promise.all([
      department.parentDepartmentId
        ? this.prisma.feishuDepartment.findUnique({ where: { departmentId: department.parentDepartmentId } })
        : Promise.resolve(null),
      this.prisma.feishuDepartment.findMany({
        where: {
          parentDepartmentId: department.departmentId
        },
        orderBy: [{ isDeleted: 'asc' }, { name: 'asc' }],
        take: 50
      }),
      this.prisma.feishuUserDepartment.findMany({
        where: {
          departmentId: department.departmentId,
          isDeleted: false
        },
        include: {
          user: true
        },
        orderBy: [{ isPrimary: 'desc' }, { userId: 'asc' }],
        take: 50
      })
    ]);

    return {
      ...toDepartmentSummary(department),
      leaderUserId: department.leaderUserId,
      parent: parent ? toDepartmentSummary(parent) : null,
      children: children.map(toDepartmentSummary),
      users: userRelations.map((relation) => ({
        ...toUserSummary(relation.user),
        isPrimary: relation.isPrimary
      }))
    };
  }
}

export function maskEmail(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const [rawLocal, rawDomain] = value.split('@');
  const local = rawLocal ?? '';
  const domain = rawDomain ?? 'unknown';
  if (!domain || local.length <= 2) {
    return `***@${domain}`;
  }

  return `${local.charAt(0)}***${local.charAt(local.length - 1)}@${domain}`;
}

export function maskMobile(value: string | null): string | null {
  if (!value) {
    return null;
  }

  return value.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2');
}

function toUserSummary(
  user: Pick<FeishuUser, 'userId' | 'name' | 'email' | 'mobile' | 'isActive' | 'isDeleted' | 'lastSyncedAt'>
): FeishuMirrorUserSummary {
  return {
    userId: user.userId,
    name: user.name,
    emailMasked: maskEmail(user.email),
    mobileMasked: maskMobile(user.mobile),
    isActive: user.isActive,
    isDeleted: user.isDeleted,
    lastSyncedAt: user.lastSyncedAt
  };
}

function toDepartmentSummary(
  department: Pick<
    FeishuDepartment,
    'departmentId' | 'openDepartmentId' | 'parentDepartmentId' | 'name' | 'isDeleted' | 'lastSyncedAt'
  >
): FeishuMirrorDepartmentSummary {
  return {
    departmentId: department.departmentId,
    openDepartmentId: department.openDepartmentId,
    parentDepartmentId: department.parentDepartmentId,
    name: department.name,
    isDeleted: department.isDeleted,
    lastSyncedAt: department.lastSyncedAt
  };
}

function normalizePage(input: PageInput) {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 20));

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize
  };
}

function normalizeKeyword(keyword: string | undefined): string {
  return keyword?.trim().slice(0, 80) ?? '';
}

function buildDepartmentWhere(
  keyword: string,
  parentDepartmentId: string | null | undefined
): Prisma.FeishuDepartmentWhereInput {
  const filters: Prisma.FeishuDepartmentWhereInput[] = [];
  if (keyword) {
    filters.push({
      OR: [
        { departmentId: { contains: keyword, mode: 'insensitive' } },
        { name: { contains: keyword, mode: 'insensitive' } }
      ]
    });
  }
  const parentWhere = buildDepartmentParentWhere(parentDepartmentId);
  if (parentWhere) {
    filters.push(parentWhere);
  }
  return {
    ...(filters.length === 1 ? filters[0] : {}),
    ...(filters.length > 1 ? { AND: filters } : {})
  };
}

function buildDepartmentParentWhere(
  parentDepartmentId: string | null | undefined
): Prisma.FeishuDepartmentWhereInput | null {
  if (parentDepartmentId === undefined) {
    return null;
  }
  if (parentDepartmentId === null) {
    return { OR: [{ parentDepartmentId: '0' }, { parentDepartmentId: null }] };
  }
  return { parentDepartmentId };
}
