import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionDomainError } from './permission.types';

export type PermissionCalculationResult = {
  appKey: string;
  userId: string;
  permissionGroups: Array<{ key: string; name: string }>;
  permissionPoints: Array<{ key: string; name: string }>;
  matchedRoles: Array<{ key: string; name: string }>;
  computedAt: string;
};

type PermissionCalculationRole = Prisma.IamRoleGetPayload<{
  include: typeof ROLE_INCLUDE;
}>;

const ROLE_INCLUDE = {
  subjects: true,
  permissionGroups: {
    include: {
      permissionGroup: {
        include: {
          permissionPoints: {
            include: {
              permissionPoint: true
            }
          }
        }
      }
    }
  },
  permissionPoints: {
    include: {
      permissionPoint: true
    }
  }
} satisfies Prisma.IamRoleInclude;

@Injectable()
export class PermissionCalculationService {
  constructor(private readonly prisma: PrismaService) {}

  async calculate(appKey: string, userId: string): Promise<PermissionCalculationResult> {
    const application = await this.prisma.application.findUnique({
      where: {
        appKey
      }
    });

    if (!application) {
      throw new PermissionDomainError('APPLICATION_NOT_FOUND', '应用不存在', 404);
    }

    if (application.status !== 'active') {
      throw new PermissionDomainError('APPLICATION_DISABLED', '应用已禁用', 403);
    }

    const user = await this.prisma.feishuUser.findFirst({
      where: {
        userId,
        isDeleted: false
      }
    });

    if (!user?.isActive) {
      throw new PermissionDomainError('FEISHU_USER_NOT_ACTIVE', '飞书用户不可登录', 403);
    }

    const departments = await this.prisma.feishuUserDepartment.findMany({
      where: {
        userId,
        isDeleted: false
      }
    });
    const directDepartmentIds = new Set(departments.map((department) => department.departmentId));
    const roles = await this.prisma.iamRole.findMany({
      where: {
        applicationId: application.id,
        status: 'active'
      },
      include: ROLE_INCLUDE
    });

    const permissionGroups = new Map<string, { key: string; name: string }>();
    const permissionPoints = new Map<string, { key: string; name: string }>();
    const matchedRoles = new Map<string, { key: string; name: string }>();

    for (const role of roles) {
      if (!isActiveMatchedRole(role, userId, directDepartmentIds)) {
        continue;
      }

      matchedRoles.set(role.key, {
        key: role.key,
        name: role.name
      });

      for (const rolePermissionGroup of role.permissionGroups) {
        const group = rolePermissionGroup.permissionGroup;
        if (group.status !== 'active') {
          continue;
        }

        permissionGroups.set(group.key, {
          key: group.key,
          name: group.name
        });

        for (const groupPermissionPoint of group.permissionPoints) {
          const point = groupPermissionPoint.permissionPoint;
          if (point.status === 'active') {
            permissionPoints.set(point.key, {
              key: point.key,
              name: point.name
            });
          }
        }
      }

      for (const rolePermissionPoint of role.permissionPoints) {
        const point = rolePermissionPoint.permissionPoint;
        if (point.status === 'active') {
          permissionPoints.set(point.key, {
            key: point.key,
            name: point.name
          });
        }
      }
    }

    return {
      appKey,
      userId,
      permissionGroups: sortByKey(permissionGroups),
      permissionPoints: sortByKey(permissionPoints),
      matchedRoles: sortByKey(matchedRoles),
      computedAt: new Date().toISOString()
    };
  }
}

function isActiveMatchedRole(
  role: PermissionCalculationRole,
  userId: string,
  directDepartmentIds: ReadonlySet<string>
): boolean {
  if (role.status !== 'active') {
    return false;
  }

  return role.subjects.some((subject) => {
    if (subject.isOrphaned) {
      return false;
    }

    if (subject.subjectType === 'feishu_user') {
      return subject.subjectId === userId;
    }

    if (subject.subjectType === 'feishu_department') {
      return directDepartmentIds.has(subject.subjectId);
    }

    return false;
  });
}

function sortByKey(items: Map<string, { key: string; name: string }>): Array<{ key: string; name: string }> {
  return [...items.values()].sort((left, right) => left.key.localeCompare(right.key));
}
