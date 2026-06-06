import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminMe } from "../../admin-types";
import {
  createAdminUser,
  disableAdminUser,
  enableAdminUser,
  fetchAdminUsers,
  updateAdminUserAuthorization,
} from "../../api/admin";
import type { AdminUser } from "../../api/admin";
import { searchFeishuUsers } from "../../api/feishu";
import { fetchApplications } from "../../api/permission";
import type { Application } from "../../api/permission";
import { AdminAuthorizationView } from "./AdminAuthorizationView";

vi.mock("../../api/admin", () => ({
  fetchAdminUsers: vi.fn(),
  createAdminUser: vi.fn(),
  updateAdminUserAuthorization: vi.fn(),
  enableAdminUser: vi.fn(),
  disableAdminUser: vi.fn(),
}));

vi.mock("../../api/permission", () => ({
  fetchApplications: vi.fn(),
}));

vi.mock("../../api/feishu", () => ({
  searchFeishuUsers: vi.fn(),
}));

const platformAdmin: AdminMe = {
  adminUserId: "admin-me",
  feishuUserId: "ou_me",
  displayName: "平台管理员",
  roles: ["platform_admin"],
  applicationIds: [],
};

const application: Application = {
  id: "app-finance",
  appKey: "finance",
  name: "财务系统",
  description: "财务",
  ownerUserId: "ou_owner",
  status: "active",
  createdAt: "2026-05-24T10:00:00.000Z",
  updatedAt: "2026-05-24T11:00:00.000Z",
};

const crmApplication: Application = {
  ...application,
  id: "app-crm",
  appKey: "crm",
  name: "CRM 系统",
};

const platformUser = makeAdminUser({
  id: "admin-platform",
  feishuUserId: "ou_platform",
  displayName: "赵平台",
  roles: [{ roleKey: "platform_admin", name: "平台管理员" }],
  applicationScopes: [],
});

const applicationUser = makeAdminUser({
  id: "admin-app",
  feishuUserId: "ou_app",
  displayName: "钱应用",
  roles: [{ roleKey: "application_admin", name: "应用管理员" }],
  applicationScopes: [{ id: "app-finance", appKey: "finance", name: "财务系统", status: "active" }],
});

const readonlyUser = makeAdminUser({
  id: "admin-readonly",
  feishuUserId: "ou_readonly",
  displayName: "孙历史",
  roles: [
    { roleKey: "platform_admin", name: "平台管理员" },
    { roleKey: "audit_viewer", name: "审计查看员" },
  ],
  applicationScopes: [],
});

