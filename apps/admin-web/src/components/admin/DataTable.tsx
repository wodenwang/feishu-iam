import type { CSSProperties, ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { PageState } from "./PageState";

export type DataTableColumn<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
  width?: string;
  minWidth?: string;
  nowrap?: boolean;
};

export type DataTableProps<T> = {
  columns: Array<DataTableColumn<T>>;
  rows: T[];
  getRowKey: (row: T) => string;
  loading?: boolean;
  emptyText?: string;
  error?: string | null;
  forbidden?: boolean | string;
  className?: string;
  "aria-label"?: string;
};

function columnStyle(column: {
  width?: string;
  minWidth?: string;
}): CSSProperties | undefined {
  if (!column.width && !column.minWidth) {
    return undefined;
  }
  return {
    ...(column.width ? { width: column.width } : {}),
    ...(column.minWidth ? { minWidth: column.minWidth } : {}),
  };
}

function columnClassName(column: {
  className?: string;
  nowrap?: boolean;
}): string | undefined {
  return (
    [column.nowrap ? "whitespace-nowrap" : undefined, column.className]
      .filter(Boolean)
      .join(" ") || undefined
  );
}

function headerClassName(column: {
  headerClassName?: string;
  nowrap?: boolean;
}): string | undefined {
  return (
    [column.nowrap ? "whitespace-nowrap" : undefined, column.headerClassName]
      .filter(Boolean)
      .join(" ") || undefined
  );
}

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  loading = false,
  emptyText = "暂无数据",
  error,
  forbidden,
  className,
  "aria-label": ariaLabel,
}: DataTableProps<T>) {
  if (forbidden) {
    return (
      <PageState
        type="forbidden"
        title="没有权限"
        description={
          typeof forbidden === "string"
            ? forbidden
            : "当前管理员无权访问该资源。"
        }
      />
    );
  }

  if (error) {
    return (
      <PageState
        type="error"
        title={error}
        description="请检查筛选条件或稍后重试。"
      />
    );
  }

  if (loading) {
    return <PageState type="loading" title="正在加载" />;
  }

  if (rows.length === 0) {
    return <PageState type="empty" title={emptyText} />;
  }

  const tableClassName = [
    "overflow-x-auto rounded-md border bg-card shadow-sm",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={tableClassName}>
      <Table aria-label={ariaLabel} className="w-full table-fixed">
        <TableHeader>
          <TableRow className="bg-muted/60 hover:bg-muted/60">
            {columns.map((column) => (
              <TableHead
                key={column.key}
                className={headerClassName(column)}
                style={columnStyle(column)}
              >
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={getRowKey(row)} className="hover:bg-accent/45">
              {columns.map((column) => (
                <TableCell
                  key={column.key}
                  className={columnClassName(column)}
                  style={columnStyle(column)}
                >
                  {column.render(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
