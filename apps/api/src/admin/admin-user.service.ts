import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma, type AdminUser, type FeishuUser } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../permission/audit-log.service';
import { AdminDomainError, type AdminAuditContext, type AdminRoleKey } from './admin.types';

export type CreateAdminUserInput = {
  feishuUserId: string;
  roleKeys: AdminRoleKey[];
  applicationIds: string[];
};

export type UpdateAdminUserAuthorizationInput = {
  roleKeys: AdminRoleKey[];
  applicationIds: string[];
};

type AdminUserClient = Pick<
  Prisma.TransactionClient,
  | 'feishuUser'
  | 'adminUser'
  | 'adminRole'
  | 'adminUserRole'
  | 'adminApplicationScope'
  | 'adminSession'
  | 'application'
>;

type AdminRoleRecord = {
  id: string;
  roleKey: string;
};
type AdminUserListRecord = Prisma.AdminUserGetPayload<{
  include: {
    roles: {
      include: {
        adminRole: true;
      };
    };
    applicationScopes: {
      include: {
        application: true;
      };
    };
  };
}>;
export type AdminUserListItem = {
  id: string;
  feishuUserId: string;
  displayName: string;
  status: string;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  roles: Array<{
    roleKey: string;
    name: string;
  }>;
  applicationScopes: Array<{
    id: string;
    appKey: string;
    name: string;
    status: string;
  }>;
};

const WRITABLE_ADMIN_ROLE_KEYS = ['platform_admin', 'application_admin'] as const;
const WRITABLE_ADMIN_ROLE_KEY_SET = new Set<string>(WRITABLE_ADMIN_ROLE_KEYS);
const SYSTEM_AUDIT_CONTEXT: AdminAuditContext = {
  actorType: 'system',
  actorId: 'deployment',
  source: 'deployment_init'
};
const ADMIN_USER_LIST_INCLUDE = {
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
} satisfies Prisma.AdminUserInclude;

