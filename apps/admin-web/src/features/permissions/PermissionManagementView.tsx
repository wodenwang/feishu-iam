import { Plus, Search } from "lucide-react";
import type { SyntheticEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useLocation, useNavigate } from "react-router-dom";
import type { AdminMe } from "../../admin-types";
import {
  fetchApplications,
  fetchIamRolesAcrossApplications,
  fetchIamRoles,
  fetchPermissionGroups,
  disableIamRole,
  enableIamRole,
} from "../../api/permission";
import type { Application, IamRole, PermissionGroup } from "../../api/permission";
import { DataTable } from "../../components/admin/DataTable";
import { FilterBar } from "../../components/admin/FilterBar";
import { PageHeader } from "../../components/admin/PageHeader";
import { StatusBadge } from "../../components/admin/StatusBadge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { ConfirmDialog } from "../../components/admin/ConfirmDialog";
import {
  parsePermissionSearch,
  serializePermissionSearch,
} from "../../routes/admin-url-state";
import type { PermissionSearchState } from "../../routes/admin-url-state";
import {
  createPermissionRoleColumns,
  formatDateTime,
  readBoundPermissionGroupIds,
} from "./permission-columns";
import type { PermissionRoleRowAction } from "./permission-columns";
import { formatRoleStatus } from "./permission-form";
import { PermissionRoleCreateDialog } from "./PermissionRoleCreateDialog";
import { PermissionRoleEditDialog } from "./PermissionRoleEditDialog";

export type PermissionManagementViewProps = {
  admin: AdminMe;
  initialAppKey?: string | null;
};

type PermissionDataState =
  | { status: "idle" | "loading" }
  | { status: "loaded"; groups: PermissionGroup[]; roles: IamRole[] }
  | { status: "failed"; message: string; forbidden: boolean };

type ApplicationState =
  | { status: "loading" }
  | { status: "loaded"; applications: Application[] }
  | { status: "failed"; message: string; forbidden: boolean };

type FilterDraft = {
  q: string;
  code: string;
  authStatus: PermissionSearchState["authStatus"];
  status: PermissionSearchState["status"];
  sort: PermissionSearchState["sort"];
};

type RoleStatusIntent =
  | { type: "single"; role: IamRole; nextStatus: "active" | "disabled" }
  | { type: "bulk"; roles: IamRole[]; nextStatus: "active" | "disabled" };

