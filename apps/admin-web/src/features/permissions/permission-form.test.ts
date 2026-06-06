import { describe, expect, it } from "vitest";
import {
  draftFromRole,
  formatRoleStatus,
  hasRoleFormErrors,
  toCreateRolePayload,
  toUpdateRolePayload,
  validateCreateRoleDraft,
  validateEditRoleDraft,
} from "./permission-form";

describe("permission role form", () => {
  it("validates create role drafts", () => {
    const errors = validateCreateRoleDraft({
      name: "",
      key: "Role.Admin",
      description: "",
      enabled: true,
    });

    expect(errors.name).toBe("角色名称不能为空");
    expect(errors.key).toContain("角色 key");
    expect(hasRoleFormErrors(errors)).toBe(true);
  });

  it("builds create payload without empty description", () => {
    expect(
      toCreateRolePayload({
        name: "  业务操作员  ",
        key: "crm.operator",
        description: "  ",
        enabled: true,
      }),
    ).toEqual({ key: "crm.operator", name: "业务操作员" });
  });

  it("does not require editable key for update payload", () => {
    const draft = {
      name: "审计员",
      key: "",
      description: "",
      enabled: true,
    };

    expect(validateEditRoleDraft(draft)).toEqual({});
    expect(toUpdateRolePayload(draft)).toEqual({
      name: "审计员",
      description: null,
    });
  });

  it("creates edit draft and labels role status", () => {
    expect(
      draftFromRole({
        id: "role-1",
        applicationId: "app-1",
        appKey: "crm",
        key: "crm.audit",
        name: "审计员",
        description: null,
        status: "disabled",
        createdAt: "2026-05-25T00:00:00.000Z",
        updatedAt: "2026-05-25T00:00:00.000Z",
      }),
    ).toMatchObject({ key: "crm.audit", enabled: false });
    expect(formatRoleStatus("active")).toBe("启用");
    expect(formatRoleStatus("unknown")).toBe("未知");
  });
});
