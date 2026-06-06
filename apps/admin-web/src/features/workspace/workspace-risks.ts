import type { FeishuStatus, FeishuSyncRun } from "../../api/feishu";
import type { ApiStatus } from "../../api/status";
import {
  serializeRecordSearch,
  serializeSystemSettingsSearch,
} from "../../routes/admin-url-state";

export type WorkspaceRiskLevel = "danger" | "warning";

export type WorkspaceRisk = {
  id: string;
  title: string;
  description: string;
  source: string;
  level: WorkspaceRiskLevel;
  actionLabel: string;
  href: string;
};

export type WorkspaceHealthItem = {
  key: string;
  label: string;
  value: string;
  tone: "success" | "warning" | "danger" | "muted";
};

export type WorkspaceSyncSummary = {
  configStatus: string;
  latestRunStatus: string;
  latestRunHref: string;
  activeDepartments: string;
};

export function collectWorkspaceRisks(params: {
  apiStatus?: ApiStatus;
  feishuStatus?: FeishuStatus;
}): WorkspaceRisk[] {
  const risks: WorkspaceRisk[] = [];
  const { apiStatus, feishuStatus } = params;
  const latestRun = feishuStatus?.latestRun;

  if (feishuStatus && feishuStatus.configStatus !== "connected") {
    risks.push({
      id: "feishu-config",
      title: "飞书配置未连接",
      description: `当前配置状态为 ${formatConfigStatus(feishuStatus.configStatus)}，会影响登录和通讯录同步。`,
      source: "飞书同步",
      level: feishuStatus.configStatus === "failed" ? "danger" : "warning",
      actionLabel: "进入飞书同步",
      href: "/admin/system/feishu",
    });
  }

  if (latestRun?.status === "failed" || latestRun?.status === "running") {
    risks.push({
      id: `sync-run-${latestRun.status}`,
      title: latestRun.status === "failed" ? "最近同步失败" : "最近同步仍在运行",
      description:
        latestRun.status === "failed"
          ? latestRun.errorMessage ?? latestRun.errorCode ?? "最近一次飞书同步失败，需要查看同步记录定位原因。"
          : "最近一次飞书同步仍在运行，完成前用户和部门镜像可能不是最终状态。",
      source: "飞书同步记录",
      level: latestRun.status === "failed" ? "danger" : "warning",
      actionLabel: "查看同步记录",
      href: recordSyncHref(latestRun),
    });
  }

  if (apiStatus && apiStatus.health !== "ok") {
    risks.push({
      id: "api-health",
      title: "API 未处于 ok 状态",
      description: `当前 API health 为 ${apiStatus.health}，开放接口和后台操作可能不可用。`,
      source: "系统运行",
      level: "danger",
      actionLabel: "查看系统运行",
      href: systemRuntimeHref(),
    });
  }

  if (apiStatus && apiStatus.ready !== "ready") {
    risks.push({
      id: "db-ready",
      title: "数据库未 ready",
      description: `当前 DB ready 为 ${apiStatus.ready}，需要先恢复数据库连接或迁移状态。`,
      source: "系统运行",
      level: "danger",
      actionLabel: "查看系统运行",
      href: systemRuntimeHref(),
    });
  }

  if (feishuStatus && feishuStatus.counts.activeUsers === 0) {
    risks.push({
      id: "active-users",
      title: "有效用户为 0",
      description: "当前飞书镜像没有有效用户，第三方应用登录和管理员授权都会受影响。",
      source: "飞书用户镜像",
      level: "danger",
      actionLabel: "查看飞书同步",
      href: "/admin/system/feishu",
    });
  }

  return risks;
}

export function createWorkspaceHealthItems(params: {
  apiStatus?: ApiStatus;
  feishuStatus?: FeishuStatus;
}): WorkspaceHealthItem[] {
  const { apiStatus, feishuStatus } = params;

  return [
    {
      key: "api",
      label: "API",
      value: apiStatus?.health ?? "读取中",
      tone: apiStatus ? (apiStatus.health === "ok" ? "success" : "danger") : "muted",
    },
    {
      key: "db",
      label: "数据库",
      value: apiStatus?.ready ?? "读取中",
      tone: apiStatus ? (apiStatus.ready === "ready" ? "success" : "danger") : "muted",
    },
    {
      key: "version",
      label: "版本",
      value: apiStatus?.version ?? "读取中",
      tone: apiStatus ? "muted" : "muted",
    },
    {
      key: "active-users",
      label: "有效用户",
      value: typeof feishuStatus?.counts.activeUsers === "number" ? String(feishuStatus.counts.activeUsers) : "读取中",
      tone: feishuStatus ? (feishuStatus.counts.activeUsers > 0 ? "success" : "danger") : "muted",
    },
  ];
}

export function createWorkspaceSyncSummary(feishuStatus?: FeishuStatus): WorkspaceSyncSummary {
  const latestRun = feishuStatus?.latestRun;
  return {
    configStatus: formatConfigStatus(feishuStatus?.configStatus),
    latestRunStatus: latestRun ? formatRunStatus(latestRun.status) : "暂无记录",
    latestRunHref: latestRun ? recordSyncHref(latestRun) : recordSyncListHref(),
    activeDepartments:
      typeof feishuStatus?.counts.activeDepartments === "number"
        ? String(feishuStatus.counts.activeDepartments)
        : "读取中",
  };
}

export function formatConfigStatus(status?: FeishuStatus["configStatus"]): string {
  if (!status) {
    return "读取中";
  }

  const labels: Record<FeishuStatus["configStatus"], string> = {
    not_configured: "未配置",
    configured: "已配置但未验证",
    connected: "连接成功",
    failed: "连接失败",
  };
  return labels[status];
}

export function formatRunStatus(status: FeishuSyncRun["status"]): string {
  const labels: Record<FeishuSyncRun["status"], string> = {
    running: "运行中",
    success: "成功",
    failed: "失败",
  };
  return labels[status];
}

function recordSyncHref(run: FeishuSyncRun): string {
  const params = serializeRecordSearch({
    tab: "sync",
    page: 1,
    pageSize: 20,
    sort: "createdAt:desc",
    sheet: `sync:${run.id}`,
  });
  return `/admin/system/audit?${params.toString()}`;
}

function recordSyncListHref(): string {
  const params = serializeRecordSearch({
    tab: "sync",
    page: 1,
    pageSize: 20,
    sort: "createdAt:desc",
  });
  return `/admin/system/audit?${params.toString()}`;
}

function systemRuntimeHref(): string {
  const params = serializeSystemSettingsSearch({ tab: "runtime" });
  return `/admin/system/info?${params.toString()}`;
}
