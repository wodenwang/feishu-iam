import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminMe } from "../../admin-types";
import { fetchApplicationFeishuDepartments, fetchApplicationFeishuUsers } from "../../api/feishu";
import {
  fetchApplications,
  fetchIamRolesAcrossApplications,
  fetchIamRoles,
  fetchPermissionGroups,
  createIamRole,
  disableIamRole,
  enableIamRole,
  replaceIamRolePermissionGroups,
  replaceIamRoleSubjects,
} from "../../api/permission";
import { PermissionManagementView } from "./PermissionManagementView";

vi.mock("../../api/permission", () => ({
  fetchApplications: vi.fn(),
  fetchIamRolesAcrossApplications: vi.fn(),
  fetchPermissionGroups: vi.fn(),
  fetchIamRoles: vi.fn(),
  createIamRole: vi.fn(),
  disableIamRole: vi.fn(),
  enableIamRole: vi.fn(),
  replaceIamRolePermissionGroups: vi.fn(),
  replaceIamRoleSubjects: vi.fn(),
}));

vi.mock("../../api/feishu", () => ({
  fetchApplicationFeishuUsers: vi.fn(),
  fetchApplicationFeishuDepartments: vi.fn(),
}));

const admin: AdminMe = {
  adminUserId: "admin-1",
  feishuUserId: "ou_admin",
  displayName: "唐群管理员",
  roles: ["platform_admin"],
  applicationIds: [],
};

const application = {
  id: "app-1",
  appKey: "crm",
  name: "CRM 系统",
  description: "客户系统",
  ownerUserId: "ou_owner",
  status: "active" as const,
  createdAt: "2026-05-24T10:00:00.000Z",
  updatedAt: "2026-05-24T11:00:00.000Z",
};

const group = {
  id: "group-1",
  applicationId: "app-1",
  key: "crm.sales",
  name: "销售权限组",
  description: "销售权限集合",
  status: "active" as const,
  permissionPoints: [
    {
      id: "point-read",
      applicationId: "app-1",
      key: "crm.customer.read",
      name: "查看客户",
      description: "查看客户资料",
      status: "active" as const,
      createdAt: "2026-05-24T10:00:00.000Z",
      updatedAt: "2026-05-24T11:00:00.000Z",
    },
    {
      id: "point-export",
      applicationId: "app-1",
      key: "crm.customer.export",
      name: "导出客户",
      description: "导出客户资料",
      status: "active" as const,
      createdAt: "2026-05-24T10:00:00.000Z",
      updatedAt: "2026-05-24T11:00:00.000Z",
    },
  ],
  createdAt: "2026-05-24T10:00:00.000Z",
  updatedAt: "2026-05-24T11:00:00.000Z",
};

const groupTwo = {
  id: "group-2",
  applicationId: "app-1",
  key: "crm.audit",
  name: "审计权限组",
  description: "审计权限集合",
  status: "active" as const,
  createdAt: "2026-05-24T10:00:00.000Z",
  updatedAt: "2026-05-24T11:00:00.000Z",
};

const role = {
  id: "role-1",
  applicationId: "app-1",
  appKey: "crm",
  key: "crm.operator",
  name: "CRM 操作员",
  description: "处理客户资料",
  status: "active" as const,
  permissionGroups: [group],
  permissionGroupIds: [group.id],
  permissionPoints: [
    {
      id: "point-read",
      applicationId: "app-1",
      key: "crm.customer.read",
      name: "查看客户",
      description: "查看客户资料",
      status: "active" as const,
      createdAt: "2026-05-24T10:00:00.000Z",
      updatedAt: "2026-05-24T11:00:00.000Z",
    },
  ],
  subjects: [
    {
      type: "feishu_user" as const,
      id: "ou_user",
      displayName: "张三",
      avatarLabel: "张",
      subjectKindLabel: "用户" as const,
      displayPath: "唐群座椅 / 销售部",
    },
  ],
  createdAt: "2026-05-24T10:00:00.000Z",
  updatedAt: "2026-05-24T11:00:00.000Z",
};

