import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Application, IamRole, PermissionGroup } from "../../api/permission";
import { PermissionRoleDetailSheet } from "./PermissionRoleDetailSheet";

const basePortal: Application = {
  id: "app-base-portal",
  appKey: "base-portal",
  name: "基础门户",
  description: "基础门户",
  ownerUserId: "ou-owner",
  status: "active",
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z",
};

const ssoDemo: Application = {
  id: "app-sso-demo",
  appKey: "feishu-iam-sso-demo",
  name: "飞书IAM的SSO DEMO",
  description: "SSO Demo",
  ownerUserId: "ou-owner",
  status: "active",
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z",
};

const group: PermissionGroup = {
  id: "group-1",
  applicationId: "app-base-portal",
  key: "base-portal.demo.embedded",
  name: "SSO Demo",
  description: "Base Portal 菜单",
  status: "active",
  permissionPoints: [
    {
      id: "point-1",
      applicationId: "app-base-portal",
      key: "base-portal.demo.read",
      name: "读取 Demo",
      description: "读取 Demo 页面",
      status: "active",
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z",
    },
  ],
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z",
};

const role: IamRole = {
  id: "role-1",
  applicationId: "app-base-portal",
  appKey: "base-portal",
  applications: [
    {
      applicationId: "app-base-portal",
      appKey: "base-portal",
      bindingStatus: "active",
      name: "基础门户",
      status: "active",
    },
    {
      applicationId: "app-sso-demo",
      appKey: "feishu-iam-sso-demo",
      bindingStatus: "active",
      name: "飞书IAM的SSO DEMO",
      status: "active",
    },
  ],
  key: "base-portal.admin",
  name: "财务管理员",
  description: "测试角色",
  status: "active",
  permissionGroups: [group],
  permissionGroupIds: [group.id],
  permissionPoints: [],
  subjects: [],
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z",
};

