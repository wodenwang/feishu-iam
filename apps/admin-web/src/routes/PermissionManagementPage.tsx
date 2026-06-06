import type { AdminMe } from "../admin-types";
import { PermissionManagementView } from "../features/permissions/PermissionManagementView";

export function PermissionManagementPage(props: {
  admin: AdminMe;
  initialAppKey?: string | null;
}) {
  return <PermissionManagementView {...props} />;
}
