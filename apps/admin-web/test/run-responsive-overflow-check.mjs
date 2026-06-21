import { chromium } from "playwright";

const baseUrl = process.env.ADMIN_WEB_URL ?? "http://localhost:3000";
const routePaths = [
  "/admin/workspace",
  "/admin/applications",
  "/admin/applications/crm?from=/admin/applications",
  "/admin/applications/crm?from=/admin/applications&tab=permissions",
  "/admin/applications/crm?from=/admin/applications&tab=development",
  "/admin/applications/crm?from=/admin/applications&tab=danger",
  "/admin/permissions",
  "/admin/permissions/matrix",
  "/admin/permissions/crm/roles/role-1?from=/admin/permissions%3FappKey%3Dcrm&tab=groups",
  "/admin/system/admins",
  "/admin/system/audit?tab=security",
  "/admin/system/audit?tab=trace&requestId=req_0123456789abcdef0123456789abcdef_long&applicationId=app-1&clientId=client_crm",
  "/admin/system/feishu",
  "/admin/system/info",
];
const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "narrow", width: 768, height: 900 },
  { name: "desktop", width: 1280, height: 900 },
  { name: "wide", width: 1440, height: 900 },
];

const browser = await launchBrowser();
const results = [];

try {
  for (const routePath of routePaths) {
    const url = new URL(routePath, baseUrl).toString();
    for (const viewport of viewports) {
      const page = await browser.newPage({ viewport });
      const consoleErrors = [];
      const requestFailures = [];

      page.on("console", (message) => {
        if (message.type() === "error") {
          consoleErrors.push(message.text());
        }
      });
      page.on("requestfailed", (request) => {
        requestFailures.push(
          `${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}`.trim(),
        );
      });
      page.on("pageerror", (error) => {
        consoleErrors.push(error.message);
      });

      await installApiMocks(page);
      await page.goto(url, { waitUntil: "networkidle" });
      try {
        await page.waitForFunction(
          () =>
            Boolean(
              document.querySelector(
                'button[aria-label="打开导航"], nav[aria-label="主菜单"]',
              ),
            ),
          null,
          { timeout: 10_000 },
        );
      } catch (error) {
        const bodyText = await page
          .locator("body")
          .innerText()
          .catch(() => "");
        throw new Error(
          `页面未完成加载：${url} / ${viewport.name} / ${bodyText.slice(0, 300)}`,
          { cause: error },
        );
      }

      const result = await page.evaluate(() => {
        const documentElement = document.documentElement;
        const nav = document.querySelector('nav[aria-label="主菜单"]');
        const activeNavItem = document.querySelector(
          'a[aria-current="page"], button[aria-current="page"]',
        );
        const menuButton = document.querySelector(
          'button[aria-label="打开导航"]',
        );
        const drawer = document.querySelector('[role="dialog"]');

        function visible(element) {
          if (!element) {
            return false;
          }
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return (
            rect.width > 0 &&
            rect.height > 0 &&
            style.visibility !== "hidden" &&
            style.display !== "none"
          );
        }

        function hasHorizontalScrollAncestor(element) {
          let current = element.parentElement;
          while (current && current !== document.body) {
            const overflowX = getComputedStyle(current).overflowX;
            if (overflowX === "auto" || overflowX === "scroll") {
              return true;
            }
            current = current.parentElement;
          }
          return false;
        }

        const overflowingElements = Array.from(
          document.querySelectorAll("main, section, table, [role='tabpanel']"),
        )
          .filter((element) => {
            const style = getComputedStyle(element);
            const overflowX = style.overflowX;
            const allowsHorizontalScroll =
              overflowX === "auto" ||
              overflowX === "scroll" ||
              hasHorizontalScrollAncestor(element);
            return (
              !allowsHorizontalScroll &&
              element.scrollWidth > element.clientWidth + 1
            );
          })
          .map((element) => ({
            tagName: element.tagName.toLowerCase(),
            ariaLabel: element.getAttribute("aria-label"),
            role: element.getAttribute("role"),
            className:
              typeof element.className === "string" ? element.className : "",
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
          }));

        return {
          viewportWidth: window.innerWidth,
          scrollWidth: documentElement.scrollWidth,
          navVisible: visible(nav),
          menuButtonVisible: visible(menuButton),
          activeNavVisible: visible(activeNavItem),
          drawerWidth: drawer ? drawer.getBoundingClientRect().width : null,
          overflowingElements,
        };
      });

      const failures = [];
      if (result.scrollWidth > result.viewportWidth) {
        failures.push(
          `页面级横向溢出：scrollWidth ${String(result.scrollWidth)} > viewport ${String(result.viewportWidth)}`,
        );
      }
      if (viewport.width <= 768 && !result.menuButtonVisible) {
        failures.push("窄屏应展示打开导航按钮");
      }
      if (viewport.width >= 1024 && !result.navVisible) {
        failures.push("桌面宽度应展示左侧主菜单");
      }
      if (viewport.width >= 1024 && !result.activeNavVisible) {
        failures.push("当前模块导航项不可见");
      }
      if (
        result.drawerWidth !== null &&
        result.drawerWidth > result.viewportWidth
      ) {
        failures.push(
          `抽屉宽度超过视口：drawer ${String(result.drawerWidth)} > viewport ${String(result.viewportWidth)}`,
        );
      }
      if (result.overflowingElements.length > 0) {
        failures.push(
          `容器横向溢出：${JSON.stringify(result.overflowingElements)}`,
        );
      }
      if (routePath === "/admin/applications" && viewport.width >= 1280) {
        const detailCheck = await checkApplicationDetailPage(page);
        if (detailCheck.failures.length > 0) {
          failures.push(...detailCheck.failures);
        }
        Object.assign(result, { applicationDetailPage: detailCheck });
      }
      if (
        routePath.startsWith("/admin/permissions/crm/roles/") &&
        viewport.width >= 1280
      ) {
        const detailCheck = await checkRoleDetailPage(page);
        if (detailCheck.failures.length > 0) {
          failures.push(...detailCheck.failures);
        }
        Object.assign(result, { roleDetailPage: detailCheck });
      }
      if (
        routePath === "/admin/permissions/matrix" &&
        viewport.width >= 1280
      ) {
        const matrixCheck = await checkPermissionMatrixPage(page);
        if (matrixCheck.failures.length > 0) {
          failures.push(...matrixCheck.failures);
        }
        Object.assign(result, { permissionMatrixPage: matrixCheck });
      }
      if (
        routePath.startsWith("/admin/applications/crm") &&
        routePath.includes("tab=permissions") &&
        viewport.width >= 1280
      ) {
        const permissionAssetCheck = await checkApplicationPermissionAssets(page);
        if (permissionAssetCheck.failures.length > 0) {
          failures.push(...permissionAssetCheck.failures);
        }
        Object.assign(result, { applicationPermissionAssets: permissionAssetCheck });
      }
      if (consoleErrors.length > 0) {
        failures.push(`console error: ${consoleErrors.join(" | ")}`);
      }
      if (requestFailures.length > 0) {
        failures.push(`request failed: ${requestFailures.join(" | ")}`);
      }

      results.push({ routePath, url, viewport, ...result, failures });
      await page.close();
    }
  }
} finally {
  await browser.close();
}