export function PermissionManagementView({ admin, initialAppKey }: PermissionManagementViewProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const search = withInitialAppKey(parsePermissionSearch(searchParams), initialAppKey);
  const [draft, setDraft] = useState<FilterDraft>(() => filterDraftFromSearch(search));
  const [applicationsState, setApplicationsState] = useState<ApplicationState>({ status: "loading" });
  const [permissionState, setPermissionState] = useState<PermissionDataState>({ status: "idle" });
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<IamRole | null>(null);
  const [statusIntent, setStatusIntent] = useState<RoleStatusIntent | null>(null);
  const [statusPending, setStatusPending] = useState(false);
  const [actionError, setActionError] = useState<string>();
  const latestRequestRef = useRef(0);
  const canManageGlobalRoles = admin.roles.includes("platform_admin");

  useEffect(() => {
    setDraft(filterDraftFromSearch(search));
  }, [search.authStatus, search.code, search.q, search.sort, search.status]);

  useEffect(() => {
    void fetchApplications()
      .then((applications) => {
        setApplicationsState({ status: "loaded", applications });
      })
      .catch((error: unknown) => {
        setApplicationsState({
          status: "failed",
          message: error instanceof Error ? error.message : "无法读取应用列表",
          forbidden: isForbiddenError(error),
        });
      });
  }, [admin.adminUserId, reloadKey]);

  useEffect(() => {
    if (applicationsState.status !== "loaded") {
      return;
    }

    const requestSeq = latestRequestRef.current + 1;
    latestRequestRef.current = requestSeq;
    setPermissionState({ status: "loading" });

    const request = search.appKey
      ? Promise.all([fetchPermissionGroups(search.appKey), fetchIamRoles(search.appKey)])
      : fetchIamRolesAcrossApplications(applicationsState.applications).then((roles) => [[] as PermissionGroup[], roles] as const);

    void request
      .then(([groups, roles]) => {
        if (latestRequestRef.current !== requestSeq) {
          return;
        }
        setPermissionState({ status: "loaded", groups, roles });
      })
      .catch((error: unknown) => {
        if (latestRequestRef.current !== requestSeq) {
          return;
        }
        setPermissionState({
          status: "failed",
          message: error instanceof Error ? error.message : "无法读取 IAM 角色授权",
          forbidden: isForbiddenError(error),
        });
      });
  }, [admin.adminUserId, applicationsState, reloadKey, search.appKey]);

  const selectedApplication =
    applicationsState.status === "loaded"
      ? applicationsState.applications.find((application) => application.appKey === search.appKey)
      : undefined;
  const groups = permissionState.status === "loaded" ? permissionState.groups : [];
  const roles = permissionState.status === "loaded" ? permissionState.roles : [];
  const groupsById = useMemo(() => {
    const next = new Map(groups.map((group) => [group.id, group]));
    for (const role of roles) {
      for (const group of role.permissionGroups ?? []) {
        next.set(group.id, group);
      }
    }
    return next;
  }, [groups, roles]);
  const filteredRoles = useMemo(
    () => filterAndSortRoles(roles, search),
    [roles, search.authStatus, search.code, search.q, search.sort, search.status],
  );
  const pagedRoles = useMemo(() => paginateRows(filteredRoles, search.page, search.pageSize), [filteredRoles, search.page, search.pageSize]);
  const selectedRoles = useMemo(
    () => filteredRoles.filter((role) => selectedRoleIds.has(role.id)),
    [filteredRoles, selectedRoleIds],
  );
  const columns = useMemo(
    () =>
      createPermissionRoleColumns({
        canManageGlobalRoles,
        permissionGroupsById: groupsById,
        selectedRoleIds,
        onAction: handleRowAction,
        onToggleSelection: (role, checked) => {
          setSelectedRoleIds((current) => {
            const next = new Set(current);
            if (checked) {
              next.add(role.id);
            } else {
              next.delete(role.id);
            }
            return next;
          });
        },
      }),
    [canManageGlobalRoles, groupsById, search, selectedRoleIds],
  );

  function updateSearch(next: Partial<PermissionSearchState>) {
    setSearchParams(serializePermissionSearch({ ...search, ...next }));
  }

  function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    updateSearch({
      q: cleanDraft(draft.q),
      code: cleanDraft(draft.code),
      authStatus: draft.authStatus,
      status: draft.status,
      sort: draft.sort,
      page: 1,
      sheet: undefined,
    });
  }

  function handleRowAction(action: PermissionRoleRowAction) {
    if (action.type === "edit") {
      setEditingRole(action.role);
      return;
    }
    if (action.type === "toggle_status") {
      setStatusIntent({
        type: "single",
        role: action.role,
        nextStatus: action.role.status === "active" ? "disabled" : "active",
      });
      return;
    }
    const roleAppKey = search.appKey ?? action.role.appKeys?.[0] ?? action.role.appKey;
    if (!roleAppKey) {
      return;
    }
    const from = `${location.pathname}${location.search}`;
    void navigate(
      `/admin/permissions/roles/${encodeURIComponent(action.role.id)}?appKey=${encodeURIComponent(roleAppKey)}&from=${encodeURIComponent(from)}`,
    );
  }

  function reloadRoles() {
    setSelectedRoleIds(new Set());
    setActionError(undefined);
    setReloadKey((current) => current + 1);
  }

  async function handleConfirmStatusChange() {
    if (!statusIntent) {
      return;
    }
    setStatusPending(true);
    setActionError(undefined);
    try {
      const targets = statusIntent.type === "single" ? [statusIntent.role] : statusIntent.roles;
      await Promise.all(
        targets.map((role) => {
          const roleAppKey = search.appKey ?? role.appKeys?.[0] ?? role.appKey;
          if (!roleAppKey) {
            throw new Error(`角色 ${role.key} 缺少关联应用，无法变更状态`);
          }
          return statusIntent.nextStatus === "active"
            ? enableIamRole(roleAppKey, role.id)
            : disableIamRole(roleAppKey, role.id);
        }),
      );
      setStatusIntent(null);
      reloadRoles();
    } catch (error: unknown) {
      setActionError(error instanceof Error ? error.message : "无法更新角色状态");
    } finally {
      setStatusPending(false);
    }
  }

  return (
    <main className="flex min-h-full flex-col bg-muted/20" role="region" aria-label="权限管理">
      <PageHeader
        breadcrumbs={[
          { label: "后台", href: "/admin/workspace" },
          { label: "权限管理", current: true },
        ]}
        badges={
          selectedApplication ? (
            <StatusBadge tone={selectedApplication.status === "active" ? "success" : "muted"}>
              {formatRoleStatus(selectedApplication.status)}
            </StatusBadge>
          ) : null
        }
        description="统一管理角色资源，按应用筛选关联角色，并进入独立工作台维护组织、用户和应用权限。"
        primaryAction={
          <Button
            disabled={!search.appKey || !canManageGlobalRoles}
            title={
              !canManageGlobalRoles
                ? "只有平台管理员可以创建角色"
                : search.appKey
                  ? "创建角色"
                  : "请先选择一个应用后创建角色"
            }
            type="button"
            onClick={() => { setCreateOpen(true); }}
          >
            <Plus aria-hidden="true" size={16} />
            创建角色
          </Button>
        }
        title="权限管理"
      />

      <section className="flex flex-1 flex-col gap-4 p-6">
        <h2 className="sr-only">IAM 角色授权</h2>
        {applicationsState.status === "failed" ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
            {applicationsState.forbidden ? "当前管理员无权查看应用列表。" : applicationsState.message}
          </div>
        ) : null}
        {actionError ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
            {actionError}
          </div>
        ) : null}
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <FilterBar
            actions={
              <Button type="submit">
                <Search aria-hidden="true" size={16} />
                查询
              </Button>
            }
            onReset={() => {
              updateSearch({
                q: undefined,
                code: undefined,
                authStatus: "all",
                status: "all",
                sort: "key:asc",
                page: 1,
                pageSize: 20,
                sheet: undefined,
              });
            }}
          >
            <label className="grid gap-1.5 text-sm font-medium text-foreground">
              <span>应用</span>
              <select
                aria-label="应用"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
                disabled={applicationsState.status !== "loaded"}
                value={search.appKey ?? ""}
                onChange={(event) => {
                  updateSearch({ appKey: event.target.value || undefined, page: 1, sheet: undefined });
                }}
              >
                <option value="">全部应用</option>
                {applicationsState.status === "loaded"
                  ? applicationsState.applications.map((application) => (
                      <option key={application.appKey} value={application.appKey}>
                        {application.name} / {application.appKey}
                      </option>
                    ))
                  : null}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-foreground">
              <span>角色查询</span>
              <Input
                aria-label="角色查询"
                placeholder="搜索角色名称 / 描述"
                value={draft.q}
                onChange={(event) => { setDraft((current) => ({ ...current, q: event.target.value })); }}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-foreground">
              <span>角色编号</span>
              <Input
                aria-label="角色编号"
                placeholder="搜索角色 key / ID"
                value={draft.code}
                onChange={(event) => { setDraft((current) => ({ ...current, code: event.target.value })); }}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-foreground">
              <span>状态</span>
              <select
                aria-label="角色状态"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
                value={draft.status}
                onChange={(event) => { setDraft((current) => ({ ...current, status: event.target.value as PermissionSearchState["status"] })); }}
              >
                <option value="all">全部</option>
                <option value="enabled">启用</option>
                <option value="disabled">停用</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-foreground">
              <span>授权状态</span>
              <select
                aria-label="授权状态"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
                value={draft.authStatus}
                onChange={(event) => { setDraft((current) => ({ ...current, authStatus: event.target.value as PermissionSearchState["authStatus"] })); }}
              >
                <option value="all">全部</option>
                <option value="configured">已配置授权</option>
                <option value="unconfigured">未配置授权</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-foreground">
              <span>排序</span>
              <select
                aria-label="角色排序"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
                value={draft.sort}
                onChange={(event) => { setDraft((current) => ({ ...current, sort: event.target.value as PermissionSearchState["sort"] })); }}
              >
                <option value="key:asc">角色 key 升序</option>
                <option value="updatedAt:desc">最近更新优先</option>
                <option value="updatedAt:asc">最早更新优先</option>
              </select>
            </label>
          </FilterBar>

          <div className="flex flex-col gap-3 rounded-md border bg-background px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>
              已选择 {selectedRoles.length} 个角色
              {!search.appKey ? "；跨应用视图下会按角色首个关联应用执行状态变更。" : null}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                disabled={selectedRoles.length === 0 || !canManageGlobalRoles}
                size="sm"
                type="button"
                variant="outline"
                onClick={() => {
                  setStatusIntent({ type: "bulk", roles: selectedRoles, nextStatus: "active" });
                }}
              >
                批量启用
              </Button>
              <Button
                disabled={selectedRoles.length === 0 || !canManageGlobalRoles}
                size="sm"
                type="button"
                variant="outline"
                onClick={() => {
                  setStatusIntent({ type: "bulk", roles: selectedRoles, nextStatus: "disabled" });
                }}
              >
                批量停用
              </Button>
              <Button
                disabled={selectedRoles.length === 0 || !canManageGlobalRoles}
                size="sm"
                type="button"
                variant="ghost"
                onClick={() => {
                  setSelectedRoleIds(new Set());
                }}
              >
                清空选择
              </Button>
            </div>
          </div>

          <DataTable
            aria-label="IAM 角色清单"
            columns={columns}
            emptyText={selectedApplication ? "当前应用暂无关联角色" : "暂无 IAM 角色"}
            error={permissionState.status === "failed" && !permissionState.forbidden ? permissionState.message : null}
            forbidden={permissionState.status === "failed" && permissionState.forbidden ? "当前管理员无权查看 IAM 角色授权。" : false}
            getRowKey={(role) => role.id}
            loading={applicationsState.status === "loading" || permissionState.status === "loading"}
            mobileCard={{
              title: (role) => role.name,
              description: (role) => (
                <code className="break-all rounded bg-muted px-2 py-1 text-xs">
                  {role.key}
                </code>
              ),
              fields: [
                {
                  label: "状态",
                  render: (role) => (
                    <StatusBadge
                      tone={role.status === "active" ? "success" : "muted"}
                    >
                      {formatRoleStatus(role.status)}
                    </StatusBadge>
                  ),
                },
                {
                  label: "权限组",
                  render: (role) =>
                    `${String(readBoundPermissionGroupIds(role).length)} 个`,
                },
                {
                  label: "更新时间",
                  render: (role) => formatDateTime(role.updatedAt),
                },
              ],
              actions: (role) => (
                <Button
                  aria-label={`配置 ${role.key}`}
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() => { handleRowAction({ type: "detail", role }); }}
                >
                  配置
                </Button>
              ),
            }}
            rows={pagedRoles}
          />

          {permissionState.status === "loaded" ? (
            <PaginationBar
              page={search.page}
              pageSize={search.pageSize}
              total={filteredRoles.length}
              onPageChange={(page) => { updateSearch({ page, sheet: undefined }); }}
              onPageSizeChange={(pageSize) => { updateSearch({ page: 1, pageSize, sheet: undefined }); }}
            />
          ) : null}
        </form>
      </section>

      <PermissionRoleCreateDialog
        appKey={search.appKey}
        onCreated={reloadRoles}
        onOpenChange={setCreateOpen}
        open={createOpen}
      />
      <PermissionRoleEditDialog
        appKey={search.appKey ?? editingRole?.appKeys?.[0] ?? editingRole?.appKey}
        onOpenChange={(open) => {
          if (!open) {
            setEditingRole(null);
          }
        }}
        onUpdated={reloadRoles}
        open={Boolean(editingRole)}
        role={editingRole}
      />
      {statusIntent ? (
        <ConfirmDialog
          danger={statusIntent.nextStatus === "disabled"}
          description={statusIntentDescription(statusIntent)}
          onConfirm={() => void handleConfirmStatusChange()}
          onOpenChange={(open) => {
            if (!open && !statusPending) {
              setStatusIntent(null);
            }
          }}
          open
          pending={statusPending}
          title={statusIntent.nextStatus === "active" ? "确认启用角色" : "确认停用角色"}
        />
      ) : null}

    </main>
  );
}

