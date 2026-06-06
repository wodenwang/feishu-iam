import type { AdminMe } from "../admin-types";
import { PermissionRoleDetailWorkspace } from "../features/permissions/PermissionRoleDetailPage";

export function PermissionRoleDetailPage(props: { admin: AdminMe }) {
  return <PermissionRoleDetailWorkspace {...props} />;
}
