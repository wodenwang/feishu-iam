import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Home, ScrollText } from "lucide-react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";
import { DataTable } from "./DataTable";
import { DetailSheet } from "./DetailSheet";
import { PageHeader } from "./PageHeader";
import { PageState } from "./PageState";
import { SecretRevealPanel } from "./SecretRevealPanel";
import { StatusBadge } from "./StatusBadge";

const APP_SHELL_STORAGE_KEY = "feishu-iam:admin-sidebar-collapsed";
const storageState = new Map<string, string>();
const storageMock: Storage = {
  get length() {
    return storageState.size;
  },
  clear() {
    storageState.clear();
  },
  getItem(key: string) {
    return storageState.get(key) ?? null;
  },
  key(index: number) {
    return Array.from(storageState.keys())[index] ?? null;
  },
  removeItem(key: string) {
    storageState.delete(key);
  },
  setItem(key: string, value: string) {
    storageState.set(key, value);
  },
};

function ensureLocalStorage() {
  if (
    typeof window.localStorage.getItem === "function" &&
    typeof window.localStorage.setItem === "function"
  ) {
    return;
  }

  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: storageMock,
  });
}

function resetAppShellStorage() {
  ensureLocalStorage();
  window.localStorage.setItem(APP_SHELL_STORAGE_KEY, "false");
}

