import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminMe } from "../../admin-types";
import { fetchPermissionMatrix } from "../../api/permission";
import { PermissionMatrixView } from "./PermissionMatrixView";

vi.mock("../../api/permission", () => ({
  fetchPermissionMatrix: vi.fn(),
}));

const platformAdmin: AdminMe = {
  adminUserId: "admin-platform",
  feishuUserId: "ou_platform",
  displayName: "平台管理员",
  roles: ["platform_admin"],
  applicationIds: [],
};

const applicationAdmin: AdminMe = {
  ...platformAdmin,
  adminUserId: "admin-app",
  roles: ["application_admin"],
  applicationIds: ["app-base-portal"],
};

const matrixFixture = {
  subject: { type: "user" as const, id: "user-1", name: "张三" },
  scope_note: "用户查询包含直接用户绑定和用户所属组织绑定。",
  applications: [
    {
      app_key: "base-portal",
      name: "基础门户",
      matched_roles: [
        { key: "source-role", name: "来源角色", match_type: "direct_user" },
      ],
      permission_groups: [
        { key: "base-portal.demo", name: "Demo 权限组", source_roles: ["source-role"] },
      ],
      permission_points: [
        {
          key: "base-portal.demo.embedded",
          name: "访问嵌入 Demo",
          source_roles: ["source-role"],
          source_groups: ["base-portal.demo"],
          status: "active" as const,
        },
      ],
      computed_at: "2026-06-21T00:00:00.000Z",
    },
  ],
  computed_at: "2026-06-21T00:00:00.000Z",
};

describe("PermissionMatrixView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchPermissionMatrix).mockResolvedValue(matrixFixture);
  });

  it("renders user matrix results grouped by application and opens point explanation", async () => {
    const user = userEvent.setup();
    renderView(platformAdmin);

    await user.click(screen.getByRole("button", { name: "用户" }));
    await user.type(screen.getByLabelText("主体 ID"), "user-1");
    await user.click(screen.getByRole("button", { name: "查询" }));

    expect(await screen.findByRole("heading", { name: "基础门户" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /base-portal.demo.embedded/ }));

    const explanation = screen.getByRole("region", { name: "权限来源解释" });
    expect(explanation).toHaveTextContent("source-role");
    expect(explanation).toHaveTextContent("base-portal.demo");
    expect(within(explanation).getByText("访问嵌入 Demo")).toBeInTheDocument();
  });

  it("shows forbidden state for application admins", () => {
    renderView(applicationAdmin);
    expect(screen.getByText("没有权限")).toBeInTheDocument();
  });
});

function renderView(admin: AdminMe) {
  render(
    <BrowserRouter>
      <PermissionMatrixView admin={admin} />
    </BrowserRouter>,
  );
}
