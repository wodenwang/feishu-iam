import type {
  AdminUser,
  CreateAdminUserInput,
  UpdateAdminUserAuthorizationInput,
} from "../../api/admin";

export type EditableAdminRole = "platform_admin" | "application_admin";

export type AdminUserDraft = {
  mode: "create" | "edit";
  adminUserId?: string;
  displayName?: string;
  feishuUserId: string;
  roleKey: EditableAdminRole;
  applicationIds: string[];
};

export type AdminUserFormErrors = Partial<
  Record<"feishuUserId" | "applicationIds", string>
>;

export const editableAdminRoles: Array<{
  roleKey: EditableAdminRole;
  label: string;
}> = [
  { roleKey: "platform_admin", label: "平台管理员" },
  { roleKey: "application_admin", label: "应用管理员" },
];

export function makeCreateAdminUserDraft(): AdminUserDraft {
  return {
    mode: "create",
    feishuUserId: "",
    roleKey: "platform_admin",
    applicationIds: [],
  };
}

export function makeEditAdminUserDraft(user: AdminUser): AdminUserDraft | null {
  const roleKey = singleEditableRole(user.roles);
  if (!roleKey) {
    return null;
  }

  return {
    mode: "edit",
    adminUserId: user.id,
    displayName: user.displayName,
    feishuUserId: user.feishuUserId,
    roleKey,
    applicationIds:
      roleKey === "application_admin"
        ? user.applicationScopes.map((scope) => scope.id)
        : [],
  };
}

export function validateAdminUserDraft(
  draft: AdminUserDraft,
): AdminUserFormErrors {
  const errors: AdminUserFormErrors = {};

  if (!draft.feishuUserId.trim()) {
    errors.feishuUserId = "飞书用户 ID 不能为空";
  }

  if (draft.roleKey === "application_admin" && draft.applicationIds.length === 0) {
    errors.applicationIds = "应用管理员至少需要选择一个应用";
  }

  return errors;
}

export function hasAdminUserFormErrors(errors: AdminUserFormErrors): boolean {
  return Object.values(errors).some(Boolean);
}

export function toCreateAdminUserPayload(
  draft: AdminUserDraft,
): CreateAdminUserInput {
  return {
    feishuUserId: draft.feishuUserId.trim(),
    roleKeys: [draft.roleKey],
    applicationIds:
      draft.roleKey === "application_admin" ? [...draft.applicationIds] : [],
  };
}

export function toUpdateAdminUserPayload(
  draft: AdminUserDraft,
): UpdateAdminUserAuthorizationInput {
  return {
    roleKeys: [draft.roleKey],
    applicationIds:
      draft.roleKey === "application_admin" ? [...draft.applicationIds] : [],
  };
}

export function isReadonlyAdminUser(user: AdminUser): boolean {
  return singleEditableRole(user.roles) === null;
}

export function singleEditableRole(
  roles: AdminUser["roles"],
): EditableAdminRole | null {
  if (roles.length !== 1) {
    return null;
  }

  const roleKey = roles[0]?.roleKey;
  return roleKey === "platform_admin" || roleKey === "application_admin"
    ? roleKey
    : null;
}

export function formatAdminRoleLabel(roles: AdminUser["roles"]): string {
  const labels = roles.map((role) => role.name || role.roleKey).filter(Boolean);
  return labels.length > 0 ? labels.join("、") : "未授权角色";
}

export function formatAdminStatus(status?: string): string {
  switch (status) {
    case "active":
    case "enabled":
      return "启用";
    case "disabled":
      return "停用";
    default:
      return "未知";
  }
}

export function formatApplicationScopes(
  scopes: AdminUser["applicationScopes"],
): string {
  if (scopes.length === 0) {
    return "全部应用";
  }

  return scopes
    .map((scope) => `${scope.appKey}${scope.name ? ` / ${scope.name}` : ""}`)
    .join("、");
}

export function formatDateTime(value?: string): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
