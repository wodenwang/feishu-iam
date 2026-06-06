import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { AdminMe } from "../../admin-types";
import {
  fetchApplications,
  fetchIamRoles,
  fetchPermissionGroups,
} from "../../api/permission";
import type { Application, IamRole, PermissionGroup } from "../../api/permission";
import { PageHeader } from "../../components/admin/PageHeader";
import { PageState } from "../../components/admin/PageState";
import { Button } from "../../components/ui/button";
import { PermissionRoleDetailSheet } from "./PermissionRoleDetailSheet";
import { formatRoleStatus } from "./permission-form";

const roleDetailTabs = ["overview", "subjects", "groups", "base", "audit"] as const;

type RoleDetailState =
  | { status: "loading" }
  | {
      status: "loaded";
      application: Application;
      role: IamRole;
      groups: PermissionGroup[];
    }
  | { status: "failed"; message: string; forbidden: boolean };

export function PermissionRoleDetailWorkspace(props: { admin: AdminMe }) {
  const { appKey, roleId } = useParams<{ appKey: string; roleId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState<RoleDetailState>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const latestRequestRef = useRef(0);
  const returnTo = useMemo(() => {
    const from = searchParams.get("from");
    return from?.startsWith("/admin/permissions")
      ? from
      : `/admin/permissions${appKey ? `?appKey=${encodeURIComponent(appKey)}` : ""}`;
  }, [appKey, searchParams]);
  const activeTab = useMemo(() => {
    const tab = searchParams.get("tab");
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
    } else {
      next.set("tab", tab);
    }
    void navigate({ search: next.toString() ? `?${next.toString()}` : "" }, { replace: true });
  }

  useEffect(() => {
    if (!appKey || !roleId) {
      setState({ status: "failed", message: "缺少应用或角色标识", forbidden: false });
      return;
    }
    const requestSeq = latestRequestRef.current + 1;
    latestRequestRef.current = requestSeq;
    setState({ status: "loading" });
    void Promise.all([
      fetchApplications(),
      fetchPermissionGroups(appKey),
      fetchIamRoles(appKey),
    ])
      .then(([applications, groups, roles]) => {
        if (latestRequestRef.current !== requestSeq) {
          return;
        }
        const application = applications.find((item) => item.appKey === appKey);
        const role = roles.find((item) => item.id === roleId);
        if (!application || !role) {
          setState({ status: "failed", message: "角色不存在或不在当前应用中", forbidden: false });
          return;
        }
        setState({ status: "loaded", application, role, groups });
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
    <main className="flex min-h-full flex-col bg-muted/20" aria-label="角色详情">
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
        description="独立角色详情页，承载组织与用户绑定、权限组绑定、基础信息和保存说明。"
        primaryAction={
          <Button type="button" variant="outline" onClick={() => { void navigate(returnTo); }}>
            <ArrowLeft aria-hidden="true" size={16} />
            返回角色列表
          </Button>
        }
        title="角色详情"
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
            onActiveTabChange={handleTabChange}
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
