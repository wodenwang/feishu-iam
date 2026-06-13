import { Search } from "lucide-react";
import type { SyntheticEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useLocation, useNavigate } from "react-router-dom";
import type { AdminMe } from "../../admin-types";
import {
  fetchApplications,
  fetchIamRoles,
  fetchPermissionGroups,
} from "../../api/permission";
import type { Application, IamRole, PermissionGroup } from "../../api/permission";
import { DataTable } from "../../components/admin/DataTable";
import { FilterBar } from "../../components/admin/FilterBar";
import { PageHeader } from "../../components/admin/PageHeader";
import { StatusBadge } from "../../components/admin/StatusBadge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  closeSheet,
  parsePermissionSearch,
  serializePermissionSearch,
} from "../../routes/admin-url-state";
import type { PermissionSearchState } from "../../routes/admin-url-state";
import { PermissionRoleDetailSheet } from "./PermissionRoleDetailSheet";
import {
  createPermissionRoleColumns,
  formatDateTime,
  readBoundPermissionGroupIds,
} from "./permission-columns";
import type { PermissionRoleRowAction } from "./permission-columns";
import { formatRoleStatus } from "./permission-form";

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
  status: PermissionSearchState["status"];
  sort: PermissionSearchState["sort"];
};

export function PermissionManagementView({ admin, initialAppKey }: PermissionManagementViewProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const search = withInitialAppKey(parsePermissionSearch(searchParams), initialAppKey);
  const [draft, setDraft] = useState<FilterDraft>(() => filterDraftFromSearch(search));
  const [applicationsState, setApplicationsState] = useState<ApplicationState>({ status: "loading" });
  const [permissionState, setPermissionState] = useState<PermissionDataState>({ status: "idle" });
  const [reloadKey, setReloadKey] = useState(0);
  const latestRequestRef = useRef(0);

  useEffect(() => {
    setDraft(filterDraftFromSearch(search));
  }, [search.q, search.sort, search.status]);

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
  }, [admin.adminUserId]);

  useEffect(() => {
    if (applicationsState.status !== "loaded" || search.appKey || applicationsState.applications.length === 0) {
      return;
    }
    const firstApplication = applicationsState.applications[0];
    if (!firstApplication) {
      return;
    }
    updateSearch({ appKey: firstApplication.appKey, page: 1, sheet: undefined });
  }, [applicationsState, search.appKey]);

  useEffect(() => {
    if (!search.appKey) {
      setPermissionState({ status: "idle" });
      return;
    }

    const requestSeq = latestRequestRef.current + 1;
    latestRequestRef.current = requestSeq;
    setPermissionState({ status: "loading" });

    void Promise.all([fetchPermissionGroups(search.appKey), fetchIamRoles(search.appKey)])
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
  }, [admin.adminUserId, reloadKey, search.appKey]);

  const selectedApplication =
    applicationsState.status === "loaded"
      ? applicationsState.applications.find((application) => application.appKey === search.appKey)
      : undefined;
  const groups = permissionState.status === "loaded" ? permissionState.groups : [];
  const roles = permissionState.status === "loaded" ? permissionState.roles : [];
  const groupsById = useMemo(() => new Map(groups.map((group) => [group.id, group])), [groups]);
  const filteredRoles = useMemo(() => filterAndSortRoles(roles, search), [roles, search.q, search.sort, search.status]);
  const pagedRoles = useMemo(() => paginateRows(filteredRoles, search.page, search.pageSize), [filteredRoles, search.page, search.pageSize]);
  const roleSheetId = parseRoleSheetId(search.sheet);
  const selectedRole = roleSheetId ? roles.find((role) => role.id === roleSheetId) ?? null : null;
  const roleMissing = Boolean(roleSheetId && permissionState.status === "loaded" && !selectedRole);
  const columns = useMemo(
    () =>
      createPermissionRoleColumns({
        permissionGroupsById: groupsById,
        onAction: handleRowAction,
      }),
    [groupsById, search],
  );

  function updateSearch(next: Partial<PermissionSearchState>) {
    setSearchParams(serializePermissionSearch({ ...search, ...next }));
  }

  function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    updateSearch({
      q: cleanDraft(draft.q),
      status: draft.status,
      sort: draft.sort,
      page: 1,
      sheet: undefined,
    });
  }

  function handleRowAction(action: PermissionRoleRowAction) {
    if (!search.appKey) {
      return;
    }
    const from = `${location.pathname}${location.search}`;
    void navigate(
      `/admin/permissions/${encodeURIComponent(search.appKey)}/roles/${encodeURIComponent(action.role.id)}?from=${encodeURIComponent(from)}`,
    );
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
        description="按应用查看 IAM 角色，并进入详情维护组织、用户和权限组授权。角色元数据在应用管理维护。"
        title="权限管理"
      />

      <section className="flex flex-1 flex-col gap-4 p-6">
        <h2 className="sr-only">IAM 角色授权</h2>
        {applicationsState.status === "failed" ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
            {applicationsState.forbidden ? "当前管理员无权查看应用列表。" : applicationsState.message}
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
                <option value="">请选择应用</option>
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
                placeholder="搜索角色名称 / key / 描述"
                value={draft.q}
                onChange={(event) => { setDraft((current) => ({ ...current, q: event.target.value })); }}
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

          <DataTable
            aria-label="IAM 角色清单"
            columns={columns}
            emptyText={selectedApplication ? "暂无 IAM 角色" : "请选择应用后查看 IAM 角色"}
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
                  aria-label={`查看 ${role.key} 详情`}
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() => { handleRowAction({ type: "detail", role }); }}
                >
                  查看详情
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

      <PermissionRoleDetailSheet
        appKey={search.appKey}
        permissionGroups={groups}
        onOpenChange={(open) => {
          if (!open) {
            setSearchParams(closeSheet(searchParams));
          }
        }}
        onSaved={() => { setReloadKey((current) => current + 1); }}
        open={Boolean(roleSheetId && (selectedRole || roleMissing))}
        permissionGroupsById={groupsById}
        readOnly={selectedApplication?.status !== "active" || selectedRole?.status === "disabled"}
        readOnlyReason={
          selectedApplication?.status !== "active"
            ? "当前应用已停用，权限管理只读。"
            : selectedRole?.status === "disabled"
              ? "当前角色已停用，权限管理只读。"
              : undefined
        }
        role={selectedRole}
        roleMissing={roleMissing}
      />
    </main>
  );
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
  const filtered = roles.filter((role) => {
    const matchesKeyword = keyword
      ? [role.name, role.key, role.description ?? ""].some((value) => value.toLowerCase().includes(keyword))
      : true;
    const matchesStatus =
      search.status === "all" ||
      (search.status === "enabled" && role.status === "active") ||
      (search.status === "disabled" && role.status === "disabled");
    return matchesKeyword && matchesStatus;
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

function parseRoleSheetId(sheet: PermissionSearchState["sheet"]): string | undefined {
  return sheet?.startsWith("role:") ? sheet.slice("role:".length) : undefined;
}

function cleanDraft(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function isForbiddenError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "status" in error && Number((error as { status?: unknown }).status) === 403;
}