describe("PermissionRoleDetailSheet", () => {
  it("页面模式使用角色名称作为详情标题并保留基础信息概览", () => {
    render(
      <PermissionRoleDetailSheet
        appKey="base-portal"
        applications={[basePortal, ssoDemo]}
        canBindApplications
        canManageSubjects
        onOpenChange={vi.fn()}
        onSaved={vi.fn()}
        open
        permissionGroups={[group]}
        permissionGroupsById={new Map([[group.id, group]])}
        presentation="page"
        role={role}
      />,
    );

    expect(screen.getByRole("heading", { name: "财务管理员" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "基础信息概览" })).toBeInTheDocument();
  });

  it("shows the reduced role workbench tabs without base, audit, or permission comparison", () => {
    render(
      <PermissionRoleDetailSheet
        appKey="base-portal"
        applications={[basePortal, ssoDemo]}
        canBindApplications
        canManageSubjects
        onOpenChange={vi.fn()}
        onSaved={vi.fn()}
        open
        permissionGroups={[group]}
        permissionGroupsById={new Map([[group.id, group]])}
        presentation="page"
        role={role}
      />,
    );

    expect(screen.getByRole("tab", { name: "总览" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "组织与用户" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "应用权限" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "基础信息" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "变更记录" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("权限点对比")).not.toBeInTheDocument();
  });

  it("应用权限页使用纵向应用 tab 切换且不拉伸可选权限组面板", async () => {
    const user = userEvent.setup();
    const onAppKeyChange = vi.fn();

    render(
      <PermissionRoleDetailSheet
        activeTab="groups"
        appKey="base-portal"
        applications={[basePortal, ssoDemo]}
        canBindApplications
        canManageSubjects
        onActiveTabChange={vi.fn()}
        onAppKeyChange={onAppKeyChange}
        onBindApplication={vi.fn()}
        onOpenChange={vi.fn()}
        onSaved={vi.fn()}
        open
        permissionGroups={[group]}
        permissionGroupsById={new Map([[group.id, group]])}
        presentation="page"
        role={role}
      />,
    );

    const availableGroups = screen.getByRole("region", { name: "可选权限组" });
    expect(availableGroups).toHaveClass("content-start");
    expect(availableGroups.parentElement).toHaveClass("items-start");

    const appTabs = within(availableGroups).getByRole("tablist", { name: "当前应用" });
    expect(appTabs).toHaveAttribute("aria-orientation", "vertical");
    expect(within(availableGroups).queryByRole("combobox", { name: "当前应用" })).not.toBeInTheDocument();

    expect(within(appTabs).getByRole("tab", { name: /基础门户/ })).toHaveAttribute("aria-selected", "true");
    await user.click(within(appTabs).getByRole("tab", { name: /飞书IAM的SSO DEMO/ }));
    expect(onAppKeyChange).toHaveBeenCalledWith("feishu-iam-sso-demo");

    const permissionPreview = screen.getByRole("region", { name: "绑定结果预览" });
    expect(permissionPreview).toHaveClass("lg:max-h-[calc(100vh-7rem)]");
    expect(within(permissionPreview).queryByLabelText("权限点对比")).not.toBeInTheDocument();
  });

  it("opens the manage role applications dialog from application permissions", async () => {
    const user = userEvent.setup();

    render(
      <PermissionRoleDetailSheet
        activeTab="groups"
        appKey="base-portal"
        applications={[basePortal, ssoDemo]}
        canBindApplications
        canManageSubjects
        onActiveTabChange={vi.fn()}
        onAppKeyChange={vi.fn()}
        onBindApplication={vi.fn()}
        onOpenChange={vi.fn()}
        onSaved={vi.fn()}
        open
        permissionGroups={[group]}
        permissionGroupsById={new Map([[group.id, group]])}
        presentation="page"
        role={role}
      />,
    );

    await user.click(screen.getByRole("button", { name: "管理应用" }));
    const dialog = await screen.findByRole("dialog", { name: "管理角色关联应用" });
    expect(dialog).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText("搜索应用"), "sso");
    expect(within(dialog).getByText("飞书IAM的SSO DEMO")).toBeInTheDocument();
    expect(within(dialog).queryByText("基础门户")).not.toBeInTheDocument();
  });

  it("treats disabled role application bindings as restorable instead of active tabs", async () => {
    const user = userEvent.setup();
    const onBindApplication = vi.fn();
    const roleWithDisabledApplication: IamRole = {
      ...role,
      applications: [
        role.applications?.[0] as NonNullable<IamRole["applications"]>[number],
        {
          applicationId: "app-sso-demo",
          appKey: "feishu-iam-sso-demo",
          bindingStatus: "disabled",
          name: "飞书IAM的SSO DEMO",
          status: "active",
        },
      ],
    };

    render(
      <PermissionRoleDetailSheet
        activeTab="groups"
        appKey="base-portal"
        applications={[basePortal, ssoDemo]}
        canBindApplications
        canManageSubjects
        onActiveTabChange={vi.fn()}
        onAppKeyChange={vi.fn()}
        onBindApplication={onBindApplication}
        onOpenChange={vi.fn()}
        onSaved={vi.fn()}
        open
        permissionGroups={[group]}
        permissionGroupsById={new Map([[group.id, group]])}
        presentation="page"
        role={roleWithDisabledApplication}
      />,
    );

    const availableGroups = screen.getByRole("region", { name: "可选权限组" });
    const appTabs = within(availableGroups).getByRole("tablist", { name: "当前应用" });
    expect(within(appTabs).queryByRole("tab", { name: /飞书IAM的SSO DEMO/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "管理应用" }));
    const dialog = await screen.findByRole("dialog", { name: "管理角色关联应用" });
    expect(within(dialog).getByText("可恢复绑定")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "添加" }));
    expect(onBindApplication).toHaveBeenCalledWith("feishu-iam-sso-demo");
  });
});
