import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { AdminMe } from "../../admin-types";
import {
  bindIamRoleApplication,
  fetchApplications,
  fetchIamRoles,
  fetchIamRolesAcrossApplications,
  fetchPermissionGroups,
  setIamRoleApplicationBindingStatus,
} from "../../api/permission";
import type { Application, IamRole, PermissionGroup } from "../../api/permission";
import { PageHeader } from "../../components/admin/PageHeader";
import { PageState } from "../../components/admin/PageState";
import { Button } from "../../components/ui/button";
import { PermissionRoleDetailSheet } from "./PermissionRoleDetailSheet";
import { formatRoleStatus } from "./permission-form";

const roleDetailTabs = ["overview", "subjects", "groups", "permissions", "base", "audit"] as const;

type RoleDetailState =
  | { status: "loading" }
  | {
      status: "loaded";
      application: Application;
      applications: Application[];
      role: IamRole;
      groups: PermissionGroup[];
    }
  | { status: "failed"; message: string; forbidden: boolean };

export function PermissionRoleDetailWorkspace(props: { admin: AdminMe }) {
  const { appKey: legacyAppKey, roleId } = useParams<{ appKey?: string; roleId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState<RoleDetailState>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const latestRequestRef = useRef(0);
  const appKey = searchParams.get("appKey") ?? legacyAppKey;
  const returnTo = useMemo(() => {
    const from = searchParams.get("from");
    return from?.startsWith("/admin/permissions")
      ? from
      : `/admin/permissions${appKey ? `?appKey=${encodeURIComponent(appKey)}` : ""}`;
  }, [appKey, searchParams]);
  const activeTab = useMemo(() => {
    const tab = searchParams.get("tab");
    if (tab === "permissions" || tab === "groups") {
      return "groups";
    }
    if (tab === "base" || tab === "audit") {
      return "overview";
    }
    return typeof tab === "string" && roleDetailTabs.some((item) => item === tab)
      ? tab
      : "overview";
  }, [searchParams]);

  function handleTabChange(tab: string) {
    if (!roleDetailTabs.some((item) => item === tab)) {
      return;
    }
    const next = new URLSearchParams(searchParams);
    if (tab === "overview") {
      next.delete("tab");
    } else if (tab === "groups") {
      next.set("tab", "permissions");
    } else {
      next.set("tab", tab);
    }
    void navigate({ search: next.toString() ? `?${next.toString()}` : "" }, { replace: true });
  }

  useEffect(() => {
    if (!roleId) {
      setState({ status: "failed", message: "缺少角色标识", forbidden: false });
      return;
    }
    const requestSeq = latestRequestRef.current + 1;
    latestRequestRef.current = requestSeq;
    setState({ status: "loading" });
    void (async () => {
      const applications = await fetchApplications();
      const roles = appKey
        ? await fetchIamRoles(appKey)
        : await fetchIamRolesAcrossApplications(applications);
      const role = roles.find((item) => item.id === roleId);
      const firstActiveAppKey = role?.applications?.find(
        (applicationBinding) => applicationBinding.bindingStatus === "active",
      )?.appKey;
      const effectiveAppKey = appKey ?? firstActiveAppKey ?? role?.appKey;
      const application = applications.find((item) => item.appKey === effectiveAppKey);
      const effectiveRoles =
        effectiveAppKey && effectiveAppKey !== appKey
          ? await fetchIamRoles(effectiveAppKey)
          : roles;
      const effectiveRole =
        effectiveRoles.find((item) => item.id === roleId) ?? role;
      const groups = effectiveAppKey ? await fetchPermissionGroups(effectiveAppKey) : [];
      return { applications, application, groups, role: effectiveRole };
    })()
      .then(({ applications, application, groups, role }) => {
        if (latestRequestRef.current !== requestSeq) {
          return;
        }
        if (!application || !role) {
          setState({ status: "failed", message: "角色不存在或不在当前管理员范围内", forbidden: false });
          return;
        }
        setState({ status: "loaded", application, applications, role, groups });
      })
      .catch((error: unknown) => {
        if (latestRequestRef.current !== requestSeq) {
          return;
        }
        setState({
          status: "failed",
          message: error instanceof Error ? error.message : "无法读取角色详情",
          forbidden: isForbiddenError(error),
        });
      });
  }, [appKey, props.admin.adminUserId, reloadKey, roleId]);

  return (
    <main className="flex min-h-full flex-col bg-muted/20" aria-label="角色配置工作台">
      <PageHeader
        badges={
          state.status === "loaded" ? (
            <span className="rounded-md border px-2 py-1 text-xs text-muted-foreground">
              {formatRoleStatus(state.role.status)}
            </span>
          ) : null
        }
        breadcrumbs={[
          { label: "后台", href: "/admin/workspace" },
          { label: "权限管理", href: returnTo },
          { label: state.status === "loaded" ? state.role.name : roleId ?? "角色详情", current: true },
        ]}
        description="独立角色配置工作台，分区维护组织与用户绑定、应用权限绑定和基础信息。"
        primaryAction={
          <Button type="button" variant="outline" onClick={() => { void navigate(returnTo); }}>
            <ArrowLeft aria-hidden="true" size={16} />
            返回角色列表
          </Button>
        }
        title="角色配置工作台"
      />
      <section className="flex flex-1 flex-col gap-4 p-6">
        {state.status === "loading" ? (
          <PageState type="loading" title="正在读取角色详情" />
        ) : null}
        {state.status === "failed" ? (
          <PageState
            description={state.forbidden ? "当前管理员无权查看该角色。" : state.message}
            type={state.forbidden ? "forbidden" : "error"}
            title="无法打开角色详情"
          />
        ) : null}
        {state.status === "loaded" ? (
          <PermissionRoleDetailSheet
            activeTab={activeTab}
            appKey={state.application.appKey}
            applications={state.applications}
            canBindApplications={props.admin.roles.includes("platform_admin")}
            canManageSubjects={props.admin.roles.includes("platform_admin")}
            onActiveTabChange={handleTabChange}
            onAppKeyChange={(nextAppKey) => {
              const next = new URLSearchParams(searchParams);
              next.set("appKey", nextAppKey);
              next.set("tab", "permissions");
              void navigate({ search: `?${next.toString()}` }, { replace: false });
            }}
            onBindApplication={async (nextAppKey) => {
              await bindIamRoleApplication(nextAppKey, state.role.id);
              const next = new URLSearchParams(searchParams);
              next.set("appKey", nextAppKey);
              next.set("tab", "permissions");
              setReloadKey((current) => current + 1);
              void navigate({ search: `?${next.toString()}` }, { replace: false });
            }}
            onSetApplicationBindingStatus={async (targetAppKey, status) => {
              await setIamRoleApplicationBindingStatus(targetAppKey, state.role.id, status);
              if (targetAppKey === state.application.appKey && status === "disabled") {
                const nextAppKey = state.role.applications?.find(
                  (application) =>
                    application.appKey !== targetAppKey &&
                    application.bindingStatus === "active",
                )?.appKey;
                if (nextAppKey) {
                  const next = new URLSearchParams(searchParams);
                  next.set("appKey", nextAppKey);
                  next.set("tab", "permissions");
                  void navigate({ search: `?${next.toString()}` }, { replace: false });
                }
              }
              setReloadKey((current) => current + 1);
            }}
            onOpenChange={() => { void navigate(returnTo); }}
            onSaved={() => { setReloadKey((current) => current + 1); }}
            open
            permissionGroups={state.groups}
            permissionGroupsById={new Map(state.groups.map((group) => [group.id, group]))}
            presentation="page"
            readOnly={state.application.status !== "active" || state.role.status === "disabled"}
            readOnlyReason={
              state.application.status !== "active"
                ? "当前应用已停用，权限管理只读。"
                : state.role.status === "disabled"
                  ? "当前角色已停用，权限管理只读。"
                  : undefined
            }
            role={state.role}
          />
        ) : null}
      </section>
    </main>
  );
}

function isForbiddenError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    Number((error as { status?: unknown }).status) === 403
  );
}
