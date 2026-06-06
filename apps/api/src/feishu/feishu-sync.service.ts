import { Inject, Injectable, Optional } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { FEISHU_CLIENT, type FeishuClient } from "./feishu-client";
import {
  FeishuClientError,
  isFeishuUserActive,
  type FeishuDepartmentItem,
  type FeishuSyncTriggerSource,
  type FeishuUserItem,
} from "./feishu.types";

export type RunFullSyncInput = {
  triggeredBy: string;
  triggerSource: FeishuSyncTriggerSource;
};

export type RunUserLightSyncInput = RunFullSyncInput & {
  userId: string;
};

export type RunDepartmentLightSyncInput = RunFullSyncInput & {
  departmentId: string;
};

type SyncCounters = {
  departmentCreatedCount: number;
  departmentUpdatedCount: number;
  departmentDeletedCount: number;
  userCreatedCount: number;
  userUpdatedCount: number;
  userDeletedCount: number;
  relationCreatedCount: number;
  relationUpdatedCount: number;
  relationDeletedCount: number;
};

type SyncCleanupClient = Pick<
  PrismaService,
  "feishuDepartment" | "feishuUser" | "feishuUserDepartment" | "feishuSyncRun"
>;

export type SyncResult = SyncCounters & {
  id: string;
  status: "success";
};

export type FeishuSyncServiceOptions = {
  now?: () => Date;
  staleRunningTimeoutMs?: number;
};

export const FEISHU_SYNC_OPTIONS = Symbol("FEISHU_SYNC_OPTIONS");
const DEFAULT_STALE_RUNNING_TIMEOUT_MS = 30 * 60 * 1000;

