import { Injectable } from "@nestjs/common";
import type { FeishuSyncRun } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { FeishuConnectionStatus } from "./feishu.types";

export type FeishuStatus = {
  configStatus: FeishuConnectionStatus;
  running: boolean;
  latestRun: SafeFeishuSyncRun | null;
  counts: {
    departments: number;
    activeDepartments: number;
    users: number;
    activeUsers: number;
    relations: number;
  };
};

export type SafeFeishuSyncRun = Pick<
  FeishuSyncRun,
  | "id"
  | "status"
  | "triggerSource"
  | "startedAt"
  | "finishedAt"
  | "departmentCreatedCount"
  | "departmentUpdatedCount"
  | "departmentDeletedCount"
  | "userCreatedCount"
  | "userUpdatedCount"
  | "userDeletedCount"
  | "relationCreatedCount"
  | "relationUpdatedCount"
  | "relationDeletedCount"
  | "errorCode"
  | "errorMessage"
> & {
  errorStage?: string | null;
  requestId?: string | null;
};

@Injectable()
export class FeishuStatusService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatus(): Promise<FeishuStatus> {
    const configured = Boolean(
      process.env.FEISHU_APP_ID && process.env.FEISHU_APP_SECRET,
    );
    const [
      runningRun,
      latestRun,
      departments,
      activeDepartments,
      users,
      activeUsers,
      relations,
    ] = await Promise.all([
      this.prisma.feishuSyncRun.findFirst({ where: { status: "running" } }),
      this.prisma.feishuSyncRun.findFirst({ orderBy: { startedAt: "desc" } }),
      this.prisma.feishuDepartment.count(),
      this.prisma.feishuDepartment.count({ where: { isDeleted: false } }),
      this.prisma.feishuUser.count(),
      this.prisma.feishuUser.count({
        where: { isDeleted: false, isActive: true },
      }),
      this.prisma.feishuUserDepartment.count({ where: { isDeleted: false } }),
    ]);

    return {
      configStatus: this.resolveConfigStatus(configured, latestRun),
      running: runningRun !== null,
      latestRun: latestRun ? sanitizeFeishuSyncRun(latestRun) : null,
      counts: {
        departments,
        activeDepartments,
        users,
        activeUsers,
        relations,
      },
    };
  }

  async listRuns(): Promise<SafeFeishuSyncRun[]> {
    const runs = await this.prisma.feishuSyncRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 50,
    });
    return runs.map(sanitizeFeishuSyncRun);
  }

  async getRun(id: string): Promise<SafeFeishuSyncRun | null> {
    const run = await this.prisma.feishuSyncRun.findUnique({ where: { id } });
    return run ? sanitizeFeishuSyncRun(run) : null;
  }

  private resolveConfigStatus(
    configured: boolean,
    latestRun: FeishuSyncRun | null,
  ): FeishuConnectionStatus {
    if (!configured) {
      return "not_configured";
    }
    if (latestRun?.status === "success") {
      return "connected";
    }
    if (latestRun?.status === "failed") {
      return "failed";
    }
    return "configured";
  }
}

export function sanitizeFeishuSyncRun(
  run: SafeFeishuSyncRun,
): SafeFeishuSyncRun {
  return {
    id: run.id,
    status: run.status,
    triggerSource: run.triggerSource,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    departmentCreatedCount: run.departmentCreatedCount,
    departmentUpdatedCount: run.departmentUpdatedCount,
    departmentDeletedCount: run.departmentDeletedCount,
    userCreatedCount: run.userCreatedCount,
    userUpdatedCount: run.userUpdatedCount,
    userDeletedCount: run.userDeletedCount,
    relationCreatedCount: run.relationCreatedCount,
    relationUpdatedCount: run.relationUpdatedCount,
    relationDeletedCount: run.relationDeletedCount,
    errorCode: run.errorCode,
    errorMessage: run.errorMessage,
    errorStage: readSyncStage(run),
    requestId: run.requestId ?? readRequestId(run),
  };
}

export function sanitizeFeishuStatus(status: FeishuStatus): FeishuStatus {
  return {
    ...status,
    latestRun: status.latestRun
      ? sanitizeFeishuSyncRun(status.latestRun)
      : null,
  };
}

function readSyncStage(run: SafeFeishuSyncRun | FeishuSyncRun): string | null {
  if ("errorStage" in run && typeof run.errorStage === "string") {
    return run.errorStage;
  }
  const detail = "errorDetail" in run ? run.errorDetail : undefined;
  return readJsonStringField(detail, "sync_stage");
}

function readRequestId(run: SafeFeishuSyncRun | FeishuSyncRun): string | null {
  const detail = "errorDetail" in run ? run.errorDetail : undefined;
  return readJsonStringField(detail, "request_id");
}

function readJsonStringField(value: unknown, field: string): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const fieldValue = (value as Record<string, unknown>)[field];
  return typeof fieldValue === "string" && fieldValue.length > 0
    ? fieldValue
    : null;
}
