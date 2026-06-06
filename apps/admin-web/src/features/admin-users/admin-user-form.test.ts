import { describe, expect, it } from "vitest";
import type { AdminUser } from "../../api/admin";
import {
  formatAdminRoleLabel,
  formatAdminStatus,
  formatApplicationScopes,
  formatDateTime,
  hasAdminUserFormErrors,
  isReadonlyAdminUser,
  makeCreateAdminUserDraft,
  makeEditAdminUserDraft,
  singleEditableRole,
  toCreateAdminUserPayload,
  toUpdateAdminUserPayload,
  validateAdminUserDraft,
} from "./admin-user-form";

describe("admin user form", () => {
  it("builds create and update payloads with normalized application scopes", () => {
    expect(
      toCreateAdminUserPayload({
        mode: "create",
        feishuUserId: "  ou_user_1  ",
        roleKey: "platform_admin",
        applicationIds: ["app-1"],
      }),
    ).toEqual({
      feishuUserId: "ou_user_1",
      roleKeys: ["platform_admin"],
      applicationIds: [],
    });

    expect(
      toUpdateAdminUserPayload({
        mode: "edit",
        adminUserId: "admin-1",
        feishuUserId: "ou_user_2",
        roleKey: "application_admin",
        applicationIds: ["app-1", "app-2"],
      }),
    ).toEqual({
      roleKeys: ["application_admin"],
      applicationIds: ["app-1", "app-2"],
    });
  });

  it("validates required Feishu user id and application scopes", () => {
    const errors = validateAdminUserDraft({
      ...makeCreateAdminUserDraft(),
      feishuUserId: " ",
      roleKey: "application_admin",
      applicationIds: [],
    });

    expect(errors).toEqual({
      feishuUserId: "飞书用户 ID 不能为空",
      applicationIds: "应用管理员至少需要选择一个应用",
    });
    expect(hasAdminUserFormErrors(errors)).toBe(true);
    expect(
      validateAdminUserDraft({
        ...makeCreateAdminUserDraft(),
        feishuUserId: "ou_user_1",
      }),
    ).toEqual({});
  });

  it("creates edit drafts only for a single editable role", () => {
    expect(
      makeEditAdminUserDraft(
        makeAdminUser({
          roles: [{ roleKey: "application_admin", name: "应用管理员" }],
          applicationScopes: [
            { id: "app-1", appKey: "crm", name: "CRM", status: "active" },
          ],
        }),
      ),
    ).toMatchObject({
      mode: "edit",
      adminUserId: "admin-1",
      roleKey: "application_admin",
      applicationIds: ["app-1"],
    });

    expect(
      makeEditAdminUserDraft(
        makeAdminUser({
          roles: [{ roleKey: "audit_viewer", name: "审计员" }],
        }),
      ),
    ).toBeNull();
  });

  it("detects readonly admin users by role shape", () => {
    expect(
      singleEditableRole([{ roleKey: "platform_admin", name: "平台管理员" }]),
    ).toBe("platform_admin");
    expect(isReadonlyAdminUser(makeAdminUser({ roles: [] }))).toBe(true);
    expect(
      isReadonlyAdminUser(
        makeAdminUser({
          roles: [
            { roleKey: "platform_admin", name: "平台管理员" },
            { roleKey: "application_admin", name: "应用管理员" },
          ],
        }),
      ),
    ).toBe(true);
    expect(
      isReadonlyAdminUser(
        makeAdminUser({ roles: [{ roleKey: "sync_admin", name: "同步管理员" }] }),
      ),
    ).toBe(true);
  });

  it("formats roles, status, application scopes and dates", () => {
    expect(
      formatAdminRoleLabel([
        { roleKey: "platform_admin", name: "平台管理员" },
        { roleKey: "audit_viewer", name: null },
      ]),
    ).toBe("平台管理员、audit_viewer");
    expect(formatAdminRoleLabel([])).toBe("未授权角色");
    expect(formatAdminStatus("active")).toBe("启用");
    expect(formatAdminStatus("disabled")).toBe("停用");
    expect(formatAdminStatus("archived")).toBe("未知");
    expect(formatApplicationScopes([])).toBe("全部应用");
    expect(
      formatApplicationScopes([
        { id: "app-1", appKey: "crm", name: "CRM", status: "active" },
        { id: "app-2", appKey: "erp", name: null, status: "active" },
      ]),
    ).toBe("crm / CRM、erp");
    expect(formatDateTime()).toBe("-");
    expect(formatDateTime("not-a-date")).toBe("not-a-date");
    expect(formatDateTime("2026-05-25T01:02:03.000Z")).toContain("2026");
  });
});

function makeAdminUser(overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    id: "admin-1",
    feishuUserId: "ou_user_1",
    displayName: "张三",
    roles: [{ roleKey: "platform_admin", name: "平台管理员" }],
    applicationScopes: [],
    status: "active",
    createdAt: "2026-05-25T01:02:03.000Z",
    ...overrides,
  };
}