const failed = results.filter((result) => result.failures.length > 0);
if (failed.length > 0) {
  console.error(JSON.stringify({ baseUrl, routePaths, results }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ baseUrl, routePaths, results }, null, 2));

async function installApiMocks(page) {
  await page.route("**/*", (route) => {
    const pathname = new URL(route.request().url()).pathname;

    if (pathname === "/api/v1/admin/me") {
      return fulfillJson(route, {
        adminUserId: "admin-user-1",
        feishuUserId: "ou_admin",
        displayName: "王文哲",
        roles: ["platform_admin"],
        applicationIds: [],
      });
    }
    if (pathname === "/health") {
      return fulfillJson(route, { status: "ok" });
    }
    if (pathname === "/ready") {
      return fulfillJson(route, { status: "ready" });
    }
    if (pathname === "/version") {
      return fulfillJson(route, { version: "0.9.0-local" });
    }
    if (pathname === "/api/v1/admin/feishu/status") {
      return fulfillJson(route, mockFeishuStatus());
    }
    if (pathname === "/api/v1/admin/feishu/field-diagnostics") {
      return fulfillJson(route, {
        status: "failed",
        loginReadiness: {
          ready: false,
          reason: "飞书字段样本不足",
        },
        sampleCounts: {
          departments: 0,
          users: 0,
          activeUsers: 0,
        },
        departmentFields: [],
        userFields: [],
        blockingIssues: ["缺少通讯录字段样本"],
        warnings: [],
        nextActions: ["检查飞书应用权限"],
      });
    }
    if (pathname === "/api/v1/admin/feishu/sync-runs") {
      return fulfillJson(route, { items: [mockSyncRun()] });
    }
    if (pathname === "/api/v1/admin/permission-matrix") {
      return fulfillJson(route, mockPermissionMatrix());
    }
    if (pathname === "/api/v1/admin/applications") {
      return fulfillJson(route, mockApplicationPage());
    }
    if (pathname === "/api/v1/admin/applications/crm/redirect-uris") {
      return fulfillJson(route, {
        items: [
          {
            id: "redirect-uri-1",
            redirectUri: "https://crm.example.com/callback",
            status: "active",
          },
        ],
      });
    }
    if (pathname === "/api/v1/admin/applications/crm/clients") {
      return fulfillJson(route, {
        items: [
          {
            id: "client-1",
            clientId: "client_crm",
            status: "active",
            lastUsedAt: null,
          },
        ],
      });
    }
    if (pathname === "/api/v1/admin/applications/crm/developer-credentials") {
      return fulfillJson(route, {
        items: [
          {
            id: "dev-1",
            name: "CRM developer credential",
            status: "active",
            lastUsedAt: null,
            rotatedAt: null,
          },
        ],
      });
    }
    if (pathname === "/api/v1/admin/applications/crm/integration-prompt") {
      return fulfillJson(route, {
        integrationPrompt: "接入 CRM 的 Codex 提示词",
      });
    }
    if (pathname.endsWith("/permission-groups")) {
      return fulfillJson(route, {
        items: [
          {
            id: "group-1",
            applicationId: "app-1",
            key: "crm.customer.viewer",
            name: "客户查看员",
            description: "客户查看权限",
            status: "active",
            createdAt: "2026-05-24T10:00:00.000Z",
            updatedAt: "2026-05-24T11:00:00.000Z",
          },
        ],
      });
    }
    if (pathname.endsWith("/permission-points")) {
      return fulfillJson(route, { items: [] });
    }
    if (pathname.endsWith("/iam-roles")) {
      return fulfillJson(route, {
        items: [
          {
            id: "role-1",
            applicationId: "app-1",
            appKey: "crm",
            key: "crm_admin",
            name: "CRM 管理员",
            description: "CRM 管理员角色",
            status: "active",
            permissionGroups: [
              {
                id: "group-1",
                applicationId: "app-1",
                key: "crm.customer.viewer",
                name: "客户查看员",
                description: "客户查看权限",
                status: "active",
                permissionPoints: [
                  {
                    id: "point-1",
                    applicationId: "app-1",
                    key: "crm.customer.read",
                    name: "查看客户",
                    description: "查看客户资料",
                    status: "active",
                    createdAt: "2026-05-24T10:00:00.000Z",
                    updatedAt: "2026-05-24T11:00:00.000Z",
                  },
                  {
                    id: "point-2",
                    applicationId: "app-1",
                    key: "crm.customer.export",
                    name: "导出客户",
                    description: "导出客户资料",
                    status: "active",
                    createdAt: "2026-05-24T10:00:00.000Z",
                    updatedAt: "2026-05-24T11:00:00.000Z",
                  },
                ],
                createdAt: "2026-05-24T10:00:00.000Z",
                updatedAt: "2026-05-24T11:00:00.000Z",
              },
            ],
            permissionGroupIds: ["group-1"],
            permissionPoints: [
              {
                id: "point-1",
                applicationId: "app-1",
                key: "crm.customer.read",
                name: "查看客户",
                description: "查看客户资料",
                status: "active",
                createdAt: "2026-05-24T10:00:00.000Z",
                updatedAt: "2026-05-24T11:00:00.000Z",
              },
            ],
            subjects: [{ type: "feishu_user", id: "ou_admin" }],
            createdAt: "2026-05-24T10:00:00.000Z",
            updatedAt: "2026-05-24T11:00:00.000Z",
          },
        ],
      });
    }
    if (pathname === "/api/v1/admin/admin-users") {
      return fulfillJson(route, { items: [], total: 0, page: 1, pageSize: 20 });
    }
    if (pathname === "/api/v1/admin/audit-logs") {
      return fulfillJson(route, { items: [], total: 0, page: 1, pageSize: 20 });
    }
    if (pathname === "/api/v1/admin/security-events") {
      return fulfillJson(route, { items: [], total: 0, page: 1, pageSize: 20 });
    }
    if (pathname === "/api/v1/admin/traces") {
      return fulfillJson(route, mockTraceResult());
    }
    if (pathname.startsWith("/api/v1/admin/")) {
      return fulfillJson(route, { items: [], total: 0, page: 1, pageSize: 20 });
    }

    return route.continue();
  });
}

