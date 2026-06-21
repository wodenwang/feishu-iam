import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type PermissionMatrixSubjectType = 'user' | 'department';

export type PermissionMatrixMatchType = 'direct_user' | 'user_department' | 'direct_department';

export type PermissionMatrixResult = {
  subject: {
    type: PermissionMatrixSubjectType;
    id: string;
    name: string;
  };
  scope_note: string;
  applications: PermissionMatrixApplication[];
  computed_at: string;
};

export type PermissionMatrixApplication = {
  app_key: string;
  name: string;
  matched_roles: Array<{ key: string; name: string; match_type: PermissionMatrixMatchType }>;
  permission_groups: Array<{ key: string; name: string; source_roles: string[] }>;
  permission_points: Array<{ key: string; name: string; source_roles: string[]; source_groups: string[]; status: 'active' }>;
  computed_at: string;
};

type MatrixRole = {
  key: string;
  name: string;
  status: string;
  applications?: Array<{
    status: string;
    application: {
      appKey: string;
      name: string;
      status: string;
    };
  }>;
  subjects?: Array<{
    subjectType: string;
    subjectId: string;
    isOrphaned?: boolean;
  }>;
  permissionGroups?: Array<{
    permissionGroup: {
      key: string;
      name: string;
      status: string;
      permissionPoints?: Array<{
        permissionPoint: {
          key: string;
          name: string;
          status: string;
        };
      }>;
    };
  }>;
  permissionPoints?: Array<{
    permissionPoint: {
      key: string;
      name: string;
      status: string;
    };
  }>;
};

type ApplicationAccumulator = {
  app_key: string;
  name: string;
  matchedRoles: Map<string, { key: string; name: string; match_type: PermissionMatrixMatchType }>;
  groups: Map<string, { key: string; name: string; sourceRoles: Set<string> }>;
  points: Map<string, { key: string; name: string; sourceRoles: Set<string>; sourceGroups: Set<string> }>;
};

@Injectable()
export class AdminPermissionMatrixService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async query(
    subjectType: PermissionMatrixSubjectType,
    subjectId: string
  ): Promise<PermissionMatrixResult> {
    const computedAt = new Date().toISOString();
    const subject = await this.resolveSubject(subjectType, subjectId);
    const departmentIds =
      subjectType === 'user' ? await this.getUserDepartmentIds(subjectId) : [subjectId];
    const roles = await this.getCandidateRoles(subjectType, subjectId, departmentIds);
    const applications = buildApplications(roles, subjectType, subjectId, departmentIds, computedAt);

    return {
      subject,
      scope_note:
        subjectType === 'user'
          ? '用户查询包含直接用户绑定和用户所属组织绑定。'
          : '组织查询只统计直接绑定该组织的角色，不展开组织下用户。',
      applications,
      computed_at: computedAt
    };
  }

  private async resolveSubject(
    subjectType: PermissionMatrixSubjectType,
    subjectId: string
  ): Promise<PermissionMatrixResult['subject']> {
    if (subjectType === 'user') {
      const user = await this.prisma.feishuUser.findUnique({
        where: { userId: subjectId },
        select: { userId: true, name: true }
      });
      return {
        type: subjectType,
        id: subjectId,
        name: user?.name ?? subjectId
      };
    }

    const department = await this.prisma.feishuDepartment.findUnique({
      where: { departmentId: subjectId },
      select: { departmentId: true, name: true }
    });
    return {
      type: subjectType,
      id: subjectId,
      name: department?.name ?? subjectId
    };
  }

  private async getUserDepartmentIds(userId: string): Promise<string[]> {
    const memberships = await this.prisma.feishuUserDepartment.findMany({
      where: {
        userId,
        isDeleted: false
      },
      select: {
        departmentId: true
      }
    });
    return memberships.map((membership) => membership.departmentId);
  }

  private async getCandidateRoles(
    subjectType: PermissionMatrixSubjectType,
    subjectId: string,
    departmentIds: string[]
  ): Promise<MatrixRole[]> {
    return this.prisma.iamRole.findMany({
      where: {
        status: 'active',
        applications: {
          some: {
            status: 'active',
            application: {
              status: 'active'
            }
          }
        },
        subjects: {
          some: {
            isOrphaned: false,
            OR:
              subjectType === 'user'
                ? [
                    { subjectType: 'feishu_user', subjectId },
                    { subjectType: 'feishu_department', subjectId: { in: departmentIds } }
                  ]
                : [{ subjectType: 'feishu_department', subjectId }]
          }
        }
      },
      include: {
        applications: {
          include: {
            application: true
          }
        },
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
      },
      orderBy: {
        key: 'asc'
      }
    });
  }
}

