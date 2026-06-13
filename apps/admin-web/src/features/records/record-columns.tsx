import { Eye } from "lucide-react";
import type { DataTableColumn } from "../../components/admin/DataTable";
import { StatusBadge } from "../../components/admin/StatusBadge";
import { Button } from "../../components/ui/button";
import type { RecordRow } from "./record-mappers";
import { formatDateTime, formatRunStatus } from "./record-mappers";

export type RecordColumnOptions = {
  detailLabel: string;
  onOpenDetail: (row: RecordRow) => void;
};

export function createRecordColumns(
  options: RecordColumnOptions,
): Array<DataTableColumn<RecordRow>> {
  return [
    {
      key: "action",
      header: "动作/类型",
      minWidth: "180px",
      render: (row) => (
        <span className="line-clamp-2 break-all font-medium">{row.action}</span>
      ),
    },
    {
      key: "target",
      header: "目标",
      minWidth: "220px",
      render: (row) => (
        <span className="line-clamp-2 break-all text-muted-foreground">
          {row.target}
        </span>
      ),
    },
    {
      key: "actor",
      header: "操作者/来源",
      minWidth: "180px",
      render: (row) => (
        <span className="line-clamp-2 break-all">{row.actor}</span>
      ),
    },
    {
      key: "result",
      header: "结果",
      width: "96px",
      nowrap: true,
      render: (row) => (
        <StatusBadge tone={statusTone(row.result)}>
          {formatResult(row.result)}
        </StatusBadge>
      ),
    },
    {
      key: "requestId",
      header: "request id",
      minWidth: "180px",
      render: (row) => (
        <span className="line-clamp-2 break-all text-muted-foreground">
          {row.requestId ? `request id: ${row.requestId}` : "-"}
        </span>
      ),
    },
    {
      key: "createdAt",
      header: "时间",
      minWidth: "160px",
      nowrap: true,
      render: (row) => (
        <span className="whitespace-nowrap">
          {formatDateTime(row.createdAt)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "操作",
      width: "112px",
      nowrap: true,
      render: (row) => (
        <Button
          aria-label={`查看 ${options.detailLabel} ${row.id}`}
          onClick={() => {
            options.onOpenDetail(row);
          }}
          size="sm"
          type="button"
          variant="outline"
        >
          <Eye aria-hidden="true" size={16} />
          详情
        </Button>
      ),
    },
  ];
}

function statusTone(
  result: string,
): "success" | "warning" | "danger" | "muted" {
  if (result === "success") {
    return "success";
  }
  if (result === "running") {
    return "warning";
  }
  if (result === "failed" || result === "failure" || result === "error") {
    return "danger";
  }
  return "muted";
}

export function formatResult(result: string): string {
  if (result === "running" || result === "success" || result === "failed") {
    return formatRunStatus(result);
  }
  return result;
}