async function checkApplicationDetailPage(page) {
  const failures = [];
  await page.getByRole("button", { name: "查看 crm 详情" }).click();
  await page.waitForURL("**/admin/applications/crm?**");
  const main = page.getByRole("main", { name: "应用详情" });
  await main.waitFor();
  await main.getByRole("heading", { level: 1, name: "应用详情" }).waitFor();
  await main.getByText("CRM 系统").first().waitFor();
  await main.getByText("回调地址").first().waitFor();
  if (
    await page
      .getByRole("dialog", { name: /应用详情/ })
      .isVisible()
      .catch(() => false)
  ) {
    failures.push("应用详情默认入口不应打开右侧抽屉");
  }
  return { url: page.url(), failures };
}

async function checkRoleDetailPage(page) {
  const failures = [];
  const main = page.getByRole("main", { name: "角色配置工作台" });
  await main.waitFor();
  await main.getByRole("heading", { level: 1, name: "角色配置工作台" }).waitFor();
  await main.getByRole("tab", { name: "应用权限" }).waitFor();
  const selected = await main
    .getByRole("tab", { name: "应用权限" })
    .getAttribute("aria-selected");
  if (selected !== "true") {
    failures.push("角色详情 URL tab=groups 未恢复到应用权限");
  }
  await main.getByRole("button", { name: "查看权限点" }).first().click();
  const effectivePoints = main.getByLabel("最终权限点清单");
  await effectivePoints.getByText("crm.customer.read").waitFor();
  await effectivePoints.getByText("crm.customer.export").waitFor();
  await effectivePoints.getByText("直接 + 权限组").waitFor();
  if (
    await page
      .getByRole("dialog", { name: /角色详情/ })
      .isVisible()
      .catch(() => false)
  ) {
    failures.push("角色详情默认入口不应打开右侧抽屉");
  }
  return { url: page.url(), selectedTab: selected, failures };
}

