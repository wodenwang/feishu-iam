import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  ChevronDown,
  ClipboardList,
  FileClock,
  KeyRound,
  LayoutDashboard,
  LogOut,
  ServerCog,
  Settings,
  ShieldCheck,
  UserCircle,
  UsersRound,
} from "lucide-react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  fetchFeishuFieldDiagnostics,
  fetchFeishuStatus,
  fetchFeishuSyncRuns,
  triggerFeishuDepartmentSync,
  triggerFeishuSync,
  triggerFeishuUserSync,
} from "./api/feishu";
import type { FeishuStatus } from "./api/feishu";
import { fetchApiStatus } from "./api/status";
import { AdminApiError, fetchAdminMe } from "./api/admin";
import type { AdminMe, AdminRoleKey } from "./admin-types";
import logoUrl from "./assets/feishu-iam-logo.png";
import { AppShell } from "./components/admin/AppShell";
import { ProblemFeedbackPage } from "./components/admin/ProblemFeedbackPage";
import { Button } from "./components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./components/ui/dropdown-menu";
import { AdminAuthorizationPage } from "./routes/AdminAuthorizationPage";
import { ApplicationManagementPage } from "./routes/ApplicationManagementPage";
import { ApplicationDetailPage } from "./routes/ApplicationDetailPage";
import { PermissionManagementPage } from "./routes/PermissionManagementPage";
import { PermissionRoleDetailPage } from "./routes/PermissionRoleDetailPage";
import { RecordQueryPage } from "./routes/RecordQueryPage";
import { SystemSettingsPage } from "./routes/SystemSettingsPage";
import type {
  FeishuDetailState,
  SystemApiState,
} from "./routes/SystemSettingsPage";
import { WorkspacePage } from "./routes/WorkspacePage";
import {
  adminRoutes,
  getActiveAdminRoute,
  routePath,
} from "./routes/admin-routes";
import type { AdminRoute, AdminRouteId } from "./routes/admin-routes";

type FeishuState =
  | { status: "loading" }
  | { status: "loaded"; data: FeishuStatus }
  | { status: "failed"; message: string };

type AdminState =
  | { status: "loading" }
  | { status: "loaded"; admin: AdminMe }
  | { status: "failed"; message: string; errorCode?: string; requestId?: string };

const roleLabels: Record<AdminRoleKey, string> = {
  platform_admin: "平台管理员",
  application_admin: "应用管理员",
  audit_viewer: "审计查看员",
  sync_admin: "同步管理员",
};

const routeIcons: Partial<Record<AdminRouteId, ReactNode>> = {
  workspace: <LayoutDashboard className="h-4 w-4" aria-hidden="true" />,
  applications: <ClipboardList className="h-4 w-4" aria-hidden="true" />,
  permissions: <KeyRound className="h-4 w-4" aria-hidden="true" />,
  system: <Settings className="h-4 w-4" aria-hidden="true" />,
};

const routeIconKeys: Record<NonNullable<AdminRoute["iconKey"]>, ReactNode> = {
  workspace: <LayoutDashboard className="h-4 w-4" aria-hidden="true" />,
  applications: <ClipboardList className="h-4 w-4" aria-hidden="true" />,
  permissions: <KeyRound className="h-4 w-4" aria-hidden="true" />,
  system: <Settings className="h-4 w-4" aria-hidden="true" />,
  feishu: <UsersRound className="h-4 w-4" aria-hidden="true" />,
  admins: <ShieldCheck className="h-4 w-4" aria-hidden="true" />,
  audit: <FileClock className="h-4 w-4" aria-hidden="true" />,
  info: <ServerCog className="h-4 w-4" aria-hidden="true" />,
};

export function App() {
  return (
    <BrowserRouter>
      <AdminApp />
    </BrowserRouter>
  );
}