@Injectable()
export class AdminUserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService
  ) {}

  async createAdminUser(input: CreateAdminUserInput, auditContext?: AdminAuditContext): Promise<AdminUser> {
    const authorization = normalizeWritableAuthorization(input.roleKeys, input.applicationIds);
    const roleKeys = [authorization.roleKey];
    const applicationIds = authorization.applicationIds;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const feishuUser = await this.getAvailableFeishuUser(tx, input.feishuUserId);
        const roles = await this.resolveRoles(tx, roleKeys);
        await this.assertApplicationsExist(tx, applicationIds);

        const adminUser = await tx.adminUser.create({
          data: {
            id: randomUUID(),
            feishuUserId: feishuUser.userId,
            displayName: feishuUser.name,
            status: 'active'
          }
        });

        await tx.adminUserRole.createMany({
          data: roles.map((role) => ({
            adminUserId: adminUser.id,
            adminRoleId: role.id
          })),
          skipDuplicates: true
        });

        if (applicationIds.length > 0) {
          await tx.adminApplicationScope.createMany({
            data: applicationIds.map((applicationId) => ({
              adminUserId: adminUser.id,
              applicationId
            })),
            skipDuplicates: true
          });
        }

        await this.audit.record(
          {
            ...(auditContext ?? SYSTEM_AUDIT_CONTEXT),
            resourceType: 'admin_user',
            resourceId: adminUser.id,
            action: 'create',
            before: undefined,
            after: {
              adminUserId: adminUser.id,
              feishuUserId: feishuUser.userId,
              roleKeys,
              applicationIds
            },
            result: 'success'
          },
          tx
        );

        return adminUser;
      });
    } catch (error) {
      if (error instanceof AdminDomainError) {
        throw error;
      }

      if (isUniqueConstraintError(error)) {
        throw new AdminDomainError('ADMIN_USER_ALREADY_EXISTS', '飞书用户已绑定管理员', 409);
      }

      throw new AdminDomainError('ADMIN_USER_CREATE_FAILED', '管理员创建失败', 500);
    }
  }

  async listAdminUsers(): Promise<AdminUserListItem[]> {
    const adminUsers = await this.prisma.adminUser.findMany({
      orderBy: {
        createdAt: 'desc'
      },
      include: ADMIN_USER_LIST_INCLUDE
    });

    return adminUsers.map(serializeAdminUserListItem);
  }

  async replaceApplicationScopes(
    adminUserId: string,
    applicationIds: string[],
    auditContext?: AdminAuditContext
  ): Promise<AdminUserListItem> {
    const normalizedAdminUserId = normalizeRequiredString(adminUserId, 'ADMIN_USER_NOT_FOUND', '管理员不存在');
    const normalizedApplicationIds = normalizeApplicationIds(applicationIds);

    return this.prisma.$transaction(async (tx) => {
      const current = await this.getAdminUserListRecord(tx, normalizedAdminUserId);
      assertCurrentRoleAllowsApplicationScopes(current);
      assertRoleScopeConsistency('application_admin', normalizedApplicationIds);
      await this.assertApplicationsExist(tx, normalizedApplicationIds);

      await tx.adminApplicationScope.deleteMany({
        where: {
          adminUserId: normalizedAdminUserId
        }
      });

      if (normalizedApplicationIds.length > 0) {
        await tx.adminApplicationScope.createMany({
          data: normalizedApplicationIds.map((applicationId) => ({
            adminUserId: normalizedAdminUserId,
            applicationId
          })),
          skipDuplicates: true
        });
      }

      const updated = await this.getAdminUserListRecord(tx, normalizedAdminUserId);
      await this.audit.record(
        {
          ...(auditContext ?? SYSTEM_AUDIT_CONTEXT),
          resourceType: 'admin_user',
          resourceId: normalizedAdminUserId,
          action: 'replace_application_scopes',
          before: {
            applicationIds: current.applicationScopes.map((scope) => scope.application.id)
          },
          after: {
            applicationIds: normalizedApplicationIds
          },
          result: 'success'
        },
        tx
      );

      return serializeAdminUserListItem(updated);
    });
  }

  async replaceAuthorization(
    adminUserId: string,
    input: UpdateAdminUserAuthorizationInput,
    auditContext?: AdminAuditContext
  ): Promise<AdminUserListItem> {
    const normalizedAdminUserId = normalizeRequiredString(adminUserId, 'ADMIN_USER_NOT_FOUND', '管理员不存在');
    const authorization = normalizeWritableAuthorization(input.roleKeys, input.applicationIds);
    const roleKeys = [authorization.roleKey];
    const applicationIds = authorization.applicationIds;

    return this.prisma.$transaction(async (tx) => {
      const current = await this.getAdminUserListRecord(tx, normalizedAdminUserId);
      assertTargetAdminUserMaintainable(current);
      const roles = await this.resolveRoles(tx, roleKeys);
      await this.assertApplicationsExist(tx, applicationIds);

      await tx.adminUserRole.deleteMany({
        where: {
          adminUserId: normalizedAdminUserId
        }
      });
      await tx.adminUserRole.createMany({
        data: roles.map((role) => ({
          adminUserId: normalizedAdminUserId,
          adminRoleId: role.id
        })),
        skipDuplicates: true
      });

      await tx.adminApplicationScope.deleteMany({
        where: {
          adminUserId: normalizedAdminUserId
        }
      });
      if (applicationIds.length > 0) {
        await tx.adminApplicationScope.createMany({
          data: applicationIds.map((applicationId) => ({
            adminUserId: normalizedAdminUserId,
            applicationId
          })),
          skipDuplicates: true
        });
      }

      const updated = await this.getAdminUserListRecord(tx, normalizedAdminUserId);
      await this.audit.record(
        {
          ...(auditContext ?? SYSTEM_AUDIT_CONTEXT),
          resourceType: 'admin_user',
          resourceId: normalizedAdminUserId,
          action: 'replace_authorization',
          before: {
            roleKeys: current.roles.map((role) => role.adminRole.roleKey),
            applicationIds: current.applicationScopes.map((scope) => scope.application.id)
          },
          after: {
            roleKeys,
            applicationIds
          },
          result: 'success'
        },
        tx
      );

      return serializeAdminUserListItem(updated);
    });
  }

  async setAdminUserStatus(
    adminUserId: string,
    status: 'active' | 'disabled',
    auditContext?: AdminAuditContext
  ): Promise<AdminUserListItem> {
    const normalizedAdminUserId = normalizeRequiredString(adminUserId, 'ADMIN_USER_NOT_FOUND', '管理员不存在');

    return this.prisma.$transaction(async (tx) => {
      const current = await this.getAdminUserListRecord(tx, normalizedAdminUserId);
      assertTargetAdminUserMaintainable(current);

      await tx.adminUser.update({
        where: {
          id: normalizedAdminUserId
        },
        data: {
          status
        }
      });

      if (status === 'disabled') {
        await tx.adminSession.updateMany({
          where: {
            adminUserId: normalizedAdminUserId,
            revokedAt: null
          },
          data: {
            revokedAt: new Date()
          }
        });
      }

      const updated = await this.getAdminUserListRecord(tx, normalizedAdminUserId);
      await this.audit.record(
        {
          ...(auditContext ?? SYSTEM_AUDIT_CONTEXT),
          resourceType: 'admin_user',
          resourceId: normalizedAdminUserId,
          action: 'set_status',
          before: {
            status: current.status
          },
          after: {
            status
          },
          result: 'success'
        },
        tx
      );

      return serializeAdminUserListItem(updated);
    });
  }

  private async getAvailableFeishuUser(client: AdminUserClient, feishuUserId: string): Promise<FeishuUser> {
    const normalizedFeishuUserId = normalizeRequiredString(
      feishuUserId,
      'ADMIN_FEISHU_USER_UNAVAILABLE',
      '飞书用户不可用，不能绑定为管理员'
    );

    const feishuUser = await client.feishuUser.findUnique({
      where: {
        userId: normalizedFeishuUserId
      }
    });

    if (!feishuUser) {
      throw new AdminDomainError('ADMIN_FEISHU_USER_NOT_FOUND', '飞书用户不存在', 404);
    }

    if (!feishuUser.isActive || feishuUser.isDeleted) {
      throw new AdminDomainError('ADMIN_FEISHU_USER_UNAVAILABLE', '飞书用户不可用，不能绑定为管理员', 422);
    }

    return feishuUser;
  }

  private async resolveRoles(client: AdminUserClient, roleKeys: AdminRoleKey[]): Promise<AdminRoleRecord[]> {
    const roles = await client.adminRole.findMany({
      where: {
        roleKey: {
          in: roleKeys
        }
      }
    });
    const resolvedRoleKeys = new Set(roles.map((role) => role.roleKey));

    if (roles.length !== roleKeys.length || roleKeys.some((roleKey) => !resolvedRoleKeys.has(roleKey))) {
      throw new AdminDomainError('ADMIN_ROLE_INVALID', '管理员角色不合法', 422);
    }

    return roles;
  }

  private async assertApplicationsExist(client: AdminUserClient, applicationIds: string[]): Promise<void> {
    if (applicationIds.length === 0) {
      return;
    }

    const applications = await client.application.findMany({
      where: {
        id: {
          in: applicationIds
        }
      },
      select: {
        id: true
      }
    });
    const resolvedApplicationIds = new Set(applications.map((application) => application.id));

    if (
      applications.length !== applicationIds.length ||
      applicationIds.some((applicationId) => !resolvedApplicationIds.has(applicationId))
    ) {
      throw new AdminDomainError('ADMIN_APPLICATION_SCOPE_INVALID', '应用授权范围包含不存在的应用', 422);
    }
  }

  private async getAdminUserListRecord(client: AdminUserClient, adminUserId: string): Promise<AdminUserListRecord> {
    const adminUser = await client.adminUser.findUnique({
      where: {
        id: adminUserId
      },
      include: ADMIN_USER_LIST_INCLUDE
    });

    if (!adminUser) {
      throw new AdminDomainError('ADMIN_USER_NOT_FOUND', '管理员不存在', 404);
    }

    return adminUser;
  }
}