async function checkPermissionMatrixPage(page) {
  const failures = [];
  const main = page.getByRole("region", { name: "权限矩阵" });
  await main.waitFor();
  await main.getByRole("heading", { level: 1, name: "权限矩阵" }).waitFor();
  await main.getByLabel("主体 ID").fill("ou_user_1");
  await main.getByRole("button", { name: "查询" }).click();
  await main.getByText("CRM 系统").first().waitFor();
  await main.getByText("crm.customer.read").first().waitFor();
  await main.getByText("权限来源解释").waitFor();
  await main.getByText("通过组织继承").waitFor();
  return { url: page.url(), failures };
}

async function checkApplicationPermissionAssets(page) {
  const failures = [];
  const main = page.getByRole("main", { name: "应用详情" });
  await main.waitFor();
  await main.getByRole("tab", { name: "权限资产" }).waitFor();
  const selected = await main
    .getByRole("tab", { name: "权限资产" })
    .getAttribute("aria-selected");
  if (selected !== "true") {
    failures.push("应用详情 URL tab=permissions 未恢复到权限资产");
  }
  await main.getByText("权限资产查询").waitFor();
  await main.getByText("客户查看员").first().waitFor();
  return { url: page.url(), selectedTab: selected, failures };
}

function mockApplicationPage() {
  return {
    items: [
      {
        id: "app-1",
        appKey: "crm",
        name: "CRM 系统",
        description: "客户系统",
        ownerUserId: "ou_owner",
        status: "active",
        createdAt: "2026-05-24T10:00:00.000Z",
        updatedAt: "2026-05-24T11:00:00.000Z",
        integrationSummary: {
          redirectUriCount: 1,
          activeRedirectUriCount: 1,
          oauthClientCount: 1,
          activeOauthClientCount: 1,
          developerCredentialCount: 1,
          activeDeveloperCredentialCount: 1,
          iamRoleCount: 0,
          activeIamRoleCount: 0,
        },
      },
    ],
    total: 1,
    page: 1,
    pageSize: 20,
  };
}

function mockSyncRun() {
  return {
    id: "sync-run-1",
    status: "failed",
    triggerSource: "manual",
    startedAt: "2026-05-23T10:00:00.000Z",
    finishedAt: "2026-05-23T10:00:03.000Z",
    departmentCreatedCount: 0,
    departmentUpdatedCount: 0,
    departmentDeletedCount: 0,
    userCreatedCount: 0,
    userUpdatedCount: 0,
    userDeletedCount: 0,
    relationCreatedCount: 0,
    relationUpdatedCount: 0,
    relationDeletedCount: 0,
    errorCode: "FEISHU_PERMISSION_DENIED",
    errorMessage: "飞书权限不足",
  };
}

