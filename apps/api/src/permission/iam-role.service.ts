import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma, type Application, type IamRole, type PermissionGroup } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ApplicationService } from './application.service';
import { AuditLogService } from './audit-log.service';
import { assertRoleKey } from './permission.validators';
import { EntityStatus, IamSubjectType, type PermissionAuditContext, PermissionDomainError } from './permission.types';

type CreateRoleInput = {
  key: string;
  name: string;
  description?: string;
};

type UpdateRoleInput = {
  name?: string;
  description?: string | null;
};

type RoleSubjectInput = {
  type: IamSubjectType;
  id: string;
};

type RoleSubjectAuditData = RoleSubjectInput & {
  isOrphaned: boolean;
};

type PermissionPointSummary = {
  id: string;
  applicationId: string;
  key: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export type IamRoleWithBindings = IamRole & {
  applications: IamRoleApplicationSummary[];
  applicationIds: string[];
  appKeys: string[];
  permissionGroups: Array<PermissionGroup & { permissionPoints: PermissionPointSummary[] }>;
  permissionGroupIds: string[];
  permissionPoints: PermissionPointSummary[];
  subjects: Array<{
    type: IamSubjectType;
    id: string;
    isOrphaned: boolean;
    displayName: string;
    avatarLabel: string;
    subjectKindLabel: '组织' | '用户';
    displayPath: string;
  }>;
};

export type IamRoleApplicationSummary = {
  applicationId: string;
  appKey: string;
  name: string;
  status: string;
  bindingStatus: string;
};

const SYSTEM_ACTOR = {
  actorType: 'platform_token',
  actorId: 'platform-admin-token',
  source: 'platform_api'
};

const IAM_SUBJECT_TYPES: readonly IamSubjectType[] = ['feishu_user', 'feishu_department'];

type IamRoleClient = Pick<
  Prisma.TransactionClient,
  | 'iamRole'
  | 'iamRoleApplication'
  | 'iamRoleSubject'
  | 'iamRolePermissionGroup'
  | 'iamRolePermissionPoint'
  | 'permissionGroup'
  | 'permissionPoint'
  | 'feishuUser'
  | 'feishuDepartment'
>;

@Injectable()
export class IamRoleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly applications: ApplicationService,
    private readonly audit: AuditLogService
  ) {}

  async createRole(appKey: string, input: CreateRoleInput, auditContext?: PermissionAuditContext): Promise<IamRole> {
    assertRoleKey(input.key);

    return this.prisma.$transaction(async (tx) => {
      const application = await this.applications.getApplicationByKey(appKey, tx);
      const created = await tx.iamRole.create({
        data: {
          id: randomUUID(),
          key: input.key,
          name: input.name,
          description: input.description ?? null
        }
      });

      await tx.iamRoleApplication.create({
        data: {
          iamRoleId: created.id,
          applicationId: application.id,
          status: 'active'
        }
      });

      await this.recordAudit(application.id, created.id, 'create', undefined, {
        ...created,
        appKey
      }, tx, auditContext);
      return created;
    });
  }

  async listRoles(appKey: string): Promise<IamRoleWithBindings[]> {
    const application = await this.applications.getApplicationByKey(appKey);
    const roles = await this.prisma.iamRole.findMany({
      where: {
        applications: {
          some: {
            applicationId: application.id
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
            applicationId: application.id
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
            applicationId: application.id
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

    const subjectDisplays = await buildSubjectDisplayMap(
      this.prisma,
      roles.flatMap((role) => role.subjects)
    );

    return roles.map((role) => ({
      ...role,
      applications: role.applications.map((binding) => ({
        applicationId: binding.applicationId,
        appKey: binding.application.appKey,
        name: binding.application.name,
        status: binding.application.status,
        bindingStatus: binding.status
      })),
      applicationIds: role.applications.map((binding) => binding.applicationId),
      appKeys: role.applications.map((binding) => binding.application.appKey),
      permissionGroups: role.permissionGroups.map((binding) => ({
        ...binding.permissionGroup,
        permissionPoints: binding.permissionGroup.permissionPoints.map((pointBinding) => pointBinding.permissionPoint)
      })),
      permissionGroupIds: role.permissionGroups.map((binding) => binding.permissionGroupId),
      permissionPoints: role.permissionPoints.map((binding) => binding.permissionPoint),
      subjects: role.subjects.map((subject) => {
        const type = subject.subjectType as IamSubjectType;
        const display = subjectDisplays.get(`${type}:${subject.subjectId}`);
        return {
          type,
          id: subject.subjectId,
          isOrphaned: subject.isOrphaned || !display,
          displayName: display?.displayName ?? subject.subjectId,
          avatarLabel: display?.avatarLabel ?? fallbackAvatarLabel(subject.subjectId),
          subjectKindLabel: type === 'feishu_department' ? '组织' : '用户',
          displayPath: display?.displayPath ?? '已失效或未同步'
        };
      })
    }));
  }

  async updateRole(
    appKey: string,
    roleId: string,
    input: UpdateRoleInput,
    auditContext?: PermissionAuditContext
  ): Promise<IamRole> {
    return this.prisma.$transaction(async (tx) => {
      const application = await this.applications.getApplicationByKey(appKey, tx);
      const current = await this.getRole(tx, application, roleId);
      const updated = await tx.iamRole.update({
        where: {
          id: roleId
        },
        data: buildUpdateRoleData(input)
      });

      await this.recordAudit(application.id, roleId, 'update', current, updated, tx, auditContext);
      return updated;
    });
  }

  async setRoleStatus(
    appKey: string,
    roleId: string,
    status: EntityStatus,
    auditContext?: PermissionAuditContext
  ): Promise<IamRole> {
    return this.prisma.$transaction(async (tx) => {
      const application = await this.applications.getApplicationByKey(appKey, tx);
      const current = await this.getRole(tx, application, roleId);
      const updated = await tx.iamRole.update({
        where: {
          id: roleId
        },
        data: {
          status
        }
      });

      await this.recordAudit(application.id, roleId, 'set_status', current, updated, tx, auditContext);
      return updated;
    });
  }

  async bindRoleToApplication(
    appKey: string,
    roleId: string,
    auditContext?: PermissionAuditContext
  ): Promise<IamRole> {
    return this.prisma.$transaction(async (tx) => {
      const application = await this.applications.getApplicationByKey(appKey, tx);
      const role = await tx.iamRole.findFirst({
        where: {
          id: roleId
        }
      });

      if (!role) {
        throw new PermissionDomainError('IAM_ROLE_NOT_FOUND', 'IAM 角色不存在', 404);
      }

      const currentBinding = await tx.iamRoleApplication.findUnique({
        where: {
          iamRoleId_applicationId: {
            iamRoleId: roleId,
            applicationId: application.id
          }
        }
      });

      await tx.iamRoleApplication.upsert({
        where: {
          iamRoleId_applicationId: {
            iamRoleId: roleId,
            applicationId: application.id
          }
        },
        create: {
          iamRoleId: roleId,
          applicationId: application.id,
          status: 'active'
        },
        update: {
          status: 'active'
        }
      });

      await this.recordAudit(
        application.id,
        roleId,
        'bind_application',
        {
          applicationId: application.id,
          bindingStatus: currentBinding?.status ?? null
        },
        {
          applicationId: application.id,
          bindingStatus: 'active'
        },
        tx,
        auditContext
      );

      return role;
    });
  }

  async replaceRoleSubjects(
    appKey: string,
    roleId: string,
    subjects: RoleSubjectInput[],
    auditContext?: PermissionAuditContext
  ): Promise<void> {
    assertAllowedSubjectTypes(subjects);
    assertUniqueSubjects(subjects);

    await this.prisma.$transaction(async (tx) => {
      const application = await this.applications.getApplicationByKey(appKey, tx);
      await this.getRole(tx, application, roleId);
      const currentSubjects = await tx.iamRoleSubject.findMany({
        where: {
          iamRoleId: roleId
        },
        orderBy: [
          { subjectType: 'asc' },
          { subjectId: 'asc' }
        ]
      });
      const subjectAuditData = await buildSubjectAuditData(tx, subjects);
      const data = subjectAuditData.map((subject) => ({
        id: randomUUID(),
        iamRoleId: roleId,
        subjectType: subject.type,
        subjectId: subject.id,
        isOrphaned: subject.isOrphaned
      }));

      await tx.iamRoleSubject.deleteMany({
        where: {
          iamRoleId: roleId
        }
      });
      await tx.iamRoleSubject.createMany({
        data,
        skipDuplicates: true
      });

      await this.recordAudit(
        application.id,
        roleId,
        'replace_subjects',
        {
          subjects: currentSubjects.map((subject) => ({
            type: subject.subjectType,
            id: subject.subjectId,
            isOrphaned: subject.isOrphaned
          }))
        },
        {
          subjects: subjectAuditData
        },
        tx,
        auditContext
      );
    });
  }

  async replaceRolePermissionGroups(
    appKey: string,
    roleId: string,
    groupIds: string[],
    auditContext?: PermissionAuditContext
  ): Promise<void> {
    assertUniqueIds(groupIds, 'PERMISSION_GROUP_DUPLICATED', '权限组重复');

    await this.prisma.$transaction(async (tx) => {
      const application = await this.applications.getApplicationByKey(appKey, tx);
      await this.getRole(tx, application, roleId);
      const currentPermissionGroups = await tx.iamRolePermissionGroup.findMany({
        where: {
          applicationId: application.id,
          iamRoleId: roleId
        },
        orderBy: {
          permissionGroupId: 'asc'
        }
      });
      const groups = await tx.permissionGroup.findMany({
        where: {
          id: {
            in: groupIds
          }
        }
      });

      if (groups.length !== groupIds.length) {
        throw new PermissionDomainError('PERMISSION_GROUP_NOT_FOUND', '权限组不存在', 404);
      }

      if (groups.some((group) => group.applicationId !== application.id)) {
        throw new PermissionDomainError('CROSS_APPLICATION_BINDING_FORBIDDEN', '禁止跨应用绑定权限组', 422);
      }

      await tx.iamRolePermissionGroup.deleteMany({
        where: {
          applicationId: application.id,
          iamRoleId: roleId
        }
      });
      await tx.iamRolePermissionGroup.createMany({
        data: groupIds.map((permissionGroupId) => ({
          applicationId: application.id,
          iamRoleId: roleId,
          permissionGroupId
        })),
        skipDuplicates: true
      });

      await this.recordAudit(
        application.id,
        roleId,
        'replace_permission_groups',
        {
          permissionGroupIds: currentPermissionGroups.map((group) => group.permissionGroupId)
        },
        {
          permissionGroupIds: groupIds
        },
        tx,
        auditContext
      );
    });
  }

  async replaceRolePermissionPoints(
    appKey: string,
    roleId: string,
    pointIds: string[],
    auditContext?: PermissionAuditContext
  ): Promise<void> {
    assertUniqueIds(pointIds, 'PERMISSION_POINT_DUPLICATED', '权限点重复');

    await this.prisma.$transaction(async (tx) => {
      const application = await this.applications.getApplicationByKey(appKey, tx);
      await this.getRole(tx, application, roleId);
      const currentPermissionPoints = await tx.iamRolePermissionPoint.findMany({
        where: {
          applicationId: application.id,
          iamRoleId: roleId
        },
        orderBy: {
          permissionPointId: 'asc'
        }
      });
      const points = await tx.permissionPoint.findMany({
        where: {
          id: {
            in: pointIds
          }
        }
      });

      if (points.length !== pointIds.length) {
        throw new PermissionDomainError('PERMISSION_POINT_NOT_FOUND', '权限点不存在', 404);
      }

      if (points.some((point) => point.applicationId !== application.id)) {
        throw new PermissionDomainError('CROSS_APPLICATION_BINDING_FORBIDDEN', '禁止跨应用绑定权限点', 422);
      }

      await tx.iamRolePermissionPoint.deleteMany({
        where: {
          applicationId: application.id,
          iamRoleId: roleId
        }
      });
      await tx.iamRolePermissionPoint.createMany({
        data: pointIds.map((permissionPointId) => ({
          applicationId: application.id,
          iamRoleId: roleId,
          permissionPointId
        })),
        skipDuplicates: true
      });

      await this.recordAudit(
        application.id,
        roleId,
        'replace_permission_points',
        {
          permissionPointIds: currentPermissionPoints.map((point) => point.permissionPointId)
        },
        {
          permissionPointIds: pointIds
        },
        tx,
        auditContext
      );
    });
  }

  private async getRole(client: IamRoleClient, application: Application, roleId: string): Promise<IamRole> {
    const role = await client.iamRole.findFirst({
      where: {
        id: roleId,
        applications: {
          some: {
            applicationId: application.id
          }
        }
      }
    });

    if (!role) {
      throw new PermissionDomainError('IAM_ROLE_NOT_FOUND', 'IAM 角色不存在', 404);
    }

    return role;
  }

  private async recordAudit(
    applicationId: string,
    resourceId: string,
    action: string,
    before: unknown,
    after: unknown,
    client: Prisma.TransactionClient,
    auditContext?: PermissionAuditContext
  ): Promise<void> {
    const actor = {
      actorType: auditContext?.actorType ?? SYSTEM_ACTOR.actorType,
      actorId: auditContext?.actorId ?? SYSTEM_ACTOR.actorId,
      source: auditContext?.source ?? SYSTEM_ACTOR.source
    };

    await this.audit.record({
      ...actor,
      applicationId,
      resourceType: 'iam_role',
      resourceId,
      action,
      before,
      after,
      result: 'success',
      requestId: auditContext?.requestId,
      ip: auditContext?.ip,
      userAgent: auditContext?.userAgent
    }, client);
  }
}

function buildUpdateRoleData(input: UpdateRoleInput): UpdateRoleInput {
  const data: UpdateRoleInput = {};
  if (input.name !== undefined) {
    data.name = input.name;
  }
  if (input.description !== undefined) {
    data.description = input.description;
  }
  return data;
}

function assertAllowedSubjectTypes(subjects: RoleSubjectInput[]): void {
  for (const subject of subjects) {
    if (!IAM_SUBJECT_TYPES.includes(subject.type)) {
      throw new PermissionDomainError('IAM_SUBJECT_TYPE_INVALID', 'IAM 主体类型不支持', 422);
    }
  }
}

function assertUniqueSubjects(subjects: RoleSubjectInput[]): void {
  const uniqueKeys = new Set(subjects.map((subject) => `${subject.type}:${subject.id}`));
  if (uniqueKeys.size !== subjects.length) {
    throw new PermissionDomainError('IAM_ROLE_SUBJECT_DUPLICATED', 'IAM 角色主体重复', 422);
  }
}

function assertUniqueIds(ids: string[], code: string, message: string): void {
  const uniqueIds = new Set(ids);
  if (uniqueIds.size !== ids.length) {
    throw new PermissionDomainError(code, message, 422);
  }
}

async function buildSubjectAuditData(
  client: IamRoleClient,
  subjects: RoleSubjectInput[]
): Promise<RoleSubjectAuditData[]> {
  const userIds = subjects.filter((subject) => subject.type === 'feishu_user').map((subject) => subject.id);
  const departmentIds = subjects.filter((subject) => subject.type === 'feishu_department').map((subject) => subject.id);
  const [users, departments] = await Promise.all([
    userIds.length > 0
      ? client.feishuUser.findMany({
          where: {
            userId: {
              in: userIds
            },
            isDeleted: false
          },
          select: {
            userId: true
          }
        })
      : Promise.resolve([]),
    departmentIds.length > 0
      ? client.feishuDepartment.findMany({
          where: {
            departmentId: {
              in: departmentIds
            },
            isDeleted: false
          },
          select: {
            departmentId: true
          }
        })
      : Promise.resolve([])
  ]);
  const activeUserIds = new Set(users.map((user) => user.userId));
  const activeDepartmentIds = new Set(departments.map((department) => department.departmentId));

  return subjects.map((subject) => ({
    ...subject,
    isOrphaned:
      subject.type === 'feishu_user'
        ? !activeUserIds.has(subject.id)
    : !activeDepartmentIds.has(subject.id)
  }));
}

async function buildSubjectDisplayMap(
  client: IamRoleClient,
  subjects: Array<{ subjectType: string; subjectId: string }>
): Promise<Map<string, { displayName: string; avatarLabel: string; displayPath: string }>> {
  const departmentIds = [
    ...new Set(subjects.filter((item) => item.subjectType === 'feishu_department').map((item) => item.subjectId))
  ];
  const userIds = [
    ...new Set(subjects.filter((item) => item.subjectType === 'feishu_user').map((item) => item.subjectId))
  ];

  if (departmentIds.length === 0 && userIds.length === 0) {
    return new Map();
  }

  const [departments, users, allDepartments] = await Promise.all([
    departmentIds.length === 0
      ? Promise.resolve([])
      : client.feishuDepartment.findMany({
          where: {
            departmentId: {
              in: departmentIds
            },
            isDeleted: false
          },
          select: {
            departmentId: true,
            name: true,
            parentDepartmentId: true
          }
        }),
    userIds.length === 0
      ? Promise.resolve([])
      : client.feishuUser.findMany({
          where: {
            userId: {
              in: userIds
            },
            isDeleted: false
          },
          select: {
            userId: true,
            name: true,
            userDepartments: {
              where: {
                isDeleted: false
              },
              include: {
                department: true
              },
              orderBy: [
                { isPrimary: 'desc' },
                { departmentId: 'asc' }
              ]
            }
          }
        }),
    client.feishuDepartment.findMany({
      where: {
        isDeleted: false
      },
      select: {
        departmentId: true,
        name: true,
        parentDepartmentId: true
      }
    })
  ]);
  const departmentMap = new Map(allDepartments.map((department) => [department.departmentId, department]));
  const displayMap = new Map<string, { displayName: string; avatarLabel: string; displayPath: string }>();

  for (const department of departments) {
    displayMap.set(`feishu_department:${department.departmentId}`, {
      displayName: department.name,
      avatarLabel: fallbackAvatarLabel(department.name),
      displayPath: buildDepartmentPath(department.departmentId, departmentMap)
    });
  }

  for (const user of users) {
    const primaryDepartment = user.userDepartments[0]?.department;
    displayMap.set(`feishu_user:${user.userId}`, {
      displayName: user.name,
      avatarLabel: fallbackAvatarLabel(user.name),
      displayPath: primaryDepartment
        ? buildDepartmentPath(primaryDepartment.departmentId, departmentMap)
        : '未返回所属组织'
    });
  }

  return displayMap;
}

function buildDepartmentPath(
  departmentId: string,
  departmentMap: Map<string, { departmentId: string; name: string; parentDepartmentId: string | null }>
): string {
  const names: string[] = [];
  const seen = new Set<string>();
  let currentId: string | null = departmentId;

  while (currentId && !seen.has(currentId) && names.length < 20) {
    seen.add(currentId);
    const current = departmentMap.get(currentId);
    if (!current) {
      break;
    }
    names.unshift(current.name);
    currentId = current.parentDepartmentId;
  }

  return names.length > 0 ? names.join(' / ') : '未返回组织路径';
}

function fallbackAvatarLabel(value: string): string {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 1) : '?';
}
