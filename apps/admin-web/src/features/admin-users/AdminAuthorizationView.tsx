import { Plus, Search } from "lucide-react";
import type { SyntheticEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { AdminMe } from "../../admin-types";
import {
  createAdminUser,
  disableAdminUser,
  enableAdminUser,
  fetchAdminUsers,
  updateAdminUserAuthorization,
} from "../../api/admin";
import type { AdminUser } from "../../api/admin";
import { fetchApplications } from "../../api/permission";
import type { Application } from "../../api/permission";
import { ConfirmDialog } from "../../components/admin/ConfirmDialog";
import { DataTable } from "../../components/admin/DataTable";
import { FilterBar } from "../../components/admin/FilterBar";
import { PageHeader } from "../../components/admin/PageHeader";
import { PageState } from "../../components/admin/PageState";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  closeSheet,
  parseAdminUserSearch,
  serializeAdminUserSearch,
} from "../../routes/admin-url-state";
import type {
  AdminUserRoleFilter,
  AdminUserSearchState,
  AdminUserStatusFilter,
} from "../../routes/admin-url-state";
import { AdminUserDetailSheet } from "./AdminUserDetailSheet";
import { AdminUserFormDialog } from "./AdminUserFormDialog";
import type { AdminUserRowAction } from "./admin-user-columns";
import { createAdminUserColumns } from "./admin-user-columns";
import {
  formatAdminRoleLabel,
  formatApplicationScopes,
  hasAdminUserFormErrors,
  isReadonlyAdminUser,
  makeCreateAdminUserDraft,
  makeEditAdminUserDraft,
  toCreateAdminUserPayload,
  toUpdateAdminUserPayload,
  validateAdminUserDraft,
} from "./admin-user-form";
import type { AdminUserDraft } from "./admin-user-form";

export type AdminAuthorizationViewProps = {
  admin: AdminMe;
};

type AdminUsersState =
  | { status: "loading" }
  | { status: "loaded"; users: AdminUser[]; applications: Application[] }
  | { status: "failed"; message: string; forbidden: boolean };

type FilterDraft = {
  q: string;
  role: AdminUserRoleFilter;
  status: AdminUserStatusFilter;
};

type DialogState = { draft: AdminUserDraft } | null;
type StatusConfirmation = { action: "enable" | "disable"; adminUser: AdminUser } | null;