function mockTraceResult() {
  return {
    summary: {
      status: "partial",
      diagnosis: "已命中 authorize 和 token 阶段，未命中 userinfo 与权限查询。",
      matchedEventCount: 2,
      missingStages: ["oauth_userinfo", "oauth_permission_query"],
      nextActions: ["请确认第三方系统是否继续调用 userinfo 和权限查询接口。"],
    },
    context: {
      requestId: "req_0123456789abcdef0123456789abcdef_long",
      application: { id: "app-1", appKey: "crm", name: "CRM 系统" },
      applicationId: "app-1",
      appKey: "crm",
      clientId: "client_crm",
      feishuUserId: "ou_user_very_long_identifier_for_layout_check",
      timeWindow: {
        from: "2026-05-29T00:00:00.000Z",
        to: "2026-05-29T01:00:00.000Z",
      },
    },
    timeline: [
      {
        id: "trace-1",
        source: "security_event",
        stage: "oauth_authorize",
        result: "success",
        occurredAt: "2026-05-29T00:10:00.000Z",
        title: "authorize 成功",
        summary: "OAuth authorize 已创建授权上下文。",
        requestId: "req_0123456789abcdef0123456789abcdef_long",
        applicationId: "app-1",
        clientId: "client_crm",
        feishuUserId: "ou_user_very_long_identifier_for_layout_check",
        details: {
          redirectUri:
            "https://crm.example.com/oauth/callback/with/a/very/long/path/that/should/wrap/instead/of-breaking-layout",
          token: "[REDACTED]",
          rawPayload: "[REDACTED]",
        },
      },
      {
        id: "trace-2",
        source: "security_event",
        stage: "oauth_token_exchange",
        result: "success",
        occurredAt: "2026-05-29T00:11:00.000Z",
        title: "token 换取成功",
        summary: "授权码已换取 Feishu IAM access token，敏感字段已脱敏。",
        requestId: "req_0123456789abcdef0123456789abcdef_long",
        applicationId: "app-1",
        clientId: "client_crm",
        feishuUserId: "ou_user_very_long_identifier_for_layout_check",
        details: {
          accessToken: "[REDACTED]",
          authorization: "[REDACTED]",
        },
      },
    ],
    coverage: {
      auditLogs: 0,
      securityEvents: 2,
      feishuSyncRuns: 0,
      oauthContexts: 0,
    },
  };
}

function mockPermissionMatrix() {
  return {
    subject: {
      type: "user",
      id: "ou_user_1",
      name: "张三",
    },
    scope_note: "用户查询包含直接用户绑定和用户所属组织绑定。",
    applications: [
      {
        app_key: "crm",
        name: "CRM 系统",
        matched_roles: [
          {
            key: "crm_admin",
            name: "CRM 管理员",
            match_type: "direct",
          },
          {
            key: "crm_sales_viewer",
            name: "销售查看员",
            match_type: "department",
          },
        ],
        permission_groups: [
          {
            key: "crm.customer.viewer",
            name: "客户查看员",
            source_roles: ["crm_admin", "crm_sales_viewer"],
          },
        ],
        permission_points: [
          {
            key: "crm.customer.read",
            name: "查看客户",
            source_groups: ["crm.customer.viewer"],
            source_roles: ["crm_admin", "crm_sales_viewer"],
            status: "active",
          },
          {
            key: "crm.customer.export",
            name: "导出客户",
            source_groups: [],
            source_roles: ["crm_admin"],
            status: "active",
          },
        ],
      },
    ],
  };
}

function mockFeishuStatus() {
  return {
    configStatus: "failed",
    running: false,
    latestRun: {
      id: "sync-run-1",
      status: "failed",
      triggerSource: "manual",
      startedAt: "2026-05-23T10:00:00.000Z",
      finishedAt: "2026-05-23T10:00:03.000Z",
      departmentCreatedCount: 0,
      departmentUpdatedCount: 0,
      departmentDeletedCount: 0,
      userCreatedCount: 0,
      userUpdatedCount: 0,
      userDeletedCount: 0,
      relationCreatedCount: 0,
      relationUpdatedCount: 0,
      relationDeletedCount: 0,
      errorCode: "FEISHU_PERMISSION_DENIED",
      errorMessage: "飞书权限不足",
    },
    counts: {
      departments: 0,
      activeDepartments: 0,
      users: 0,
      activeUsers: 0,
      relations: 0,
    },
  };
}

function fulfillJson(route, body) {
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function launchBrowser() {
  try {
    return await chromium.launch();
  } catch (error) {
    if (process.platform === "darwin") {
      return chromium.launch({ channel: "chrome" });
    }
    throw error;
  }
}