describe("PermissionManagementView", () => {
  beforeEach(() => {
    vi.mocked(fetchApplications).mockResolvedValue([application]);
    vi.mocked(fetchIamRolesAcrossApplications).mockResolvedValue([role]);
    vi.mocked(fetchPermissionGroups).mockResolvedValue([group, groupTwo]);
    vi.mocked(fetchIamRoles).mockResolvedValue([role]);
    vi.mocked(createIamRole).mockResolvedValue({
      ...role,
      id: "role-created",
      key: "crm.auditor",
      name: "CRM 审计员",
    });
    vi.mocked(disableIamRole).mockResolvedValue({ ...role, status: "disabled" });
    vi.mocked(enableIamRole).mockResolvedValue(role);
    vi.mocked(replaceIamRolePermissionGroups).mockResolvedValue(undefined);
    vi.mocked(replaceIamRoleSubjects).mockResolvedValue(undefined);
    vi.mocked(fetchApplicationFeishuUsers).mockResolvedValue({
      items: [{ userId: "ou_new", name: "王文哲", isActive: true, isDeleted: false }],
      page: 1,
      pageSize: 20,
      total: 1,
    });
    vi.mocked(fetchApplicationFeishuDepartments).mockResolvedValue({
      items: [{ departmentId: "od_huizhou", name: "惠州唐群", parentDepartmentId: "0", isDeleted: false }],
      page: 1,
      pageSize: 20,
      total: 1,
    });
    window.history.pushState({}, "", "/admin/permissions?appKey=crm");
  });

  it("renders role table for the selected application", async () => {
    renderView();

    expect(await screen.findByText("CRM 操作员")).toBeInTheDocument();
    expect(screen.getAllByText("crm.operator").length).toBeGreaterThan(0);
    expect(screen.getAllByText("启用").length).toBeGreaterThan(0);
    expect(screen.queryByLabelText("应用列表")).not.toBeInTheDocument();
    expect(screen.getByLabelText("应用")).toHaveValue("crm");
  });

  it("keeps IAM role row actions in a single icon button group", async () => {
    renderView();

    await screen.findByText("CRM 操作员");
    const table = screen.getByRole("table", { name: "IAM 角色清单" });
    const actionsHeader = within(table).getByRole("columnheader", { name: "操作" });
    expect(actionsHeader).toHaveStyle({
      width: "132px",
      minWidth: "132px",
    });

    const detailButton = screen.getByRole("button", { name: "配置 crm.operator" });
    const actionBar = detailButton.parentElement;
    if (!actionBar) {
      throw new Error("未找到 IAM 角色操作按钮容器");
    }
    expect(actionBar).toHaveClass("flex", "w-full", "items-center", "justify-end", "gap-1.5");
    expect(actionBar).not.toHaveClass("flex-wrap");

    expect(detailButton).toHaveClass("h-8", "w-8", "min-h-8", "p-0");
    expect(detailButton).toHaveAttribute("title", "配置");
    expect(screen.getByRole("button", { name: "编辑 crm.operator" })).toHaveAttribute("title", "编辑");
    expect(screen.queryByRole("button", { name: "权限组" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "成员" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "停用 crm.operator" })).toHaveAttribute("title", "停用");
  });

  it("updates url when filtering and resetting roles", async () => {
    const user = userEvent.setup();
    renderView();

    await user.type(await screen.findByLabelText("角色查询"), "operator");
    await user.selectOptions(screen.getByLabelText("角色状态"), "enabled");
    await user.click(screen.getByRole("button", { name: "查询" }));

    expect(window.location.search).toContain("q=operator");
    expect(window.location.search).toContain("status=enabled");

    await user.click(screen.getByRole("button", { name: "重置" }));
    expect(window.location.search).toBe("?appKey=crm");
  });

  it("navigates to independent role workbench instead of opening a sheet", async () => {
    const user = userEvent.setup();

    renderView();

    await user.click(await screen.findByRole("button", { name: "配置 crm.operator" }));

    expect(window.location.pathname).toBe("/admin/permissions/roles/role-1");
    expect(window.location.search).toContain("appKey=crm");
    expect(window.location.search).toContain("from=");
    expect(screen.queryByRole("dialog", { name: "角色详情" })).not.toBeInTheDocument();
  });

  it("exposes role metadata creation from permission management", async () => {
    renderView();

    await screen.findByText("CRM 操作员");
    expect(screen.getByRole("button", { name: "创建角色" })).toBeInTheDocument();
    expect(screen.getByText(/统一管理角色资源/)).toBeInTheDocument();
  });

  it("lets platform admins create a role from the all-applications view after selecting an application", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/admin/permissions");
    renderView();

    await screen.findByText("CRM 操作员");
    await user.click(screen.getByRole("button", { name: "创建角色" }));

    const dialog = await screen.findByRole("dialog", { name: "创建 IAM 角色" });
    expect(within(dialog).getByLabelText("所属应用")).toBeInTheDocument();

    await user.selectOptions(within(dialog).getByLabelText("所属应用"), "crm");
    await user.type(within(dialog).getByLabelText("角色 key"), "crm.auditor");
    await user.type(within(dialog).getByLabelText("角色名称"), "CRM 审计员");
    await user.click(within(dialog).getByRole("button", { name: "创建角色" }));

    await waitFor(() => {
      expect(createIamRole).toHaveBeenCalledWith(
        "crm",
        expect.objectContaining({
          key: "crm.auditor",
          name: "CRM 审计员",
        }),
      );
    });
    expect(window.location.search).toContain("appKey=crm");
  });

  it("disables global role metadata actions for application admins", async () => {
    renderView({
      ...admin,
      roles: ["application_admin"],
      applicationIds: ["app-1"],
    });

    await screen.findByText("CRM 操作员");
    expect(screen.getByRole("button", { name: "创建角色" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "编辑 crm.operator" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "停用 crm.operator" })).toBeDisabled();
    expect(screen.getByLabelText("选择 crm.operator")).toBeDisabled();
    expect(screen.getByRole("button", { name: "配置 crm.operator" })).toBeEnabled();
  });

  it("shows forbidden state for 403 role responses instead of empty state", async () => {
    vi.mocked(fetchIamRoles).mockRejectedValueOnce(Object.assign(new Error("forbidden"), { status: 403 }));

    renderView();

    expect(await screen.findByText("没有权限")).toBeInTheDocument();
    expect(screen.queryByText("暂无 IAM 角色")).not.toBeInTheDocument();
  });

  it("bulk disables selected roles after confirmation and reloads the role list", async () => {
    const user = userEvent.setup();
    renderView();

    await user.click(await screen.findByLabelText("选择 crm.operator"));
    await user.click(screen.getByRole("button", { name: "批量停用" }));

    const confirm = await screen.findByRole("alertdialog", { name: "确认停用角色" });
    expect(confirm).toHaveTextContent("确认批量停用 1 个角色");
    const callsBeforeConfirm = vi.mocked(fetchIamRoles).mock.calls.length;
    await user.click(within(confirm).getByRole("button", { name: "确认" }));

    await waitFor(() => {
      expect(disableIamRole).toHaveBeenCalledWith("crm", "role-1");
      expect(vi.mocked(fetchIamRoles).mock.calls.length).toBeGreaterThan(callsBeforeConfirm);
    });
    expect(screen.getByText("已选择 0 个角色")).toBeInTheDocument();
  });
});

function renderView(overrides?: AdminMe) {
  render(
    <BrowserRouter>
      <PermissionManagementView admin={overrides ?? admin} />
    </BrowserRouter>,
  );
}