export function AdminAuthorizationView({ admin }: AdminAuthorizationViewProps) {
  const canManage = admin.roles.includes("platform_admin");
  const [searchParams, setSearchParams] = useSearchParams();
  const search = parseAdminUserSearch(searchParams);
  const [draft, setDraft] = useState<FilterDraft>(() => filterDraftFromSearch(search));
  const [state, setState] = useState<AdminUsersState>({ status: "loading" });
  const [dialogState, setDialogState] = useState<DialogState>(null);
  const [dialogPending, setDialogPending] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [statusConfirmation, setStatusConfirmation] = useState<StatusConfirmation>(null);
  const [statusPending, setStatusPending] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setDraft(filterDraftFromSearch(search));
  }, [search.q, search.role, search.status]);

  useEffect(() => {
    if (!canManage) {
      return;
    }

    setState({ status: "loading" });
    void Promise.all([fetchAdminUsers(), fetchApplications()])
      .then(([usersResult, applications]) => {
        setState({ status: "loaded", users: usersResult.items, applications });
      })
      .catch((error: unknown) => {
        setState({
          status: "failed",
          message: error instanceof Error ? error.message : "无法读取管理员授权",
          forbidden: isForbiddenError(error),
        });
      });
  }, [admin.adminUserId, canManage]);

  const users = state.status === "loaded" ? state.users : [];
  const filteredUsers = useMemo(() => filterAdminUsers(users, search), [users, search.q, search.role, search.status]);
  const selectedAdminUserId = parseAdminUserSheetId(search.sheet);
  const selectedAdminUser = selectedAdminUserId ? users.find((user) => user.id === selectedAdminUserId) ?? null : null;
  const roleMissing = Boolean(selectedAdminUserId && state.status === "loaded" && !selectedAdminUser);
  const columns = useMemo(() => createAdminUserColumns({ onAction: handleRowAction }), [search]);

  function updateSearch(next: Partial<AdminUserSearchState>) {
    setSearchParams(serializeAdminUserSearch({ ...search, ...next }));
  }

  function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccessMessage(null);
    updateSearch({
      q: cleanDraft(draft.q),
      role: draft.role,
      status: draft.status,
      sheet: undefined,
    });
  }

  function handleRowAction(action: AdminUserRowAction) {
    setSuccessMessage(null);
    if (action.type === "detail") {
      updateSearch({ sheet: `admin:${action.adminUser.id}` });
      return;
    }
    if (action.type === "edit") {
      openEditDialog(action.adminUser);
      return;
    }
    setStatusError(null);
    setStatusConfirmation({ action: action.type, adminUser: action.adminUser });
  }

  function openCreateDialog() {
    setDialogState({ draft: makeCreateAdminUserDraft() });
    setDialogError(null);
    setSuccessMessage(null);
  }

  function openEditDialog(adminUser: AdminUser) {
    const draft = makeEditAdminUserDraft(adminUser);
    if (!draft) {
      return;
    }
    setDialogState({ draft });
    setDialogError(null);
    setSuccessMessage(null);
  }

  function upsertAdminUser(adminUser: AdminUser) {
    setState((current) => {
      if (current.status !== "loaded") {
        return current;
      }
      const exists = current.users.some((item) => item.id === adminUser.id);
      return {
        ...current,
        users: exists
          ? current.users.map((item) => (item.id === adminUser.id ? adminUser : item))
          : [adminUser, ...current.users],
      };
    });
  }

  async function submitDialog() {
    if (!dialogState || dialogPending) {
      return;
    }
    const errors = validateAdminUserDraft(dialogState.draft);
    if (hasAdminUserFormErrors(errors)) {
      return;
    }

    setDialogPending(true);
    setDialogError(null);
    setSuccessMessage(null);
    try {
      if (dialogState.draft.mode === "create") {
        const created = await createAdminUser(toCreateAdminUserPayload(dialogState.draft));
        upsertAdminUser(created);
        setDialogState(null);
        updateSearch({ sheet: undefined });
        setSuccessMessage(`已新增${formatAdminRoleLabel(created.roles)}：${created.displayName || created.feishuUserId}`);
      } else {
        const updated = await updateAdminUserAuthorization(
          dialogState.draft.adminUserId ?? "",
          toUpdateAdminUserPayload(dialogState.draft),
        );
        upsertAdminUser(updated);
        setDialogState(null);
      }
    } catch (error: unknown) {
      setDialogError(error instanceof Error ? error.message : "无法保存管理员授权");
    } finally {
      setDialogPending(false);
    }
  }

  async function confirmStatusChange() {
    if (!statusConfirmation || statusPending) {
      return;
    }
    setStatusPending(true);
    setStatusError(null);
    try {
      const updated =
        statusConfirmation.action === "enable"
          ? await enableAdminUser(statusConfirmation.adminUser.id)
          : await disableAdminUser(statusConfirmation.adminUser.id);
      upsertAdminUser(updated);
      setSuccessMessage(null);
      setStatusConfirmation(null);
    } catch (error: unknown) {
      setStatusError(error instanceof Error ? error.message : "无法切换管理员状态");
    } finally {
      setStatusPending(false);
    }
  }

  const applications = state.status === "loaded" ? state.applications : [];
  const statusCopy = statusConfirmation ? statusActionCopy[statusConfirmation.action] : null;

  return (
    <main className="flex min-h-full flex-col bg-muted/20" role="main" aria-label="管理员授权">
      <PageHeader
        breadcrumbs={[
          { label: "后台", href: "/admin/workspace" },
          { label: "系统管理", href: "/admin/system/info" },
          { label: "管理员授权", current: true },
        ]}
        description="维护 Feishu IAM 管理后台管理员身份、角色和应用范围。"
        primaryAction={
          canManage ? (
            <Button type="button" onClick={openCreateDialog}>
              <Plus aria-hidden="true" size={16} />
              新增管理员
            </Button>
          ) : null
        }
        title="管理员授权"
      />

      <section className="flex flex-1 flex-col gap-4 p-6">
        {!canManage ? (
          <PageState
            type="forbidden"
            title="没有权限"
            description="当前管理员无权管理管理员授权"
          />
        ) : (
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <FilterBar
              actions={
                <Button type="submit">
                  <Search aria-hidden="true" size={16} />
                  查询
                </Button>
              }
              onReset={() => {
                setSuccessMessage(null);
                setSearchParams(serializeAdminUserSearch({ role: "all", status: "all", sheet: undefined }));
              }}
            >
              <label className="grid gap-1.5 text-sm font-medium text-foreground">
                <span>管理员搜索</span>
                <Input
                  aria-label="管理员搜索"
                  placeholder="搜索姓名 / user_id / 角色 / 应用范围"
                  value={draft.q}
                  onChange={(event) => {
                    setDraft((current) => ({ ...current, q: event.target.value }));
                  }}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-foreground">
                <span>角色筛选</span>
                <select
                  aria-label="角色筛选"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
                  value={draft.role}
                  onChange={(event) => {
                    setDraft((current) => ({ ...current, role: event.target.value as AdminUserRoleFilter }));
                  }}
                >
                  <option value="all">全部角色</option>
                  <option value="platform_admin">平台管理员</option>
                  <option value="application_admin">应用管理员</option>
                  <option value="readonly">历史只读</option>
                </select>
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-foreground">
                <span>状态筛选</span>
                <select
                  aria-label="状态筛选"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
                  value={draft.status}
                  onChange={(event) => {
                    setDraft((current) => ({ ...current, status: event.target.value as AdminUserStatusFilter }));
                  }}
                >
                  <option value="all">全部状态</option>
                  <option value="active">启用</option>
                  <option value="disabled">停用</option>
                </select>
              </label>
            </FilterBar>

            {successMessage ? (
              <div role="status" className="rounded-md border border-[hsl(var(--status-success))]/30 bg-[hsl(var(--status-success))]/10 px-4 py-3 text-sm text-foreground">
                {successMessage}
              </div>
            ) : null}

            <DataTable
              aria-label="管理员授权清单"
              columns={columns}
              emptyText={state.status === "loaded" && users.length > 0 ? "没有符合筛选条件的管理员" : "暂无管理员授权记录"}
              error={state.status === "failed" && !state.forbidden ? state.message : null}
              forbidden={state.status === "failed" && state.forbidden ? "当前管理员无权管理管理员授权" : false}
              getRowKey={(adminUser) => adminUser.id}
              loading={state.status === "loading"}
              rows={filteredUsers}
            />
          </form>
        )}
      </section>

      <AdminUserDetailSheet
        adminUser={selectedAdminUser}
        roleMissing={roleMissing}
        open={Boolean(selectedAdminUserId && (selectedAdminUser || roleMissing))}
        onDisable={(adminUser) => {
          setStatusConfirmation({ action: "disable", adminUser });
        }}
        onEdit={openEditDialog}
        onEnable={(adminUser) => {
          setStatusConfirmation({ action: "enable", adminUser });
        }}
        onOpenChange={(open) => {
          if (!open) {
            setSearchParams(closeSheet(searchParams));
          }
        }}
      />

      {dialogState ? (
        <AdminUserFormDialog
          applications={applications}
          draft={dialogState.draft}
          error={dialogError}
          onDraftChange={(nextDraft) => {
            setDialogState({ draft: nextDraft });
            setDialogError(null);
          }}
          onOpenChange={(open) => {
            if (!open) {
              setDialogState(null);
              setDialogError(null);
            }
          }}
          onSubmit={() => {
            void submitDialog();
          }}
          open
          pending={dialogPending}
        />
      ) : null}

      <ConfirmDialog
        danger={statusConfirmation?.action === "disable"}
        description={
          statusConfirmation && statusCopy
            ? `${statusCopy.verb}管理员“${statusConfirmation.adminUser.displayName || statusConfirmation.adminUser.feishuUserId}”后，${statusCopy.description}。该操作会写入审计日志，可通过操作审计追溯操作者、目标管理员和执行结果。${statusError ? ` ${statusError}` : ""}`
            : ""
        }
        onConfirm={() => {
          void confirmStatusChange();
        }}
        onOpenChange={(open) => {
          if (!open && !statusPending) {
            setStatusConfirmation(null);
            setStatusError(null);
          }
        }}
        open={Boolean(statusConfirmation)}
        pending={statusPending}
        title={statusCopy?.title ?? "确认操作"}
      />
    </main>
  );
}