function buildApplications(
  roles: MatrixRole[],
  subjectType: PermissionMatrixSubjectType,
  subjectId: string,
  departmentIds: string[],
  computedAt: string
): PermissionMatrixApplication[] {
  const applications = new Map<string, ApplicationAccumulator>();

  for (const role of roles) {
    if (role.status !== 'active') {
      continue;
    }
    const matchType = getRoleMatchType(role, subjectType, subjectId, departmentIds);
    if (!matchType) {
      continue;
    }

    for (const binding of role.applications ?? []) {
      if (binding.status !== 'active' || binding.application.status !== 'active') {
        continue;
      }
      const app = getOrCreateApplication(applications, binding.application.appKey, binding.application.name);
      app.matchedRoles.set(role.key, { key: role.key, name: role.name, match_type: matchType });
      addPermissionGroups(app, role);
      addDirectPermissionPoints(app, role);
    }
  }

  return [...applications.values()]
    .map((application) => ({
      app_key: application.app_key,
      name: application.name,
      matched_roles: [...application.matchedRoles.values()].sort(compareByKey),
      permission_groups: [...application.groups.values()]
        .map((group) => ({
          key: group.key,
          name: group.name,
          source_roles: [...group.sourceRoles].sort()
        }))
        .sort(compareByKey),
      permission_points: [...application.points.values()]
        .map((point) => ({
          key: point.key,
          name: point.name,
          source_roles: [...point.sourceRoles].sort(),
          source_groups: [...point.sourceGroups].sort(),
          status: 'active' as const
        }))
        .sort(compareByKey),
      computed_at: computedAt
    }))
    .filter((application) => application.permission_points.length > 0)
    .sort(compareApplications);
}

function getRoleMatchType(
  role: MatrixRole,
  subjectType: PermissionMatrixSubjectType,
  subjectId: string,
  departmentIds: string[]
): PermissionMatrixMatchType | null {
  for (const subject of role.subjects ?? []) {
    if (subject.isOrphaned) {
      continue;
    }
    if (subjectType === 'user') {
      if (subject.subjectType === 'feishu_user' && subject.subjectId === subjectId) {
        return 'direct_user';
      }
      if (subject.subjectType === 'feishu_department' && departmentIds.includes(subject.subjectId)) {
        return 'user_department';
      }
    } else if (subject.subjectType === 'feishu_department' && subject.subjectId === subjectId) {
      return 'direct_department';
    }
  }
  return null;
}

function getOrCreateApplication(
  applications: Map<string, ApplicationAccumulator>,
  appKey: string,
  name: string
): ApplicationAccumulator {
  const current = applications.get(appKey);
  if (current) {
    return current;
  }
  const next: ApplicationAccumulator = {
    app_key: appKey,
    name,
    matchedRoles: new Map(),
    groups: new Map(),
    points: new Map()
  };
  applications.set(appKey, next);
  return next;
}

function addPermissionGroups(application: ApplicationAccumulator, role: MatrixRole): void {
  for (const binding of role.permissionGroups ?? []) {
    const group = binding.permissionGroup;
    if (group.status !== 'active') {
      continue;
    }
    const currentGroup = application.groups.get(group.key) ?? {
      key: group.key,
      name: group.name,
      sourceRoles: new Set<string>()
    };
    currentGroup.sourceRoles.add(role.key);
    application.groups.set(group.key, currentGroup);

    for (const pointBinding of group.permissionPoints ?? []) {
      const point = pointBinding.permissionPoint;
      if (point.status !== 'active') {
        continue;
      }
      const currentPoint = application.points.get(point.key) ?? {
        key: point.key,
        name: point.name,
        sourceRoles: new Set<string>(),
        sourceGroups: new Set<string>()
      };
      currentPoint.sourceRoles.add(role.key);
      currentPoint.sourceGroups.add(group.key);
      application.points.set(point.key, currentPoint);
    }
  }
}

function addDirectPermissionPoints(application: ApplicationAccumulator, role: MatrixRole): void {
  for (const binding of role.permissionPoints ?? []) {
    const point = binding.permissionPoint;
    if (point.status !== 'active') {
      continue;
    }
    const currentPoint = application.points.get(point.key) ?? {
      key: point.key,
      name: point.name,
      sourceRoles: new Set<string>(),
      sourceGroups: new Set<string>()
    };
    currentPoint.sourceRoles.add(role.key);
    application.points.set(point.key, currentPoint);
  }
}

function compareByKey(left: { key: string }, right: { key: string }): number {
  return left.key.localeCompare(right.key);
}

function compareApplications(left: { app_key: string }, right: { app_key: string }): number {
  return left.app_key.localeCompare(right.app_key);
}
