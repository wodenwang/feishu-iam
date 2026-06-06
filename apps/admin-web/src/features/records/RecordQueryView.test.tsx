import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RecordQueryPage } from "../../routes/RecordQueryPage";
import {
  fetchAdminAuditLogs,
  fetchAdminSecurityEvents,
  fetchAdminTrace,
} from "../../api/admin";
import { fetchFeishuSyncRuns } from "../../api/feishu";

vi.mock("../../api/admin", () => ({
  fetchAdminAuditLogs: vi.fn(),
  fetchAdminSecurityEvents: vi.fn(),
  fetchAdminTrace: vi.fn(),
}));

vi.mock("../../api/feishu", () => ({
  fetchFeishuSyncRuns: vi.fn(),
}));

const auditLog = {
  id: "audit-1",
  actorType: "admin",
  actorId: "admin-1",
  source: "admin_web",
  applicationId: "app-1",
  resourceType: "application",
  resourceId: "app-1",
  action: "application.update",
  before: { client_secret: "masked-value-1", name: "旧名称" },
  after: { accessToken: "masked-value-2", name: "新名称" },
  result: "success",
  ip: "127.0.0.1",
  userAgent: "vitest",
  requestId: "req-1",
  createdAt: "2026-05-24T12:00:00.000Z",
};

const securityEvent = {
  id: "security-1",
  applicationId: "app-1",
  clientId: "client-1",
  feishuUserId: "ou-user",
  eventType: "oauth_token",
  reasonCode: "ok",
  result: "success",
  ip: "127.0.0.1",
  userAgent: "vitest",
  requestId: "req-security",
  createdAt: "2026-05-24T12:01:00.000Z",
};

const syncRun = {
  id: "sync-1",
  requestId: "req-sync-1",
  status: "success" as const,
  triggerSource: "manual",
  startedAt: "2026-05-24T12:02:00.000Z",
  finishedAt: "2026-05-24T12:03:00.000Z",
  departmentCreatedCount: 1,
  departmentUpdatedCount: 2,
  departmentDeletedCount: 0,
  userCreatedCount: 3,
  userUpdatedCount: 4,
  userDeletedCount: 0,
  relationCreatedCount: 5,
  relationUpdatedCount: 6,
  relationDeletedCount: 0,
  errorCode: null,
  errorMessage: null,
};

const traceResult = {
  summary: {
    status: "complete" as const,
    diagnosis: "已找到可见追踪记录",
    matchedEventCount: 1,
    missingStages: [],
    nextActions: ["核对调用顺序"],
  },
  context: {
    requestId: "req-1",
    timeWindow: {
      from: "2026-05-24T00:00:00.000Z",
      to: "2026-05-25T00:00:00.000Z",
    },
  },
  timeline: [
    {
      id: "security-1",
      source: "security_event" as const,
      stage: "token_exchange",
      result: "success",
      occurredAt: "2026-05-24T12:01:00.000Z",
      title: "安全事件：oauth_token_exchange / success",
      summary: "授权码换取 access token 成功",
      requestId: "req-1",
      applicationId: "app-1",
      clientId: "client-1",
      feishuUserId: "ou-user",
      details: { reasonCode: null, accessToken: "[REDACTED]" },
    },
  ],
  coverage: {
    auditLogs: 0,
    securityEvents: 1,
    feishuSyncRuns: 0,
    oauthContexts: 0,
  },
};