function statusIntentDescription(intent: RoleStatusIntent): string {
  const targetCount = intent.type === "single" ? 1 : intent.roles.length;
  const action = intent.nextStatus === "active" ? "启用" : "停用";
  if (intent.type === "single") {
    return `确认${action}角色「${intent.role.name}」？该操作会影响该角色在所有关联应用中的授权结果，并写入审计日志。`;
  }
  return `确认批量${action} ${String(targetCount)} 个角色？该操作会影响这些角色在所有关联应用中的授权结果，并写入审计日志。`;
}

function PaginationBar(props: {
  page: number;
  pageSize: PermissionSearchState["pageSize"];
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: PermissionSearchState["pageSize"]) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(props.total / props.pageSize));
  return (
    <div className="flex flex-col gap-3 rounded-md border bg-background px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <span>
        共 {props.total} 条，第 {props.page} / {pageCount} 页
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="每页条数"
          className="h-9 rounded-md border border-input bg-background px-2"
          value={props.pageSize}
          onChange={(event) => { props.onPageSizeChange(Number(event.target.value) as PermissionSearchState["pageSize"]); }}
        >
          <option value={20}>20 条/页</option>
          <option value={50}>50 条/页</option>
          <option value={100}>100 条/页</option>
        </select>
        <Button disabled={props.page <= 1} onClick={() => { props.onPageChange(props.page - 1); }} size="sm" type="button" variant="outline">
          上一页
        </Button>
        <Button disabled={props.page >= pageCount} onClick={() => { props.onPageChange(props.page + 1); }} size="sm" type="button" variant="outline">
          下一页
        </Button>
      </div>
    </div>
  );
}