function AdminApp() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeRoute = getActiveAdminRoute(location.pathname);
  const [adminState, setAdminState] = useState<AdminState>({
    status: "loading",
  });
  const [state, setState] = useState<SystemApiState>({ status: "loading" });
  const [feishuState, setFeishuState] = useState<FeishuState>({
    status: "loading",
  });
  const [feishuDetailState, setFeishuDetailState] = useState<FeishuDetailState>(
    { status: "idle" },
  );
  const [recordsInitialApplicationId, setRecordsInitialApplicationId] =
    useState<string | null>(null);

  useEffect(() => {
    void fetchAdminMe()
      .then((admin) => {
        setAdminState({ status: "loaded", admin });
      })
      .catch((error: unknown) => {
        setAdminState({
          status: "failed",
          message:
            error instanceof Error
              ? error.message
              : "需要登录 Feishu IAM 管理后台",
          errorCode: error instanceof AdminApiError ? error.code : undefined,
          requestId: error instanceof AdminApiError ? error.requestId : undefined,
        });
      });
  }, []);

  useEffect(() => {
    if (adminState.status !== "loaded") {
      return;
    }

    void fetchApiStatus()
      .then((data) => {
        setState({ status: "loaded", data });
      })
      .catch((error: unknown) => {
        setState({
          status: "failed",
          message: error instanceof Error ? error.message : "无法读取 API 状态",
        });
      });
  }, [adminState]);

  useEffect(() => {
    if (adminState.status !== "loaded") {
      return;
    }

    void fetchFeishuStatus()
      .then((data) => {
        setFeishuState({ status: "loaded", data });
      })
      .catch((error: unknown) => {
        setFeishuState({
          status: "failed",
          message:
            error instanceof Error ? error.message : "无法读取飞书同步状态",
        });
      });
  }, [adminState]);

  useEffect(() => {
    if (activeRoute !== "systemAudit") {
      setRecordsInitialApplicationId(null);
    }
  }, [activeRoute]);

  useEffect(() => {
    if (
      adminState.status !== "loaded" ||
      activeRoute !== "systemFeishu" ||
      feishuDetailState.status !== "idle"
    ) {
      return;
    }

    void loadFeishuDetails();
  }, [activeRoute, adminState, feishuDetailState.status]);

  async function loadFeishuDetails(): Promise<void> {
    setFeishuDetailState({ status: "loading" });

    try {
      const [data, runs, diagnostics] = await Promise.all([
        fetchFeishuStatus(),
        fetchFeishuSyncRuns(),
        fetchFeishuFieldDiagnostics(),
      ]);
      setFeishuDetailState({
        status: "loaded",
        data,
        runs,
        diagnostics,
        syncing: false,
      });
    } catch (error: unknown) {
      setFeishuDetailState({
        status: "failed",
        message:
          error instanceof Error ? error.message : "无法读取飞书同步状态",
      });
    }
  }

  async function refreshDiagnostics(): Promise<void> {
    if (
      feishuDetailState.status !== "loaded" ||
      feishuDetailState.diagnosticsRefreshing
    ) {
      return;
    }

    setFeishuDetailState((current) =>
      current.status === "loaded"
        ? {
            ...current,
            diagnosticsRefreshing: true,
            diagnosticsError: undefined,
          }
        : current,
    );

    try {
      const diagnostics = await fetchFeishuFieldDiagnostics();
      setFeishuDetailState((current) =>
        current.status === "loaded"
          ? {
              ...current,
              diagnostics,
              diagnosticsRefreshing: false,
              diagnosticsError: undefined,
            }
          : current,
      );
    } catch (error: unknown) {
      setFeishuDetailState((current) =>
        current.status === "loaded"
          ? {
              ...current,
              diagnosticsRefreshing: false,
              diagnosticsError:
                error instanceof Error ? error.message : "无法读取字段诊断",
            }
          : current,
      );
    }
  }

  async function handleSync(confirmLatestRunId: string): Promise<boolean> {
    if (feishuDetailState.status !== "loaded") {
      return false;
    }

    setFeishuDetailState((current) =>
      current.status === "loaded"
        ? { ...current, syncing: true, syncError: undefined }
        : current,
    );

    try {
      await triggerFeishuSync(confirmLatestRunId);
      const [data, runs] = await Promise.all([
        fetchFeishuStatus(),
        fetchFeishuSyncRuns(),
      ]);
      setFeishuDetailState((current) =>
        current.status === "loaded"
          ? { ...current, data, runs, syncing: false, syncError: undefined }
          : current,
      );
      setFeishuState({ status: "loaded", data });
      return true;
    } catch (error: unknown) {
      setFeishuDetailState((current) =>
        current.status === "loaded"
          ? {
              ...current,
              syncing: false,
              syncError:
                error instanceof Error ? error.message : "无法触发飞书同步",
            }
          : current,
      );
      return false;
    }
  }

  async function handleLightSync(
    target: { type: "user"; id: string } | { type: "department"; id: string },
  ): Promise<boolean> {
    if (feishuDetailState.status !== "loaded") {
      return false;
    }

    setFeishuDetailState((current) =>
      current.status === "loaded"
        ? { ...current, syncing: true, syncError: undefined }
        : current,
    );

    try {
      if (target.type === "user") {
        await triggerFeishuUserSync(target.id);
      } else {
        await triggerFeishuDepartmentSync(target.id);
      }
      const [data, runs, diagnostics] = await Promise.all([
        fetchFeishuStatus(),
        fetchFeishuSyncRuns(),
        fetchFeishuFieldDiagnostics(),
      ]);
      setFeishuDetailState((current) =>
        current.status === "loaded"
          ? {
              ...current,
              data,
              runs,
              diagnostics,
              syncing: false,
              syncError: undefined,
            }
          : current,
      );
      setFeishuState({ status: "loaded", data });
      return true;
    } catch (error: unknown) {
      setFeishuDetailState((current) =>
        current.status === "loaded"
          ? {
              ...current,
              syncing: false,
              syncError:
                error instanceof Error ? error.message : "无法触发飞书轻量同步",
            }
          : current,
      );
      return false;
    }
  }

  if (adminState.status === "loading") {
    return (
      <main className="grid min-h-screen place-content-center bg-background p-6 text-center">
        <p>正在读取管理员身份...</p>
      </main>
    );
  }

  if (adminState.status === "failed") {
    return (
      <ProblemFeedbackPage
        title="需要登录 Feishu IAM 管理后台"
        description="当前浏览器没有有效管理员会话，请使用飞书登录后继续。"
        primaryAction={{ label: "飞书登录", href: "/admin/auth/login" }}
        errorCode={adminState.errorCode ?? "ADMIN_SESSION_REQUIRED"}
        requestId={adminState.requestId ?? "unknown"}
        occurredAt={new Date().toLocaleString("zh-CN")}
        path={window.location.pathname + window.location.search}
      />
    );
  }

  return (
    <AppShell
      brand={<Brand />}
      navItems={adminRoutes.map((route) => toNavItem(route, activeRoute))}
      userMenu={<UserMenu admin={adminState.admin} />}
    >
      <Routes>
        <Route
          path="/admin"
          element={<Navigate to="/admin/workspace" replace />}
        />
        <Route
          path="/admin/workspace"
          element={
            <WorkspacePage
              admin={adminState.admin}
              apiStatus={state.status === "loaded" ? state.data : undefined}
              feishuStatus={
                feishuState.status === "loaded" ? feishuState.data : undefined
              }
              onNavigate={(href) => {
                void navigate(href);
              }}
            />
          }
        />
        <Route
          path="/admin/applications"
          element={
            <ApplicationManagementPage
              admin={adminState.admin}
              onManagePermissions={(appKey) => {
                void navigate(
                  `/admin/permissions?appKey=${encodeURIComponent(appKey)}`,
                );
              }}
              onOpenRecords={(applicationId, options) => {
                setRecordsInitialApplicationId(applicationId);
                const params = new URLSearchParams();
                params.set("tab", options?.tab ?? "trace");
                params.set("applicationId", applicationId);
                if (options?.clientId) {
                  params.set("clientId", options.clientId);
                }
                params.set("returnTo", `${location.pathname}${location.search}`);
                void navigate(`${routePath("systemAudit")}?${params.toString()}`);
              }}
            />
          }
        />
        <Route
          path="/admin/applications/:appKey"
          element={
            <ApplicationDetailPage
              admin={adminState.admin}
              onManagePermissions={(appKey) => {
                void navigate(
                  `/admin/permissions?appKey=${encodeURIComponent(appKey)}`,
                );
              }}
              onOpenRecords={(applicationId, options) => {
                setRecordsInitialApplicationId(applicationId);
                const params = new URLSearchParams();
                params.set("tab", options?.tab ?? "trace");
                params.set("applicationId", applicationId);
                if (options?.clientId) {
                  params.set("clientId", options.clientId);
                }
                params.set("returnTo", `${location.pathname}${location.search}`);
                void navigate(`${routePath("systemAudit")}?${params.toString()}`);
              }}
            />
          }
        />
        <Route
          path="/admin/permissions"
          element={<PermissionManagementPage admin={adminState.admin} />}
        />
        <Route
          path="/admin/permissions/:appKey/roles/:roleId"
          element={<PermissionRoleDetailPage admin={adminState.admin} />}
        />
        <Route
          path="/admin/system/admins"
          element={<AdminAuthorizationPage admin={adminState.admin} />}
        />
        <Route
          path="/admin/system/audit"
          element={
            <RecordQueryPage
              initialApplicationId={recordsInitialApplicationId}
            />
          }
        />
        <Route
          path="/admin/system/feishu"
          element={
            <SystemSettingsPage
              admin={adminState.admin}
              apiState={state}
              feishuDetailState={feishuDetailState}
              mode="feishu"
              onRefreshDiagnostics={() => void refreshDiagnostics()}
              onOpenTrace={(run) => {
                const params = new URLSearchParams();
                params.set("tab", "trace");
                if (run.requestId) {
                  params.set("requestId", run.requestId);
                }
                void navigate(`${routePath("systemAudit")}?${params.toString()}`);
              }}
              onLightSync={handleLightSync}
              onSync={handleSync}
            />
          }
        />
        <Route
          path="/admin/system/info"
          element={
            <SystemSettingsPage
              admin={adminState.admin}
              apiState={state}
              feishuDetailState={feishuDetailState}
              mode="info"
              onRefreshDiagnostics={() => void refreshDiagnostics()}
              onOpenTrace={(run) => {
                const params = new URLSearchParams();
                params.set("tab", "trace");
                if (run.requestId) {
                  params.set("requestId", run.requestId);
                }
                void navigate(`${routePath("systemAudit")}?${params.toString()}`);
              }}
              onLightSync={handleLightSync}
              onSync={handleSync}
            />
          }
        />
        <Route
          path="/admin/admins"
          element={<RedirectWithSearch to={routePath("systemAdmins")} />}
        />
        <Route
          path="/admin/records"
          element={<RedirectWithSearch to={routePath("systemAudit")} />}
        />
        <Route path="/admin/settings" element={<RedirectSettingsLegacy />} />
        <Route
          path="*"
          element={<Navigate to={routePath("systemAudit")} replace />}
        />
      </Routes>
      {state.status === "failed" ? (
        <p className="mx-6 my-4 text-sm text-destructive">{state.message}</p>
      ) : null}
      {feishuState.status === "failed" ? (
        <p className="mx-6 my-4 text-sm text-destructive">
          {feishuState.message}
        </p>
      ) : null}
    </AppShell>
  );
}

