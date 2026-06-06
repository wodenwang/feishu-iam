import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FeishuStatusService } from "../src/feishu/feishu-status.service";

type Row = Record<string, unknown>;

class CountModel {
  constructor(private readonly rows: Row[] = []) {}

  count(args?: { where?: Row }): Promise<number> {
    return Promise.resolve(
      this.rows.filter((row) => matches(row, args?.where)).length,
    );
  }
}

class SyncRunModel {
  constructor(private readonly rows: Row[]) {}

  findFirst(args?: {
    where?: Row;
    orderBy?: Record<string, string>;
  }): Promise<Row | null> {
    let rows = this.rows.filter((row) => matches(row, args?.where));
    if (args?.orderBy?.startedAt === "desc") {
      rows = rows.sort((a, b) =>
        String(b.startedAt).localeCompare(String(a.startedAt)),
      );
    }
    return Promise.resolve(rows[0] ?? null);
  }

  findMany(): Promise<Row[]> {
    return Promise.resolve(this.rows);
  }

  findUnique(): Promise<Row | null> {
    return Promise.resolve(null);
  }
}

function matches(row: Row, where?: Row): boolean {
  if (!where) {
    return true;
  }
  return Object.entries(where).every(([key, value]) => row[key] === value);
}

function makePrisma(syncRuns: Row[]) {
  return {
    feishuSyncRun: new SyncRunModel(syncRuns),
    feishuDepartment: new CountModel(),
    feishuUser: new CountModel(),
    feishuUserDepartment: new CountModel(),
  };
}

describe("FeishuStatusService", () => {
  let originalAppId: string | undefined;
  let originalAppSecret: string | undefined;

  beforeEach(() => {
    originalAppId = process.env.FEISHU_APP_ID;
    originalAppSecret = process.env.FEISHU_APP_SECRET;
  });

  afterEach(() => {
    restoreEnv("FEISHU_APP_ID", originalAppId);
    restoreEnv("FEISHU_APP_SECRET", originalAppSecret);
  });

  it("未配置飞书应用时返回 not_configured", async () => {
    delete process.env.FEISHU_APP_ID;
    delete process.env.FEISHU_APP_SECRET;

    const service = new FeishuStatusService(makePrisma([]) as never);
    await expect(service.getStatus()).resolves.toMatchObject({
      configStatus: "not_configured",
    });
  });

  it.each([
    ["running", "configured"],
    ["success", "connected"],
    ["failed", "failed"],
  ] as const)(
    "根据最近一次 run 状态 %s 推导配置状态 %s",
    async (runStatus, configStatus) => {
      process.env.FEISHU_APP_ID = "cli_test";
      process.env.FEISHU_APP_SECRET = "test-secret";
      const service = new FeishuStatusService(
        makePrisma([
          {
            id: "run-1",
            status: runStatus,
            startedAt: "2026-05-15T10:00:00.000Z",
          },
        ]) as never,
      );

      await expect(service.getStatus()).resolves.toMatchObject({
        configStatus,
      });
    },
  );

  it("同步记录暴露安全的失败阶段和 request id 供后台诊断", async () => {
    process.env.FEISHU_APP_ID = "cli_test";
    process.env.FEISHU_APP_SECRET = "test-secret";
    const service = new FeishuStatusService(
      makePrisma([
        {
          id: "run-1",
          status: "failed",
          startedAt: "2026-05-15T10:00:00.000Z",
          errorCode: "FEISHU_API_ERROR",
          errorMessage: "飞书同步失败",
          errorDetail: {
            sync_stage: "users:D001",
            cause: "Unique constraint failed on the fields: (`open_id`)",
            request_id: "req-feishu-1",
          },
          requestId: "req-feishu-1",
        },
      ]) as never,
    );

    const runs = await service.listRuns();

    expect(runs[0]).toMatchObject({
      id: "run-1",
      errorCode: "FEISHU_API_ERROR",
      errorMessage: "飞书同步失败",
      errorStage: "users:D001",
      requestId: "req-feishu-1",
    });
    expect(JSON.stringify(runs[0])).not.toContain("Unique constraint failed");
  });
});

function restoreEnv(
  key: "FEISHU_APP_ID" | "FEISHU_APP_SECRET",
  value: string | undefined,
): void {
  if (key === "FEISHU_APP_ID") {
    if (value === undefined) {
      delete process.env.FEISHU_APP_ID;
    } else {
      process.env.FEISHU_APP_ID = value;
    }
    return;
  }

  if (value === undefined) {
    delete process.env.FEISHU_APP_SECRET;
  } else {
    process.env.FEISHU_APP_SECRET = value;
  }
}
