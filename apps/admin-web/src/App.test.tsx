import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import type { AdminMe } from "./admin-types";
import type { AdminAuditLog, AdminSecurityEvent } from "./api/admin";
import type {
  FeishuFieldDiagnostics,
  FeishuStatus,
  FeishuSyncRun,
} from "./api/feishu";
import type { ApiStatus } from "./api/status";

describe("管理后台骨架", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.history.pushState({}, "", "/admin/workspace");
  });

  it("应用 API 使用 admin session 同源接口", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        responseJson(makeApplication({ name: "Demo 应用" })),
      );

    const { updateApplication } = await import("./api/applications");
    await updateApplication("demo", { name: "Demo 应用" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/admin/applications/demo",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("权限应用列表 API 按分页拉取全量应用并保留数组返回语义", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        responseJson({
          items: [
            makeApplication({
              id: "app-1",
              appKey: "finance",
              name: "财务系统",
            }),
          ],
          total: 2,
          page: 1,
          pageSize: 1,
        }),
      )
      .mockResolvedValueOnce(
        responseJson({
          items: [
            makeApplication({ id: "app-2", appKey: "crm", name: "CRM 系统" }),
          ],
          total: 2,
          page: 2,
          pageSize: 1,
        }),
      );

    const { fetchApplications } = await import("./api/permission");
    await expect(fetchApplications(1)).resolves.toEqual([
      expect.objectContaining({ id: "app-1", appKey: "finance" }),
      expect.objectContaining({ id: "app-2", appKey: "crm" }),
    ]);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/v1/admin/applications?page=1&pageSize=1",
      expect.objectContaining({ credentials: "include" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/v1/admin/applications?page=2&pageSize=1",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("应用 API 错误保留结构化字段且不泄露后端 detail", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      responseJson(
        {
          error: {
            code: "APPLICATION_BODY_INVALID",
            message: "backend detail includes secret-token",
            request_id: "req-application",
            detail: { token: "secret-token" },
          },
        },
        { status: 422 },
      ),
    );

    const { ApplicationApiError, updateApplication } =
      await import("./api/applications");
    let caughtError: unknown;

    try {
      await updateApplication("demo", { name: "" });
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(ApplicationApiError);
    expect(caughtError).toMatchObject({
      code: "APPLICATION_BODY_INVALID",
      requestId: "req-application",
      status: 422,
    });
    expect((caughtError as Error).message).toContain("应用请求体不合法");
    expect((caughtError as Error).message).not.toContain("secret-token");
    expect((caughtError as Error).message).not.toContain("backend detail");
  });

  it("应用 API 支持同级错误结构", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      responseJson(
        {
          code: "APPLICATION_NOT_FOUND",
          requestId: "req-application-flat",
          detail: { secret: "secret-token" },
        },
        { status: 404 },
      ),
    );

    const { updateApplication } = await import("./api/applications");
    let caughtError: unknown;

    try {
      await updateApplication("missing", { name: "不存在的应用" });
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toMatchObject({
      code: "APPLICATION_NOT_FOUND",
      requestId: "req-application-flat",
      status: 404,
    });
    expect((caughtError as Error).message).toContain("应用不存在");
    expect((caughtError as Error).message).not.toContain("secret-token");
  });

  it("权限 API 对 IAM 角色错误码展示稳定中文消息", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      responseJson(
        {
          error: {
            code: "IAM_ROLE_KEY_INVALID",
            message: "backend detail includes invalid role key",
            requestId: "req-role-key",
          },
        },
        { status: 422 },
      ),
    );

    const { updateIamRole } = await import("./api/permission");
    let caughtError: unknown;

    try {
      await updateIamRole("finance", "role-1", { name: "" });
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toMatchObject({
      code: "IAM_ROLE_KEY_INVALID",
      requestId: "req-role-key",
      status: 422,
    });
    expect((caughtError as Error).message).toContain("IAM 角色 key 不符合规则");
    expect((caughtError as Error).message).not.toContain("backend detail");
  });

  it("接入提示词 API 使用应用级路径且不把 secret 放进请求 URL", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        responseJson({ integrationPrompt: "safe prompt" }),
      );

    const { fetchIntegrationPrompt } = await import("./api/oauth");
    await fetchIntegrationPrompt("demo");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/admin/applications/demo/integration-prompt",
      expect.any(Object),
    );
  });

  it("显示传统后台布局和当前管理员信息", async () => {
    const user = userEvent.setup();
    mockFetch({
      feishuStatus: makeStatus(),
      syncRuns: [makeRun()],
    });

    render(<App />);

    await screen.findByText("张三 · 平台管理员");
    expect(
      screen.getAllByText("Riversoft 内部身份与权限控制台").length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("Feishu IAM").length).toBeGreaterThan(0);
    expect(screen.getByText("张三 · 平台管理员")).toBeInTheDocument();
    expect(screen.getByText("飞书 user_id: ou_1")).toBeInTheDocument();
    const navigation = within(
      screen.getByRole("navigation", { name: "主菜单" }),
    );
    expect(navigation.getByRole("link", { name: "工作台" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(navigation.queryByText("权限模型")).not.toBeInTheDocument();
    expect(navigation.queryByText("SSO 接入")).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", {
        name: /当前登录人 张三，平台管理员，飞书 user_id: ou_1/,
      }),
    );
    expect(screen.getByRole("menuitem", { name: "退出登录" })).toHaveAttribute(
      "href",
      "/admin/auth/logout",
    );
  });

  it("默认 /admin 入口进入工作台", async () => {
    window.history.pushState({}, "", "/admin");
    mockFetch({
      feishuStatus: makeStatus(),
      syncRuns: [makeRun()],
    });

    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "工作台" }),
      ).toBeInTheDocument();
    });
  });

  it("一级菜单切换不使用 hash 锚点并展示独立模块", async () => {
    const user = userEvent.setup();
    mockFetch({
      feishuStatus: makeStatus(),
      syncRuns: [makeRun()],
    });

    render(<App />);
    expect(
      await screen.findByRole("link", { name: "应用管理" }),
    ).toHaveAttribute("href", "/admin/applications");
    expect(
      screen.queryByRole("button", { name: "应用管理" }),
    ).not.toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: "收起系统管理子菜单" }),
    ).toHaveAttribute("aria-expanded", "true");
    await user.click(screen.getByRole("link", { name: "系统信息" }));
    expect(
      await screen.findByRole("heading", { name: "系统信息" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "系统运行信息" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "应用与权限" }),
    ).not.toBeInTheDocument();
  });

  it("系统管理二级菜单展示飞书同步、管理员授权、操作审计和系统信息", async () => {
    const user = userEvent.setup();
    mockFetch({
      feishuStatus: makeStatus(),
      syncRuns: [makeRun()],
    });

    render(<App />);

    const navigation = within(
      await screen.findByRole("navigation", { name: "主菜单" }),
    );
    expect(
      navigation.getByRole("button", { name: "收起系统管理子菜单" }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(navigation.getByRole("link", { name: "飞书同步" })).toHaveAttribute(
      "href",
      "/admin/system/feishu",
    );
    expect(
      navigation.getByRole("link", { name: "管理员授权" }),
    ).toHaveAttribute("href", "/admin/system/admins");
    expect(navigation.getByRole("link", { name: "操作审计" })).toHaveAttribute(
      "href",
      "/admin/system/audit",
    );
    expect(navigation.getByRole("link", { name: "系统信息" })).toHaveAttribute(
      "href",
      "/admin/system/info",
    );

    await user.click(navigation.getByRole("link", { name: "操作审计" }));
    await waitFor(() => {
      expect(window.location.pathname).toBe("/admin/system/audit");
    });
  });

  it("旧系统路由兼容跳转到系统管理二级菜单", async () => {
    mockFetch({
      feishuStatus: makeStatus(),
      syncRuns: [makeRun()],
    });
    window.history.pushState({}, "", "/admin/records?tab=security");

    render(<App />);

    await waitFor(() => {
      expect(window.location.pathname).toBe("/admin/system/audit");
    });
    expect(window.location.search).toContain("tab=security");
    const navigation = within(
      await screen.findByRole("navigation", { name: "主菜单" }),
    );
    expect(
      navigation.getByRole("button", {
        name: "系统管理分组已展开，当前页面位于该分组下",
      }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(navigation.getByRole("link", { name: "操作审计" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("左上角展示 Feishu IAM logo 和平台名称", async () => {
    mockFetch({
      feishuStatus: makeStatus(),
      syncRuns: [makeRun()],
    });

    render(<App />);

    expect(await screen.findByLabelText("Riversoft 标识")).toBeInTheDocument();
    expect(screen.getAllByText("Feishu IAM").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Riversoft 内部身份与权限控制台").length,
    ).toBeGreaterThan(0);
  });

  it("管理端 API 不再注入 VITE_PLATFORM_ADMIN_TOKEN", async () => {
    const requests: Request[] = [];

    vi.spyOn(globalThis, "fetch").mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = requestUrl(input);
        const request =
          input instanceof Request
            ? input
            : new Request(`http://localhost${url}`, init);
        requests.push(request);

        if (url === "/health") {
          return jsonResponse({ status: "ok" });
        }
        if (url === "/ready") {
          return jsonResponse({ status: "ready" });
        }
        if (url === "/version") {
          return jsonResponse({ version: "0.4.0-dev" });
        }
        if (url === "/api/v1/admin/me") {
          return jsonResponse(makeAdminMe());
        }
        if (url === "/api/v1/admin/feishu/status") {
          return jsonResponse(makeStatus());
        }
        if (url === "/api/v1/admin/feishu/sync-runs") {
          return jsonResponse({ items: [makeRun()] });
        }
        if (url === "/api/v1/admin/feishu/field-diagnostics") {
          return jsonResponse(makeDiagnostics());
        }
        if (isApplicationListUrl(url)) {
          return jsonResponse({ items: [makeApplication()] });
        }
        if (url === "/api/v1/admin/audit-logs?page=1&pageSize=20") {
          return jsonResponse({ items: [], total: 0, page: 1, pageSize: 20 });
        }
        if (url === "/api/v1/admin/security-events?page=1&pageSize=20") {
          return jsonResponse({ items: [], total: 0, page: 1, pageSize: 20 });
        }
        if (url === "/api/v1/admin/admin-users") {
          return jsonResponse({ items: [], total: 0, page: 1, pageSize: 20 });
        }
        return jsonResponse({}, { status: 404 });
      },
    );

    render(<App />);

    await screen.findByText("张三 · 平台管理员");
    await waitFor(() => {
      expect(requests.length).toBeGreaterThan(4);
    });

    for (const request of requests) {
      expect(request.headers.has("Authorization")).toBe(false);
    }
  });

  it("管理员授权首页展示管理员列表且新增流程只暴露平台管理员和应用管理员", async () => {
    const user = userEvent.setup();
    mockFetch({
      feishuStatus: makeStatus(),
      syncRuns: [makeRun()],
      adminUsers: [
        makeAdminUser({
          displayName: "李四",
          roles: [
            { roleKey: "platform_admin", name: "平台管理员" },
            { roleKey: "audit_viewer", name: null },
          ],
          applicationScopes: [
            {
              id: "scope-finance",
              appKey: "finance",
              name: "财务系统",
              status: "active",
            },
          ],
        }),
        makeAdminUser({
          id: "admin-user-2",
          feishuUserId: "ou_admin_2",
          displayName: "王五",
          roles: [{ roleKey: "application_admin", name: "应用管理员" }],
          applicationScopes: [],
        }),
      ],
    });

    render(<App />);
    await user.click(await screen.findByRole("link", { name: "管理员授权" }));

    const section = await screen.findByRole("main", { name: "管理员授权" });
    expect(
      await within(section).findByRole("heading", { name: "管理员授权" }),
    ).toBeInTheDocument();
    expect(await within(section).findByText("李四")).toBeInTheDocument();
    expect(
      within(section).getByText("平台管理员、audit_viewer"),
    ).toBeInTheDocument();
    expect(within(section).getByText("历史角色只读")).toBeInTheDocument();
    expect(within(section).getByText("finance / 财务系统")).toBeInTheDocument();
    expect(within(section).getByText("全部应用")).toBeInTheDocument();
    expect(section).not.toHaveTextContent("[object Object]");
    const readonlyRow = within(section).getByText("李四").closest("tr");
    expect(readonlyRow).not.toBeNull();
    expect(
      within(readonlyRow as HTMLElement).getByRole("button", {
        name: "查看 李四 详情",
      }),
    ).toBeInTheDocument();
    expect(
      within(readonlyRow as HTMLElement).queryByRole("button", {
        name: "编辑",
      }),
    ).not.toBeInTheDocument();
    expect(
      within(readonlyRow as HTMLElement).queryByRole("button", {
        name: "停用",
      }),
    ).not.toBeInTheDocument();

    await user.click(
      within(section).getByRole("button", { name: "新增管理员" }),
    );
    const form = await screen.findByRole("dialog", { name: "新增管理员" });
    expect(
      within(form).getByRole("option", { name: "平台管理员" }),
    ).toBeInTheDocument();
    expect(
      within(form).getByRole("option", { name: "应用管理员" }),
    ).toBeInTheDocument();
    expect(
      within(form).queryByRole("option", { name: "审计查看员" }),
    ).not.toBeInTheDocument();
    expect(
      within(form).queryByRole("option", { name: "同步管理员" }),
    ).not.toBeInTheDocument();
  });

  it("非平台管理员进入管理员授权显示权限不足", async () => {
    const user = userEvent.setup();
    mockFetch({
      adminMe: makeAdminMe({
        roles: ["application_admin"],
        applicationIds: ["app-1"],
      }),
      feishuStatus: makeStatus(),
      syncRuns: [makeRun()],
    });

    render(<App />);
    await user.click(await screen.findByRole("link", { name: "管理员授权" }));

    const section = await screen.findByRole("main", { name: "管理员授权" });
    expect(
      within(section).getByText("当前管理员无权管理管理员授权"),
    ).toBeInTheDocument();
    expect(
      within(section).queryByRole("button", { name: "新增管理员" }),
    ).not.toBeInTheDocument();
  });

  it("管理员授权新增应用管理员时必须选择应用范围", async () => {
    const user = userEvent.setup();
    const createBodies: unknown[] = [];
    mockFetch({
      feishuStatus: makeStatus(),
      syncRuns: [makeRun()],
      onCreateAdminUser: (body) => createBodies.push(body),
    });

    render(<App />);
    await user.click(await screen.findByRole("link", { name: "管理员授权" }));

    const section = await screen.findByRole("main", { name: "管理员授权" });
    await user.click(
      within(section).getByRole("button", { name: "新增管理员" }),
    );
    const form = await screen.findByRole("dialog", { name: "新增管理员" });
    await user.type(within(form).getByLabelText("飞书用户"), "ou_app_admin");
    await user.selectOptions(
      within(form).getByLabelText("管理员类型"),
      "application_admin",
    );
    await user.click(within(form).getByRole("button", { name: "保存授权" }));

    expect(
      await within(form).findByText("应用管理员至少需要选择一个应用"),
    ).toBeInTheDocument();
    expect(createBodies).toEqual([]);
  });

  it("管理员授权新增平台管理员不展示也不提交应用范围", async () => {
    const user = userEvent.setup();
    const createBodies: unknown[] = [];
    mockFetch({
      feishuStatus: makeStatus(),
      syncRuns: [makeRun()],
      onCreateAdminUser: (body) => createBodies.push(body),
    });

    render(<App />);
    await user.click(await screen.findByRole("link", { name: "管理员授权" }));

    const section = await screen.findByRole("main", { name: "管理员授权" });
    await user.click(
      within(section).getByRole("button", { name: "新增管理员" }),
    );
    const form = await screen.findByRole("dialog", { name: "新增管理员" });
    expect(
      within(form).getByText(
        "平台管理员默认拥有全部应用范围，不需要单独选择应用。",
      ),
    ).toBeInTheDocument();
    expect(
      within(form).queryByRole("group", { name: "应用范围" }),
    ).not.toBeInTheDocument();

    await user.type(
      within(form).getByLabelText("飞书用户"),
      "ou_platform_admin",
    );
    await user.click(within(form).getByRole("button", { name: "保存授权" }));

    await waitFor(() => {
      expect(createBodies).toHaveLength(1);
    });
    expect(createBodies[0]).toEqual({
      feishuUserId: "ou_platform_admin",
      roleKeys: ["platform_admin"],
      applicationIds: [],
    });
  });

  it("管理员授权新增管理员可搜索并选择本地飞书用户", async () => {
    const user = userEvent.setup();
    const createBodies: unknown[] = [];
    const requestedUrls: string[] = [];
    mockFetch({
      feishuStatus: makeStatus(),
      syncRuns: [makeRun()],
      onRequest: (url) => requestedUrls.push(url),
      onCreateAdminUser: (body) => createBodies.push(body),
    });

    render(<App />);
    await user.click(await screen.findByRole("link", { name: "管理员授权" }));

    const section = await screen.findByRole("main", { name: "管理员授权" });
    await user.click(
      within(section).getByRole("button", { name: "新增管理员" }),
    );
    const form = await screen.findByRole("dialog", { name: "新增管理员" });
    await user.type(within(form).getByLabelText("飞书用户"), "王");
    await user.click(within(form).getByRole("button", { name: "搜索用户" }));
    await user.click(
      await within(form).findByRole("button", { name: /王文哲/ }),
    );
    await user.click(within(form).getByRole("button", { name: "保存授权" }));

    await waitFor(() => {
      expect(createBodies).toHaveLength(1);
    });
    expect(requestedUrls).toContain(
      "/api/v1/admin/feishu/users?keyword=%E7%8E%8B",
    );
    expect(createBodies[0]).toEqual({
      feishuUserId: "ou-wang",
      roleKeys: ["platform_admin"],
      applicationIds: [],
    });
  });

  it("管理员授权可以编辑应用管理员范围并停用管理员", async () => {
    const user = userEvent.setup();
    const requestedUrls: string[] = [];
    const adminUser = makeAdminUser({
      roles: [{ roleKey: "application_admin", name: "应用管理员" }],
      applicationScopes: [],
    });
    mockFetch({
      feishuStatus: makeStatus(),
      syncRuns: [makeRun()],
      adminUsers: [adminUser],
      onRequest: (url) => requestedUrls.push(url),
    });

    render(<App />);
    await user.click(await screen.findByRole("link", { name: "管理员授权" }));

    const section = await screen.findByRole("main", { name: "管理员授权" });
    expect(await within(section).findByText("李四")).toBeInTheDocument();
    await user.click(within(section).getByRole("button", { name: "编辑" }));
    const form = await screen.findByRole("dialog", { name: "编辑管理员授权" });
    await user.click(
      within(form).getByRole("checkbox", { name: /财务系统\s*finance/ }),
    );
    await user.click(within(form).getByRole("button", { name: "保存授权" }));

    await waitFor(() => {
      expect(requestedUrls).toContain(
        "/api/v1/admin/admin-users/admin-user-1/authorization",
      );
    });
    expect(
      await within(section).findByText("finance / 财务系统"),
    ).toBeInTheDocument();

    await user.click(within(section).getByRole("button", { name: "停用" }));
    const confirmDialog = await screen.findByRole("alertdialog", {
      name: "确认停用管理员",
    });
    expect(
      within(confirmDialog).getByText(/该操作会写入审计日志/),
    ).toBeInTheDocument();
    expect(
      within(confirmDialog).getByText(/不能继续使用对应管理员权限/),
    ).toBeInTheDocument();
    expect(requestedUrls).not.toContain(
      "/api/v1/admin/admin-users/admin-user-1/disable",
    );
    await user.click(
      within(confirmDialog).getByRole("button", { name: "确认" }),
    );
    await waitFor(() => {
      expect(requestedUrls).toContain(
        "/api/v1/admin/admin-users/admin-user-1/disable",
      );
    });
    await waitFor(() => {
      expect(
        within(section).getAllByText("停用").length,
      ).toBeGreaterThanOrEqual(2);
    });
  });

  it("系统管理二级页按入口展示飞书同步和系统信息", async () => {
    const user = userEvent.setup();
    mockFetch({
      feishuStatus: makeStatus(),
      syncRuns: [makeRun()],
    });

    render(<App />);
    await user.click(await screen.findByRole("link", { name: "系统信息" }));

    const page = await screen.findByRole("main", { name: "系统信息" });
    expect(
      within(page).getByRole("heading", { name: "系统信息" }),
    ).toBeInTheDocument();
    expect(
      within(page).getByRole("button", { name: /系统运行/ }),
    ).toBeInTheDocument();
    expect(
      within(page).getByRole("button", { name: /版本信息/ }),
    ).toBeInTheDocument();
    expect(
      within(page).queryByRole("button", { name: /飞书同步/ }),
    ).not.toBeInTheDocument();
    expect(within(page).queryByText("Client")).not.toBeInTheDocument();

    await user.click(within(page).getByRole("button", { name: /系统运行/ }));
    expect(await within(page).findByText("API health")).toBeInTheDocument();
    expect(within(page).getByText("DB ready")).toBeInTheDocument();

    await user.click(within(page).getByRole("button", { name: /版本信息/ }));
    expect(await within(page).findByText("当前版本")).toBeInTheDocument();
    expect(within(page).getByText("0.4.0-dev")).toBeInTheDocument();
    expect(within(page).queryByText("Client")).not.toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "飞书同步" }));
    const feishuPage = await screen.findByRole("main", { name: "飞书同步" });
    expect(
      within(feishuPage).getByRole("heading", { name: "飞书同步" }),
    ).toBeInTheDocument();
    expect(
      within(feishuPage).queryByRole("button", { name: /飞书同步/ }),
    ).not.toBeInTheDocument();
    expect(
      within(feishuPage).getByRole("region", { name: "组织用户浏览" }),
    ).toBeInTheDocument();
  });

  it("管理员身份未登录时不请求后台工作台数据并显示登录入口", async () => {
    const requestedUrls: string[] = [];

    vi.spyOn(globalThis, "fetch").mockImplementation(
      (input: RequestInfo | URL) => {
        const url = requestUrl(input);
        requestedUrls.push(url);
        if (url === "/api/v1/admin/me") {
          return jsonResponse(
            {
              error: {
                code: "ADMIN_LOGIN_REQUIRED",
                message: "backend detail includes secret-token",
                requestId: "req-admin-401",
              },
            },
            { status: 401 },
          );
        }
        return jsonResponse({}, { status: 404 });
      },
    );

    render(<App />);

    expect(
      await screen.findByRole("heading", {
        name: "需要登录 Feishu IAM 管理后台",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "飞书登录" })).toHaveAttribute(
      "href",
      "/admin/auth/login",
    );
    expect(screen.queryAllByRole("link")).toHaveLength(1);
    expect(screen.getByText(/req-admin-401/)).toBeInTheDocument();
    expect(screen.queryByText(/secret-token/)).not.toBeInTheDocument();

    await waitFor(() => {
      expect(requestedUrls).toEqual(["/api/v1/admin/me"]);
    });
    expect(
      requestedUrls.some((url) => url.startsWith("/api/v1/admin/feishu/")),
    ).toBe(false);
    expect(requestedUrls).not.toContain("/api/v1/admin/applications");
    expect(requestedUrls).not.toContain("/health");
  });

  it("工作台展示风险队列、系统健康、飞书同步概览和记录入口", async () => {
    mockFetch({
      feishuStatus: makeStatus({
        configStatus: "connected",
        counts: {
          departments: 3,
          activeDepartments: 2,
          users: 5,
          activeUsers: 4,
          relations: 6,
        },
        latestRun: makeRun({
          departmentCreatedCount: 1,
          departmentUpdatedCount: 2,
          departmentDeletedCount: 3,
          userCreatedCount: 4,
          userUpdatedCount: 5,
          userDeletedCount: 6,
          relationCreatedCount: 7,
          relationUpdatedCount: 8,
          relationDeletedCount: 9,
        }),
      }),
      syncRuns: [makeRun()],
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("0.4.0-dev")).toBeInTheDocument();
    });

    expect(
      screen.getByRole("region", { name: "待处理风险" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "系统健康" }),
    ).toBeInTheDocument();
    expect(screen.getByText("数据库")).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "飞书同步概览" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "最近操作审计" }),
    ).toBeInTheDocument();
    expect(screen.getByText("连接成功")).toBeInTheDocument();
    expect(screen.getAllByText("成功").length).toBeGreaterThan(0);
  });

  it("工作台风险优先展示在指标前并提供处理入口", async () => {
    mockFetch({
      feishuStatus: makeStatus({
        configStatus: "failed",
        counts: {
          departments: 0,
          activeDepartments: 0,
          users: 0,
          activeUsers: 0,
          relations: 0,
        },
        latestRun: makeRun({ status: "failed", errorMessage: "飞书权限不足" }),
      }),
      syncRuns: [makeRun()],
    });

    render(<App />);

    await screen.findByText("飞书配置未连接");
    const riskHeading = await screen.findByRole("heading", {
      name: "待处理风险",
    });
    const metricLabel = screen.getByText("系统健康");
    expect(
      Boolean(
        riskHeading.compareDocumentPosition(metricLabel) &
        Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);
    expect(screen.getByText("飞书配置未连接")).toBeInTheDocument();
    expect(screen.getByText("最近同步失败")).toBeInTheDocument();
    expect(screen.getByText("有效用户为 0")).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "进入飞书同步" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("button", { name: "查看同步记录" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("button", { name: "查看飞书同步" }).length,
    ).toBeGreaterThan(0);
  });

  it("工作台同步风险入口进入可刷新的同步记录详情", async () => {
    const user = userEvent.setup();
    mockFetch({
      feishuStatus: makeStatus({
        latestRun: makeRun({
          id: "sync-failed-1",
          status: "failed",
          errorMessage: "飞书权限不足",
        }),
      }),
      syncRuns: [
        makeRun({
          id: "sync-failed-1",
          status: "failed",
          errorMessage: "飞书权限不足",
        }),
      ],
    });

    render(<App />);

    await screen.findByText("最近同步失败");
    const [syncRiskButton] = screen.getAllByRole("button", {
      name: "查看同步记录",
    });
    if (!syncRiskButton) {
      throw new Error("缺少同步风险处理按钮");
    }
    await user.click(syncRiskButton);

    await waitFor(() => {
      expect(window.location.pathname).toBe("/admin/system/audit");
      const search = new URLSearchParams(window.location.search);
      expect(search.get("tab")).toBe("sync");
      expect(search.get("sheet")).toBe("sync:sync-failed-1");
    });
  });

  it("工作台运行风险入口进入系统运行设置页", async () => {
    const user = userEvent.setup();
    mockFetch({
      apiStatus: { health: "error", ready: "not_ready", version: "0.10.1-dev" },
      feishuStatus: makeStatus(),
      syncRuns: [makeRun()],
    });

    render(<App />);

    await screen.findByText("API 未处于 ok 状态");
    const [runtimeRiskButton] = screen.getAllByRole("button", {
      name: "查看系统运行",
    });
    if (!runtimeRiskButton) {
      throw new Error("缺少运行风险处理按钮");
    }
    await user.click(runtimeRiskButton);

    await waitFor(() => {
      expect(window.location.pathname).toBe("/admin/system/info");
      expect(new URLSearchParams(window.location.search).get("tab")).toBe(
        "runtime",
      );
    });
  });

  it("展示字段完整性诊断通过态", async () => {
    const user = userEvent.setup();
    mockFetch({
      feishuStatus: makeStatus({
        counts: {
          departments: 1,
          activeDepartments: 1,
          users: 1,
          activeUsers: 1,
          relations: 1,
        },
      }),
      syncRuns: [makeRun()],
      diagnostics: makeDiagnostics(),
    });

    render(<App />);
    await user.click(await screen.findByRole("link", { name: "飞书同步" }));
    await user.click(await screen.findByRole("tab", { name: "字段诊断" }));

    expect(await screen.findByText("字段完整性诊断")).toBeInTheDocument();
    expect(screen.getByText("可进入后续 SSO")).toBeInTheDocument();
    expect(screen.getByText("active_users > 0 已满足")).toBeInTheDocument();
    expect(screen.getByText("字段满足后续 SSO 准备要求")).toBeInTheDocument();
  });

  it("展示字段诊断阻断态和安全建议", async () => {
    const user = userEvent.setup();
    mockFetch({
      feishuStatus: makeStatus({
        counts: {
          departments: 1,
          activeDepartments: 1,
          users: 1,
          activeUsers: 0,
          relations: 1,
        },
      }),
      syncRuns: [makeRun()],
      diagnostics: makeDiagnostics({
        status: "failed",
        loginReadiness: {
          ready: false,
          reason: "用户 status 字段未返回，无法判断可登录用户",
        },
        sampleCounts: { departments: 1, users: 1, activeUsers: 0 },
        userFields: [
          {
            field: "status",
            status: "missing",
            presentCount: 0,
            missingCount: 1,
            emptyCount: 0,
            requiredLevel: "blocking",
          },
        ],
        blockingIssues: ["用户 status 字段未返回，无法判断可登录用户"],
        nextActions: [
          "确认飞书应用已授权读取用户状态字段，补齐后重新运行字段诊断和全量同步",
        ],
      }),
    });

    render(<App />);
    await user.click(await screen.findByRole("link", { name: "飞书同步" }));
    await user.click(await screen.findByRole("tab", { name: "字段诊断" }));

    expect(await screen.findByText("不可进入后续 SSO")).toBeInTheDocument();
    expect(screen.getByText("active_users > 0 未满足")).toBeInTheDocument();
    expect(
      screen.getAllByText("用户 status 字段未返回，无法判断可登录用户").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(
        "确认飞书应用已授权读取用户状态字段，补齐后重新运行字段诊断和全量同步",
      ),
    ).toBeInTheDocument();
  });

  it("点击刷新诊断按钮后重新读取字段诊断", async () => {
    const user = userEvent.setup();
    let diagnosticsCalls = 0;

    vi.spyOn(globalThis, "fetch").mockImplementation(
      (input: RequestInfo | URL) => {
        const url = requestUrl(input);
        if (url === "/health") {
          return jsonResponse({ status: "ok" });
        }
        if (url === "/ready") {
          return jsonResponse({ status: "ready" });
        }
        if (url === "/version") {
          return jsonResponse({ version: "0.4.0-dev" });
        }
        if (url === "/api/v1/admin/me") {
          return jsonResponse(makeAdminMe());
        }
        if (url === "/api/v1/admin/feishu/status") {
          return jsonResponse(makeStatus());
        }
        if (url === "/api/v1/admin/feishu/sync-runs") {
          return jsonResponse({ items: [makeRun()] });
        }
        if (url === "/api/v1/admin/feishu/field-diagnostics") {
          diagnosticsCalls += 1;
          return jsonResponse(
            diagnosticsCalls === 1
              ? makeDiagnostics()
              : makeDiagnostics({
                  status: "warning",
                  loginReadiness: {
                    ready: true,
                    reason: "关键字段满足登录准备要求，但展示字段仍需补齐",
                  },
                  warnings: ["用户 email 字段未返回，相关展示信息会缺失"],
                }),
          );
        }
        return jsonResponse({}, { status: 404 });
      },
    );

    render(<App />);
    await user.click(await screen.findByRole("link", { name: "飞书同步" }));
    await user.click(await screen.findByRole("tab", { name: "字段诊断" }));
    expect(await screen.findByText("可进入后续 SSO")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "刷新诊断" }));

    await waitFor(() => {
      expect(diagnosticsCalls).toBe(2);
      expect(screen.getByText("字段不完整但可继续同步")).toBeInTheDocument();
      expect(
        screen.getByText("用户 email 字段未返回，相关展示信息会缺失"),
      ).toBeInTheDocument();
    });
  });

  it("刷新诊断返回较晚时不覆盖同步刷新后的状态和历史", async () => {
    const user = userEvent.setup();
    const diagnosticsRefresh = createDeferred<Response>();
    let diagnosticsCalls = 0;
    let postCalls = 0;

    vi.spyOn(globalThis, "fetch").mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = requestUrl(input);
        const method = init?.method ?? "GET";
        if (url === "/health") {
          return jsonResponse({ status: "ok" });
        }
        if (url === "/ready") {
          return jsonResponse({ status: "ready" });
        }
        if (url === "/version") {
          return jsonResponse({ version: "0.4.0-dev" });
        }
        if (url === "/api/v1/admin/me") {
          return jsonResponse(makeAdminMe());
        }
        if (url === "/api/v1/admin/feishu/status" && method === "GET") {
          return jsonResponse(
            makeStatus({
              counts: {
                departments: 2,
                activeDepartments: 2,
                users: postCalls === 0 ? 1 : 2,
                activeUsers: postCalls === 0 ? 1 : 2,
                relations: 2,
              },
              latestRun:
                postCalls === 0
                  ? makeRun()
                  : makeRun({ id: "run-2", userCreatedCount: 2 }),
            }),
          );
        }
        if (url === "/api/v1/admin/feishu/sync-runs" && method === "GET") {
          return jsonResponse({
            items:
              postCalls === 0
                ? [makeRun()]
                : [makeRun({ id: "run-2", userCreatedCount: 2 })],
          });
        }
        if (url === "/api/v1/admin/feishu/field-diagnostics") {
          diagnosticsCalls += 1;
          if (diagnosticsCalls === 1) {
            return jsonResponse(makeDiagnostics());
          }
          return diagnosticsRefresh.promise;
        }
        if (url === "/api/v1/admin/feishu/sync-runs" && method === "POST") {
          postCalls += 1;
          return jsonResponse(makeRun({ id: "run-2" }));
        }
        return jsonResponse({}, { status: 404 });
      },
    );

    render(<App />);
    await user.click(await screen.findByRole("link", { name: "飞书同步" }));
    await user.click(await screen.findByRole("tab", { name: "字段诊断" }));
    expect(await screen.findByText("可进入后续 SSO")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "刷新诊断" }));
    expect(screen.getByRole("button", { name: "刷新中..." })).toBeDisabled();

    await user.click(screen.getByRole("tab", { name: "高级操作" }));
    const fullSyncInput = screen.getByLabelText("输入当前最新 run id");
    await user.type(
      fullSyncInput,
      fullSyncInput.getAttribute("placeholder") ?? "run-1",
    );
    const syncButton = screen.getByRole("button", { name: "确认触发全量同步" });
    await waitFor(() => {
      expect(syncButton).toBeEnabled();
    });
    await user.click(syncButton);
    const confirmDialog = await screen.findByRole("alertdialog", {
      name: "确认触发飞书全量同步",
    });
    expect(
      within(confirmDialog).getByText(/该操作会立即发起飞书组织与用户全量同步/),
    ).toBeInTheDocument();
    expect(postCalls).toBe(0);
    await user.click(
      within(confirmDialog).getByRole("button", { name: "确认" }),
    );
    await user.click(screen.getByRole("tab", { name: "同步历史" }));
    expect((await screen.findAllByText("+2 / ~0 / -0")).length).toBeGreaterThan(
      0,
    );

    diagnosticsRefresh.resolve(
      responseJson(
        makeDiagnostics({
          status: "warning",
          loginReadiness: {
            ready: true,
            reason: "关键字段满足登录准备要求，但展示字段仍需补齐",
          },
          warnings: ["用户 email 字段未返回，相关展示信息会缺失"],
        }),
      ),
    );

    await waitFor(() => {
      expect(postCalls).toBe(1);
      expect(diagnosticsCalls).toBe(2);
    });
    await user.click(screen.getByRole("tab", { name: "字段诊断" }));
    await waitFor(() => {
      expect(screen.getByText("字段不完整但可继续同步")).toBeInTheDocument();
      expect(
        screen.getByText("用户 email 字段未返回，相关展示信息会缺失"),
      ).toBeInTheDocument();
    });
    await user.click(screen.getByRole("tab", { name: "同步历史" }));
    await waitFor(() => {
      expect(screen.getAllByText("+2 / ~0 / -0").length).toBeGreaterThan(0);
    });
  });

  it("点击同步按钮先确认，确认后发起 POST 并刷新状态和历史", async () => {
    const user = userEvent.setup();
    let statusCalls = 0;
    let runsCalls = 0;
    let postCalls = 0;

    vi.spyOn(globalThis, "fetch").mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = requestUrl(input);
        const method = init?.method ?? "GET";
        if (url === "/health") {
          return jsonResponse({ status: "ok" });
        }
        if (url === "/ready") {
          return jsonResponse({ status: "ready" });
        }
        if (url === "/version") {
          return jsonResponse({ version: "0.4.0-dev" });
        }
        if (url === "/api/v1/admin/me") {
          return jsonResponse(makeAdminMe());
        }
        if (url === "/api/v1/admin/feishu/status" && method === "GET") {
          statusCalls += 1;
          return jsonResponse(
            makeStatus({
              counts: {
                departments: 2,
                activeDepartments: 2,
                users: statusCalls === 1 ? 1 : 2,
                activeUsers: statusCalls === 1 ? 1 : 2,
                relations: 2,
              },
              latestRun:
                statusCalls === 1
                  ? makeRun()
                  : makeRun({ id: "run-2", userCreatedCount: 2 }),
            }),
          );
        }
        if (url === "/api/v1/admin/feishu/sync-runs" && method === "GET") {
          runsCalls += 1;
          return jsonResponse({
            items:
              runsCalls === 1
                ? [makeRun()]
                : [makeRun({ id: "run-2", userCreatedCount: 2 })],
          });
        }
        if (url === "/api/v1/admin/feishu/field-diagnostics") {
          return jsonResponse(makeDiagnostics());
        }
        if (url === "/api/v1/admin/feishu/sync-runs" && method === "POST") {
          postCalls += 1;
          return jsonResponse(makeRun({ id: "run-2" }));
        }
        return jsonResponse({}, { status: 404 });
      },
    );

    render(<App />);
    await user.click(await screen.findByRole("link", { name: "飞书同步" }));
    await screen.findByText("同步健康");

    await user.click(screen.getByRole("tab", { name: "高级操作" }));
    const fullSyncInput = screen.getByLabelText("输入当前最新 run id");
    await user.type(
      fullSyncInput,
      fullSyncInput.getAttribute("placeholder") ?? "run-1",
    );
    const syncButton = screen.getByRole("button", { name: "确认触发全量同步" });
    await waitFor(() => {
      expect(syncButton).toBeEnabled();
    });
    await user.click(syncButton);
    const confirmDialog = await screen.findByRole("alertdialog", {
      name: "确认触发飞书全量同步",
    });
    expect(
      within(confirmDialog).getByText(/该操作会立即发起飞书组织与用户全量同步/),
    ).toBeInTheDocument();
    expect(postCalls).toBe(0);
    await user.click(
      within(confirmDialog).getByRole("button", { name: "确认" }),
    );

    await waitFor(() => {
      expect(postCalls).toBe(1);
      expect(statusCalls).toBe(3);
      expect(runsCalls).toBe(2);
    });
    await user.click(screen.getByRole("tab", { name: "同步历史" }));
    await waitFor(() => {
      expect(screen.getAllByText("+2 / ~0 / -0").length).toBeGreaterThan(0);
    });
  });

  it("手动同步失败时保留现有面板、展示安全错误并允许重试", async () => {
    const user = userEvent.setup();
    let postCalls = 0;

    vi.spyOn(globalThis, "fetch").mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = requestUrl(input);
        const method = init?.method ?? "GET";
        if (url === "/health") {
          return jsonResponse({ status: "ok" });
        }
        if (url === "/ready") {
          return jsonResponse({ status: "ready" });
        }
        if (url === "/version") {
          return jsonResponse({ version: "0.4.0-dev" });
        }
        if (url === "/api/v1/admin/me") {
          return jsonResponse(makeAdminMe());
        }
        if (url === "/api/v1/admin/feishu/status" && method === "GET") {
          return jsonResponse(makeStatus({ latestRun: makeRun() }));
        }
        if (url === "/api/v1/admin/feishu/sync-runs" && method === "GET") {
          return jsonResponse({ items: [makeRun()] });
        }
        if (url === "/api/v1/admin/feishu/field-diagnostics") {
          return jsonResponse(makeDiagnostics());
        }
        if (url === "/api/v1/admin/feishu/sync-runs" && method === "POST") {
          postCalls += 1;
          if (postCalls === 1) {
            return jsonResponse(
              {
                error: {
                  code: "FEISHU_SYNC_RUNNING",
                  message: "backend detail includes secret-token",
                  requestId: "req-123",
                  detail: { platformToken: "secret-token" },
                },
              },
              { status: 409 },
            );
          }
          return jsonResponse(makeRun({ id: "run-2" }));
        }
        return jsonResponse({}, { status: 404 });
      },
    );

    render(<App />);
    await user.click(await screen.findByRole("link", { name: "飞书同步" }));
    await screen.findByText("同步历史");

    await user.click(screen.getByRole("tab", { name: "高级操作" }));
    const fullSyncInput = screen.getByLabelText("输入当前最新 run id");
    await user.type(
      fullSyncInput,
      fullSyncInput.getAttribute("placeholder") ?? "run-1",
    );
    const syncButton = screen.getByRole("button", { name: "确认触发全量同步" });
    await waitFor(() => {
      expect(syncButton).toBeEnabled();
    });
    await user.click(syncButton);
    let confirmDialog = await screen.findByRole("alertdialog", {
      name: "确认触发飞书全量同步",
    });
    expect(
      within(confirmDialog).getByText(/该操作会立即发起飞书组织与用户全量同步/),
    ).toBeInTheDocument();
    expect(postCalls).toBe(0);
    await user.click(
      within(confirmDialog).getByRole("button", { name: "确认" }),
    );

    await waitFor(() => {
      expect(
        within(confirmDialog).getByText(/FEISHU_SYNC_RUNNING/),
      ).toBeInTheDocument();
      expect(
        within(confirmDialog).getByText(/已有飞书同步正在运行/),
      ).toBeInTheDocument();
      expect(within(confirmDialog).getByText(/req-123/)).toBeInTheDocument();
    });
    expect(confirmDialog).not.toHaveTextContent("secret-token");
    expect(confirmDialog).not.toHaveTextContent("backend detail");

    await user.click(
      within(confirmDialog).getByRole("button", { name: "取消" }),
    );
    const feishuSection = await screen.findByRole("region", {
      name: "飞书同步",
    });
    await user.click(
      within(feishuSection).getByRole("tab", { name: "组织与用户" }),
    );
    expect(within(feishuSection).getByText("有效用户")).toBeInTheDocument();
    expect(
      within(feishuSection).getByRole("tab", { name: "同步历史" }),
    ).toBeInTheDocument();
    await user.click(
      within(feishuSection).getByRole("tab", { name: "高级操作" }),
    );
    const retrySyncButton = within(feishuSection).getByRole("button", {
      name: "确认触发全量同步",
    });
    expect(retrySyncButton).toBeEnabled();
    await user.click(retrySyncButton);
    confirmDialog = await screen.findByRole("alertdialog", {
      name: "确认触发飞书全量同步",
    });
    await user.click(
      within(confirmDialog).getByRole("button", { name: "确认" }),
    );
    await waitFor(() => {
      expect(postCalls).toBe(2);
      expect(
        within(feishuSection).queryByText(/FEISHU_SYNC_RUNNING/),
      ).not.toBeInTheDocument();
    });
  });

  it("首次读取飞书详情失败时展示安全错误状态", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockImplementation(
      (input: RequestInfo | URL) => {
        const url = requestUrl(input);
        if (url === "/health") {
          return jsonResponse({ status: "ok" });
        }
        if (url === "/ready") {
          return jsonResponse({ status: "ready" });
        }
        if (url === "/version") {
          return jsonResponse({ version: "0.4.0-dev" });
        }
        if (url === "/api/v1/admin/me") {
          return jsonResponse(makeAdminMe());
        }
        if (url === "/api/v1/admin/feishu/status") {
          return jsonResponse(
            {
              error: {
                code: "FEISHU_CONFIG_MISSING",
                message: "飞书配置缺失",
                requestId: "req-init",
                detail: { appSecret: "secret-value" },
              },
            },
            { status: 500 },
          );
        }
        if (url === "/api/v1/admin/feishu/sync-runs") {
          return jsonResponse({ items: [] });
        }
        if (url === "/api/v1/admin/feishu/field-diagnostics") {
          return jsonResponse(makeDiagnostics());
        }
        return jsonResponse({}, { status: 404 });
      },
    );

    render(<App />);
    await user.click(await screen.findByRole("link", { name: "飞书同步" }));

    const feishuSection = await screen.findByRole("region", {
      name: "飞书同步",
    });
    expect(
      await within(feishuSection).findByText(/FEISHU_CONFIG_MISSING/),
    ).toBeInTheDocument();
    expect(
      within(feishuSection).getByText(/飞书应用配置缺失/),
    ).toBeInTheDocument();
    expect(within(feishuSection).getByText(/req-init/)).toBeInTheDocument();
    expect(feishuSection).not.toHaveTextContent("secret-value");
  });

  it("同步运行中时禁用触发并稳健展示空最近记录和错误码", async () => {
    const user = userEvent.setup();
    mockFetch({
      feishuStatus: makeStatus({
        running: true,
        latestRun: null,
      }),
      syncRuns: [
        makeRun({
          id: "run-failed",
          status: "failed",
          finishedAt: null,
          errorCode: "FEISHU_PERMISSION_DENIED",
          errorMessage: null,
        }),
      ],
    });

    render(<App />);
    await user.click(await screen.findByRole("link", { name: "飞书同步" }));

    await user.click(await screen.findByRole("tab", { name: "同步历史" }));
    expect(await screen.findByText("暂无记录")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "高级操作" }));
    expect(
      screen.getByRole("button", { name: "确认触发全量同步" }),
    ).toBeDisabled();
    expect(screen.getByText("已有同步运行中")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "同步历史" }));
    expect(
      screen.getAllByText("FEISHU_PERMISSION_DENIED").length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("运行中").length).toBeGreaterThan(0);
  });

  it.each([
    ["not_configured", "未配置"],
    ["configured", "已配置但未验证"],
    ["connected", "连接成功"],
    ["failed", "连接失败"],
  ] as const)("展示飞书配置状态 %s 的设计文案", async (configStatus, label) => {
    mockFetch({
      feishuStatus: makeStatus({ configStatus }),
      syncRuns: [makeRun()],
    });

    render(<App />);

    expect(await screen.findByText(label)).toBeInTheDocument();
  });

  it("应用详情页支持 Tab query 并保留返回上下文", async () => {
    const user = userEvent.setup();
    mockFetch({
      feishuStatus: makeStatus(),
      syncRuns: [makeRun()],
    });
    window.history.pushState(
      {},
      "",
      "/admin/applications/finance?from=%2Fadmin%2Fapplications%3Fq%3Dfinance&tab=development",
    );

    render(<App />);

    const main = await screen.findByRole("main", { name: "应用详情" });
    expect(
      await within(main).findByRole("tab", {
        name: "开发信息",
        selected: true,
      }),
    ).toBeInTheDocument();
    expect(
      await within(main).findByText("OAuth credential"),
    ).toBeInTheDocument();

    await user.click(within(main).getByRole("tab", { name: "角色管理" }));

    const params = new URLSearchParams(window.location.search);
    expect(window.location.pathname).toBe("/admin/applications/finance");
    expect(params.get("tab")).toBe("roles");
    expect(params.get("from")).toBe("/admin/applications?q=finance");
    expect(
      await within(main).findByRole("button", { name: "新增角色" }),
    ).toBeInTheDocument();
  });

  it("应用详情页遇到无效 Tab query 时降级到详细资料", async () => {
    mockFetch({
      feishuStatus: makeStatus(),
      syncRuns: [makeRun()],
    });
    window.history.pushState({}, "", "/admin/applications/finance?tab=unknown");

    render(<App />);

    expect(
      await screen.findByRole("tab", { name: "详细资料", selected: true }),
    ).toBeInTheDocument();
    expect(screen.getByText("飞书 user_id: ou-owner")).toBeInTheDocument();
  });

  it("渲染权限管理区域并展示应用筛选", async () => {
    const user = userEvent.setup();
    mockFetch({
      feishuStatus: makeStatus(),
      syncRuns: [makeRun()],
    });

    render(<App />);
    await user.click(await screen.findByRole("link", { name: "权限管理" }));

    const section = await screen.findByRole("region", { name: "权限管理" });
    expect(
      within(section).getByRole("heading", { name: "IAM 角色授权" }),
    ).toBeInTheDocument();
    const applicationSelect = await permissionApplicationSelect(section);
    expect(applicationSelect).toHaveValue("finance");
    expect(
      within(applicationSelect).getByRole("option", {
        name: "财务系统 / finance",
      }),
    ).toBeInTheDocument();
    expect(within(section).queryByLabelText("应用列表")).not.toBeInTheDocument();
  });

  it("点击应用后在角色详情 Tab 中展示授权绑定", async () => {
    const user = userEvent.setup();
    mockFetch({
      feishuStatus: makeStatus(),
      syncRuns: [makeRun()],
    });

    render(<App />);
    await user.click(await screen.findByRole("link", { name: "权限管理" }));

    const section = await screen.findByRole("region", { name: "权限管理" });
    await selectPermissionApplication(section, user);

    expect(
      screen.queryByRole("dialog", { name: "角色详情" }),
    ).not.toBeInTheDocument();
    expect(
      await within(section).findByRole("button", { name: /finance_admin/ }),
    ).toBeInTheDocument();

    const drawer = await openRoleDetail(section, user);
    expect(
      within(drawer).getByRole("heading", { name: "财务管理员", level: 3 }),
    ).toBeInTheDocument();
    expect(drawer).toHaveTextContent("finance_admin");
    expect(
      within(drawer).getByRole("tab", { name: "组织与用户绑定" }),
    ).toBeInTheDocument();
    expect(
      within(drawer).getByRole("tab", { name: "权限组绑定" }),
    ).toBeInTheDocument();

    await user.click(within(drawer).getByRole("tab", { name: "权限组绑定" }));
    expect(await within(drawer).findByText("发票查看员")).toBeInTheDocument();
    expect(
      within(drawer).getByText("finance.invoice.viewer"),
    ).toBeInTheDocument();

    await user.click(
      within(drawer).getByRole("tab", { name: "组织与用户绑定" }),
    );
    expect(within(drawer).getByText("5be616gc")).toBeInTheDocument();
    expect(within(drawer).getByText("od-demo")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "权限目录" }),
    ).not.toBeInTheDocument();
    expect(drawer).not.toHaveTextContent("finance.invoice.read");
  });

  it("权限管理不再暴露角色元数据创建入口", async () => {
    const user = userEvent.setup();
    mockFetch({
      feishuStatus: makeStatus(),
      syncRuns: [makeRun()],
    });

    render(<App />);
    await user.click(await screen.findByRole("link", { name: "权限管理" }));

    const section = await screen.findByRole("region", { name: "权限管理" });
    await selectPermissionApplication(section, user);

    expect(
      screen.queryByRole("dialog", { name: "创建 IAM 角色" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("角色 key")).not.toBeInTheDocument();
    expect(
      within(section).queryByRole("button", { name: "创建角色" }),
    ).not.toBeInTheDocument();
    expect(
      within(section).getByText(/角色元数据在应用管理维护/),
    ).toBeInTheDocument();
  });

  it("权限管理按应用展示 IAM 角色并在详情 Tab 绑定权限组", async () => {
    const user = userEvent.setup();
    const requestedUrls: string[] = [];
    mockFetch({
      feishuStatus: makeStatus(),
      syncRuns: [makeRun()],
      onRequest: (url) => requestedUrls.push(url),
    });

    render(<App />);
    await user.click(await screen.findByRole("link", { name: "权限管理" }));

    const section = await screen.findByRole("region", { name: "权限管理" });
    await selectPermissionApplication(section, user);
    const drawer = await openRoleDetail(section, user);

    await user.click(within(drawer).getByRole("tab", { name: "权限组绑定" }));
    expect(window.location.search).toContain("tab=groups");
    await user.click(within(drawer).getByLabelText("搜索权限组"));
    await user.click(await within(drawer).findByText("审计查看员"));
    await user.click(
      within(drawer).getByRole("button", { name: "保存权限组绑定" }),
    );
    const confirmDialog = await screen.findByRole("alertdialog", {
      name: "确认保存权限组绑定",
    });
    expect(confirmDialog).toHaveTextContent("新增 1 个权限组");
    expect(
      screen.queryByRole("heading", { name: "权限目录" }),
    ).not.toBeInTheDocument();
    await user.click(
      within(confirmDialog).getByRole("button", { name: "确认" }),
    );

    await waitFor(() => {
      expect(requestedUrls).toContain(
        "/api/v1/admin/applications/finance/iam-roles/role-1/permission-groups",
      );
    });
  });

  it("权限管理角色详情展示组织与用户绑定工作区", async () => {
    const user = userEvent.setup();
    mockFetch({
      feishuStatus: makeStatus(),
      syncRuns: [makeRun()],
    });

    render(<App />);
    await user.click(await screen.findByRole("link", { name: "权限管理" }));

    const section = await screen.findByRole("region", { name: "权限管理" });
    await selectPermissionApplication(section, user);
    const drawer = await openRoleDetail(section, user);
    await user.click(
      within(drawer).getByRole("tab", { name: "组织与用户绑定" }),
    );
    expect(
      within(drawer).getAllByRole("button", { name: "搜索" }).length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      within(drawer).getAllByLabelText("搜索组织或用户").length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      within(drawer).getAllByText("待选组织与用户").length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      within(drawer).getAllByText("已选组织与用户").length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("权限管理绑定成员支持搜索本地飞书用户和部门候选并保存前确认", async () => {
    const user = userEvent.setup();
    const requestedUrls: string[] = [];
    mockFetch({
      feishuStatus: makeStatus(),
      syncRuns: [makeRun()],
      onRequest: (url) => requestedUrls.push(url),
    });

    render(<App />);
    await user.click(await screen.findByRole("link", { name: "权限管理" }));

    const section = await screen.findByRole("region", { name: "权限管理" });
    await selectPermissionApplication(section, user);
    const drawer = await openRoleDetail(section, user);
    await user.click(
      within(drawer).getByRole("tab", { name: "组织与用户绑定" }),
    );

    const searchInputs = within(drawer).getAllByLabelText("搜索组织或用户");
    const searchButtons = within(drawer).getAllByRole("button", { name: "搜索" });
    const searchInput = searchInputs[searchInputs.length - 1] as HTMLInputElement;
    const searchButton = searchButtons[searchButtons.length - 1] as HTMLElement;
    await user.type(searchInput, "王");
    await user.click(searchButton);
    expect(
      await within(drawer).findAllByRole("button", { name: "选择用户" }),
    ).toHaveLength(1);
    await user.click(within(drawer).getAllByRole("button", { name: "选择用户" })[0] as HTMLElement);
    expect(
      within(drawer).getAllByText("ou-wang").length,
    ).toBeGreaterThanOrEqual(1);

    await user.clear(searchInput);
    await user.type(searchInput, "财务");
    await user.click(searchButton);
    expect(
      await within(drawer).findAllByRole("button", { name: "选择组织" }),
    ).toHaveLength(1);
    await user.click(within(drawer).getAllByRole("button", { name: "选择组织" })[0] as HTMLElement);
    expect(
      within(drawer).getAllByText("od-finance").length,
    ).toBeGreaterThanOrEqual(1);
    await user.click(
      within(drawer).getAllByRole("button", { name: "保存主体绑定" })[0] as HTMLElement,
    );
    const confirmDialog = await screen.findByRole("alertdialog", {
      name: "确认保存组织与用户绑定",
    });
    expect(confirmDialog).toHaveTextContent("新增 2 个主体");
    await user.click(
      within(confirmDialog).getByRole("button", { name: "确认" }),
    );
    expect(requestedUrls.some((url) => url.startsWith("/api/v1/admin/applications/finance/feishu/users?"))).toBe(true);
    expect(requestedUrls.some((url) => url.startsWith("/api/v1/admin/applications/finance/feishu/departments?"))).toBe(true);
    expect(requestedUrls).toContain(
      "/api/v1/admin/applications/finance/iam-roles/role-1/subjects",
    );
    expect(section).not.toHaveTextContent(/bics_|secret|token/i);
  });

  it("快速切换应用时忽略旧应用详情返回", async () => {
    const user = userEvent.setup();
    const financeGroups = createDeferred<Response>();
    const financeRoles = createDeferred<Response>();

    vi.spyOn(globalThis, "fetch").mockImplementation(
      (input: RequestInfo | URL) => {
        const url = requestUrl(input);
        if (url === "/health") {
          return jsonResponse({ status: "ok" });
        }
        if (url === "/ready") {
          return jsonResponse({ status: "ready" });
        }
        if (url === "/version") {
          return jsonResponse({ version: "0.4.0-dev" });
        }
        if (url === "/api/v1/admin/me") {
          return jsonResponse(makeAdminMe());
        }
        if (url === "/api/v1/admin/feishu/status") {
          return jsonResponse(makeStatus());
        }
        if (url === "/api/v1/admin/feishu/sync-runs") {
          return jsonResponse({ items: [makeRun()] });
        }
        if (url === "/api/v1/admin/feishu/field-diagnostics") {
          return jsonResponse(makeDiagnostics());
        }
        if (isApplicationListUrl(url)) {
          return jsonResponse({
            items: [
              makeApplication(),
              makeApplication({
                id: "app-crm",
                appKey: "crm",
                name: "CRM 系统",
              }),
            ],
          });
        }
        if (url === "/api/v1/admin/applications/finance/permission-groups") {
          return financeGroups.promise;
        }
        if (url === "/api/v1/admin/applications/finance/iam-roles") {
          return financeRoles.promise;
        }
        if (url === "/api/v1/admin/applications/crm/permission-groups") {
          return jsonResponse({
            items: [
              makePermissionGroup({
                id: "crm-group",
                applicationId: "app-crm",
                key: "crm.customer.viewer",
                name: "客户查看员",
              }),
            ],
          });
        }
        if (url === "/api/v1/admin/applications/crm/iam-roles") {
          return jsonResponse({
            items: [
              makeIamRole({
                id: "crm-role",
                applicationId: "app-crm",
                app_key: "crm",
                key: "crm_admin",
                name: "CRM 管理员",
                permissionGroups: [
                  makePermissionGroup({
                    id: "crm-group",
                    applicationId: "app-crm",
                    key: "crm.customer.viewer",
                    name: "客户查看员",
                  }),
                ],
              }),
            ],
          });
        }
        return jsonResponse({}, { status: 404 });
      },
    );

    render(<App />);
    await user.click(await screen.findByRole("link", { name: "权限管理" }));

    const section = await screen.findByRole("region", { name: "权限管理" });
    await selectPermissionApplication(section, user, /finance/);
    await selectPermissionApplication(section, user, /crm/);

    expect(
      await within(section).findByRole("button", { name: /crm_admin/ }),
    ).toBeInTheDocument();
    const drawer = await openRoleDetail(section, user, /crm_admin/);
    await user.click(within(drawer).getByRole("tab", { name: "权限组绑定" }));
    expect(await within(drawer).findByText("客户查看员")).toBeInTheDocument();
    expect(within(drawer).getByText("crm.customer.viewer")).toBeInTheDocument();

    financeGroups.resolve(responseJson({ items: [makePermissionGroup()] }));
    financeRoles.resolve(responseJson({ items: [makeIamRole()] }));
    await flushPromises();

    await waitFor(() => {
      expect(within(drawer).getByText("crm_admin")).toBeInTheDocument();
      expect(section).not.toHaveTextContent("发票查看员");
      expect(section).not.toHaveTextContent("finance.invoice.read");
    });
  });

  it("权限 API 错误只展示安全错误，不泄漏 detail 或 secret", async () => {
    const user = userEvent.setup();

    vi.spyOn(globalThis, "fetch").mockImplementation(
      (input: RequestInfo | URL) => {
        const url = requestUrl(input);
        if (url === "/health") {
          return jsonResponse({ status: "ok" });
        }
        if (url === "/ready") {
          return jsonResponse({ status: "ready" });
        }
        if (url === "/version") {
          return jsonResponse({ version: "0.4.0-dev" });
        }
        if (url === "/api/v1/admin/me") {
          return jsonResponse(makeAdminMe());
        }
        if (url === "/api/v1/admin/feishu/status") {
          return jsonResponse(makeStatus());
        }
        if (url === "/api/v1/admin/feishu/sync-runs") {
          return jsonResponse({ items: [makeRun()] });
        }
        if (url === "/api/v1/admin/feishu/field-diagnostics") {
          return jsonResponse(makeDiagnostics());
        }
        if (isApplicationListUrl(url)) {
          return jsonResponse(
            {
              error: {
                code: "ADMIN_LOGIN_REQUIRED",
                message: "backend detail includes secret-token",
                requestId: "req-permission",
                detail: { token: "secret-token" },
              },
            },
            { status: 401 },
          );
        }
        return jsonResponse({}, { status: 404 });
      },
    );

    render(<App />);
    await user.click(await screen.findByRole("link", { name: "权限管理" }));

    const section = await screen.findByRole("region", { name: "权限管理" });
    expect(
      await within(section).findByText(/ADMIN_LOGIN_REQUIRED/),
    ).toBeInTheDocument();
    expect(
      within(section).getByText(/需要登录 Feishu IAM 管理后台/),
    ).toBeInTheDocument();
    expect(within(section).getByText(/req-permission/)).toBeInTheDocument();
    expect(section).not.toHaveTextContent("secret-token");
    expect(section).not.toHaveTextContent("backend detail");
  });
});

async function permissionApplicationSelect(
  section: HTMLElement,
): Promise<HTMLSelectElement> {
  const select = await within(section).findByLabelText("应用");
  if (!(select instanceof HTMLSelectElement)) {
    throw new Error("未找到权限管理应用筛选");
  }
  return select;
}

async function selectPermissionApplication(
  section: HTMLElement,
  user: ReturnType<typeof userEvent.setup>,
  appName: RegExp = /finance/,
): Promise<void> {
  const select = await permissionApplicationSelect(section);
  const option = Array.from(select.options).find((item) =>
    appName.test(`${item.text} ${item.value}`),
  );
  if (!option) {
    throw new Error("未找到权限管理应用筛选项");
  }
  await user.selectOptions(select, option.value);
}

async function openRoleDetail(
  section: HTMLElement,
  user: ReturnType<typeof userEvent.setup>,
  roleKey: RegExp = /finance_admin/,
): Promise<HTMLElement> {
  await user.click(
    await within(section).findByRole("button", { name: roleKey }),
  );
  return screen.findByRole("main", { name: "角色详情" });
}

function mockFetch(options: {
  adminMe?: AdminMe;
  apiStatus?: ApiStatus;
  feishuStatus: FeishuStatus;
  syncRuns: FeishuSyncRun[];
  diagnostics?: FeishuFieldDiagnostics;
  createdClientSecret?: string;
  environments?: EnvironmentFixture[];
  createdEnvironment?: EnvironmentFixture;
  createdAdminUser?: AdminUserFixture;
  adminUsers?: AdminUserFixture[];
  auditLogs?: AdminAuditLog[];
  securityEvents?: AdminSecurityEvent[];
  onRequest?: (url: string) => void;
  onCreateAdminUser?: (body: unknown) => void;
}) {
  let applications = [makeApplication()];
  let environments = options.environments ?? [makeEnvironment()];
  let adminUsers = options.adminUsers ?? [];
  let iamRoles = [makeIamRole()];
  vi.spyOn(globalThis, "fetch").mockImplementation(
    (input: RequestInfo | URL, init?: RequestInit) => {
      const url = requestUrl(input);
      const method = init?.method ?? "GET";
      const body: unknown =
        typeof init?.body === "string"
          ? (JSON.parse(init.body) as unknown)
          : init?.body;
      options.onRequest?.(url);
      if (url === "/health") {
        return jsonResponse({ status: options.apiStatus?.health ?? "ok" });
      }
      if (url === "/ready") {
        return jsonResponse({ status: options.apiStatus?.ready ?? "ready" });
      }
      if (url === "/version") {
        return jsonResponse({
          version: options.apiStatus?.version ?? "0.4.0-dev",
        });
      }
      if (url === "/api/v1/admin/me") {
        return jsonResponse(options.adminMe ?? makeAdminMe());
      }
      if (url === "/api/v1/admin/feishu/status") {
        return jsonResponse(options.feishuStatus);
      }
      if (url === "/api/v1/admin/feishu/sync-runs") {
        return jsonResponse({ items: options.syncRuns });
      }
      if (url === "/api/v1/admin/feishu/field-diagnostics") {
        return jsonResponse(options.diagnostics ?? makeDiagnostics());
      }
      if (url === "/api/v1/admin/applications" || isApplicationListUrl(url)) {
        if (method === "POST") {
          const input = isRecord(body) ? body : {};
          const createdApplication = makeApplication({
            id: "app-created",
            appKey:
              typeof input.appKey === "string" ? input.appKey : "finance_new",
            name: typeof input.name === "string" ? input.name : "新财务系统",
            description:
              typeof input.description === "string"
                ? input.description
                : "新系统",
            ownerUserId:
              typeof input.ownerUserId === "string"
                ? input.ownerUserId
                : undefined,
          });
          applications = [...applications, createdApplication];
          return jsonResponse({
            application: createdApplication,
            redirectUris: [
              makeRedirectUri({
                id: "redirect-created",
                applicationId: createdApplication.id,
                redirectUri: "http://localhost:5173/auth/callback",
              }),
            ],
            oauthCredential: {
              id: "client-created",
              clientId: "client_finance_new",
              status: "active",
            },
            clientSecret: "bics_created_secret_once",
            developerCredential: {
              id: "developer-created",
              name: "默认开发者凭证",
              status: "active",
            },
            developerApiToken: "biad_created_token_once",
            integrationPrompt:
              "请把以下内容写入第三方项目 AGENTS.md 或 CLAUDE.md：client_id client_secret developer_api_token",
          });
        }
        return jsonResponse(makeApplicationPageResponse(url, applications));
      }
      if (url === "/api/v1/admin/applications/finance/permission-groups") {
        return jsonResponse({
          items: [
            makePermissionGroup(),
            makePermissionGroup({
              id: "group-2",
              key: "finance.audit.viewer",
              name: "审计查看员",
              description: "允许查看审计记录",
            }),
          ],
        });
      }
      if (url === "/api/v1/admin/applications/finance/iam-roles") {
        if (method === "POST") {
          const input = isRecord(body) ? body : {};
          const created = makeIamRole({
            id: "role-created",
            key: typeof input.key === "string" ? input.key : "finance.operator",
            name: typeof input.name === "string" ? input.name : "业务操作员",
            description:
              typeof input.description === "string" ? input.description : "",
          });
          iamRoles = [...iamRoles, created];
          return jsonResponse(created, { status: 201 });
        }
        return jsonResponse({ items: iamRoles });
      }
      if (
        url ===
          "/api/v1/admin/applications/finance/iam-roles/role-1/permission-groups" &&
        method === "PUT"
      ) {
        const permissionGroupIds =
          isRecord(body) && Array.isArray(body.permissionGroupIds)
            ? body.permissionGroupIds.filter(
                (value): value is string => typeof value === "string",
              )
            : [];
        const groups = [makePermissionGroup()].filter((group) =>
          permissionGroupIds.includes(group.id),
        );
        iamRoles = iamRoles.map((role) =>
          role.id === "role-1"
            ? { ...role, permissionGroupIds, permissionGroups: groups }
            : role,
        );
        return jsonResponse({ ok: true });
      }
      if (
        url ===
          "/api/v1/admin/applications/finance/iam-roles/role-1/subjects" &&
        method === "PUT"
      ) {
        const subjects =
          isRecord(body) && Array.isArray(body.subjects)
            ? body.subjects.filter(
                (
                  value,
                ): value is NonNullable<IamRoleFixture["subjects"]>[number] =>
                  isRecord(value) &&
                  (value.type === "feishu_user" ||
                    value.type === "feishu_department") &&
                  typeof value.id === "string",
              )
            : [];
        iamRoles = iamRoles.map((role) =>
          role.id === "role-1" ? { ...role, subjects } : role,
        );
        return jsonResponse({ ok: true });
      }
      if (
        url === "/api/v1/admin/applications/finance/iam-roles/role-1/enable" &&
        method === "POST"
      ) {
        iamRoles = iamRoles.map((role) =>
          role.id === "role-1" ? { ...role, status: "active" } : role,
        );
        return jsonResponse(
          iamRoles.find((role) => role.id === "role-1") ?? makeIamRole(),
        );
      }
      if (
        url === "/api/v1/admin/applications/finance/iam-roles/role-1/disable" &&
        method === "POST"
      ) {
        iamRoles = iamRoles.map((role) =>
          role.id === "role-1" ? { ...role, status: "disabled" } : role,
        );
        return jsonResponse(
          iamRoles.find((role) => role.id === "role-1") ??
            makeIamRole({ status: "disabled" }),
        );
      }
      if (
        url === "/api/v1/admin/applications/finance/iam-roles/role-1" &&
        method === "PATCH"
      ) {
        const input = isRecord(body) ? body : {};
        iamRoles = iamRoles.map((role) =>
          role.id === "role-1"
            ? {
                ...role,
                name: typeof input.name === "string" ? input.name : role.name,
                description:
                  typeof input.description === "string" ||
                  input.description === null
                    ? input.description
                    : role.description,
              }
            : role,
        );
        return jsonResponse(
          iamRoles.find((role) => role.id === "role-1") ?? makeIamRole(),
        );
      }
      if (url.startsWith("/api/v1/admin/applications/finance/feishu/users?")) {
        return jsonResponse({
          items: [
            {
              userId: "ou-wang",
              name: "王文哲",
              email: "wang@example.com",
              active: true,
            },
          ],
        });
      }
      if (url.startsWith("/api/v1/admin/feishu/users?")) {
        return jsonResponse({
          items: [
            {
              userId: "ou-wang",
              name: "王文哲",
              email: "wang@example.com",
              active: true,
            },
          ],
        });
      }
      if (
        url.startsWith("/api/v1/admin/applications/finance/feishu/departments?")
      ) {
        return jsonResponse({
          items: [
            {
              departmentId: "od-finance",
              name: "财务部",
              parentDepartmentId: null,
              status: {},
            },
          ],
        });
      }
      if (url === "/api/v1/admin/applications/finance/redirect-uris") {
        if (method === "POST") {
          const input = isRecord(body) ? body : {};
          return jsonResponse(
            makeRedirectUri({
              id: "redirect-created",
              redirectUri:
                typeof input.redirectUri === "string"
                  ? input.redirectUri
                  : "http://localhost:5190/callback",
            }),
          );
        }
        return jsonResponse({ items: [makeRedirectUri()] });
      }
      if (url === "/api/v1/admin/applications/finance/clients") {
        return jsonResponse({
          items: [
            {
              id: "client-1",
              clientId: "client_finance_dev",
              status: "active",
              lastUsedAt: null,
            },
          ],
        });
      }
      if (url === "/api/v1/admin/applications/finance/developer-credentials") {
        return jsonResponse({
          items: [
            {
              id: "developer-1",
              name: "默认开发者凭证",
              status: "active",
              lastUsedAt: null,
              rotatedAt: null,
            },
          ],
        });
      }
      if (url === "/api/v1/admin/applications/finance/integration-prompt") {
        return jsonResponse({
          integrationPrompt:
            "请把以下内容写入第三方项目 AGENTS.md 或 CLAUDE.md：client_id=<CLIENT_ID>",
        });
      }
      if (url === "/api/v1/admin/applications/finance/environments") {
        if (method === "POST") {
          const created = options.createdEnvironment ?? makeEnvironment();
          environments = [...environments, created];
          return jsonResponse(created);
        }
        return jsonResponse({ items: environments });
      }
      if (
        url ===
        "/api/v1/admin/applications/finance/environments/env-dev/redirect-uris"
      ) {
        return jsonResponse({ items: [makeRedirectUri()] });
      }
      if (
        url ===
          "/api/v1/admin/applications/finance/environments/env-dev/clients" &&
        method === "GET"
      ) {
        return jsonResponse({ items: [makeClient()] });
      }
      if (
        url ===
        "/api/v1/admin/applications/finance/clients/client_finance_dev/view-secret"
      ) {
        return jsonResponse({
          clientId: "client_finance_dev",
          clientSecret: "bics_viewed_secret",
        });
      }
      if (
        url ===
        "/api/v1/admin/applications/finance/clients/client_finance_dev/rotate-secret"
      ) {
        return jsonResponse({
          clientId: "client_finance_dev",
          clientSecret: "bics_rotated_secret",
        });
      }
      if (
        url ===
          "/api/v1/admin/applications/finance/environments/env-dev/clients" &&
        method === "POST"
      ) {
        return jsonResponse(
          makeClient({
            id: "client-created",
            clientId: "client_created",
            name: "本地调试 client",
            clientSecret:
              options.createdClientSecret ?? "bics_created_secret_once",
          }),
        );
      }
      if (url.startsWith("/api/v1/admin/audit-logs?")) {
        return jsonResponse({
          items: options.auditLogs ?? [],
          total: options.auditLogs?.length ?? 0,
          page: 1,
          pageSize: 20,
        });
      }
      if (url.startsWith("/api/v1/admin/security-events?")) {
        return jsonResponse({
          items: options.securityEvents ?? [],
          total: options.securityEvents?.length ?? 0,
          page: 1,
          pageSize: 20,
        });
      }
      if (url === "/api/v1/admin/admin-users") {
        if (method === "POST") {
          options.onCreateAdminUser?.(body);
          const created =
            options.createdAdminUser ??
            makeAdminUser({
              id: "admin-user-created",
              displayName: "新管理员",
            });
          adminUsers = [...adminUsers, created];
          return jsonResponse(created);
        }
        return jsonResponse({
          items: adminUsers,
          total: adminUsers.length,
          page: 1,
          pageSize: 20,
        });
      }
      if (
        url === "/api/v1/admin/admin-users/admin-user-1/authorization" &&
        method === "PATCH"
      ) {
        const input = isRecord(body) ? body : {};
        const roleKeys = Array.isArray(input.roleKeys)
          ? input.roleKeys.filter(
              (value): value is string => typeof value === "string",
            )
          : [];
        const applicationIds = Array.isArray(input.applicationIds)
          ? input.applicationIds.filter(
              (value): value is string => typeof value === "string",
            )
          : [];
        adminUsers = adminUsers.map((adminUser) =>
          adminUser.id === "admin-user-1"
            ? {
                ...adminUser,
                roles: roleKeys.map((roleKey) => ({
                  roleKey,
                  name:
                    roleKey === "platform_admin"
                      ? "平台管理员"
                      : roleKey === "application_admin"
                        ? "应用管理员"
                        : null,
                })),
                applicationScopes: applicationIds.includes("app-1")
                  ? [
                      {
                        id: "app-1",
                        appKey: "finance",
                        name: "财务系统",
                        status: "active",
                      },
                    ]
                  : [],
              }
            : adminUser,
        );
        return jsonResponse(
          adminUsers.find((adminUser) => adminUser.id === "admin-user-1") ??
            makeAdminUser(),
        );
      }
      if (
        url === "/api/v1/admin/admin-users/admin-user-1/disable" &&
        method === "POST"
      ) {
        adminUsers = adminUsers.map((adminUser) =>
          adminUser.id === "admin-user-1"
            ? { ...adminUser, status: "disabled" }
            : adminUser,
        );
        return jsonResponse(
          adminUsers.find((adminUser) => adminUser.id === "admin-user-1") ??
            makeAdminUser(),
        );
      }
      if (
        url === "/api/v1/admin/admin-users/admin-user-1/enable" &&
        method === "POST"
      ) {
        adminUsers = adminUsers.map((adminUser) =>
          adminUser.id === "admin-user-1"
            ? { ...adminUser, status: "active" }
            : adminUser,
        );
        return jsonResponse(
          adminUsers.find((adminUser) => adminUser.id === "admin-user-1") ??
            makeAdminUser(),
        );
      }
      return jsonResponse({}, { status: 404 });
    },
  );
}

function makeAdminMe(overrides?: Partial<AdminMe>): AdminMe {
  return {
    adminUserId: "admin-1",
    feishuUserId: "ou_1",
    displayName: "张三",
    roles: ["platform_admin"],
    applicationIds: [],
    ...overrides,
  };
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  return input.url;
}

function isApplicationListUrl(url: string): boolean {
  return (
    url === "/api/v1/admin/applications" ||
    url.startsWith("/api/v1/admin/applications?")
  );
}

function makeApplicationPageResponse(
  url: string,
  applications: PermissionApplicationFixture[],
) {
  const parsed = new URL(`http://localhost${url}`);
  const page = normalizePositiveInteger(
    Number(parsed.searchParams.get("page")),
    1,
  );
  const pageSize = normalizePositiveInteger(
    Number(parsed.searchParams.get("pageSize")),
    100,
  );
  const query = parsed.searchParams.get("query")?.trim().toLowerCase() ?? "";
  const status = parsed.searchParams.get("status");
  const filtered = applications.filter((application) => {
    const matchesStatus =
      !status || status === "all" || application.status === status;
    const matchesQuery =
      query.length === 0 ||
      [
        application.name,
        application.appKey,
        application.description,
        application.ownerUserId,
      ].some((value) => value.toLowerCase().includes(query));
    return matchesStatus && matchesQuery;
  });
  const start = (page - 1) * pageSize;
  return {
    items: filtered.slice(start, start + pageSize),
    total: filtered.length,
    page,
    pageSize,
  };
}

function normalizePositiveInteger(value: number, fallback: number): number {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function jsonResponse(body: unknown, init?: ResponseInit): Promise<Response> {
  return Promise.resolve(responseJson(body, init));
}

function responseJson(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), init);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function makeStatus(overrides?: Partial<FeishuStatus>): FeishuStatus {
  return {
    configStatus: "configured",
    running: false,
    latestRun: makeRun(),
    counts: {
      departments: 1,
      activeDepartments: 1,
      users: 1,
      activeUsers: 1,
      relations: 1,
    },
    ...overrides,
  };
}

function makeDiagnostics(
  overrides?: Partial<FeishuFieldDiagnostics>,
): FeishuFieldDiagnostics {
  return {
    status: "passed",
    loginReadiness: {
      ready: true,
      reason: "字段满足后续 SSO 准备要求",
    },
    sampleCounts: {
      departments: 1,
      users: 1,
      activeUsers: 1,
    },
    departmentFields: [
      {
        field: "name",
        status: "present",
        presentCount: 1,
        missingCount: 0,
        emptyCount: 0,
        requiredLevel: "strong_warning",
      },
    ],
    userFields: [
      {
        field: "status",
        status: "present",
        presentCount: 1,
        missingCount: 0,
        emptyCount: 0,
        requiredLevel: "blocking",
      },
    ],
    blockingIssues: [],
    warnings: [],
    nextActions: [
      "字段完整性满足 v0.2.x 身份镜像发布门槛，可以执行真实同步验收",
    ],
    ...overrides,
  };
}

function makeRun(overrides?: Partial<FeishuSyncRun>): FeishuSyncRun {
  return {
    id: "run-1",
    status: "success",
    triggerSource: "platform_api",
    startedAt: "2026-05-15T00:00:00.000Z",
    finishedAt: "2026-05-15T00:00:01.000Z",
    departmentCreatedCount: 1,
    departmentUpdatedCount: 0,
    departmentDeletedCount: 0,
    userCreatedCount: 1,
    userUpdatedCount: 0,
    userDeletedCount: 0,
    relationCreatedCount: 1,
    relationUpdatedCount: 0,
    relationDeletedCount: 0,
    errorCode: null,
    errorMessage: null,
    ...overrides,
  };
}

type PermissionApplicationFixture = {
  id: string;
  appKey: string;
  name: string;
  description: string;
  ownerUserId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type PermissionCatalogFixture = {
  id: string;
  applicationId: string;
  key: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type IamRoleFixture = PermissionCatalogFixture & {
  app_key: string;
  permissionGroups?: PermissionCatalogFixture[];
  permissionGroupIds?: string[];
  subjects?: Array<{
    type: "feishu_user" | "feishu_department";
    id: string;
    isOrphaned?: boolean;
  }>;
};

type EnvironmentFixture = {
  id: string;
  applicationId: string;
  environmentKey: "dev" | "test" | "prod";
  name: string;
  status: string;
};

type RedirectUriFixture = {
  id: string;
  applicationId: string;
  environmentId: string;
  redirectUri: string;
  status: string;
};

type ClientFixture = {
  id: string;
  applicationId: string;
  environmentId: string;
  clientId: string;
  name: string;
  status: string;
  lastUsedAt: string | null;
  clientSecret?: string;
};

type AdminUserFixture = {
  id: string;
  feishuUserId: string;
  displayName: string;
  roles: Array<{ roleKey: string; name: string | null }>;
  applicationScopes: Array<{
    id: string;
    appKey: string;
    name: string | null;
    status: string;
  }>;
  status: string;
  createdAt: string;
};

function makeApplication(
  overrides?: Partial<PermissionApplicationFixture>,
): PermissionApplicationFixture {
  return {
    id: "app-1",
    appKey: "finance",
    name: "财务系统",
    description: "财务后台",
    ownerUserId: "ou-owner",
    status: "active",
    createdAt: "2026-05-16T00:00:00.000Z",
    updatedAt: "2026-05-16T00:00:00.000Z",
    ...overrides,
  };
}

function makeAdminUser(
  overrides?: Partial<AdminUserFixture>,
): AdminUserFixture {
  return {
    id: "admin-user-1",
    feishuUserId: "ou_admin_1",
    displayName: "李四",
    roles: [{ roleKey: "platform_admin", name: "平台管理员" }],
    applicationScopes: [],
    status: "active",
    createdAt: "2026-05-16T00:00:00.000Z",
    ...overrides,
  };
}

function makeEnvironment(
  overrides?: Partial<EnvironmentFixture>,
): EnvironmentFixture {
  return {
    id: "env-dev",
    applicationId: "app-1",
    environmentKey: "dev",
    name: "开发环境",
    status: "active",
    ...overrides,
  };
}

function makeRedirectUri(
  overrides?: Partial<RedirectUriFixture>,
): RedirectUriFixture {
  return {
    id: "redirect-1",
    applicationId: "app-1",
    environmentId: "env-dev",
    redirectUri: "http://localhost:5179/callback",
    status: "active",
    ...overrides,
  };
}

function makeClient(overrides?: Partial<ClientFixture>): ClientFixture {
  return {
    id: "client-1",
    applicationId: "app-1",
    environmentId: "env-dev",
    clientId: "client_finance_dev",
    name: "开发 client",
    status: "active",
    lastUsedAt: null,
    ...overrides,
  };
}

function makePermissionGroup(
  overrides?: Partial<PermissionCatalogFixture>,
): PermissionCatalogFixture {
  return {
    id: "group-1",
    applicationId: "app-1",
    key: "finance.invoice.viewer",
    name: "发票查看员",
    description: "允许查看发票",
    status: "active",
    createdAt: "2026-05-16T00:00:00.000Z",
    updatedAt: "2026-05-16T00:00:00.000Z",
    ...overrides,
  };
}

function makeIamRole(overrides?: Partial<IamRoleFixture>): IamRoleFixture {
  const boundGroup = makePermissionGroup();
  return {
    id: "role-1",
    applicationId: "app-1",
    app_key: "finance",
    key: "finance_admin",
    name: "财务管理员",
    description: "财务管理角色",
    status: "active",
    createdAt: "2026-05-16T00:00:00.000Z",
    updatedAt: "2026-05-16T00:00:00.000Z",
    permissionGroups: [boundGroup],
    permissionGroupIds: [boundGroup.id],
    subjects: [
      { type: "feishu_user", id: "5be616gc" },
      { type: "feishu_department", id: "od-demo" },
    ],
    ...overrides,
  };
}
