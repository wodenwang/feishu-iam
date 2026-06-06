import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { Prisma, type Application } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditLogService } from "./audit-log.service";
import { assertApplicationKey } from "./permission.validators";
import {
  EntityStatus,
  type PermissionAuditContext,
  PermissionDomainError,
} from "./permission.types";

type CreateApplicationInput = {
  appKey: string;
  name: string;
  description?: string;
  ownerUserId?: string;
};

type UpdateApplicationInput = {
  name?: string;
  description?: string | null;
  ownerUserId?: string | null;
};

export type ListApplicationsInput = {
  page?: number;
  pageSize?: number;
  query?: string;
  status?: EntityStatus | "all";
  applicationIds?: string[];
};

export type ListApplicationsResult = {
  items: Application[];
  total: number;
  page: number;
  pageSize: number;
};

const SYSTEM_ACTOR = {
  actorType: "platform_token",
  actorId: "platform-admin-token",
  source: "platform_api",
};

type ApplicationClient = Pick<Prisma.TransactionClient, "application">;
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

@Injectable()
export class ApplicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async createApplication(
    input: CreateApplicationInput,
    auditContext?: PermissionAuditContext,
  ): Promise<Application> {
    return this.prisma.$transaction((tx) =>
      this.createApplicationInTransaction(input, tx, auditContext),
    );
  }

  async createApplicationInTransaction(
    input: CreateApplicationInput,
    tx: Prisma.TransactionClient,
    auditContext?: PermissionAuditContext,
  ): Promise<Application> {
    assertApplicationKey(input.appKey);

    try {
      const created = await tx.application.create({
        data: {
          id: randomUUID(),
          appKey: input.appKey,
          name: input.name,
          description: input.description ?? null,
          ownerUserId: input.ownerUserId ?? null,
        },
      });

      await this.recordAudit(
        created.id,
        created.id,
        "create",
        undefined,
        created,
        tx,
        auditContext,
      );
      return created;
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new PermissionDomainError(
          "APPLICATION_KEY_CONFLICT",
          "应用 key 已存在",
          409,
        );
      }
      throw error;
    }
  }

  async listApplications(
    input: ListApplicationsInput = {},
  ): Promise<ListApplicationsResult> {
    const { page, pageSize } = normalizePagination(input);
    const applicationIds = input.applicationIds;

    if (applicationIds && applicationIds.length === 0) {
      return {
        items: [],
        total: 0,
        page,
        pageSize,
      };
    }

    const where = buildApplicationListWhere(input);
    const [items, total] = await Promise.all([
      this.prisma.application.findMany({
        where,
        orderBy: {
          appKey: "asc",
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.application.count({
        where,
      }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
    };
  }

  async listAllApplications(): Promise<Application[]> {
    return this.prisma.application.findMany({
      orderBy: {
        appKey: "asc",
      },
    });
  }

  async getApplicationByKey(
    appKey: string,
    client: ApplicationClient = this.prisma,
  ): Promise<Application> {
    const application = await client.application.findUnique({
      where: {
        appKey,
      },
    });

    if (!application) {
      throw new PermissionDomainError(
        "APPLICATION_NOT_FOUND",
        "应用不存在",
        404,
      );
    }

    return application;
  }

  async updateApplication(
    appKey: string,
    input: UpdateApplicationInput,
    auditContext?: PermissionAuditContext,
  ): Promise<Application> {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.getApplicationByKey(appKey, tx);
      const updated = await tx.application.update({
        where: {
          appKey,
        },
        data: buildUpdateApplicationData(input),
      });

      await this.recordAudit(
        current.id,
        current.id,
        "update",
        current,
        updated,
        tx,
        auditContext,
      );
      return updated;
    });
  }

  async setApplicationStatus(
    appKey: string,
    status: EntityStatus,
    auditContext?: PermissionAuditContext,
  ): Promise<Application> {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.getApplicationByKey(appKey, tx);
      const updated = await tx.application.update({
        where: {
          appKey,
        },
        data: {
          status,
        },
      });

      await this.recordAudit(
        current.id,
        current.id,
        status === "active" ? "enable" : "disable",
        current,
        updated,
        tx,
        auditContext,
      );
      return updated;
    });
  }

  private async recordAudit(
    applicationId: string,
    resourceId: string,
    action: string,
    before: unknown,
    after: unknown,
    client: Prisma.TransactionClient,
    auditContext?: PermissionAuditContext,
  ): Promise<void> {
    const actor = {
      actorType: auditContext?.actorType ?? SYSTEM_ACTOR.actorType,
      actorId: auditContext?.actorId ?? SYSTEM_ACTOR.actorId,
      source: auditContext?.source ?? SYSTEM_ACTOR.source,
    };

    await this.audit.record(
      {
        ...actor,
        applicationId,
        resourceType: "application",
        resourceId,
        action,
        before,
        after,
        result: "success",
        requestId: auditContext?.requestId,
        ip: auditContext?.ip,
        userAgent: auditContext?.userAgent,
      },
      client,
    );
  }
}

function buildUpdateApplicationData(
  input: UpdateApplicationInput,
): UpdateApplicationInput {
  const data: UpdateApplicationInput = {};
  if (input.name !== undefined) {
    data.name = input.name;
  }
  if (input.description !== undefined) {
    data.description = input.description;
  }
  if (input.ownerUserId !== undefined) {
    data.ownerUserId = input.ownerUserId;
  }
  return data;
}

function buildApplicationListWhere(
  input: ListApplicationsInput,
): Prisma.ApplicationWhereInput {
  const where: Prisma.ApplicationWhereInput = {};
  const query = normalizeString(input.query);

  if (query) {
    where.OR = [
      { name: { contains: query, mode: "insensitive" } },
      { appKey: { contains: query, mode: "insensitive" } },
      { description: { contains: query, mode: "insensitive" } },
      { ownerUserId: { contains: query, mode: "insensitive" } },
    ];
  }

  if (input.status && input.status !== "all") {
    where.status = input.status;
  }

  if (input.applicationIds) {
    where.id = { in: input.applicationIds };
  }

  return where;
}

function normalizePagination(input: { page?: number; pageSize?: number }): {
  page: number;
  pageSize: number;
} {
  const page =
    Number.isInteger(input.page) && input.page && input.page > 0
      ? input.page
      : DEFAULT_PAGE;
  const rawPageSize =
    Number.isInteger(input.pageSize) && input.pageSize && input.pageSize > 0
      ? input.pageSize
      : DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, rawPageSize));
  return { page, pageSize };
}

function normalizeString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}
