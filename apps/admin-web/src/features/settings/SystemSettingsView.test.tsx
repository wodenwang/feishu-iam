import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminMe } from "../../admin-types";
import { fetchFeishuDepartments, fetchFeishuSyncRun, fetchFeishuUsers } from "../../api/feishu";
import type {
  FeishuFieldDiagnostics,
  FeishuStatus,
  FeishuSyncRun,
} from "../../api/feishu";
import type { ApiStatus } from "../../api/status";
import { SystemSettingsView } from "./SystemSettingsView";

vi.mock("../../api/feishu", async (importOriginal) => {
  const actual = await importOriginal<object>();
  return {
    ...actual,
    fetchFeishuDepartments: vi.fn(),
    fetchFeishuSyncRun: vi.fn(),
    fetchFeishuUsers: vi.fn(),
  };
});

const platformAdmin: AdminMe = {
  adminUserId: "admin-1",
  feishuUserId: "ou_admin",
  displayName: "平台管理员",
  roles: ["platform_admin"],
  applicationIds: [],
};

const auditViewer: AdminMe = {
  ...platformAdmin,
  roles: ["audit_viewer"],
};

const apiStatus: ApiStatus = {
  health: "ok",
  ready: "ready",
  version: "0.10.1-s4",
};

const syncRun = makeSyncRun();