function Brand() {
  return (
    <div className="flex min-w-0 items-center gap-3" aria-label="Feishu IAM 品牌">
      <img
        className="h-10 w-10 shrink-0 rounded-md"
        src={logoUrl}
        alt="Feishu IAM 标识"
        aria-label="Feishu IAM 标识"
      />
      <div className="min-w-0">
        <strong className="block truncate text-sm font-semibold leading-5">
          Feishu IAM
        </strong>
        <span className="block truncate text-xs text-muted-foreground">
          唐群内部身份与权限控制台
        </span>
      </div>
    </div>
  );
}

function toNavItem(route: AdminRoute, activeRoute: AdminRouteId) {
  const children = route.children?.map((child) => ({
    href: child.path,
    label: child.label,
    icon: child.iconKey ? routeIconKeys[child.iconKey] : undefined,
    active: activeRoute === child.id,
  }));

  return {
    href: route.path,
    label: route.label,
    icon: route.iconKey ? routeIconKeys[route.iconKey] : routeIcons[route.id],
    active:
      activeRoute === route.id ||
      route.children?.some((child) => child.id === activeRoute) === true,
    children,
  };
}

function RedirectWithSearch({ to }: { to: string }) {
  const location = useLocation();
  return <Navigate to={`${to}${location.search}`} replace />;
}

