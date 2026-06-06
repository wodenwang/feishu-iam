import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminMe } from "../../admin-types";
import {
  createApplication,
  createIamRole,
  disableApplication,
  disableIamRole,
  enableApplication,
  enableIamRole,
  fetchApplicationPage,
  fetchIamRoles,
  updateApplication,
  updateIamRole,
} from "../../api/permission";
import {
  createApplicationRedirectUri,
  disableApplicationRedirectUri,
  fetchApplicationDeveloperCredential,
  fetchApplicationOauthCredential,
  fetchApplicationRedirectUris,
  fetchIntegrationPrompt,
  rotateApplicationClientSecret,
  viewApplicationClientSecret,
} from "../../api/oauth";
import { ApplicationManagementPage } from "../../routes/ApplicationManagementPage";

vi.mock("../../api/permission", () => ({
  fetchApplicationPage: vi.fn(),
  createApplication: vi.fn(),
  updateApplication: vi.fn(),
  enableApplication: vi.fn(),
  disableApplication: vi.fn(),
  fetchIamRoles: vi.fn(),
  createIamRole: vi.fn(),
  updateIamRole: vi.fn(),
  enableIamRole: vi.fn(),
  disableIamRole: vi.fn(),
}));

vi.mock("../../api/oauth", () => ({
  fetchApplicationRedirectUris: vi.fn(),
  createApplicationRedirectUri: vi.fn(),
  disableApplicationRedirectUri: vi.fn(),
  fetchApplicationOauthCredential: vi.fn(),
  fetchApplicationDeveloperCredential: vi.fn(),
  fetchIntegrationPrompt: vi.fn(),
  viewApplicationClientSecret: vi.fn(),
  rotateApplicationClientSecret: vi.fn(),
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
  integrationSummary: {
    redirectUriCount: 1,
    activeRedirectUriCount: 1,
    oauthClientCount: 1,
    activeOauthClientCount: 1,
    developerCredentialCount: 1,
    activeDeveloperCredentialCount: 1,
    iamRoleCount: 1,
    activeIamRoleCount: 1,
  },
};

let writeClipboard: ReturnType<typeof vi.fn>;

describe("ApplicationManagementPage v0.11.2", () => {
  beforeEach(() => {
    writeClipboard = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      writable: true,
      value: {
        writeText: writeClipboard,
      },
    });
    vi.mocked(fetchApplicationPage).mockResolvedValue({
      items: [application],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    vi.mocked(fetchApplicationRedirectUris).mockResolvedValue([
      {
        id: "uri-1",
        redirectUri: "https://crm.example.com/callback",
        status: "active",
      },
    ]);
    vi.mocked(fetchApplicationOauthCredential).mockResolvedValue({
      id: "client-1",
      clientId: "client_crm",
      status: "active",
      lastUsedAt: null,
    });
    vi.mocked(fetchApplicationDeveloperCredential).mockResolvedValue({
      id: "dev-1",
      name: "CRM developer credential",
      status: "active",
      lastUsedAt: null,
      rotatedAt: null,
    });
    vi.mocked(fetchIntegrationPrompt).mockResolvedValue({
      integrationPrompt:
        "接入 CRM 的 Codex 提示词\nclient_secret: <请轮换后填入>",
    });
    vi.mocked(fetchIamRoles).mockResolvedValue([
      {
        id: "role-1",
        applicationId: "app-1",
        appKey: "crm",
        key: "crm.admin",
        name: "CRM 管理员",
        description: "管理 CRM",
        status: "active",
        createdAt: "2026-05-24T10:00:00.000Z",
        updatedAt: "2026-05-24T11:00:00.000Z",
      },
    ]);
    vi.mocked(updateApplication).mockResolvedValue({
      ...application,
      name: "CRM 生产系统",
    });
    vi.mocked(createApplicationRedirectUri).mockResolvedValue({
      id: "uri-2",
      redirectUri: "https://crm.example.com/next-callback",
      status: "active",
    });
    vi.mocked(disableApplicationRedirectUri).mockResolvedValue({
      id: "uri-1",
      redirectUri: "https://crm.example.com/callback",
      status: "disabled",
    });
    vi.mocked(createIamRole).mockResolvedValue({
      id: "role-2",
      applicationId: "app-1",
      appKey: "crm",
      key: "crm.viewer",
      name: "CRM 查看员",
      description: "查看 CRM",
      status: "active",
      createdAt: "2026-05-24T10:00:00.000Z",
      updatedAt: "2026-05-24T11:00:00.000Z",
    });
    vi.mocked(updateIamRole).mockResolvedValue({
      id: "role-1",
      applicationId: "app-1",
      appKey: "crm",
      key: "crm.admin",
      name: "CRM 超级管理员",
      description: "管理 CRM",
      status: "active",
      createdAt: "2026-05-24T10:00:00.000Z",
      updatedAt: "2026-05-24T12:00:00.000Z",
    });
    vi.mocked(enableIamRole).mockResolvedValue({
      id: "role-1",
      applicationId: "app-1",
      appKey: "crm",
      key: "crm.admin",
      name: "CRM 管理员",
      description: "管理 CRM",
      status: "active",
      createdAt: "2026-05-24T10:00:00.000Z",
      updatedAt: "2026-05-24T11:00:00.000Z",
    });
    vi.mocked(disableIamRole).mockResolvedValue({
      id: "role-1",
      applicationId: "app-1",
      appKey: "crm",
      key: "crm.admin",
      name: "CRM 管理员",
      description: "管理 CRM",
      status: "disabled",
      createdAt: "2026-05-24T10:00:00.000Z",
      updatedAt: "2026-05-24T11:00:00.000Z",
    });
    vi.mocked(viewApplicationClientSecret).mockResolvedValue({
      clientId: "client_crm",
      clientSecret: "viewed-secret",
    });
    vi.mocked(rotateApplicationClientSecret).mockResolvedValue({
      clientId: "client_crm",
      clientSecret: "rotated-secret",
    });
    vi.mocked(createApplication).mockResolvedValue({
      application: {
        ...application,
        appKey: "erp",
        name: "ERP 系统",
        id: "app-2",
      },
      redirectUris: [
        {
          id: "uri-2",
          redirectUri: "https://erp.example.com/callback",
          status: "active",
        },
      ],
      oauthCredential: {
        id: "client-2",
        clientId: "client_erp",
        status: "active",
      },
      clientSecret: "created-client-secret",
      developerCredential: {
        id: "dev-2",
        name: "ERP developer credential",
        status: "active",
      },
      developerApiToken: "created-developer-token",
      integrationPrompt: "接入 ERP 的 Codex 提示词",
    });
    vi.mocked(enableApplication).mockResolvedValue({
      ...application,
      status: "active",
    });
    vi.mocked(disableApplication).mockResolvedValue({
      ...application,
      status: "disabled",
    });
    window.history.pushState({}, "", "/admin/applications");
  });

  it("opens create dialog from url", async () => {
    window.history.pushState({}, "", "/admin/applications?sheet=create");

    renderApplicationPage();

    await waitFor(() => {
      expect(
        screen.getByRole("dialog", { name: /新增应用/ }),
      ).toBeInTheDocument();
    });
  });

  it("shows application integration summary in list", async () => {
    renderApplicationPage();

    expect(await screen.findByText("接入配置完整")).toBeInTheDocument();
    expect(screen.getByText(/回调 1\/1/)).toBeInTheDocument();
    expect(screen.getByText(/角色 1\/1/)).toBeInTheDocument();
  });

  it("keeps application list row actions as accessible icon buttons", async () => {
    renderApplicationPage();

    const table = await screen.findByRole("table", { name: "应用清单" });
    const actionsHeader = within(table).getByRole("columnheader", { name: "操作" });
    expect(actionsHeader).toHaveStyle({
      width: "112px",
    });
    const detailButton = within(table).getByRole("button", { name: "查看 crm 详情" });
    expect(detailButton).toHaveAttribute("title", "详情");
    expect(detailButton).toHaveClass("h-8", "w-8", "min-h-8", "p-0");
    expect(detailButton).not.toHaveTextContent("详情");
  });

  it("opens detail sheet from url and keeps list query params when closing", async () => {
    const user = userEvent.setup();
    window.history.pushState(
      {},
      "",
      "/admin/applications?q=crm&status=active&page=2&pageSize=10&sort=appKey%3Aasc&sheet=app%3Acrm",
    );

    renderApplicationPage();

    const dialog = await screen.findByRole("dialog", { name: /应用详情/ });
    expect(within(dialog).getAllByText("CRM 系统").length).toBeGreaterThan(0);
    expect(
      within(dialog).getByRole("tab", { name: "详细资料", selected: true }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("tab", { name: "角色管理" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("tab", { name: "开发信息" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("tab", { name: "危险操作" }),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole("tab", { name: "开发信息" }));
    expect(
      await within(dialog).findByText("https://crm.example.com/callback"),
    ).toBeInTheDocument();

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(window.location.search).not.toContain("sheet=");
    });
    expect(window.location.search).toContain("q=crm");
    expect(window.location.search).toContain("status=active");
    expect(window.location.search).toContain("page=2");
    expect(window.location.search).toContain("pageSize=10");
    expect(window.location.search).toContain("sort=appKey%3Aasc");
  });

  it("shows one-time secrets after create without serializing them into url", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/admin/applications?sheet=create");

    renderApplicationPage();

    expect(screen.queryByLabelText("负责人 user_id")).not.toBeInTheDocument();
    expect(screen.queryByText("负责人 user_id")).not.toBeInTheDocument();
    await user.type(await screen.findByLabelText("应用 key"), "erp");
    await user.type(screen.getByLabelText("应用名称"), "ERP 系统");
    await user.type(
      screen.getByLabelText("Redirect URI"),
      "https://erp.example.com/callback",
    );
    await user.click(screen.getByRole("button", { name: "创建接入包" }));

    expect(
      await screen.findByText("created-client-secret"),
    ).toBeInTheDocument();
    expect(screen.getByText("created-developer-token")).toBeInTheDocument();
    expect(window.location.search).not.toContain("created-client-secret");
    expect(window.location.search).not.toContain("created-developer-token");
    expect(createApplication).toHaveBeenCalledWith({
      appKey: "erp",
      name: "ERP 系统",
      description: undefined,
      ownerUserId: "ou_admin",
      redirectUris: ["https://erp.example.com/callback"],
    });
  });

  it("confirms disabling application and updates the detail status", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/admin/applications?sheet=app%3Acrm");

    renderApplicationPage();

    const dialog = await screen.findByRole("dialog", { name: /应用详情/ });
    await user.click(within(dialog).getByRole("tab", { name: "危险操作" }));
    await user.click(
      await within(dialog).findByRole("button", { name: "停用应用" }),
    );
    const confirm = await screen.findByRole("alertdialog", {
      name: "确认停用应用",
    });
    expect(
      within(confirm).getByText(/userinfo、权限查询和 developer API/),
    ).toBeInTheDocument();
    await user.click(within(confirm).getByRole("button", { name: "确认" }));

    await waitFor(() => {
      expect(disableApplication).toHaveBeenCalledWith("crm");
    });
    expect(window.location.search).toContain("sheet=app%3Acrm");
    expect(
      screen.getByRole("dialog", { name: /应用详情/ }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("停用").length).toBeGreaterThan(0);
  });

  it("edits application basic information from detail sheet", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/admin/applications?sheet=app%3Acrm");

    renderApplicationPage();

    const dialog = await screen.findByRole("dialog", { name: /应用详情/ });
    expect(
      within(dialog).getByText("飞书 user_id: ou_owner"),
    ).toBeInTheDocument();
    await user.click(
      await within(dialog).findByRole("button", { name: "编辑基础信息" }),
    );
    expect(
      within(dialog).queryByLabelText("负责人 user_id"),
    ).not.toBeInTheDocument();
    await user.clear(within(dialog).getByLabelText("应用名称"));
    await user.type(within(dialog).getByLabelText("应用名称"), "CRM 生产系统");
    await user.click(
      within(dialog).getByRole("button", { name: "保存基础信息" }),
    );

    await waitFor(() => {
      expect(updateApplication).toHaveBeenCalledWith("crm", {
        name: "CRM 生产系统",
        description: "客户系统",
      });
    });
    expect(
      (await within(dialog).findAllByText("CRM 生产系统")).length,
    ).toBeGreaterThan(0);
  });

  it("creates and disables redirect uri from detail sheet", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/admin/applications?sheet=app%3Acrm");

    renderApplicationPage();

    const dialog = await screen.findByRole("dialog", { name: /应用详情/ });
    await user.click(within(dialog).getByRole("tab", { name: "开发信息" }));
    expect(
      within(dialog).getByRole("tab", { name: "开发信息", selected: true }),
    ).toBeInTheDocument();
    await user.type(
      await within(dialog).findByLabelText("新增 Redirect URI"),
      "https://crm.example.com/next-callback",
    );
    const redirectActionButton = within(dialog).getByRole("button", {
      name: "新增回调地址",
    });
    const redirectActionGroup = redirectActionButton.closest(
      "[data-ui='redirect-uri-action-group']",
    );
    expect(redirectActionGroup).toHaveClass(
      "flex",
      "flex-col",
      "gap-2",
      "sm:flex-row",
    );
    expect(redirectActionButton).toHaveClass("whitespace-nowrap", "shrink-0");
    await user.click(redirectActionButton);
    await waitFor(() => {
      expect(createApplicationRedirectUri).toHaveBeenCalledWith("crm", {
        redirectUri: "https://crm.example.com/next-callback",
      });
    });
    expect(
      await within(dialog).findByText("https://crm.example.com/next-callback"),
    ).toBeInTheDocument();

    const disableRedirectButton = within(dialog).getAllByRole("button", {
      name: "停用",
    })[0];
    if (!disableRedirectButton) {
      throw new Error("未找到停用回调地址按钮");
    }
    await user.click(disableRedirectButton);
    const confirm = await screen.findByRole("alertdialog", {
      name: "确认停用回调地址",
    });
    await user.click(within(confirm).getByRole("button", { name: "确认" }));

    await waitFor(() => {
      expect(disableApplicationRedirectUri).toHaveBeenCalledWith(
        "crm",
        "uri-1",
      );
    });
  });

  it("copies safe integration prompt without leaking secrets", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/admin/applications?sheet=app%3Acrm");

    renderApplicationPage();

    const dialog = await screen.findByRole("dialog", { name: /应用详情/ });
    await user.click(within(dialog).getByRole("tab", { name: "开发信息" }));
    const prompt = await within(dialog).findByLabelText("Codex 接入提示词");
    expect((prompt as HTMLTextAreaElement).value).not.toContain(
      "created-client-secret",
    );
    const writeText = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue(undefined);
    const copyButton = within(dialog).getByRole("button", {
      name: "复制安全版提示词",
    });
    copyButton.click();

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        expect.stringContaining("接入 CRM 的 Codex 提示词"),
      );
    });
  });

  it("creates and edits application role metadata without entering authorization binding", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/admin/applications?sheet=app%3Acrm");

    renderApplicationPage();

    const dialog = await screen.findByRole("dialog", { name: /应用详情/ });
    await user.click(within(dialog).getByRole("tab", { name: "角色管理" }));
    expect(await within(dialog).findByText("CRM 管理员")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("tab", { name: "角色管理", selected: true }),
    ).toBeInTheDocument();
    const roleTable = within(dialog).getByRole("table", {
      name: "应用角色清单",
    });
    expect(
      within(roleTable).getByRole("columnheader", { name: "角色名称" }),
    ).toBeInTheDocument();
    expect(
      within(roleTable).getByRole("columnheader", { name: "角色 key" }),
    ).toBeInTheDocument();
    expect(
      within(roleTable).getByRole("columnheader", { name: "操作" }),
    ).toHaveStyle({
      width: "132px",
      minWidth: "132px",
    });
    expect(
      within(roleTable).getByRole("button", { name: "查看 crm.admin" }),
    ).toBeInTheDocument();
    expect(
      within(roleTable).getByRole("button", { name: "编辑 crm.admin" }),
    ).toBeInTheDocument();
    expect(
      within(roleTable).getByRole("button", { name: "停用 crm.admin" }),
    ).toHaveClass("h-8", "w-8", "p-0");
    expect(
      within(roleTable).getByRole("button", { name: "停用 crm.admin" }),
    ).toHaveAttribute("title", "停用");
    expect(
      within(roleTable).getByRole("button", { name: "停用 crm.admin" }),
    ).not.toHaveTextContent("停用");
    expect(screen.queryByText("后续 v0.11.3")).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "新增角色" }));
    await user.type(within(dialog).getByLabelText("角色 key"), "crm.viewer");
    await user.type(within(dialog).getByLabelText("角色名称"), "CRM 查看员");
    await user.click(within(dialog).getByRole("button", { name: "创建角色" }));
    await waitFor(() => {
      expect(createIamRole).toHaveBeenCalledWith("crm", {
        key: "crm.viewer",
        name: "CRM 查看员",
        description: undefined,
      });
    });

    await user.click(
      within(dialog).getByRole("button", { name: "编辑 crm.admin" }),
    );
    await user.clear(within(dialog).getByLabelText("角色名称"));
    await user.type(
      within(dialog).getByLabelText("角色名称"),
      "CRM 超级管理员",
    );
    await user.click(within(dialog).getByRole("button", { name: "保存角色" }));
    await waitFor(() => {
      expect(updateIamRole).toHaveBeenCalledWith("crm", "role-1", {
        name: "CRM 超级管理员",
        description: "管理 CRM",
      });
    });
  });

  it("shows role empty, no-permission, failed and readonly states", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchIamRoles).mockResolvedValueOnce([]);
    window.history.pushState({}, "", "/admin/applications?sheet=app%3Acrm");

    renderApplicationPage();

    let dialog = await screen.findByRole("dialog", { name: /应用详情/ });
    await user.click(within(dialog).getByRole("tab", { name: "角色管理" }));
    expect(await screen.findByText(/暂无应用角色/)).toBeInTheDocument();

    cleanup();
    vi.mocked(fetchApplicationPage).mockResolvedValueOnce({
      items: [{ ...application, status: "disabled" }],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    vi.mocked(fetchIamRoles).mockRejectedValueOnce(
      Object.assign(new Error("forbidden"), { status: 403 }),
    );
    window.history.pushState({}, "", "/admin/applications?sheet=app%3Acrm");
    renderApplicationPage();
    dialog = await screen.findByRole("dialog", { name: /应用详情/ });
    await user.click(within(dialog).getByRole("tab", { name: "角色管理" }));
    expect(
      await screen.findByText("当前管理员无权查看该应用角色。"),
    ).toBeInTheDocument();

    cleanup();
    vi.mocked(fetchApplicationPage).mockResolvedValueOnce({
      items: [{ ...application, status: "disabled" }],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    vi.mocked(fetchIamRoles).mockResolvedValueOnce([
      {
        id: "role-1",
        applicationId: "app-1",
        appKey: "crm",
        key: "crm.admin",
        name: "CRM 管理员",
        description: "管理 CRM",
        status: "active",
        createdAt: "2026-05-24T10:00:00.000Z",
        updatedAt: "2026-05-24T11:00:00.000Z",
      },
    ]);
    window.history.pushState({}, "", "/admin/applications?sheet=app%3Acrm");
    renderApplicationPage();
    const dialogs = await screen.findAllByRole("dialog", { name: /应用详情/ });
    const latestDialog = dialogs[dialogs.length - 1];
    if (!latestDialog) {
      throw new Error("未找到应用详情弹窗");
    }
    await user.click(
      within(latestDialog).getByRole("tab", { name: "角色管理" }),
    );
    expect(
      await within(latestDialog).findByText(/角色元数据保持只读/),
    ).toBeInTheDocument();
    expect(
      within(latestDialog).getByRole("button", { name: "新增角色" }),
    ).toBeDisabled();
  });

  it("shows no-permission state for 403 list responses instead of empty state", async () => {
    vi.mocked(fetchApplicationPage).mockRejectedValueOnce(
      Object.assign(new Error("forbidden"), { status: 403 }),
    );

    renderApplicationPage();

    expect(await screen.findByText("没有权限")).toBeInTheDocument();
    expect(screen.queryByText("暂无应用")).not.toBeInTheDocument();
  });

  it("opens application details in an independent page and preserves filters in return url", async () => {
    const user = userEvent.setup();

    renderApplicationPage();

    await user.type(await screen.findByLabelText("应用查询"), "finance");
    await user.click(screen.getByRole("button", { name: "查询" }));
    await user.click(
      await screen.findByRole("button", { name: /查看 .* 详情/ }),
    );

    await waitFor(() => {
      expect(window.location.pathname).toBe("/admin/applications/crm");
    });
    expect(window.location.search).toContain(
      `from=${encodeURIComponent("/admin/applications?q=finance")}`,
    );
  });
});

function renderApplicationPage() {
  render(
    <BrowserRouter>
      <ApplicationManagementPage
        admin={admin}
        onManagePermissions={() => undefined}
        onOpenRecords={() => undefined}
      />
    </BrowserRouter>,
  );
}