describe("RecordQueryPage v0.10", () => {
  beforeEach(() => {
    vi.mocked(fetchAdminAuditLogs).mockResolvedValue({
      items: [auditLog],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    vi.mocked(fetchAdminSecurityEvents).mockResolvedValue({
      items: [securityEvent],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    vi.mocked(fetchFeishuSyncRuns).mockResolvedValue([syncRun]);
    vi.mocked(fetchAdminTrace).mockResolvedValue(traceResult);
    window.history.pushState({}, "", "/admin/records");
  });

  it("uses 操作审计 naming and system management breadcrumb", async () => {
    render(
      <BrowserRouter>
        <RecordQueryPage />
      </BrowserRouter>,
    );

    expect(
      await screen.findByRole("main", { name: "操作审计" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "操作审计" }),
    ).toBeInTheDocument();

    const breadcrumb = screen.getByRole("navigation", { name: "面包屑" });
    expect(within(breadcrumb).getByText("后台")).toBeInTheDocument();
    expect(within(breadcrumb).getByText("系统管理")).toBeInTheDocument();
    expect(within(breadcrumb).getByText("操作审计")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("keeps trace tab in initial state until a query criterion is present", async () => {
    render(
      <BrowserRouter>
        <RecordQueryPage />
      </BrowserRouter>,
    );

    expect(
      await screen.findByText("输入 request id 或上下文后查询"),
    ).toBeInTheDocument();
    expect(fetchAdminTrace).not.toHaveBeenCalled();
  });

  it("loads trace results when request id is present", async () => {
    window.history.pushState({}, "", "/admin/records?requestId=req-1");
    render(
      <BrowserRouter>
        <RecordQueryPage />
      </BrowserRouter>,
    );

    expect(await screen.findByText("诊断摘要")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "复制问题信息" })).not.toBeInTheDocument();
    expect(fetchAdminTrace).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: "req-1" }),
    );
  });

  it("keeps trace query focused on direct request id input", async () => {
    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <RecordQueryPage />
      </BrowserRouter>,
    );

    expect(await screen.findByText("输入 request id 或上下文后查询")).toBeInTheDocument();
    expect(screen.queryByLabelText("粘贴问题信息")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "提取 request id" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "复制问题信息" })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("request id"), "req-admin-401");
    await user.click(screen.getByRole("button", { name: "查询" }));

    await waitFor(() => {
      expect(fetchAdminTrace).toHaveBeenCalledWith(
        expect.objectContaining({ requestId: "req-admin-401" }),
      );
    });
    expect(JSON.stringify(vi.mocked(fetchAdminTrace).mock.calls)).not.toContain(
      "cookie",
    );
  });

  it("filters sync runs by request id instead of run id", async () => {
    window.history.pushState({}, "", "/admin/records?tab=sync&requestId=req-sync-1");
    render(
      <BrowserRouter>
        <RecordQueryPage />
      </BrowserRouter>,
    );

    expect(await screen.findByText("feishu.sync")).toBeInTheDocument();
    expect(screen.getByText("request id: req-sync-1")).toBeInTheDocument();
  });

  it("labels security actor as Feishu user_id", async () => {
    window.history.pushState({}, "", "/admin/records?tab=security");
    render(
      <BrowserRouter>
        <RecordQueryPage />
      </BrowserRouter>,
    );

    expect(
      await screen.findByText("飞书 user_id: ou-user"),
    ).toBeInTheDocument();
  });

  it("opens audit detail sheet from url and redacts sensitive diff keys", async () => {
    window.history.pushState(
      {},
      "",
      "/admin/records?tab=audit&sheet=audit:audit-1",
    );
    render(
      <BrowserRouter>
        <RecordQueryPage />
      </BrowserRouter>,
    );

    const dialog = await screen.findByRole("dialog", { name: /审计日志详情/ });
    expect(within(dialog).getByText("application.update")).toBeInTheDocument();
    expect((dialog.textContent.match(/\[已隐藏\]/g) ?? []).length).toBe(2);
    expect(dialog).not.toHaveTextContent("masked-value-1");
    expect(dialog).not.toHaveTextContent("masked-value-2");
  });

  it("updates query params when switching tabs without serializing secret or token drafts", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/admin/records?tab=audit");
    render(
      <BrowserRouter>
        <RecordQueryPage />
      </BrowserRouter>,
    );

    await user.click(await screen.findByRole("tab", { name: "安全事件" }));

    expect(window.location.search).toContain("tab=security");
    expect(window.location.search).not.toContain("secret");
    expect(window.location.search).not.toContain("token");
  });

  it("opens token sheet from row detail click and keeps token values out of url", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/admin/records?tab=tokens");
    render(
      <BrowserRouter>
        <RecordQueryPage />
      </BrowserRouter>,
    );

    await user.click(
      await screen.findByRole("button", {
        name: "查看 token 记录详情 security-1",
      }),
    );

    await waitFor(() => {
      expect(window.location.search).toContain("sheet=token%3Asecurity-1");
    });
    expect(window.location.search).not.toContain("oauth_token");
    expect(window.location.search).not.toContain("secret");
  });

  it("shows no-permission state for 403 responses instead of empty state", async () => {
    vi.mocked(fetchAdminAuditLogs).mockRejectedValueOnce(
      Object.assign(new Error("forbidden"), { status: 403 }),
    );
    window.history.pushState({}, "", "/admin/records?tab=audit");

    render(
      <BrowserRouter>
        <RecordQueryPage />
      </BrowserRouter>,
    );

    expect(await screen.findByText("没有权限")).toBeInTheDocument();
    expect(screen.queryByText("暂无审计日志")).not.toBeInTheDocument();
  });

  it("keeps record result, time and actions columns stable", async () => {
    window.history.pushState({}, "", "/admin/records?tab=audit");
    render(
      <BrowserRouter>
        <RecordQueryPage />
      </BrowserRouter>,
    );

    expect(
      await screen.findByRole("columnheader", { name: "结果" }),
    ).toHaveStyle({ width: "96px" });
    expect(screen.getByRole("columnheader", { name: "时间" })).toHaveStyle({
      minWidth: "160px",
    });
    expect(screen.getByRole("columnheader", { name: "操作" })).toHaveStyle({
      width: "112px",
    });
    expect(screen.getByRole("columnheader", { name: "动作/类型" })).toHaveStyle({
      minWidth: "180px",
    });
    expect(screen.getByRole("columnheader", { name: "目标" })).toHaveStyle({
      minWidth: "220px",
    });
    expect(screen.getByRole("columnheader", { name: "操作者/来源" })).toHaveStyle({
      minWidth: "180px",
    });
    expect(screen.getByRole("columnheader", { name: "request id" })).toHaveStyle({
      minWidth: "180px",
    });
    expect(await screen.findByText("request id: req-1")).toBeInTheDocument();
    expect(await screen.findByText("成功")).toHaveClass("whitespace-nowrap");
  });
});