describe("admin components", () => {
  it("DataTable renders loading, empty, error and rows", () => {
    const columns = [
      {
        key: "name",
        header: "名称",
        render: (row: { name: string }) => row.name,
      },
    ];
    const { rerender } = render(
      <DataTable
        columns={columns}
        rows={[]}
        getRowKey={(row) => row.name}
        loading
      />,
    );
    expect(screen.getByText("正在加载")).toBeInTheDocument();

    rerender(
      <DataTable
        columns={columns}
        rows={[]}
        getRowKey={(row) => row.name}
        emptyText="暂无数据"
      />,
    );
    expect(screen.getByText("暂无数据")).toBeInTheDocument();

    rerender(
      <DataTable
        columns={columns}
        rows={[]}
        getRowKey={(row) => row.name}
        error="读取失败"
      />,
    );
    expect(screen.getByText("读取失败")).toBeInTheDocument();

    rerender(
      <DataTable
        columns={columns}
        rows={[{ name: "CRM" }]}
        getRowKey={(row) => row.name}
      />,
    );
    expect(screen.getByRole("cell", { name: "CRM" })).toBeInTheDocument();
  });

  it("PageState separates no-permission from empty state", () => {
    render(
      <PageState
        type="forbidden"
        title="没有权限"
        description="当前管理员无权访问该资源"
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("没有权限");
  });

  it("SecretRevealPanel copies secret and keeps the value in local panel only", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(
      <SecretRevealPanel label="client_secret" value="client-secret-value" />,
    );
    const region = screen.getByRole("region", { name: "client_secret" });
    expect(within(region).getByText("client-secret-value")).toBeInTheDocument();
    await userEvent.click(
      within(region).getByRole("button", { name: "复制 client_secret" }),
    );
    expect(writeText).toHaveBeenCalledWith("client-secret-value");
  });

  it("AppShell supports desktop collapse state, nav labels and localStorage persistence", async () => {
    resetAppShellStorage();
    const user = userEvent.setup();
    const renderShell = () =>
      render(
        <MemoryRouter>
          <AppShell
            brand={<span>Feishu IAM</span>}
            navItems={[
              {
                href: "/admin/home",
                label: "工作台",
                icon: <Home className="h-4 w-4" />,
                active: true,
              },
              {
                href: "/admin/system/audit",
                label: "操作审计",
                icon: <ScrollText className="h-4 w-4" />,
                active: false,
              },
            ]}
            userMenu={<button type="button">用户菜单</button>}
          >
            <div>页面内容</div>
          </AppShell>
        </MemoryRouter>,
      );

    const { unmount } = renderShell();
    expect(screen.getAllByRole("navigation", { name: "主菜单" })).toHaveLength(
      1,
    );
    expect(screen.getByRole("link", { name: "工作台" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    await user.click(screen.getByRole("button", { name: "收起主菜单" }));
    expect(window.localStorage.getItem(APP_SHELL_STORAGE_KEY)).toBe("true");
    expect(
      screen.getByRole("button", { name: "展开主菜单" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "工作台" })).toHaveAttribute(
      "title",
      "工作台",
    );
    expect(screen.getByText("工作台")).toHaveClass("sr-only");

    unmount();
    renderShell();
    expect(
      screen.getByRole("button", { name: "展开主菜单" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "工作台" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("AppShell renders grouped system management navigation in expanded and collapsed states", async () => {
    resetAppShellStorage();
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AppShell
          brand={<span>Feishu IAM</span>}
          navItems={[
            {
              href: "/admin/workspace",
              label: "工作台",
              icon: <Home className="h-4 w-4" />,
              active: false,
            },
            {
              href: "/admin/system",
              label: "系统管理",
              icon: <ScrollText className="h-4 w-4" />,
              active: true,
              children: [
                {
                  href: "/admin/system/feishu",
                  label: "飞书同步",
                  active: false,
                },
                {
                  href: "/admin/system/audit",
                  label: "操作审计",
                  active: true,
                },
              ],
            },
          ]}
          userMenu={<button type="button">用户菜单</button>}
        >
          <div>页面内容</div>
        </AppShell>
      </MemoryRouter>,
    );

    const nav = screen.getByRole("navigation", { name: "主菜单" });
    expect(within(nav).getByRole("link", { name: "工作台" })).toHaveClass(
      "w-full",
      "flex-1",
      "text-left",
    );
    expect(
      within(nav).getByRole("button", {
        name: "系统管理分组已展开，当前页面位于该分组下",
      }),
    ).toHaveClass("w-full", "flex-1", "text-left");
    expect(
      within(nav).getByRole("button", {
        name: "系统管理分组已展开，当前页面位于该分组下",
      }),
    ).not.toHaveAttribute("aria-current");
    expect(
      within(nav).getByRole("button", {
        name: "系统管理分组已展开，当前页面位于该分组下",
      }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(within(nav).getByRole("link", { name: "飞书同步" })).toHaveAttribute(
      "href",
      "/admin/system/feishu",
    );
    expect(within(nav).getByRole("link", { name: "操作审计" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    await user.click(screen.getByRole("button", { name: "收起主菜单" }));
    expect(screen.getByRole("link", { name: "系统管理" })).toHaveAttribute(
      "title",
      "系统管理",
    );
    expect(
      screen.queryByRole("link", { name: "飞书同步" }),
    ).not.toBeInTheDocument();
    await user.hover(screen.getByRole("link", { name: "系统管理" }));
    expect(await screen.findAllByText("飞书同步 / 操作审计")).not.toHaveLength(
      0,
    );
  });

  it("AppShell renders mobile drawer grouped navigation with surface text colors", async () => {
    resetAppShellStorage();
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AppShell
          brand={<span>Feishu IAM</span>}
          navItems={[
            {
              href: "/admin/workspace",
              label: "工作台",
              icon: <Home className="h-4 w-4" />,
              active: false,
            },
            {
              href: "/admin/system",
              label: "系统管理",
              icon: <ScrollText className="h-4 w-4" />,
              active: true,
              children: [
                {
                  href: "/admin/system/feishu",
                  label: "飞书同步",
                  active: false,
                },
                {
                  href: "/admin/system/audit",
                  label: "操作审计",
                  active: true,
                },
                {
                  href: "/admin/system/info",
                  label: "系统信息",
                  active: false,
                },
              ],
            },
          ]}
          userMenu={<button type="button">用户菜单</button>}
        >
          <div>页面内容</div>
        </AppShell>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "打开导航" }));
    const dialog = screen.getByRole("dialog", { name: "主菜单" });
    const mobileNav = within(dialog).getByRole("navigation", {
      name: "主菜单",
    });

    expect(
      within(mobileNav).getByRole("link", { name: "飞书同步" }),
    ).toHaveClass("text-muted-foreground");
    expect(
      within(mobileNav).getByRole("link", { name: "操作审计" }),
    ).toHaveClass("bg-primary");
    expect(
      within(mobileNav).getByRole("link", { name: "系统信息" }),
    ).toHaveClass("text-muted-foreground");
    expect(
      within(mobileNav).getByRole("link", { name: "飞书同步" }),
    ).not.toHaveClass("text-sidebar-foreground/80");
  });

  it("AppShell lets inactive grouped navigation expand and collapse with aria state", async () => {
    resetAppShellStorage();
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AppShell
          brand={<span>Feishu IAM</span>}
          navItems={[
            {
              href: "/admin/workspace",
              label: "工作台",
              icon: <Home className="h-4 w-4" />,
              active: true,
            },
            {
              href: "/admin/system",
              label: "系统管理",
              icon: <ScrollText className="h-4 w-4" />,
              active: false,
              children: [
                {
                  href: "/admin/system/feishu",
                  label: "飞书同步",
                  active: false,
                },
                {
                  href: "/admin/system/audit",
                  label: "操作审计",
                  active: false,
                },
              ],
            },
          ]}
          userMenu={<button type="button">用户菜单</button>}
        >
          <div>页面内容</div>
        </AppShell>
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "飞书同步" })).toBeInTheDocument();
    const collapseButton = screen.getByRole("button", {
      name: "收起系统管理子菜单",
    });
    expect(collapseButton).toHaveAttribute("aria-expanded", "true");

    await user.click(collapseButton);
    expect(
      screen.getByRole("button", { name: "展开系统管理子菜单" }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("link", { name: "飞书同步" }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "展开系统管理子菜单" }),
    );
    expect(
      screen.getByRole("button", { name: "收起系统管理子菜单" }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "飞书同步" })).toBeInTheDocument();
  });

  it("PageHeader renders breadcrumbs before title", () => {
    render(
      <MemoryRouter>
        <PageHeader
          breadcrumbs={[
            { label: "后台", href: "/admin/workspace" },
            { label: "操作审计", current: true },
          ]}
          title="操作审计"
          description="集中查询审计、安全事件和同步记录。"
        />
      </MemoryRouter>,
    );

    const nav = screen.getByRole("navigation", { name: "面包屑" });
    expect(within(nav).getByRole("link", { name: "后台" })).toHaveAttribute(
      "href",
      "/admin/workspace",
    );
    expect(within(nav).getByText("操作审计")).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("heading", { name: "操作审计" }),
    ).toBeInTheDocument();
  });

  it("DetailSheet switches between normal wide and full without remounting content", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <DetailSheet
        open
        title="角色详情"
        description={<span>测试详情宽度切换</span>}
        defaultSize="normal"
        onOpenChange={onOpenChange}
      >
        <label>
          角色名称
          <input aria-label="角色名称" defaultValue="审计员" />
        </label>
      </DetailSheet>,
    );

    const dialog = screen.getByRole("dialog", { name: "角色详情" });
    const input = within(dialog).getByLabelText("角色名称");
    await user.clear(input);
    await user.type(input, "审计管理员");

    await user.click(
      within(dialog).getByRole("button", { name: "切换为宽屏详情" }),
    );
    expect(within(dialog).getByLabelText("角色名称")).toHaveValue("审计管理员");

    await user.click(
      within(dialog).getByRole("button", { name: "切换为填满详情" }),
    );
    expect(within(dialog).getByLabelText("角色名称")).toHaveValue("审计管理员");
    expect(within(dialog).getByTestId("detail-sheet-body")).toHaveClass(
      "pb-24",
    );
  });

  it("DataTable applies column sizing and StatusBadge keeps short labels on one line", () => {
    const columns = [
      {
        key: "status",
        header: "状态",
        width: "96px",
        nowrap: true,
        render: (row: { status: string }) => (
          <StatusBadge tone="success">{row.status}</StatusBadge>
        ),
      },
      {
        key: "requestId",
        header: "request id",
        minWidth: "220px",
        render: (row: { requestId: string }) => <span>{row.requestId}</span>,
      },
    ];

    render(
      <DataTable
        aria-label="记录列表"
        columns={columns}
        rows={[{ status: "成功", requestId: "req-20260525-long-value" }]}
        getRowKey={(row) => row.requestId}
      />,
    );

    expect(screen.getByRole("columnheader", { name: "状态" })).toHaveStyle({
      width: "96px",
    });
    expect(screen.getByRole("table", { name: "记录列表" })).toHaveClass(
      "w-full",
    );
    expect(screen.getByRole("table", { name: "记录列表" })).toHaveClass(
      "table-fixed",
    );
    expect(
      screen.getByRole("columnheader", { name: "request id" }),
    ).toHaveStyle({
      minWidth: "220px",
    });
    expect(screen.getByText("成功")).toHaveClass("whitespace-nowrap");
  });
});