function normalizeWritableAuthorization(
  roleKeys: AdminRoleKey[],
  applicationIds: string[]
): { roleKey: AdminRoleKey; applicationIds: string[] } {
  const normalizedRoleKeys = validateStringArray(roleKeys, 'ADMIN_ROLE_INVALID', '管理员角色不合法');
  const normalizedApplicationIds = normalizeApplicationIds(applicationIds);
  const roleKey = normalizedRoleKeys[0];

  if (normalizedRoleKeys.length !== 1 || roleKey === undefined || !WRITABLE_ADMIN_ROLE_KEY_SET.has(roleKey)) {
    throw new AdminDomainError('ADMIN_ROLE_INVALID', '管理员角色不合法', 422);
  }

  const writableRoleKey = roleKey as AdminRoleKey;
  assertRoleScopeConsistency(writableRoleKey, normalizedApplicationIds);

  return {
    roleKey: writableRoleKey,
    applicationIds: normalizedApplicationIds
  };
}

function normalizeApplicationIds(applicationIds: string[]): string[] {
  return validateStringArray(applicationIds, 'ADMIN_APPLICATION_SCOPE_INVALID', '应用授权范围不合法');
}

function validateStringArray(values: unknown, code: string, message: string): string[] {
  if (!Array.isArray(values)) {
    throw new AdminDomainError(code, message, 422);
  }

  const normalizedValues = values.map((value) => normalizeRequiredString(value, code, message));
  return Array.from(new Set(normalizedValues));
}