function RedirectSettingsLegacy() {
  const location = useLocation();
  const search = new URLSearchParams(location.search);
  const target =
    search.get("tab") === "feishu"
      ? routePath("systemFeishu")
      : routePath("systemInfo");

  return <Navigate to={`${target}${location.search}`} replace />;
}

function UserMenu(props: { admin: AdminMe }) {
  const primaryRole = props.admin.roles[0];
  const roleLabel = primaryRole ? roleLabels[primaryRole] : "管理员";
  const displayName = props.admin.displayName || props.admin.feishuUserId;
  const initials = displayName.slice(0, 1).toUpperCase();
  const feishuUserLabel = `飞书 user_id: ${props.admin.feishuUserId}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`当前登录人 ${displayName}，${roleLabel}，${feishuUserLabel}`}
          className="min-h-11 max-w-[min(22rem,calc(100vw-5rem))] justify-start gap-3 px-2 sm:px-3"
          type="button"
          variant="ghost"
        >
          <span
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
            aria-hidden="true"
          >
            {initials || <UserCircle className="h-4 w-4" aria-hidden="true" />}
          </span>
          <span className="hidden min-w-0 text-left sm:block">
            <span className="block truncate text-sm font-medium">
              {displayName} · {roleLabel}
            </span>
            <code
              className="block truncate text-xs font-normal text-muted-foreground"
              title={feishuUserLabel}
            >
              {feishuUserLabel}
            </code>
          </span>
          <ChevronDown
            className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block"
            aria-hidden="true"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="space-y-1">
          <span className="block truncate text-sm font-medium">
            {displayName}
          </span>
          <span className="block text-xs font-normal text-muted-foreground">
            {roleLabel}
          </span>
          <code
            className="block truncate rounded bg-muted px-2 py-1 text-xs font-normal"
            title={feishuUserLabel}
          >
            {feishuUserLabel}
          </code>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href="/admin/auth/logout" className="gap-2">
            <LogOut className="h-4 w-4" aria-hidden="true" />
            退出登录
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