function filterAndSortRoles(roles: IamRole[], search: PermissionSearchState): IamRole[] {
  const keyword = search.q?.trim().toLowerCase();
  const codeKeyword = search.code?.trim().toLowerCase();
  const filtered = roles.filter((role) => {
    const matchesKeyword = keyword
      ? [role.name, role.description ?? ""].some((value) => value.toLowerCase().includes(keyword))
      : true;
    const matchesCode = codeKeyword
      ? [role.key, role.id].some((value) => value.toLowerCase().includes(codeKeyword))
      : true;
    const matchesStatus =
      search.status === "all" ||
      (search.status === "enabled" && role.status === "active") ||
      (search.status === "disabled" && role.status === "disabled");
    const hasAuthorization =
      (role.subjects?.length ?? 0) > 0 ||
      readBoundPermissionGroupIds(role).length > 0 ||
      (role.permissionPoints?.length ?? 0) > 0;
    const matchesAuthStatus =
      search.authStatus === "all" ||
      (search.authStatus === "configured" && hasAuthorization) ||
      (search.authStatus === "unconfigured" && !hasAuthorization);
    return matchesKeyword && matchesCode && matchesStatus && matchesAuthStatus;
  });

  return filtered.sort((left, right) => {
    if (search.sort === "updatedAt:desc") {
      return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
    }
    if (search.sort === "updatedAt:asc") {
      return Date.parse(left.updatedAt) - Date.parse(right.updatedAt);
    }
    return left.key.localeCompare(right.key);
  });
}

function paginateRows(rows: IamRole[], page: number, pageSize: number): IamRole[] {
  const start = (page - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}

function filterDraftFromSearch(search: PermissionSearchState): FilterDraft {
  return {
    q: search.q ?? "",
    code: search.code ?? "",
    authStatus: search.authStatus,
    status: search.status,
    sort: search.sort,
  };
}

function withInitialAppKey(search: PermissionSearchState, initialAppKey?: string | null): PermissionSearchState {
  if (search.appKey || !initialAppKey?.trim()) {
    return search;
  }
  return { ...search, appKey: initialAppKey.trim() };
}

function cleanDraft(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function isForbiddenError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "status" in error && Number((error as { status?: unknown }).status) === 403;
}
