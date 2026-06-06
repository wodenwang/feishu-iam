import type { IamRole } from "../../api/permission";

export type PermissionRoleDraft = {
  name: string;
  key: string;
  description: string;
  enabled: boolean;
};

export type PermissionRoleFormErrors = Partial<
  Record<keyof PermissionRoleDraft, string>
>;

export const emptyPermissionRoleDraft: PermissionRoleDraft = {
  name: "",
  key: "",
  description: "",
  enabled: true,
};

const roleKeyPattern = /^[a-z0-9][a-z0-9._-]{0,127}$/;

export function draftFromRole(role: IamRole): PermissionRoleDraft {
  return {
    name: role.name,
    key: role.key,
    description: role.description ?? "",
    enabled: role.status === "active",
  };
}

export function validateCreateRoleDraft(
  draft: PermissionRoleDraft,
): PermissionRoleFormErrors {
  return validateRoleDraft(draft, { requireKey: true });
}

export function validateEditRoleDraft(
  draft: PermissionRoleDraft,
): PermissionRoleFormErrors {
  return validateRoleDraft(draft, { requireKey: false });
}

export function hasRoleFormErrors(errors: PermissionRoleFormErrors): boolean {
  return Object.values(errors).some(Boolean);
}

export function toCreateRolePayload(draft: PermissionRoleDraft): {
  key: string;
  name: string;
  description?: string;
} {
  const description = draft.description.trim();
  return {
    key: draft.key.trim(),
    name: draft.name.trim(),
    ...(description ? { description } : {}),
  };
}

export function toUpdateRolePayload(draft: PermissionRoleDraft): {
  name: string;
  description: string | null;
} {
  const description = draft.description.trim();
  return {
    name: draft.name.trim(),
    description: description || null,
  };
}

export function roleStatusToPermissionFilter(status: string): "enabled" | "disabled" | "unknown" {
  if (status === "active") {
    return "enabled";
  }
  if (status === "disabled") {
    return "disabled";
  }
  return "unknown";
}

export function formatRoleStatus(status: string): string {
  const labels: Record<string, string> = {
    active: "启用",
    disabled: "停用",
  };
  return labels[status] ?? "未知";
}

export function formatSubjectType(type: "feishu_user" | "feishu_department"): string {
  return type === "feishu_user" ? "飞书用户" : "飞书部门";
}

function validateRoleDraft(
  draft: PermissionRoleDraft,
  options: { requireKey: boolean },
): PermissionRoleFormErrors {
  const errors: PermissionRoleFormErrors = {};
  const name = draft.name.trim();
  const key = draft.key.trim();
  const description = draft.description.trim();

  if (name.length === 0) {
    errors.name = "角色名称不能为空";
  } else if (name.length > 64) {
    errors.name = "角色名称不能超过 64 个字符";
  }

  if (options.requireKey) {
    if (key.length === 0) {
      errors.key = "角色 key 不能为空";
    } else if (!roleKeyPattern.test(key)) {
      errors.key = "角色 key 只能使用小写字母、数字、点、下划线和短横线，且必须以小写字母或数字开头";
    }
  }

  if (description.length > 500) {
    errors.description = "描述不能超过 500 个字符";
  }

  return errors;
}