function normalizeRequiredString(value: unknown, code: string, message: string): string {
  if (typeof value !== 'string') {
    throw new AdminDomainError(code, message, 422);
  }

  const normalizedValue = value.trim();
  if (normalizedValue.length === 0) {
    throw new AdminDomainError(code, message, 422);
  }

  return normalizedValue;
}

function assertRoleScopeConsistency(roleKey: AdminRoleKey, applicationIds: string[]): void {
  if (roleKey === 'application_admin' && applicationIds.length === 0) {
    throw new AdminDomainError('ADMIN_APPLICATION_SCOPE_INVALID', '应用管理员必须设置应用授权范围', 422);
  }

  if (roleKey === 'platform_admin' && applicationIds.length > 0) {
    throw new AdminDomainError('ADMIN_APPLICATION_SCOPE_INVALID', '平台管理员不允许设置应用授权范围', 422);
  }
}

function assertCurrentRoleAllowsApplicationScopes(adminUser: AdminUserListRecord): void {
  const roleKey = getSingleEditableAdminRole(
    adminUser,
    'ADMIN_APPLICATION_SCOPE_INVALID',
    '只有单一应用管理员可以设置应用授权范围'
  );
  if (roleKey !== 'application_admin') {
    throw new AdminDomainError('ADMIN_APPLICATION_SCOPE_INVALID', '只有单一应用管理员可以设置应用授权范围', 422);
  }
}

function assertTargetAdminUserMaintainable(adminUser: AdminUserListRecord): void {
  getSingleEditableAdminRole(adminUser, 'ADMIN_USER_NOT_EDITABLE', '该管理员当前角色不支持维护');
}

function getSingleEditableAdminRole(
  adminUser: AdminUserListRecord,
  code: string,
  message: string
): (typeof WRITABLE_ADMIN_ROLE_KEYS)[number] {
  const roleKeys = adminUser.roles.map((role) => role.adminRole.roleKey);
  const roleKey = roleKeys[0];

  if (roleKeys.length === 1 && roleKey !== undefined && WRITABLE_ADMIN_ROLE_KEY_SET.has(roleKey)) {
    return roleKey as (typeof WRITABLE_ADMIN_ROLE_KEYS)[number];
  }

  throw new AdminDomainError(code, message, 422);
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function serializeAdminUserListItem(adminUser: AdminUserListRecord): AdminUserListItem {
  return {
    id: adminUser.id,
    feishuUserId: adminUser.feishuUserId,
    displayName: adminUser.displayName,
    status: adminUser.status,
    lastLoginAt: adminUser.lastLoginAt,
    createdAt: adminUser.createdAt,
    updatedAt: adminUser.updatedAt,
    roles: adminUser.roles.map((role) => ({
      roleKey: role.adminRole.roleKey,
      name: role.adminRole.name
    })),
    applicationScopes: adminUser.applicationScopes.map((scope) => ({
      id: scope.application.id,
      appKey: scope.application.appKey,
      name: scope.application.name,
      status: scope.application.status
    }))
  };
}
