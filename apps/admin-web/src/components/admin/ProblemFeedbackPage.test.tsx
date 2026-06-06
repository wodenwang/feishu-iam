import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProblemFeedbackPage } from "./ProblemFeedbackPage";

const props = {
  title: "需要登录 Feishu IAM 管理后台",
  description: "当前浏览器没有有效管理员会话，请使用飞书登录后继续。",
  errorCode: "ADMIN_SESSION_REQUIRED",
  requestId: "req-admin-401",
  occurredAt: "2026/5/29 11:30:00",
  path: "/admin/system/audit",
  primaryAction: { label: "飞书登录", href: "/admin/auth/login" },
};

describe("ProblemFeedbackPage", () => {
  it("展示未登录问题信息并支持复制 request id", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<ProblemFeedbackPage {...props} />);

    expect(screen.getByRole("main", { name: "Feishu IAM 问题提示" })).toBeInTheDocument();
    expect(screen.getByText("ADMIN_SESSION_REQUIRED")).toBeInTheDocument();
    expect(screen.getByText("req-admin-401")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "飞书登录" })).toHaveAttribute("href", "/admin/auth/login");
    expect(screen.queryByRole("button", { name: "复制问题信息" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "复制 request id" }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("req-admin-401");
    });
    expect(screen.getByRole("button", { name: "已复制" })).toBeInTheDocument();
  });
});
