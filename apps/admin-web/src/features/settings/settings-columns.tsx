import { Eye } from "lucide-react";
import type { FeishuSyncRun } from "../../api/feishu";
import type { DataTableColumn } from "../../components/admin/DataTable";
import { StatusBadge } from "../../components/admin/StatusBadge";
import { Button } from "../../components/ui/button";
import {
  durationText,
  formatDateTime,
  formatRunChange,
  formatRunStatus,
} from "./settings-format";

export type SyncRunRowAction = { type: "detail"; run: FeishuSyncRun };

export function createSyncRunColumns(options: {
  onAction: (action: SyncRunRowAction) => void;
}): DataTableColumn<FeishuSyncRun>[] {
  return [
    {
      key: "status",
      header: "状态",
      width: "96px",
      nowrap: true,
      render: (run) => (
        <StatusBadge
          tone={statusTone(run.status)}
          ariaLabel={`同步状态：${formatRunStatus(run.status)}`}
        >
          {formatRunStatus(run.status)}
        </StatusBadge>
      ),
    },
    {
      key: "triggerSource",
      header: "触发来源",
      minWidth: "120px",
      className: "break-all",
      render: (run) => run.triggerSource,
    },
    {
      key: "startedAt",
      header: "开始时间",
      minWidth: "160px",
      nowrap: true,
      render: (run) => formatDateTime(run.startedAt),
    },
    {
      key: "finishedAt",
      header: "结束时间",
      minWidth: "160px",
      nowrap: true,
      render: (run) =>
        run.finishedAt ? formatDateTime(run.finishedAt) : durationText(run),
    },
    {
      key: "departments",
      header: "部门",
      minWidth: "128px",
      nowrap: true,
      render: (run) =>
        formatRunChange(
          null,
          run.departmentCreatedCount,
          run.departmentUpdatedCount,
          run.departmentDeletedCount,
        ),
    },
    {
      key: "users",
      header: "用户",
      minWidth: "128px",
      nowrap: true,
      render: (run) =>
        formatRunChange(
          null,
          run.userCreatedCount,
          run.userUpdatedCount,
          run.userDeletedCount,
        ),
    },
    {
      key: "relations",
      header: "关系",
      minWidth: "128px",
      nowrap: true,
      render: (run) =>
        formatRunChange(
          null,
          run.relationCreatedCount,
          run.relationUpdatedCount,
          run.relationDeletedCount,
        ),
    },
    {
      key: "error",
      header: "诊断",
      minWidth: "260px",
      className: "max-w-xs break-all text-muted-foreground",
      render: (run) => formatRunDiagnostic(run),
    },
    {
      key: "actions",
      header: "操作",
      width: "88px",
      nowrap: true,
      render: (run) => (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            options.onAction({ type: "detail", run });
          }}
        >
          <Eye className="mr-1 h-4 w-4" aria-hidden="true" />
          详情
        </Button>
      ),
    },
  ];
}

function formatRunDiagnostic(run: FeishuSyncRun): string {
  if (run.status !== "failed") {
    return "-";
  }
  return [
    run.errorMessage ?? run.errorCode ?? "同步失败",
    run.errorStage ? `阶段：${run.errorStage}` : null,
    run.requestId ? `request id: ${run.requestId}` : null,
  ]
    .filter(Boolean)
    .join(" / ");
}

function statusTone(
  status: FeishuSyncRun["status"],
): "success" | "warning" | "danger" {
  if (status === "success") {
    return "success";
  }
  if (status === "running") {
    return "warning";
  }
  return "danger";
}