const statusActionCopy = {
  enable: {
    title: "确认启用管理员",
    verb: "启用",
    description: "该用户可重新进入 Feishu IAM 管理后台并按授权范围操作",
  },
  disable: {
    title: "确认停用管理员",
    verb: "停用",
    description: "该用户将不能继续使用对应管理员权限访问 Feishu IAM 管理后台",
  },
} as const;

function filterDraftFromSearch(search: AdminUserSearchState): FilterDraft {
  return {
    q: search.q ?? "",
    role: search.role,
    status: search.status,
  };
}

function filterAdminUsers(users: AdminUser[], search: AdminUserSearchState): AdminUser[] {
  const query = (cleanDraft(search.q ?? "") ?? "").toLowerCase();
  return users.filter((user) => {
    const status = user.status ?? "active";
    const matchesStatus = search.status === "all" || status === search.status;
    const matchesRole = matchesRoleFilter(user, search.role);
    const searchableText = [
      user.displayName,
      user.feishuUserId,
      formatAdminRoleLabel(user.roles),
      formatApplicationScopes(user.applicationScopes),
    ]
      .join(" ")
      .toLowerCase();
    return matchesStatus && matchesRole && (query.length === 0 || searchableText.includes(query));
  });
}

function matchesRoleFilter(user: AdminUser, role: AdminUserRoleFilter): boolean {
  if (role === "all") {
    return true;
  }
  if (role === "readonly") {
    return isReadonlyAdminUser(user);
  }
  return user.roles.length === 1 && user.roles[0]?.roleKey === role;
}

function parseAdminUserSheetId(sheet: AdminUserSearchState["sheet"]): string | undefined {
  return sheet?.startsWith("admin:") ? sheet.slice("admin:".length) : undefined;
}

function cleanDraft(value: string): string | undefined {
  const cleaned = value.trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

function isForbiddenError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "status" in error && (error as { status?: unknown }).status === 403;
}
