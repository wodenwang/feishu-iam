import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminMe } from "../../admin-types";
import { fetchApplicationFeishuDepartments, fetchApplicationFeishuUsers } from "../../api/feishu";
import {
  fetchApplications,
  fetchIamRoles,
  fetchPermissionGroups,
  replaceIamRolePermissionGroups,
  replaceIamRoleSubjects,
} from "../../api/permission";
import { PermissionManagementView } from "./PermissionManagementView";

vi.mock("../../api/permission", () => ({
  fetchApplications: vi.fn(),
  fetchPermissionGroups: vi.fn(),
  fetchIamRoles: vi.fn(),
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
    vi.mocked(fetchPermissionGroups).mockResolvedValue([group, groupTwo]);
    vi.mocked(fetchIamRoles).mockResolvedValue([role]);
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
      width: "88px",
      minWidth: "88px",
    });

    const detailButton = screen.getByRole("button", { name: "查看 crm.operator 详情" });
    const actionBar = detailButton.parentElement;
    if (!actionBar) {
      throw new Error("未找到 IAM 角色操作按钮容器");
    }
    expect(actionBar).toHaveClass("flex", "w-full", "items-center", "justify-end", "gap-1.5");
    expect(actionBar).not.toHaveClass("flex-wrap");

    expect(detailButton).toHaveClass("h-8", "w-8", "min-h-8", "p-0");
    expect(detailButton).toHaveAttribute("title", "详情");
    expect(screen.queryByRole("button", { name: "编辑" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "权限组" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "成员" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "停用" })).not.toBeInTheDocument();
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

  it("opens detail sheet from url and keeps filters when closing", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/admin/permissions?appKey=crm&q=CRM&status=enabled&page=2&pageSize=50&sheet=role%3Arole-1");

    renderView();

    const dialog = await screen.findByRole("dialog", { name: "角色详情" });
    expect(within(dialog).getByText(/销售权限组/)).toBeInTheDocument();

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(window.location.search).not.toContain("sheet=");
    });
    expect(window.location.search).toContain("q=CRM");
    expect(window.location.search).toContain("status=enabled");
    expect(window.location.search).toContain("page=2");
    expect(window.location.search).toContain("pageSize=50");
  });

  it("does not expose role metadata creation from permission management", async () => {
    renderView();

    await screen.findByText("CRM 操作员");
    expect(screen.queryByRole("button", { name: "创建角色" })).not.toBeInTheDocument();
    expect(screen.getByText(/角色元数据在应用管理维护/)).toBeInTheDocument();
  });

  it("binds permission groups from the role detail workspace after a diff confirmation", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/admin/permissions?appKey=crm&sheet=role%3Arole-1");

    renderView();

    const detail = await screen.findByRole("dialog", { name: "角色详情" });
    await user.click(within(detail).getByRole("tab", { name: "权限组绑定" }));
    await user.click(within(detail).getByLabelText("搜索权限组"));
    await user.click(within(detail).getByLabelText("搜索权限组"));
    await user.click(within(detail).getByText("审计权限组"));
    await user.click(within(detail).getByRole("button", { name: "保存权限组绑定" }));

    const confirm = await screen.findByRole("alertdialog", { name: "确认保存权限组绑定" });
    expect(confirm).toHaveTextContent("新增 1 个权限组");
    await user.click(within(confirm).getByRole("button", { name: "确认" }));

    await waitFor(() => {
      expect(replaceIamRolePermissionGroups).toHaveBeenCalledWith("crm", "role-1", ["group-1", "group-2"]);
    });
  });

  it("shows permission group points and searchable effective permission points", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/admin/permissions?appKey=crm&sheet=role%3Arole-1");

    renderView();

    const detail = await screen.findByRole("dialog", { name: "角色详情" });
    await user.click(within(detail).getByRole("tab", { name: "权限组绑定" }));
    await user.click(within(detail).getAllByRole("button", { name: "查看权限点" })[0] as HTMLElement);

    expect(within(detail).getAllByText("查看客户")).toHaveLength(2);
    expect(within(detail).getAllByText("导出客户")).toHaveLength(2);
    expect(within(detail).getByText("最终权限点")).toBeInTheDocument();
    const effectivePoints = within(detail).getByLabelText("最终权限点清单");
    expect(within(effectivePoints).getByText("crm.customer.read")).toBeInTheDocument();
    expect(within(effectivePoints).getByText("crm.customer.export")).toBeInTheDocument();
    expect(within(effectivePoints).getByText("直接 + 权限组")).toBeInTheDocument();
    expect(within(effectivePoints).getByText("权限组")).toBeInTheDocument();

    await user.type(within(detail).getByLabelText("搜索最终权限点"), "导出");

    const filteredEffectivePoints = within(detail).getByLabelText("最终权限点清单");
    expect(within(filteredEffectivePoints).queryByText("crm.customer.read")).not.toBeInTheDocument();
    expect(within(filteredEffectivePoints).getByText("crm.customer.export")).toBeInTheDocument();
  });

  it("searches and binds users and departments from the detail workspace", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/admin/permissions?appKey=crm&sheet=role%3Arole-1");

    renderView();

    const detail = await screen.findByRole("dialog", { name: "角色详情" });
    await user.click(within(detail).getByRole("tab", { name: "组织与用户绑定" }));
    await waitFor(() => {
      expect(fetchApplicationFeishuDepartments).toHaveBeenCalledWith(
        "crm",
        expect.objectContaining({ parentDepartmentId: null, page: 1, pageSize: 20 }),
      );
    });
    expect(fetchApplicationFeishuUsers).not.toHaveBeenCalledWith(
      "crm",
      expect.objectContaining({ departmentId: undefined, keyword: undefined }),
    );
    expect(within(detail).getAllByRole("region", { name: "待选组织用户列表" }).length).toBeGreaterThan(0);
    expect(within(detail).getAllByText("组织").length).toBeGreaterThan(0);
    expect(within(detail).queryByRole("button", { name: "选择用户" })).not.toBeInTheDocument();
    const orgButtons = await within(detail).findAllByRole("button", { name: "选择组织" });
    expect(orgButtons[0]).toBeDefined();
    await user.click(orgButtons[0] as HTMLElement);
    await user.click(within(detail).getByRole("button", { name: "进入组织 惠州唐群" }));
    await waitFor(() => {
      expect(fetchApplicationFeishuUsers).toHaveBeenCalledWith(
        "crm",
        expect.objectContaining({ departmentId: "od_huizhou", page: 1, pageSize: 20 }),
      );
    });
    const userButtons = await within(detail).findAllByRole("button", { name: "选择用户" });
    expect(userButtons[0]).toBeDefined();
    await user.click(userButtons[0] as HTMLElement);
    const searchInputs = within(detail).getAllByLabelText("搜索组织或用户");
    const searchInput = searchInputs[searchInputs.length - 1] as HTMLElement;
    await user.clear(searchInput);
    await user.type(searchInput, "王文哲");
    const searchButtons = within(detail).getAllByRole("button", { name: "搜索" });
    await user.click(searchButtons[searchButtons.length - 1] as HTMLElement);
    await waitFor(() => {
      expect(fetchApplicationFeishuUsers).toHaveBeenCalledWith(
        "crm",
        expect.objectContaining({ departmentId: undefined, keyword: "王文哲", page: 1, pageSize: 20 }),
      );
    });
    await user.click(within(detail).getByRole("button", { name: "保存主体绑定" }));

    const confirm = await screen.findByRole("alertdialog", { name: "确认保存组织与用户绑定" });
    expect(confirm).toHaveTextContent("新增 2 个主体");
    await user.click(within(confirm).getByRole("button", { name: "确认" }));

    await waitFor(() => {
      expect(replaceIamRoleSubjects).toHaveBeenCalledWith("crm", "role-1", expect.arrayContaining([
        expect.objectContaining({ type: "feishu_user", id: "ou_user" }),
        expect.objectContaining({
          type: "feishu_department",
          id: "od_huizhou",
          displayName: "惠州唐群",
          displayPath: "顶层组织 / 惠州唐群",
        }),
        expect.objectContaining({
          type: "feishu_user",
          id: "ou_new",
          displayName: "王文哲",
          displayPath: "顶层组织 / 惠州唐群",
        }),
      ]));
    });
  });

  it("shows selected subject names, avatar labels, types, paths and orphaned state", async () => {
    vi.mocked(fetchIamRoles).mockResolvedValueOnce([
      {
        ...role,
        subjects: [
          {
            type: "feishu_department",
            id: "od_finance",
            displayName: "财务部",
            avatarLabel: "财",
            subjectKindLabel: "组织",
            displayPath: "唐群座椅 / 财务部",
          },
          {
            type: "feishu_user",
            id: "ou_missing",
            displayName: "离职用户",
            avatarLabel: "离",
            subjectKindLabel: "用户",
            displayPath: "已失效或未同步",
            isOrphaned: true,
          },
        ],
      },
    ]);
    const user = userEvent.setup();
    window.history.pushState({}, "", "/admin/permissions?appKey=crm&sheet=role%3Arole-1");

    renderView();

    const detail = await screen.findByRole("dialog", { name: "角色详情" });
    await user.click(within(detail).getByRole("tab", { name: "组织与用户绑定" }));

    expect(within(detail).getByText("财务部")).toBeInTheDocument();
    expect(within(detail).getByText("财")).toBeInTheDocument();
    expect(within(detail).getAllByText("组织").length).toBeGreaterThan(0);
    expect(within(detail).getByText("唐群座椅 / 财务部")).toBeInTheDocument();
    expect(within(detail).getByText("离职用户")).toBeInTheDocument();
    expect(within(detail).getByText("离")).toBeInTheDocument();
    expect(within(detail).getAllByText("用户").length).toBeGreaterThan(0);
    expect(within(detail).getAllByText("已失效或未同步").length).toBeGreaterThan(0);
  });

  it("shows forbidden state for 403 role responses instead of empty state", async () => {
    vi.mocked(fetchIamRoles).mockRejectedValueOnce(Object.assign(new Error("forbidden"), { status: 403 }));

    renderView();

    expect(await screen.findByText("没有权限")).toBeInTheDocument();
    expect(screen.queryByText("暂无 IAM 角色")).not.toBeInTheDocument();
  });
});

function renderView() {
  render(
    <BrowserRouter>
      <PermissionManagementView admin={admin} />
    </BrowserRouter>,
  );
}
