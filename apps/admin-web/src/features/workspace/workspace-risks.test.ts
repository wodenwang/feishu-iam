import { describe, expect, it } from "vitest";
import type { FeishuStatus, FeishuSyncRun } from "../../api/feishu";
import {
  collectWorkspaceRisks,
  createWorkspaceHealthItems,
  createWorkspaceSyncSummary,
} from "./workspace-risks";

describe("workspace risk model", () => {
  it("maps Feishu config failures to system settings", () => {
    const risks = collectWorkspaceRisks({
      feishuStatus: makeStatus({ configStatus: "failed" }),
    });

    expect(risks).toContainEqual(
      expect.objectContaining({
        id: "feishu-config",
        title: "飞书配置未连接",
        level: "danger",
        href: "/admin/system/feishu",
      }),
    );
  });

  it("maps failed and running sync runs to refreshable record detail urls", () => {
    const failed = collectWorkspaceRisks({
      feishuStatus: makeStatus({
        latestRun: makeRun({ id: "sync-run-1", status: "failed" }),
      }),
    });
    const running = collectWorkspaceRisks({
      feishuStatus: makeStatus({
        latestRun: makeRun({ id: "sync-run-2", status: "running" }),
      }),
    });

    expect(failed).toContainEqual(
      expect.objectContaining({
        title: "最近同步失败",
        level: "danger",
        href: "/admin/system/audit?tab=sync&sheet=sync%3Async-run-1",
      }),
    );
    expect(running).toContainEqual(
      expect.objectContaining({
        title: "最近同步仍在运行",
        level: "warning",
        href: "/admin/system/audit?tab=sync&sheet=sync%3Async-run-2",
      }),
    );
  });

  it("maps API and DB runtime failures to the runtime settings tab", () => {
    const risks = collectWorkspaceRisks({
      apiStatus: { health: "error", ready: "not_ready", version: "0.10.1-dev" },
    });

    expect(risks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "api-health",
          href: "/admin/system/info?tab=runtime",
        }),
        expect.objectContaining({
          id: "db-ready",
          href: "/admin/system/info?tab=runtime",
        }),
      ]),
    );
  });

  it("maps zero active users to Feishu sync settings", () => {
    const risks = collectWorkspaceRisks({
      feishuStatus: makeStatus({
        configStatus: "connected",
        latestRun: makeRun({ status: "success" }),
        counts: {
          departments: 1,
          activeDepartments: 1,
          users: 2,
          activeUsers: 0,
          relations: 1,
        },
      }),
    });

    expect(risks).toEqual([
      expect.objectContaining({
        id: "active-users",
        title: "有效用户为 0",
        href: "/admin/system/feishu",
      }),
    ]);
  });

  it("does not invent risks while data is still loading", () => {
    expect(collectWorkspaceRisks({})).toEqual([]);
    expect(createWorkspaceHealthItems({})[0]).toMatchObject({
      label: "API",
      value: "读取中",
      tone: "muted",
    });
    expect(createWorkspaceSyncSummary()).toMatchObject({
      configStatus: "读取中",
      latestRunStatus: "暂无记录",
      latestRunHref: "/admin/system/audit?tab=sync",
    });
  });
});

function makeStatus(overrides?: Partial<FeishuStatus>): FeishuStatus {
  return {
    configStatus: "connected",
    running: false,
    latestRun: makeRun(),
    counts: {
      departments: 1,
      activeDepartments: 1,
      users: 1,
      activeUsers: 1,
      relations: 1,
    },
    ...overrides,
  };
}

function makeRun(overrides?: Partial<FeishuSyncRun>): FeishuSyncRun {
  return {
    id: "run-1",
    status: "success",
    triggerSource: "platform_api",
    startedAt: "2026-05-15T00:00:00.000Z",
    finishedAt: "2026-05-15T00:00:01.000Z",
    departmentCreatedCount: 1,
    departmentUpdatedCount: 0,
    departmentDeletedCount: 0,
    userCreatedCount: 1,
    userUpdatedCount: 0,
    userDeletedCount: 0,
    relationCreatedCount: 1,
    relationUpdatedCount: 0,
    relationDeletedCount: 0,
    errorCode: null,
    errorMessage: null,
    ...overrides,
  };
}
