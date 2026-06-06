export type AdminRouteId =
  | "workspace"
  | "applications"
  | "permissions"
  | "system"
  | "systemFeishu"
  | "systemAdmins"
  | "systemAudit"
  | "systemInfo";

type LegacyAdminRouteId = "admins" | "records" | "settings";

export type AdminRoute = {
  id: AdminRouteId;
  path: string;
  label: string;
  iconKey?: "workspace" | "applications" | "permissions" | "system" | "feishu" | "admins" | "audit" | "info";
  legacyPaths?: string[];
  children?: AdminRoute[];
};

export const systemRoutes: AdminRoute[] = [
  {
    id: "systemFeishu",
    path: "/admin/system/feishu",
    label: "飞书同步",
    iconKey: "feishu",
    legacyPaths: ["/admin/settings"],
  },
  {
    id: "systemAdmins",
    path: "/admin/system/admins",
    label: "管理员授权",
    iconKey: "admins",
    legacyPaths: ["/admin/admins"],
  },
  {
    id: "systemAudit",
    path: "/admin/system/audit",
    label: "操作审计",
    iconKey: "audit",
    legacyPaths: ["/admin/records"],
  },
  { id: "systemInfo", path: "/admin/system/info", label: "系统信息", iconKey: "info" },
];

export const adminRoutes: AdminRoute[] = [
  { id: "workspace", path: "/admin/workspace", label: "工作台", iconKey: "workspace" },
  { id: "applications", path: "/admin/applications", label: "应用管理", iconKey: "applications" },
  { id: "permissions", path: "/admin/permissions", label: "权限管理", iconKey: "permissions" },
  {
    id: "system",
    path: "/admin/system/info",
    label: "系统管理",
    iconKey: "system",
    children: systemRoutes,
  },
];

const legacyRoutePaths: Record<LegacyAdminRouteId, string> = {
  admins: "/admin/admins",
  records: "/admin/records",
  settings: "/admin/settings",
};

export function routePath(id: AdminRouteId | LegacyAdminRouteId): string {
  if (id in legacyRoutePaths) {
    return legacyRoutePaths[id as LegacyAdminRouteId];
  }

  return (
    flattenRoutes(adminRoutes).find((route) => route.id === id)?.path ??
    "/admin/system/audit"
  );
}

export function getActiveAdminRoute(pathname: string): AdminRouteId {
  const matched = flattenRoutes(adminRoutes)
    .filter(
      (route) =>
        matchesPath(pathname, route.path) ||
        route.legacyPaths?.some((legacy) => matchesPath(pathname, legacy)),
    )
    .sort(
      (a, b) =>
        b.path.length - a.path.length ||
        Number(Boolean(a.children)) - Number(Boolean(b.children)),
    )[0];

  return matched?.id ?? "systemAudit";
}

export function flattenRoutes(routes: AdminRoute[]): AdminRoute[] {
  return routes.flatMap((route) => [
    route,
    ...(route.children ? flattenRoutes(route.children) : []),
  ]);
}

function matchesPath(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`);
}
