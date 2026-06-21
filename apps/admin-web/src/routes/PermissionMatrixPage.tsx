import type { AdminMe } from "../admin-types";
import { PermissionMatrixView } from "../features/permissions/PermissionMatrixView";

export function PermissionMatrixPage(props: { admin: AdminMe }) {
  return <PermissionMatrixView admin={props.admin} />;
}