describe("AdminAuthorizationView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchAdminUsers).mockResolvedValue({
      items: [platformUser, applicationUser, readonlyUser],
      total: 3,
      page: 1,
      pageSize: 20,
    });
    vi.mocked(fetchApplications).mockResolvedValue([application, crmApplication]);
    vi.mocked(searchFeishuUsers).mockResolvedValue([{ userId: "ou_new", name: "新增管理员" }]);
    vi.mocked(createAdminUser).mockResolvedValue(makeAdminUser({
      id: "admin-new",
      feishuUserId: "ou_new",
      displayName: "新增管理员",
      roles: [{ roleKey: "platform_admin", name: "平台管理员" }],
      applicationScopes: [],
    }));
    vi.mocked(updateAdminUserAuthorization).mockResolvedValue({
      ...applicationUser,
      applicationScopes: [{ id: "app-finance", appKey: "finance", name: "财务系统", status: "active" }],
    });
    vi.mocked(disableAdminUser).mockResolvedValue({ ...applicationUser, status: "disabled" });
    vi.mocked(enableAdminUser).mockResolvedValue({ ...applicationUser, status: "active" });
    window.history.pushState({}, "", "/admin/admins");
  });

  it("展示管理员清单并按搜索、角色、状态筛选", async () => {
    const user = userEvent.setup();
    renderView();

    const table = await screen.findByRole("table", { name: "管理员授权清单" });
    expect(within(table).getByText("赵平台")).toBeInTheDocument();
    expect(within(table).getByText("飞书 user_id: ou_platform")).toBeInTheDocument();
    expect(within(table).getByText("钱应用")).toBeInTheDocument();
    expect(within(table).getByText("孙历史")).toBeInTheDocument();

    const breadcrumb = screen.getByRole("navigation", { name: "面包屑" });
    expect(within(breadcrumb).getByText("后台")).toBeInTheDocument();
    expect(within(breadcrumb).getByText("系统管理")).toBeInTheDocument();
    expect(within(breadcrumb).getByText("管理员授权")).toHaveAttribute(
      "aria-current",
      "page",
    );

    await user.type(screen.getByLabelText("管理员搜索"), "finance");
    await user.selectOptions(screen.getByLabelText("角色筛选"), "application_admin");
    await user.selectOptions(screen.getByLabelText("状态筛选"), "active");
    await user.click(screen.getByRole("button", { name: "查询" }));

    expect(window.location.search).toContain("q=finance");
    expect(window.location.search).toContain("role=application_admin");
    expect(window.location.search).toContain("status=active");
    expect(await screen.findByText("钱应用")).toBeInTheDocument();
    expect(screen.queryByText("赵平台")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "重置" }));
    expect(window.location.search).toBe("");
    expect(await screen.findByText("赵平台")).toBeInTheDocument();
  });

  it("从 URL 打开详情 sheet，关闭时保留筛选条件", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/admin/admins?q=finance&role=application_admin&status=active&sheet=admin%3Aadmin-app");
    renderView();

    const sheet = await screen.findByRole("dialog", { name: "管理员详情" });
    expect(within(sheet).getAllByText("钱应用").length).toBeGreaterThan(0);
    expect(within(sheet).getAllByText("飞书 user_id: ou_app").length).toBeGreaterThan(0);
    expect(within(sheet).getByText(/可通过操作审计追溯/)).toBeInTheDocument();

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(window.location.search).not.toContain("sheet=");
    });
    expect(window.location.search).toContain("q=finance");
    expect(window.location.search).toContain("role=application_admin");
    expect(window.location.search).toContain("status=active");
  });

  it("新增应用管理员必须选择应用范围", async () => {
    const user = userEvent.setup();
    renderView();

    await user.click(await screen.findByRole("button", { name: "新增管理员" }));
    const dialog = await screen.findByRole("dialog", { name: "新增管理员" });
    await user.type(within(dialog).getByLabelText("飞书用户"), "ou_app_admin");
    await user.selectOptions(within(dialog).getByLabelText("管理员类型"), "application_admin");
    await user.click(within(dialog).getByRole("button", { name: "保存授权" }));

    expect(await within(dialog).findByText("应用管理员至少需要选择一个应用")).toBeInTheDocument();
    expect(createAdminUser).not.toHaveBeenCalled();
  });

  it("新增平台管理员成功后回到列表并展示成功反馈", async () => {
    const user = userEvent.setup();
    renderView();

    await user.click(await screen.findByRole("button", { name: "新增管理员" }));
    const dialog = await screen.findByRole("dialog", { name: "新增管理员" });
    expect(within(dialog).queryByRole("group", { name: "应用范围" })).not.toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("飞书用户"), "ou_new");
    await user.click(within(dialog).getByRole("button", { name: "保存授权" }));

    await waitFor(() => {
      expect(createAdminUser).toHaveBeenCalledWith({
        feishuUserId: "ou_new",
        roleKeys: ["platform_admin"],
        applicationIds: [],
      });
    });
    expect(window.location.search).not.toContain("sheet=admin");
    expect(screen.queryByRole("dialog", { name: "管理员详情" })).not.toBeInTheDocument();
    expect(await screen.findByText("已新增平台管理员：新增管理员")).toBeInTheDocument();
    expect(screen.getAllByText("新增管理员").length).toBeGreaterThan(1);
  });

  it("新增平台管理员被当前筛选排除时不打开空白详情", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/admin/admins?q=not-match");
    renderView();

    await user.click(await screen.findByRole("button", { name: "新增管理员" }));
    const dialog = await screen.findByRole("dialog", { name: "新增管理员" });
    await user.type(within(dialog).getByLabelText("飞书用户"), "ou_new");
    await user.click(within(dialog).getByRole("button", { name: "保存授权" }));

    expect(await screen.findByText("已新增平台管理员：新增管理员")).toBeInTheDocument();
    expect(window.location.search).toContain("q=not-match");
    expect(window.location.search).not.toContain("sheet=admin");
    expect(screen.queryByRole("dialog", { name: "管理员详情" })).not.toBeInTheDocument();
  });

  it("编辑应用管理员应用范围", async () => {
    const user = userEvent.setup();
    renderView();

    const row = (await screen.findByText("钱应用")).closest("tr");
    expect(row).not.toBeNull();
    await user.click(within(row as HTMLElement).getByRole("button", { name: "编辑" }));
    const dialog = await screen.findByRole("dialog", { name: "编辑管理员授权" });
    await user.click(within(dialog).getByRole("checkbox", { name: /CRM 系统\s*crm/ }));
    await user.click(within(dialog).getByRole("button", { name: "保存授权" }));

    await waitFor(() => {
      expect(updateAdminUserAuthorization).toHaveBeenCalledWith("admin-app", {
        roleKeys: ["application_admin"],
        applicationIds: ["app-finance", "app-crm"],
      });
    });
  });

  it("启停用前只打开确认框，确认后才调用接口", async () => {
    const user = userEvent.setup();
    renderView();

    const row = (await screen.findByText("钱应用")).closest("tr");
    expect(row).not.toBeNull();
    await user.click(within(row as HTMLElement).getByRole("button", { name: "停用" }));
    expect(disableAdminUser).not.toHaveBeenCalled();

    const dialog = await screen.findByRole("alertdialog", { name: "确认停用管理员" });
    expect(within(dialog).getByText(/可通过操作审计追溯/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "确认" }));

    await waitFor(() => {
      expect(disableAdminUser).toHaveBeenCalledWith("admin-app");
    });
  });

  it("启用停用管理员时保留失败错误并支持启用流程", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchAdminUsers).mockResolvedValueOnce({
      items: [{ ...applicationUser, status: "disabled" }],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    vi.mocked(enableAdminUser).mockRejectedValueOnce(new Error("无法切换管理员状态"));

    renderView();

    const row = (await screen.findByText("钱应用")).closest("tr");
    expect(row).not.toBeNull();
    await user.click(within(row as HTMLElement).getByRole("button", { name: "启用" }));
    expect(enableAdminUser).not.toHaveBeenCalled();

    const dialog = await screen.findByRole("alertdialog", { name: "确认启用管理员" });
    await user.click(within(dialog).getByRole("button", { name: "确认" }));

    await waitFor(() => {
      expect(enableAdminUser).toHaveBeenCalledWith("admin-app");
    });
    expect(await within(dialog).findByText(/无法切换管理员状态/)).toBeInTheDocument();
    expect(screen.getByRole("alertdialog", { name: "确认启用管理员" })).toBeInTheDocument();
  });

  it("历史只读角色不展示编辑和启停用操作", async () => {
    renderView();

    const row = (await screen.findByText("孙历史")).closest("tr");
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText("历史角色只读")).toBeInTheDocument();
    expect(within(row as HTMLElement).queryByRole("button", { name: "编辑" })).not.toBeInTheDocument();
    expect(within(row as HTMLElement).queryByRole("button", { name: "停用" })).not.toBeInTheDocument();
  });

  it("非平台管理员显示权限不足且不请求管理员和应用接口", async () => {
    renderView({
      roles: ["application_admin"],
      applicationIds: ["app-finance"],
    });

    expect(await screen.findByText("当前管理员无权管理管理员授权")).toBeInTheDocument();
    expect(fetchAdminUsers).not.toHaveBeenCalled();
    expect(fetchApplications).not.toHaveBeenCalled();
  });
});

function renderView(adminOverride?: Partial<AdminMe>) {
  render(
    <BrowserRouter>
      <AdminAuthorizationView admin={{ ...platformAdmin, ...adminOverride }} />
    </BrowserRouter>,
  );
}

function makeAdminUser(overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    id: "admin-user-1",
    feishuUserId: "ou_admin",
    displayName: "李四",
    roles: [{ roleKey: "platform_admin", name: "平台管理员" }],
    applicationScopes: [],
    status: "active",
    createdAt: "2026-05-24T10:00:00.000Z",
    ...overrides,
  };
}
