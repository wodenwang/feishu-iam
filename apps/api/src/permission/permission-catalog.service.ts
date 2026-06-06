import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma, type Application, type PermissionGroup, type PermissionPoint } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ApplicationService } from './application.service';
import { AuditLogService } from './audit-log.service';
import { assertPermissionKey } from './permission.validators';
import { EntityStatus, type PermissionAuditContext, PermissionDomainError } from './permission.types';

type CreatePermissionGroupInput = {
  key: string;
  name: string;
  description?: string;
};

type UpdatePermissionGroupInput = {
  key?: string;
  name?: string;
  description?: string | null;
};

type CreatePermissionPointInput = {
  key: string;
  name: string;
  description?: string;
};

type UpdatePermissionPointInput = {
  key?: string;
  name?: string;
  description?: string | null;
};

const SYSTEM_ACTOR = {
  actorType: 'platform_token',
  actorId: 'platform-admin-token',
  source: 'platform_api'
};

type PermissionCatalogClient = Pick<
  Prisma.TransactionClient,
  'permissionGroup' | 'permissionPoint' | 'permissionGroupPoint'
>;

@Injectable()
export class PermissionCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly applications: ApplicationService,
    private readonly audit: AuditLogService
  ) {}

  async createPermissionGroup(
    appKey: string,
    input: CreatePermissionGroupInput,
    auditContext?: PermissionAuditContext
  ): Promise<PermissionGroup> {
    assertPermissionKey(appKey, input.key, 'permission_group');

    return this.prisma.$transaction(async (tx) => {
      const application = await this.applications.getApplicationByKey(appKey, tx);
      const created = await tx.permissionGroup.create({
        data: {
          id: randomUUID(),
          applicationId: application.id,
          key: input.key,
          name: input.name,
          description: input.description ?? null
        }
      });

      await this.recordAudit(application.id, 'permission_group', created.id, 'create', undefined, created, tx, auditContext);
      return created;
    });
  }

  async listPermissionGroups(appKey: string): Promise<PermissionGroup[]> {
    const application = await this.applications.getApplicationByKey(appKey);
    return this.prisma.permissionGroup.findMany({
      where: {
        applicationId: application.id
      },
      orderBy: {
        key: 'asc'
      }
    });
  }

  async updatePermissionGroup(
    appKey: string,
    groupId: string,
    input: UpdatePermissionGroupInput,
    auditContext?: PermissionAuditContext
  ): Promise<PermissionGroup> {
    if (input.key !== undefined) {
      assertPermissionKey(appKey, input.key, 'permission_group');
    }

    return this.prisma.$transaction(async (tx) => {
      const application = await this.applications.getApplicationByKey(appKey, tx);
      const current = await this.getPermissionGroup(tx, application, groupId);
      const updated = await tx.permissionGroup.update({
        where: {
          applicationId_id: {
            applicationId: application.id,
            id: groupId
          }
        },
        data: buildUpdatePermissionGroupData(input)
      });

      await this.recordAudit(application.id, 'permission_group', groupId, 'update', current, updated, tx, auditContext);
      return updated;
    });
  }

  async setPermissionGroupStatus(
    appKey: string,
    groupId: string,
    status: EntityStatus,
    auditContext?: PermissionAuditContext
  ): Promise<PermissionGroup> {
    return this.prisma.$transaction(async (tx) => {
      const application = await this.applications.getApplicationByKey(appKey, tx);
      const current = await this.getPermissionGroup(tx, application, groupId);
      const updated = await tx.permissionGroup.update({
        where: {
          applicationId_id: {
            applicationId: application.id,
            id: groupId
          }
        },
        data: {
          status
        }
      });

      await this.recordAudit(application.id, 'permission_group', groupId, 'set_status', current, updated, tx, auditContext);
      return updated;
    });
  }

  async replacePermissionGroupPoints(
    appKey: string,
    groupId: string,
    pointIds: string[],
    auditContext?: PermissionAuditContext
  ): Promise<void> {
    const uniquePointIds = new Set(pointIds);
    if (uniquePointIds.size !== pointIds.length) {
      throw new PermissionDomainError('PERMISSION_POINT_DUPLICATED', '权限点重复', 422);
    }

    await this.prisma.$transaction(async (tx) => {
      const application = await this.applications.getApplicationByKey(appKey, tx);
      const group = await this.getPermissionGroup(tx, application, groupId);
      const points = await tx.permissionPoint.findMany({
        where: {
          id: {
            in: pointIds
          }
        }
      });

      if (points.length !== uniquePointIds.size) {
        throw new PermissionDomainError('PERMISSION_POINT_NOT_FOUND', '权限点不存在', 404);
      }

      if (group.applicationId !== application.id || points.some((point) => point.applicationId !== application.id)) {
        throw new PermissionDomainError('CROSS_APPLICATION_BINDING_FORBIDDEN', '禁止跨应用绑定权限点', 422);
      }

      const data = pointIds.map((permissionPointId) => ({
        applicationId: application.id,
        permissionGroupId: groupId,
        permissionPointId
      }));

      await tx.permissionGroupPoint.deleteMany({
        where: {
          applicationId: application.id,
          permissionGroupId: groupId
        }
      });
      await tx.permissionGroupPoint.createMany({
        data,
        skipDuplicates: true
      });

      await this.recordAudit(
        application.id,
        'permission_group',
        groupId,
        'replace_permission_points',
        undefined,
        {
          permissionPointIds: pointIds
        },
        tx,
        auditContext
      );
    });
  }

  async createPermissionPoint(
    appKey: string,
    input: CreatePermissionPointInput,
    auditContext?: PermissionAuditContext
  ): Promise<PermissionPoint> {
    assertPermissionKey(appKey, input.key, 'permission_point');

    return this.prisma.$transaction(async (tx) => {
      const application = await this.applications.getApplicationByKey(appKey, tx);
      const created = await tx.permissionPoint.create({
        data: {
          id: randomUUID(),
          applicationId: application.id,
          key: input.key,
          name: input.name,
          description: input.description ?? null
        }
      });

      await this.recordAudit(application.id, 'permission_point', created.id, 'create', undefined, created, tx, auditContext);
      return created;
    });
  }

  async listPermissionPoints(appKey: string): Promise<PermissionPoint[]> {
    const application = await this.applications.getApplicationByKey(appKey);
    return this.prisma.permissionPoint.findMany({
      where: {
        applicationId: application.id
      },
      orderBy: {
        key: 'asc'
      }
    });
  }

  async updatePermissionPoint(
    appKey: string,
    pointId: string,
    input: UpdatePermissionPointInput,
    auditContext?: PermissionAuditContext
  ): Promise<PermissionPoint> {
    if (input.key !== undefined) {
      assertPermissionKey(appKey, input.key, 'permission_point');
    }

    return this.prisma.$transaction(async (tx) => {
      const application = await this.applications.getApplicationByKey(appKey, tx);
      const current = await this.getPermissionPoint(tx, application, pointId);
      const updated = await tx.permissionPoint.update({
        where: {
          applicationId_id: {
            applicationId: application.id,
            id: pointId
          }
        },
        data: buildUpdatePermissionPointData(input)
      });

      await this.recordAudit(application.id, 'permission_point', pointId, 'update', current, updated, tx, auditContext);
      return updated;
    });
  }

  async setPermissionPointStatus(
    appKey: string,
    pointId: string,
    status: EntityStatus,
    auditContext?: PermissionAuditContext
  ): Promise<PermissionPoint> {
    return this.prisma.$transaction(async (tx) => {
      const application = await this.applications.getApplicationByKey(appKey, tx);
      const current = await this.getPermissionPoint(tx, application, pointId);
      const updated = await tx.permissionPoint.update({
        where: {
          applicationId_id: {
            applicationId: application.id,
            id: pointId
          }
        },
        data: {
          status
        }
      });

      await this.recordAudit(application.id, 'permission_point', pointId, 'set_status', current, updated, tx, auditContext);
      return updated;
    });
  }

  private async getPermissionGroup(
    client: PermissionCatalogClient,
    application: Application,
    groupId: string
  ): Promise<PermissionGroup> {
    const group = await client.permissionGroup.findFirst({
      where: {
        id: groupId,
        applicationId: application.id
      }
    });

    if (!group) {
      throw new PermissionDomainError('PERMISSION_GROUP_NOT_FOUND', '权限组不存在', 404);
    }

    return group;
  }

  private async getPermissionPoint(
    client: PermissionCatalogClient,
    application: Application,
    pointId: string
  ): Promise<PermissionPoint> {
    const point = await client.permissionPoint.findFirst({
      where: {
        id: pointId,
        applicationId: application.id
      }
    });

    if (!point) {
      throw new PermissionDomainError('PERMISSION_POINT_NOT_FOUND', '权限点不存在', 404);
    }

    return point;
  }

  private async recordAudit(
    applicationId: string,
    resourceType: string,
    resourceId: string,
    action: string,
    before: unknown,
    after: unknown,
    client: Prisma.TransactionClient,
    auditContext?: PermissionAuditContext
  ): Promise<void> {
    await this.audit.record({
      actorType: auditContext?.actorType ?? SYSTEM_ACTOR.actorType,
      actorId: auditContext?.actorId ?? SYSTEM_ACTOR.actorId,
      source: auditContext?.source ?? SYSTEM_ACTOR.source,
      applicationId,
      resourceType,
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

function buildUpdatePermissionGroupData(input: UpdatePermissionGroupInput): UpdatePermissionGroupInput {
  const data: UpdatePermissionGroupInput = {};
  if (input.key !== undefined) {
    data.key = input.key;
  }
  if (input.name !== undefined) {
    data.name = input.name;
  }
  if (input.description !== undefined) {
    data.description = input.description;
  }
  return data;
}

function buildUpdatePermissionPointData(input: UpdatePermissionPointInput): UpdatePermissionPointInput {
  const data: UpdatePermissionPointInput = {};
  if (input.key !== undefined) {
    data.key = input.key;
  }
  if (input.name !== undefined) {
    data.name = input.name;
  }
  if (input.description !== undefined) {
    data.description = input.description;
  }
  return data;
}
