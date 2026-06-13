import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button } from "../ui/button";
import { DataTable } from "./DataTable";

type Row = {
  id: string;
  name: string;
  key: string;
  status: string;
  updatedAt: string;
};

const rows: Row[] = [
  {
    id: "app-1",
    name: "客户管理系统",
    key: "crm.production.portal.long-key",
    status: "启用",
    updatedAt: "2026-06-13 15:00",
  },
];

describe("DataTable", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders desktop table by default", () => {
    render(
      <DataTable
        aria-label="应用清单"
        columns={[
          { key: "name", header: "应用", render: (row) => row.name },
          { key: "key", header: "app_key", render: (row) => row.key },
        ]}
        getRowKey={(row) => row.id}
        mobileCard={{
          title: (row) => row.name,
          description: (row) => row.key,
        }}
        rows={rows}
      />,
    );

    expect(screen.getByRole("table", { name: "应用清单" })).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "应用清单移动端列表" })).not.toBeInTheDocument();
  });

  it("renders mobile cards on small viewports", () => {
    vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
      matches: query === "(max-width: 767px)",
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(
      <DataTable
        aria-label="应用清单"
        columns={[
          { key: "name", header: "应用", render: (row) => row.name },
          { key: "key", header: "app_key", render: (row) => row.key },
        ]}
        getRowKey={(row) => row.id}
        mobileCard={{
          title: (row) => row.name,
          description: (row) => row.key,
          fields: [
            { label: "状态", render: (row) => row.status },
            { label: "更新时间", render: (row) => row.updatedAt },
          ],
          actions: (row) => <Button type="button">查看 {row.name}</Button>,
        }}
        rows={rows}
      />,
    );

    expect(screen.queryByRole("table", { name: "应用清单" })).not.toBeInTheDocument();
    expect(screen.getByRole("list", { name: "应用清单移动端列表" })).toBeInTheDocument();
    expect(screen.getByText("crm.production.portal.long-key")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "查看 客户管理系统" })).toBeInTheDocument();
  });

  it("keeps PageState behavior for empty, loading, error, and forbidden states", () => {
    const { rerender } = render(
      <DataTable columns={[]} getRowKey={(row: Row) => row.id} loading rows={[]} />,
    );
    expect(screen.getByText("正在加载")).toBeInTheDocument();

    rerender(<DataTable columns={[]} getRowKey={(row: Row) => row.id} rows={[]} />);
    expect(screen.getByText("暂无数据")).toBeInTheDocument();

    rerender(<DataTable columns={[]} error="无法读取列表" getRowKey={(row: Row) => row.id} rows={[]} />);
    expect(screen.getByText("无法读取列表")).toBeInTheDocument();

    rerender(<DataTable columns={[]} forbidden="没有权限访问" getRowKey={(row: Row) => row.id} rows={[]} />);
    expect(screen.getByText("没有权限")).toBeInTheDocument();
    expect(screen.getByText("没有权限访问")).toBeInTheDocument();
  });
});