@Injectable()
export class FeishuSyncService {
  private readonly now: () => Date;
  private readonly staleRunningTimeoutMs: number;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(FEISHU_CLIENT) private readonly feishuClient: FeishuClient,
    @Optional()
    @Inject(FEISHU_SYNC_OPTIONS)
    options?: FeishuSyncServiceOptions,
  ) {
    this.now = options?.now ?? (() => new Date());
    this.staleRunningTimeoutMs =
      options?.staleRunningTimeoutMs ?? DEFAULT_STALE_RUNNING_TIMEOUT_MS;
  }

  async runFullSync(input: RunFullSyncInput): Promise<SyncResult> {
    const runId = randomUUID();
    const startedAt = this.now();
    let syncStage = "create-run";
    let runCreated = false;

    const counters = this.emptyCounters();
    const seenDepartmentIds = new Set<string>();
    const seenUserIds = new Set<string>();
    const seenRelationKeys = new Set<string>();

    try {
      await this.createRunningRun(runId, input, startedAt);
      runCreated = true;

      syncStage = "departments";
      const departmentIds = await this.syncDepartments(
        counters,
        seenDepartmentIds,
      );
      for (const departmentId of ["0", ...departmentIds]) {
        syncStage = `users:${departmentId}`;
        await this.syncUsersForDepartment(
          departmentId,
          counters,
          seenDepartmentIds,
          seenUserIds,
          seenRelationKeys,
        );
      }

      syncStage = "cleanup";
      await this.prisma.$transaction(async (tx) => {
        await this.cleanupStaleDataAndMarkSuccess(tx, {
          runId,
          counters,
          seenDepartmentIds,
          seenUserIds,
          seenRelationKeys,
        });
      });

      return { id: runId, status: "success", ...counters };
    } catch (error) {
      const clientError = this.toClientError(error, syncStage);
      if (runCreated) {
        await this.prisma.feishuSyncRun.update({
          where: { id: runId },
          data: {
            status: "failed",
            finishedAt: this.now(),
            errorCode: clientError.code,
            errorMessage: clientError.message,
            errorDetail: toJson(clientError.detail ?? {}),
            requestId: readStringDetail(clientError.detail, "request_id"),
          },
        });
      }
      throw clientError;
    }
  }

  async runUserLightSync(input: RunUserLightSyncInput): Promise<SyncResult> {
    const runId = randomUUID();
    const startedAt = this.now();
    let syncStage = "create-run";
    let runCreated = false;
    const counters = this.emptyCounters();
    const seenDepartmentIds = new Set<string>();
    const seenUserIds = new Set<string>();
    const seenRelationKeys = new Set<string>();

    try {
      await this.createRunningRun(runId, input, startedAt);
      runCreated = true;

      syncStage = "resolve-user";
      const departments = await this.prisma.feishuUserDepartment.findMany({
        where: { userId: input.userId, isDeleted: false },
        select: { departmentId: true },
      });
      if (departments.length === 0) {
        throw new FeishuClientError(
          "FEISHU_API_ERROR",
          "本地飞书用户没有可用部门关系，无法执行用户级轻量同步",
          {
            error_code: "FEISHU_LIGHT_SYNC_TARGET_NOT_FOUND",
            sync_stage: syncStage,
          },
        );
      }

      let synced = false;
      for (const relation of departments) {
        syncStage = `users:${relation.departmentId}`;
        seenDepartmentIds.add(relation.departmentId);
        synced = await this.syncSingleUserFromDepartment(
          input.userId,
          relation.departmentId,
          counters,
          seenDepartmentIds,
          seenUserIds,
          seenRelationKeys,
        ) || synced;
      }
      if (!synced) {
        throw new FeishuClientError(
          "FEISHU_API_ERROR",
          "未能从飞书部门成员列表刷新目标用户",
          {
            error_code: "FEISHU_LIGHT_SYNC_TARGET_NOT_FOUND",
            sync_stage: syncStage,
          },
        );
      }

      await this.markRunSuccess(runId, counters);
      return { id: runId, status: "success", ...counters };
    } catch (error) {
      await this.markRunFailed(runCreated, runId, error, syncStage);
      throw this.toClientError(error, syncStage);
    }
  }

  async runDepartmentLightSync(input: RunDepartmentLightSyncInput): Promise<SyncResult> {
    const runId = randomUUID();
    const startedAt = this.now();
    let syncStage = "create-run";
    let runCreated = false;
    const counters = this.emptyCounters();
    const seenDepartmentIds = new Set<string>([input.departmentId]);
    const seenUserIds = new Set<string>();
    const seenRelationKeys = new Set<string>();

    try {
      await this.createRunningRun(runId, input, startedAt);
      runCreated = true;

      syncStage = `departments:${input.departmentId}`;
      await this.syncDepartmentChildren(input.departmentId, counters, seenDepartmentIds);

      syncStage = `users:${input.departmentId}`;
      await this.syncUsersForDepartment(
        input.departmentId,
        counters,
        seenDepartmentIds,
        seenUserIds,
        seenRelationKeys,
      );

      await this.markRunSuccess(runId, counters);
      return { id: runId, status: "success", ...counters };
    } catch (error) {
      await this.markRunFailed(runCreated, runId, error, syncStage);
      throw this.toClientError(error, syncStage);
    }
  }

  private async createRunningRun(
    runId: string,
    input: RunFullSyncInput,
    startedAt: Date,
  ): Promise<void> {
    try {
      await this.releaseStaleRunningRuns(startedAt);
      await this.prisma.feishuSyncRun.create({
        data: {
          id: runId,
          triggeredBy: input.triggeredBy,
          triggerSource: input.triggerSource,
          status: "running",
          startedAt,
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new FeishuClientError(
          "FEISHU_API_ERROR",
          "已有飞书同步正在运行",
          {
            error_code: "FEISHU_SYNC_ALREADY_RUNNING",
            sync_stage: "lock",
          },
        );
      }
      throw error;
    }
  }

  private async releaseStaleRunningRuns(now: Date): Promise<void> {
    const staleBefore = new Date(now.getTime() - this.staleRunningTimeoutMs);
    await this.prisma.feishuSyncRun.updateMany({
      where: {
        status: "running",
        startedAt: { lt: staleBefore },
      },
      data: {
        status: "failed",
        finishedAt: now,
        errorCode: "FEISHU_SYNC_STALE_RUNNING",
        errorMessage: "上一次飞书同步未正常结束，已自动释放运行锁",
        errorDetail: toJson({
          sync_stage: "lock",
          reason: "stale_running_timeout",
        }),
      },
    });
  }

  private async syncDepartments(
    counters: SyncCounters,
    seenDepartmentIds: Set<string>,
  ): Promise<string[]> {
    const pending = ["0"];
    const syncedDepartmentIds: string[] = [];

    while (pending.length > 0) {
      const parentId = pending.shift() ?? "0";
      let pageToken: string | undefined;
      do {
        const page = await this.feishuClient.listDepartmentChildren({
          departmentId: parentId,
          pageSize: 50,
          pageToken,
        });

        for (const department of page.items) {
          const departmentId = await this.upsertDepartment(
            department,
            counters,
          );
          seenDepartmentIds.add(departmentId);
          syncedDepartmentIds.push(departmentId);
          pending.push(departmentId);
        }
        pageToken = page.pageToken;
      } while (pageToken);
    }

    return syncedDepartmentIds;
  }

  private async syncDepartmentChildren(
    parentDepartmentId: string,
    counters: SyncCounters,
    seenDepartmentIds: Set<string>,
  ): Promise<void> {
    let pageToken: string | undefined;
    do {
      const page = await this.feishuClient.listDepartmentChildren({
        departmentId: parentDepartmentId,
        pageSize: 50,
        pageToken,
      });

      for (const department of page.items) {
        const departmentId = await this.upsertDepartment(department, counters);
        seenDepartmentIds.add(departmentId);
      }
      pageToken = page.pageToken;
    } while (pageToken);
  }

  private async upsertDepartment(
    department: FeishuDepartmentItem,
    counters: SyncCounters,
  ): Promise<string> {
    const departmentId = this.resolveDepartmentId(department);
    const existingByDepartmentId =
      await this.prisma.feishuDepartment.findUnique({
        where: { departmentId },
      });
    const existingByOpenDepartmentId =
      existingByDepartmentId || !department.open_department_id
        ? null
        : await this.prisma.feishuDepartment.findUnique({
            where: { openDepartmentId: department.open_department_id },
          });
    const existing = existingByDepartmentId ?? existingByOpenDepartmentId;
    const syncedAt = new Date();
    const data = {
      openDepartmentId: department.open_department_id ?? null,
      parentDepartmentId: department.parent_department_id ?? null,
      name: department.name ?? departmentId,
      i18nName: toNullableJson(department.i18n_name),
      leaderUserId: department.leader_user_id ?? null,
      order: department.order ?? null,
      status: toJson(department.status ?? {}),
      rawPayload: toJson(department),
      lastSyncedAt: syncedAt,
      isDeleted: false,
    };

    if (existing && existing.departmentId !== departmentId) {
      await this.prisma.feishuDepartment.update({
        where: { departmentId: existing.departmentId },
        data: { departmentId, ...data },
      });
    } else {
      await this.prisma.feishuDepartment.upsert({
        where: { departmentId },
        create: { departmentId, ...data },
        update: data,
      });
    }

    if (existing) {
      counters.departmentUpdatedCount += 1;
    } else {
      counters.departmentCreatedCount += 1;
    }
    return departmentId;
  }

  private async syncUsersForDepartment(
    departmentId: string,
    counters: SyncCounters,
    seenDepartmentIds: Set<string>,
    seenUserIds: Set<string>,
    seenRelationKeys: Set<string>,
  ): Promise<void> {
    let pageToken: string | undefined;
    do {
      const page = await this.feishuClient.listDepartmentUsers({
        departmentId,
        pageSize: 50,
        pageToken,
      });

      for (const user of page.items) {
        await this.upsertUser(user, counters, seenUserIds);
        await this.upsertUserDepartments(
          user,
          departmentId,
          seenDepartmentIds,
          counters,
          seenRelationKeys,
        );
      }
      pageToken = page.pageToken;
    } while (pageToken);
  }

  private async syncSingleUserFromDepartment(
    userId: string,
    departmentId: string,
    counters: SyncCounters,
    seenDepartmentIds: Set<string>,
    seenUserIds: Set<string>,
    seenRelationKeys: Set<string>,
  ): Promise<boolean> {
    let pageToken: string | undefined;
    do {
      const page = await this.feishuClient.listDepartmentUsers({
        departmentId,
        pageSize: 50,
        pageToken,
      });

      for (const user of page.items) {
        if (user.user_id !== userId) {
          continue;
        }
        await this.upsertUser(user, counters, seenUserIds);
        await this.upsertUserDepartments(
          user,
          departmentId,
          seenDepartmentIds,
          counters,
          seenRelationKeys,
        );
        return true;
      }
      pageToken = page.pageToken;
    } while (pageToken);
    return false;
  }

  private async upsertUser(
    user: FeishuUserItem,
    counters: SyncCounters,
    seenUserIds: Set<string>,
  ): Promise<void> {
    if (!user.user_id) {
      throw new FeishuClientError("FEISHU_API_ERROR", "飞书用户缺少 user_id", {
        field: "user_id",
      });
    }
    const seenInCurrentRun = seenUserIds.has(user.user_id);
    const existing = await this.findExistingUser(user);
    const syncedAt = new Date();
    const data = {
      openId: user.open_id ?? null,
      unionId: user.union_id ?? null,
      name: user.name ?? user.user_id,
      enName: user.en_name ?? null,
      email: user.email ?? null,
      mobile: user.mobile ?? null,
      mobileVisible: user.mobile_visible ?? null,
      avatar: toNullableJson(user.avatar),
      employeeNo: user.employee_no ?? null,
      employeeType: user.employee_type ?? null,
      jobTitle: user.job_title ?? null,
      leaderUserId: user.leader_user_id ?? null,
      status: toJson(user.status ?? {}),
      rawPayload: toJson(user),
      lastSyncedAt: syncedAt,
      isActive: isFeishuUserActive(user.status),
      isDeleted: false,
    };

    if (existing && existing.userId !== user.user_id) {
      await this.prisma.feishuUser.update({
        where: { userId: existing.userId },
        data: { userId: user.user_id, ...data },
      });
    } else {
      await this.prisma.feishuUser.upsert({
        where: { userId: user.user_id },
        create: { userId: user.user_id, ...data },
        update: data,
      });
    }

    if (seenInCurrentRun) {
      return;
    }
    if (existing) {
      counters.userUpdatedCount += 1;
    } else {
      counters.userCreatedCount += 1;
    }
    seenUserIds.add(user.user_id);
  }

  private async findExistingUser(user: FeishuUserItem) {
    const existingByUserId = await this.prisma.feishuUser.findUnique({
      where: { userId: user.user_id },
    });
    if (existingByUserId) {
      return existingByUserId;
    }

    const existingByOpenId = user.open_id
      ? await this.prisma.feishuUser.findUnique({
          where: { openId: user.open_id },
        })
      : null;
    if (existingByOpenId) {
      return existingByOpenId;
    }

    return user.union_id
      ? await this.prisma.feishuUser.findUnique({
          where: { unionId: user.union_id },
        })
      : null;
  }

  private async upsertUserDepartments(
    user: FeishuUserItem,
    fallbackDepartmentId: string,
    seenDepartmentIds: Set<string>,
    counters: SyncCounters,
    seenRelationKeys: Set<string>,
  ): Promise<void> {
    const departmentIds = (
      user.department_ids && user.department_ids.length > 0
        ? user.department_ids
        : [fallbackDepartmentId]
    ).filter((departmentId) => seenDepartmentIds.has(departmentId));

    for (const departmentId of departmentIds) {
      const relationKey = `${user.user_id}:${departmentId}`;
      if (seenRelationKeys.has(relationKey)) {
        continue;
      }

      const order = user.orders?.find(
        (item) => item.department_id === departmentId,
      );
      const existing = await this.prisma.feishuUserDepartment.findUnique({
        where: { userId_departmentId: { userId: user.user_id, departmentId } },
      });
      const data = {
        isPrimary: order?.is_primary_dept === true,
        userOrder: order?.user_order ?? null,
        departmentOrder: order?.department_order ?? null,
        lastSyncedAt: new Date(),
        isDeleted: false,
      };

      await this.prisma.feishuUserDepartment.upsert({
        where: { userId_departmentId: { userId: user.user_id, departmentId } },
        create: { userId: user.user_id, departmentId, ...data },
        update: data,
      });

      if (existing) {
        counters.relationUpdatedCount += 1;
      } else {
        counters.relationCreatedCount += 1;
      }
      seenRelationKeys.add(relationKey);
    }
  }

  private async cleanupStaleDataAndMarkSuccess(
    client: SyncCleanupClient,
    input: {
      runId: string;
      counters: SyncCounters;
      seenDepartmentIds: Set<string>;
      seenUserIds: Set<string>;
      seenRelationKeys: Set<string>;
    },
  ): Promise<void> {
    input.counters.departmentDeletedCount = (
      await client.feishuDepartment.updateMany({
        where: {
          departmentId: { notIn: Array.from(input.seenDepartmentIds) },
          isDeleted: false,
        },
        data: { isDeleted: true, lastSyncedAt: new Date() },
      })
    ).count;
    input.counters.userDeletedCount = (
      await client.feishuUser.updateMany({
        where: {
          userId: { notIn: Array.from(input.seenUserIds) },
          isDeleted: false,
        },
        data: { isDeleted: true, isActive: false, lastSyncedAt: new Date() },
      })
    ).count;
    input.counters.relationDeletedCount = await this.markStaleRelationsDeleted(
      client,
      input.seenRelationKeys,
    );

    await client.feishuSyncRun.update({
      where: { id: input.runId },
      data: {
        status: "success",
        finishedAt: new Date(),
        ...input.counters,
      },
    });
  }

  private async markRunSuccess(runId: string, counters: SyncCounters): Promise<void> {
    await this.prisma.feishuSyncRun.update({
      where: { id: runId },
      data: {
        status: "success",
        finishedAt: new Date(),
        ...counters,
      },
    });
  }

  private async markRunFailed(
    runCreated: boolean,
    runId: string,
    error: unknown,
    syncStage: string,
  ): Promise<void> {
    if (!runCreated) {
      return;
    }
    const clientError = this.toClientError(error, syncStage);
    await this.prisma.feishuSyncRun.update({
      where: { id: runId },
      data: {
        status: "failed",
        finishedAt: this.now(),
        errorCode: clientError.code,
        errorMessage: clientError.message,
        errorDetail: toJson(clientError.detail ?? {}),
        requestId: readStringDetail(clientError.detail, "request_id"),
      },
    });
  }

  private async markStaleRelationsDeleted(
    client: SyncCleanupClient,
    seenRelationKeys: Set<string>,
  ): Promise<number> {
    const existingRelations = await client.feishuUserDepartment.findMany({
      where: { isDeleted: false },
      select: { userId: true, departmentId: true },
    });
    let deletedCount = 0;

    for (const relation of existingRelations) {
      const relationKey = `${relation.userId}:${relation.departmentId}`;
      if (seenRelationKeys.has(relationKey)) {
        continue;
      }

      await client.feishuUserDepartment.update({
        where: {
          userId_departmentId: {
            userId: relation.userId,
            departmentId: relation.departmentId,
          },
        },
        data: { isDeleted: true, lastSyncedAt: new Date() },
      });
      deletedCount += 1;
    }

    return deletedCount;
  }

  private toClientError(error: unknown, syncStage: string): FeishuClientError {
    if (error instanceof FeishuClientError) {
      return new FeishuClientError(error.code, error.message, {
        ...(error.detail ?? {}),
        sync_stage: readStringDetail(error.detail, "sync_stage") ?? syncStage,
      });
    }

    return new FeishuClientError("FEISHU_API_ERROR", "飞书同步失败", {
      sync_stage: syncStage,
      cause: error instanceof Error ? error.message : String(error),
    });
  }

  private emptyCounters(): SyncCounters {
    return {
      departmentCreatedCount: 0,
      departmentUpdatedCount: 0,
      departmentDeletedCount: 0,
      userCreatedCount: 0,
      userUpdatedCount: 0,
      userDeletedCount: 0,
      relationCreatedCount: 0,
      relationUpdatedCount: 0,
      relationDeletedCount: 0,
    };
  }

  private resolveDepartmentId(department: FeishuDepartmentItem): string {
    const departmentId =
      department.department_id ?? department.open_department_id;
    if (!departmentId) {
      throw new FeishuClientError(
        "FEISHU_API_ERROR",
        "飞书部门缺少可用部门 ID",
        {
          field: "department_id/open_department_id",
        },
      );
    }
    return departmentId;
  }
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function toNullableJson(
  value: unknown,
): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return value === undefined ? Prisma.DbNull : toJson(value);
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function readStringDetail(
  detail: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const value = detail?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