describe("SystemSettingsView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, "", "/admin/settings");
    vi.mocked(fetchFeishuDepartments).mockResolvedValue({
      items: [
        {
          departmentId: "od_sales",
          openDepartmentId: null,
          name: "销售部",
          parentDepartmentId: null,
          isDeleted: false,
          lastSyncedAt: "2026-05-29T08:00:00.000Z",
        },
      ],
      page: 1,
      pageSize: 20,
      total: 1,
    });
    vi.mocked(fetchFeishuUsers).mockResolvedValue({
      items: [
        {
          userId: "ou_sales",
          name: "王文哲",
          emailMasked: null,
          mobileMasked: null,
          isActive: true,
          isDeleted: false,
          lastSyncedAt: "2026-05-29T08:00:00.000Z",
        },
      ],
      page: 1,
      pageSize: 20,
      total: 1,
    });
    vi.mocked(fetchFeishuSyncRun).mockResolvedValue(syncRun);
  });

  it("defaults to Feishu tab without writing noisy query params", async () => {
    renderView();

    expect(
      await screen.findByRole("main", { name: "系统设置" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "飞书同步" }),
    ).toBeInTheDocument();
    expect(window.location.search).toBe("");
  });

  it("supports Feishu sync mode with system management breadcrumb", async () => {
    window.history.pushState({}, "", "/admin/system/feishu?tab=runtime");
    renderView({ mode: "feishu" });

    expect(
      await screen.findByRole("main", { name: "飞书同步" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "飞书同步" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "飞书同步" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "系统运行信息" }),
    ).not.toBeInTheDocument();

    const breadcrumb = screen.getByRole("navigation", { name: "面包屑" });
    expect(within(breadcrumb).getByText("后台")).toBeInTheDocument();
    expect(within(breadcrumb).getByText("系统管理")).toBeInTheDocument();
    expect(within(breadcrumb).getByText("飞书同步")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("renders compact Feishu console tabs without daily full sync primary action", async () => {
    renderView({ mode: "feishu" });

    expect(await screen.findByRole("tab", { name: "组织与用户" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "同步历史" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "字段诊断" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "高级操作" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "全量同步" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "高级操作" })).toBeInTheDocument();
  });

  it("supports system info mode and defaults to runtime unless version is requested", async () => {
    window.history.pushState({}, "", "/admin/system/info");
    const { unmount } = renderView({ mode: "info" });

    expect(
      await screen.findByRole("main", { name: "系统信息" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "系统信息" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "系统运行信息" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /飞书同步/ }),
    ).not.toBeInTheDocument();

    const breadcrumb = screen.getByRole("navigation", { name: "面包屑" });
    expect(within(breadcrumb).getByText("系统管理")).toBeInTheDocument();
    expect(within(breadcrumb).getByText("系统信息")).toHaveAttribute(
      "aria-current",
      "page",
    );

    unmount();
    window.history.pushState({}, "", "/admin/system/info?tab=version");
    renderView({ mode: "info" });
    expect(
      await screen.findByRole("region", { name: "版本信息" }),
    ).toBeInTheDocument();
  });

  it("updates URL when switching settings sections", async () => {
    const user = userEvent.setup();
    renderView();

    await user.click(await screen.findByRole("button", { name: /系统运行/ }));
    expect(window.location.search).toBe("?tab=runtime");
    expect(
      screen.getByRole("region", { name: "系统运行信息" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /版本信息/ }));
    expect(window.location.search).toBe("?tab=version");
    expect(
      screen.getByRole("region", { name: "版本信息" }),
    ).toBeInTheDocument();
  });

  it("opens sync run detail sheet from row action and keeps tab when closing", async () => {
    const user = userEvent.setup();
    renderView();

    await user.click(await screen.findByRole("tab", { name: "同步历史" }));
    const table = await screen.findByRole("table", { name: "同步历史" });
    await user.click(within(table).getByRole("button", { name: /详情/ }));

    expect(window.location.search).toBe("?sheet=sync%3Async-run-1");
    expect(
      await screen.findByRole("dialog", { name: /同步记录 sync-run-1/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("FEISHU_PERMISSION_DENIED")).toBeInTheDocument();
    expect(screen.getByText("users:D001")).toBeInTheDocument();
    expect(screen.getByText("req-feishu-1")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "诊断建议" })).toHaveTextContent(
      "检查飞书自建应用通讯录权限和可见范围是否覆盖目标部门",
    );
    expect(screen.getByRole("region", { name: "诊断建议" })).toHaveTextContent(
      "优先排查失败阶段：users:D001",
    );

    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(window.location.search).toBe("");
    });
  });

  it("loads sync run detail from URL when the row is not in current list", async () => {
    vi.mocked(fetchFeishuSyncRun).mockResolvedValue({
      ...syncRun,
      id: "sync-run-404",
    });
    window.history.pushState(
      {},
      "",
      "/admin/settings?tab=runtime&sheet=sync%3Async-run-404",
    );
    renderView({ runs: [] });

    expect(
      await screen.findByRole("dialog", { name: /同步记录 sync-run-404/ }),
    ).toBeInTheDocument();
    expect(fetchFeishuSyncRun).toHaveBeenCalledWith("sync-run-404");
  });

  it("keeps sync history visible when diagnostics failed", async () => {
    const user = userEvent.setup();
    renderView({
      diagnosticsError: "字段诊断接口失败",
      diagnostics: makeDiagnostics({
        status: "failed",
        blockingIssues: ["缺少通讯录权限"],
      }),
    });

    await user.click(await screen.findByRole("tab", { name: "字段诊断" }));
    expect(
      screen.getByText("字段诊断接口失败"),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "同步历史" }));
    expect(
      screen.getByRole("table", { name: "同步历史" }),
    ).toBeInTheDocument();
  });

  it("lets audit viewer read settings but not query mirror or trigger full sync", async () => {
    const user = userEvent.setup();
    renderView({ admin: auditViewer });

    expect(
      await screen.findByRole("region", { name: "飞书同步" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("当前管理员无权查看用户或部门 PII 详情。"),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "高级操作" }));
    expect(screen.getByRole("button", { name: "确认触发全量同步" })).toBeDisabled();
    expect(screen.getByText("当前管理员无权触发飞书全量同步。")).toBeInTheDocument();
  });

  it("keeps Feishu mirror OrgBrowser readonly without role binding semantics", async () => {
    const user = userEvent.setup();
    renderView({ mode: "feishu" });

    await user.click(await screen.findByRole("tab", { name: "组织与用户" }));

    const browser = await screen.findByRole("region", { name: "组织用户浏览" });
    expect(within(browser).getByText("销售部")).toBeInTheDocument();
    expect(within(browser).queryByText("王文哲")).not.toBeInTheDocument();
    expect(within(browser).getByText("组织与用户列表")).toBeInTheDocument();
    expect(within(browser).getByText("组织和用户在同一列表中展示，仅用于浏览本地飞书镜像。")).toBeInTheDocument();
    expect(vi.mocked(fetchFeishuUsers)).not.toHaveBeenCalled();

    await user.type(within(browser).getByLabelText("搜索组织或用户"), "王");
    await user.click(within(browser).getByRole("button", { name: "搜索" }));
    expect(await within(browser).findByText("王文哲")).toBeInTheDocument();
    expect(within(browser).queryByText("待选组织与用户")).not.toBeInTheDocument();
    expect(within(browser).queryByText(/保存时仍按主体类型区分/)).not.toBeInTheDocument();
    expect(within(browser).queryByRole("button", { name: "选择组织" })).not.toBeInTheDocument();
    expect(within(browser).queryByRole("button", { name: "选择用户" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "已选组织与用户" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "保存主体绑定" })).not.toBeInTheDocument();
  });

  it("requires current run id before opening full sync confirmation", async () => {
    const user = userEvent.setup();
    const onSync = vi.fn();
    const { rerender } = renderView({ onSync });

    await user.click(await screen.findByRole("tab", { name: "高级操作" }));
    const submit = screen.getByRole("button", { name: "确认触发全量同步" });
    expect(submit).toBeDisabled();
    await user.type(screen.getByLabelText("输入当前最新 run id"), syncRun.id);
    expect(submit).toBeEnabled();
    await user.click(submit);
    const confirmDialog = await screen.findByRole("alertdialog", {
      name: "确认触发飞书全量同步",
    });
    await user.click(
      within(confirmDialog).getByRole("button", { name: "确认" }),
    );
    expect(onSync).toHaveBeenCalledWith(syncRun.id);

    rerender(
      <BrowserRouter>
        <SystemSettingsView
          admin={platformAdmin}
          apiState={{ status: "loaded", data: apiStatus }}
          feishuDetailState={{
            status: "loaded",
            data: makeStatus(),
            diagnostics: makeDiagnostics(),
            runs: [syncRun],
            syncing: false,
            syncError:
              "FEISHU_SYNC_RUNNING / 已有飞书同步正在运行 / request id: req-123",
          }}
          onRefreshDiagnostics={vi.fn()}
          onLightSync={vi.fn()}
          onSync={onSync}
        />
      </BrowserRouter>,
    );

    expect(
      screen.getByRole("alertdialog", { name: "确认触发飞书全量同步" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/已有飞书同步正在运行/)).toBeInTheDocument();
    expect(screen.getByText(/req-123/)).toBeInTheDocument();
    expect(screen.queryByText("secret-token")).not.toBeInTheDocument();
    expect(screen.queryByText("backend detail")).not.toBeInTheDocument();
  });
});

