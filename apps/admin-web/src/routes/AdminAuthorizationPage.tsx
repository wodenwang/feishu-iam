import type { AdminMe } from "../admin-types";
import { AdminAuthorizationView } from "../features/admin-users/AdminAuthorizationView";

export function AdminAuthorizationPage(props: { admin: AdminMe }) {
  return <AdminAuthorizationView admin={props.admin} />;
}
