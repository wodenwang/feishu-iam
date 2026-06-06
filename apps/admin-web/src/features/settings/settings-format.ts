import type { AdminRoleKey } from "../../admin-types";
import type { ApiStatus } from "../../api/status";
import type {
  FeishuDiagnosticFieldStatus,
  FeishuDiagnosticStatus,
  FeishuStatus,
  FeishuSyncRun,
} from "../../api/feishu";
import type { SystemSettingsTab } from "../../routes/admin-url-state";

export function formatSystemSettingsTab(tab: SystemSettingsTab): string {
  const labels: Record<SystemSettingsTab, string> = {
    feishu: "飞书同步",
    runtime: "系统运行",
    version: "版本信息",
  };
  return labels[tab];
}

export function formatHealthStatus(status: ApiStatus["health"]): string {
  return status === "ok" ? "ok" : "error";
}

export function formatReadyStatus(status: ApiStatus["ready"]): string {
  const labels: Record<ApiStatus["ready"], string> = {
    ready: "ready",
    not_ready: "not_ready",
    error: "error",
  };
  return labels[status];
}

export function formatConfigStatus(status: FeishuStatus["configStatus"]): string {
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

export function formatSyncTriggerSource(source: string): string {
  const labels: Record<string, string> = {
    admin_web: "管理后台全量同步",
    admin_web_user_light: "用户级轻量同步",
    admin_web_department_light: "部门级轻量同步",
    admin_web_diagnostics: "字段诊断刷新",
    platform_api: "平台 API",
  };
  return labels[source] ?? source;
}

export function formatFieldStatus(status: FeishuDiagnosticFieldStatus): string {
  const labels: Record<FeishuDiagnosticFieldStatus, string> = {
    present: "已返回",
    empty: "空值",
    missing: "未返回",
    not_sampled: "未抽样到数据",
  };
  return labels[status];
}

export function formatDiagnosticConclusion(status: FeishuDiagnosticStatus): string {
  const labels: Record<FeishuDiagnosticStatus, string> = {
    passed: "可进入后续 SSO",
    warning: "字段不完整但可继续同步",
    failed: "不可进入后续 SSO",
    not_configured: "飞书未配置",
  };
  return labels[status];
}

export function formatDateTime(value?: string | null): string {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export function durationText(run: FeishuSyncRun): string {
  if (!run.finishedAt) {
    return "运行中";
  }
  const durationMs = new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime();
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return "-";
  }
  const seconds = Math.round(durationMs / 1000);
  return `${String(seconds)} 秒`;
}

export function formatRunChange(
  label: string | null,
  created: number,
  updated: number,
  deleted: number,
): string {
  const value = `+${String(created)} / ~${String(updated)} / -${String(deleted)}`;
  return label ? `${label} ${value}` : value;
}

export function canViewFeishuSettings(roles: AdminRoleKey[]): boolean {
  return roles.includes("platform_admin") || roles.includes("sync_admin") || roles.includes("audit_viewer");
}

export function canTriggerFeishuSync(roles: AdminRoleKey[]): boolean {
  return canTriggerFeishuFullSync(roles);
}

export function canQueryFeishuMirror(roles: AdminRoleKey[]): boolean {
  return roles.includes("platform_admin") || roles.includes("sync_admin");
}

export function canTriggerFeishuLightSync(roles: AdminRoleKey[]): boolean {
  return roles.includes("platform_admin") || roles.includes("sync_admin");
}

export function canTriggerFeishuFullSync(roles: AdminRoleKey[]): boolean {
  return roles.includes("platform_admin");
}