function renderView(
  options: {
    admin?: AdminMe;
    diagnostics?: FeishuFieldDiagnostics;
    diagnosticsError?: string;
    runs?: FeishuSyncRun[];
    mode?: "feishu" | "info";
    onSync?: (confirmLatestRunId: string) => boolean | undefined | Promise<boolean | undefined>;
  } = {},
) {
  return render(
    <BrowserRouter>
      <SystemSettingsView
        admin={options.admin ?? platformAdmin}
        apiState={{ status: "loaded", data: apiStatus }}
        mode={options.mode}
        feishuDetailState={{
          status: "loaded",
          data: makeStatus(),
          diagnostics: options.diagnostics ?? makeDiagnostics(),
          runs: options.runs ?? [syncRun],
          syncing: false,
          diagnosticsError: options.diagnosticsError,
        }}
        onRefreshDiagnostics={vi.fn()}
        onLightSync={vi.fn()}
        onSync={options.onSync ?? vi.fn()}
      />
    </BrowserRouter>,
  );
}

function makeStatus(): FeishuStatus {
  return {
    configStatus: "failed",
    running: false,
    latestRun: syncRun,
    counts: {
      departments: 1,
      activeDepartments: 1,
      users: 2,
      activeUsers: 2,
      relations: 2,
    },
  };
}

function makeDiagnostics(
  overrides: Partial<FeishuFieldDiagnostics> = {},
): FeishuFieldDiagnostics {
  return {
    status: "warning",
    loginReadiness: {
      ready: false,
      reason: "字段样本不足",
    },
    sampleCounts: {
      departments: 1,
      users: 2,
      activeUsers: 2,
    },
    departmentFields: [
      {
        field: "department_id",
        status: "present",
        presentCount: 1,
        missingCount: 0,
        emptyCount: 0,
        requiredLevel: "blocking",
      },
    ],
    userFields: [
      {
        field: "user_id",
        status: "present",
        presentCount: 2,
        missingCount: 0,
        emptyCount: 0,
        requiredLevel: "blocking",
      },
    ],
    blockingIssues: [],
    warnings: ["字段样本不足"],
    nextActions: ["检查飞书应用权限"],
    ...overrides,
  };
}

function makeSyncRun(): FeishuSyncRun {
  return {
    id: "sync-run-1",
    status: "failed",
    triggerSource: "admin_web",
    startedAt: "2026-05-25T08:00:00.000Z",
    finishedAt: "2026-05-25T08:00:03.000Z",
    departmentCreatedCount: 1,
    departmentUpdatedCount: 2,
    departmentDeletedCount: 3,
    userCreatedCount: 4,
    userUpdatedCount: 5,
    userDeletedCount: 6,
    relationCreatedCount: 7,
    relationUpdatedCount: 8,
    relationDeletedCount: 9,
    errorCode: "FEISHU_PERMISSION_DENIED",
    errorMessage: "飞书权限不足",
    errorStage: "users:D001",
    requestId: "req-feishu-1",
  };
}
