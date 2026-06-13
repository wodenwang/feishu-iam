import type { CSSProperties, ReactNode } from "react";
import { useEffect, useState } from "react";
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

export type DataTableMobileField<T> = {
  label: string;
  render: (row: T) => ReactNode;
};

export type DataTableMobileCard<T> = {
  title: (row: T) => ReactNode;
  description?: (row: T) => ReactNode;
  fields?: Array<DataTableMobileField<T>>;
  actions?: (row: T) => ReactNode;
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
  mobileCard?: DataTableMobileCard<T>;
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
  mobileCard,
  "aria-label": ariaLabel,
}: DataTableProps<T>) {
  const renderMobileCards = useSmallViewport() && Boolean(mobileCard);

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
    <div className="grid gap-3">
      {renderMobileCards && mobileCard ? (
        <ul
          aria-label={`${ariaLabel ?? "数据"}移动端列表`}
          className="grid gap-3"
        >
          {rows.map((row) => (
            <li
              className="grid min-w-0 gap-3 rounded-md border bg-card p-4 shadow-sm"
              key={getRowKey(row)}
            >
              <div className="grid min-w-0 gap-1">
                <div className="break-words text-sm font-semibold text-foreground">
                  {mobileCard.title(row)}
                </div>
                {mobileCard.description ? (
                  <div className="break-all text-xs leading-5 text-muted-foreground">
                    {mobileCard.description(row)}
                  </div>
                ) : null}
              </div>
              {mobileCard.fields?.length ? (
                <dl className="grid gap-2 text-sm">
                  {mobileCard.fields.map((field) => (
                    <div
                      className="grid min-w-0 grid-cols-[88px_minmax(0,1fr)] gap-2"
                      key={field.label}
                    >
                      <dt className="text-muted-foreground">{field.label}</dt>
                      <dd className="min-w-0 break-words text-foreground">
                        {field.render(row)}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              {mobileCard.actions ? (
                <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                  {mobileCard.actions(row)}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {!renderMobileCards ? (
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
      ) : null}
    </div>
  );
}

function useSmallViewport(): boolean {
  const query = "(max-width: 767px)";
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(query).matches
      : false,
  );

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }
    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);

    const listener = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };
    mediaQuery.addEventListener("change", listener);
    return () => {
      mediaQuery.removeEventListener("change", listener);
    };
  }, []);

  return matches;
}
