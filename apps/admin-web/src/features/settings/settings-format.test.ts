import { describe, expect, it } from "vitest";
import type { FeishuSyncRun } from "../../api/feishu";
import {
  canQueryFeishuMirror,
  canTriggerFeishuFullSync,
  canTriggerFeishuLightSync,
  canTriggerFeishuSync,
  canViewFeishuSettings,
  durationText,
  formatConfigStatus,
  formatDiagnosticConclusion,
  formatFieldStatus,
  formatRunChange,
  formatRunStatus,
  formatSyncTriggerSource,
  formatSystemSettingsTab,
} from "./settings-format";

describe("settings-format", () => {
  it("formats setting tabs and Feishu states", () => {
    expect(formatSystemSettingsTab("feishu")).toBe("飞书同步");
    expect(formatSystemSettingsTab("runtime")).toBe("系统运行");
    expect(formatSystemSettingsTab("version")).toBe("版本信息");
    expect(formatRunStatus("success")).toBe("成功");
    expect(formatRunStatus("running")).toBe("运行中");
    expect(formatConfigStatus("not_configured")).toBe("未配置");
    expect(formatFieldStatus("present")).toBe("已返回");
    expect(formatDiagnosticConclusion("failed")).toBe("不可进入后续 SSO");
    expect(formatSyncTriggerSource("admin_web_user_light")).toBe("用户级轻量同步");
    expect(formatSyncTriggerSource("admin_web_department_light")).toBe("部门级轻量同步");
    expect(formatSyncTriggerSource("admin_web")).toBe("管理后台全量同步");
  });

  it("formats sync counters and duration", () => {
    const run: FeishuSyncRun = {
      id: "sync-run-1",
      status: "success",
      triggerSource: "admin_web",
      startedAt: "2026-05-25T08:00:00.000Z",
      finishedAt: "2026-05-25T08:00:03.000Z",
      departmentCreatedCount: 1,
      departmentUpdatedCount: 2,
      departmentDeletedCount: 3,
      userCreatedCount: 4,
      userUpdatedCount: 5,
      userDeletedCount: 6,
      relationCreatedCount: 7,
      relationUpdatedCount: 8,
      relationDeletedCount: 9,
    };

    expect(formatRunChange(null, 1, 2, 3)).toBe("+1 / ~2 / -3");
    expect(formatRunChange("部门", 1, 2, 3)).toBe("部门 +1 / ~2 / -3");
    expect(durationText(run)).toBe("3 秒");
    expect(durationText({ ...run, finishedAt: null })).toBe("运行中");
  });

  it("checks view and trigger permissions from admin roles", () => {
    expect(canViewFeishuSettings(["audit_viewer"])).toBe(true);
    expect(canViewFeishuSettings(["application_admin"])).toBe(false);
    expect(canTriggerFeishuSync(["audit_viewer"])).toBe(false);
    expect(canTriggerFeishuSync(["sync_admin"])).toBe(false);
    expect(canTriggerFeishuSync(["platform_admin"])).toBe(true);
    expect(canQueryFeishuMirror(["sync_admin"])).toBe(true);
    expect(canQueryFeishuMirror(["audit_viewer"])).toBe(false);
    expect(canTriggerFeishuLightSync(["sync_admin"])).toBe(true);
    expect(canTriggerFeishuLightSync(["audit_viewer"])).toBe(false);
    expect(canTriggerFeishuFullSync(["sync_admin"])).toBe(false);
    expect(canTriggerFeishuFullSync(["platform_admin"])).toBe(true);
  });
});
