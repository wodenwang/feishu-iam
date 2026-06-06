import { ArrowLeft, Building2, ChevronRight, Search, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { PageResult } from "../../api/feishu";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import type {
  OrgBrowserDepartment,
  OrgBrowserLoadDepartments,
  OrgBrowserLoadUsers,
  OrgBrowserSelectionMeta,
  OrgBrowserUser,
} from "./org-browser-types";

const PAGE_SIZE = 20;

export type OrgBrowserProps = {
  title: string;
  description?: string;
  loadDepartments: OrgBrowserLoadDepartments;
  loadUsers: OrgBrowserLoadUsers;
  enabled?: boolean;
  readonly?: boolean;
  readonlyListDescription?: string;
  selectedDepartmentIds?: string[];
  selectedUserIds?: string[];
  onSelectDepartment?: (department: OrgBrowserDepartment, meta: OrgBrowserSelectionMeta) => void;
  onSelectUser?: (user: OrgBrowserUser, meta: OrgBrowserSelectionMeta) => void;
  onInspectDepartment?: (department: OrgBrowserDepartment) => void;
  onInspectUser?: (user: OrgBrowserUser) => void;
};

type BrowserState = {
  departments: OrgBrowserDepartment[];
  users: OrgBrowserUser[];
  page: number;
  totalDepartments: number;
  totalUsers: number;
  loading: boolean;
  error?: string;
};

export function OrgBrowser(props: OrgBrowserProps) {
  const [keyword, setKeyword] = useState("");
  const [activeDepartment, setActiveDepartment] = useState<OrgBrowserDepartment | null>(null);
  const [stack, setStack] = useState<OrgBrowserDepartment[]>([]);
  const [state, setState] = useState<BrowserState>({
    departments: [],
    users: [],
    page: 1,
    totalDepartments: 0,
    totalUsers: 0,
    loading: true,
  });
  const selectedDepartments = useMemo(() => new Set(props.selectedDepartmentIds ?? []), [props.selectedDepartmentIds]);
  const selectedUsers = useMemo(() => new Set(props.selectedUserIds ?? []), [props.selectedUserIds]);
  const hasMore = state.departments.length < state.totalDepartments || state.users.length < state.totalUsers;
  const enabled = props.enabled ?? true;

  useEffect(() => {
    if (!enabled) {
      setState((current) => ({ ...current, loading: false, error: undefined }));
      return;
    }
    void loadPage(1, false);
  }, [activeDepartment?.departmentId, enabled]);

  async function loadPage(page: number, append: boolean) {
    if (!enabled) {
      return;
    }
    const keywordText = keyword.trim();
    const parentDepartmentId = keywordText ? undefined : activeDepartment?.departmentId ?? null;
    setState((current) => ({
      ...current,
      loading: true,
      error: undefined,
    }));
    try {
      const shouldLoadUsers = Boolean(keywordText || activeDepartment);
      const [departments, users] = await Promise.all([
        props.loadDepartments({
          parentDepartmentId,
          keyword: keywordText || undefined,
          page,
          pageSize: PAGE_SIZE,
        }),
        shouldLoadUsers
          ? props.loadUsers({
              departmentId: keywordText ? undefined : activeDepartment?.departmentId,
              keyword: keywordText || undefined,
              page,
              pageSize: PAGE_SIZE,
            })
          : Promise.resolve(emptyPage<OrgBrowserUser>(page)),
      ]);
      setState((current) => ({
        departments: append ? [...current.departments, ...departments.items] : departments.items,
        users: append ? [...current.users, ...users.items] : users.items,
        page,
        totalDepartments: departments.total,
        totalUsers: users.total,
        loading: false,
        error: undefined,
      }));
    } catch (error: unknown) {
      setState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : "无法读取组织浏览数据",
      }));
    }
  }

  function drillInto(department: OrgBrowserDepartment) {
    setStack((current) => [...current, department]);
    setActiveDepartment(department);
    props.onInspectDepartment?.(department);
  }

  function goBack() {
    const nextStack = stack.slice(0, -1);
    setStack(nextStack);
    setActiveDepartment(nextStack.at(-1) ?? null);
  }

  return (
    <section className="grid gap-3 rounded-md border bg-background p-4" aria-label={props.title}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-base font-semibold">{props.title}</h3>
          {props.description ? <p className="mt-1 text-sm text-muted-foreground">{props.description}</p> : null}
        </div>
        {activeDepartment ? (
          <Button type="button" variant="outline" onClick={goBack}>
            <ArrowLeft aria-hidden="true" size={16} />
            返回上级
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          aria-label="搜索组织或用户"
          placeholder="搜索部门、用户或 ID"
          value={keyword}
          onChange={(event) => {
            setKeyword(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              void loadPage(1, false);
            }
          }}
        />
        <Button type="button" onClick={() => void loadPage(1, false)}>
          <Search aria-hidden="true" size={16} />
          搜索
        </Button>
      </div>

      <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
        {keyword.trim()
          ? `搜索 “${keyword.trim()}”`
          : activeDepartment
            ? `组织路径：顶层 / ${stack.map((department) => department.name).join(" / ")}`
            : "组织路径：顶层组织"}
      </div>

      {state.error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4" role="alert">
          <h4 className="font-semibold text-destructive">无权限查看该组织或加载失败</h4>
          <p className="mt-1 text-sm text-destructive/90">
            {state.error}。错误态只影响当前浏览区域，不会清空已选草稿或其他排障区域。
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => void loadPage(1, false)}>
              重试
            </Button>
            {activeDepartment ? (
              <Button type="button" variant="ghost" onClick={goBack}>
                返回可见范围
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {!state.error && !state.loading && state.departments.length === 0 && state.users.length === 0 ? (
        <div className="rounded-md border bg-background px-4 py-10 text-center">
          <h4 className="font-semibold">{keyword.trim() ? "搜索无结果" : "当前组织暂无下级部门或用户"}</h4>
          <p className="mt-1 text-sm text-muted-foreground">
            可调整关键词，或返回上级组织继续浏览。
          </p>
        </div>
      ) : null}

      <CandidateList
        departments={state.departments}
        readonly={props.readonly}
        readonlyListDescription={props.readonlyListDescription}
        selectedDepartmentIds={selectedDepartments}
        selectedUserIds={selectedUsers}
        users={state.users}
        onInspectDepartment={drillInto}
        onInspectUser={props.onInspectUser}
        selectionPath={currentPathLabel(stack, activeDepartment)}
        onSelectDepartment={props.onSelectDepartment}
        onSelectUser={props.onSelectUser}
      />

      {state.loading ? <p className="text-sm text-muted-foreground">正在加载组织数据...</p> : null}
      {hasMore && !state.loading ? (
        <Button type="button" variant="outline" onClick={() => void loadPage(state.page + 1, true)}>
          加载更多
        </Button>
      ) : null}
    </section>
  );
}

function CandidateList(props: {
  departments: OrgBrowserDepartment[];
  readonly?: boolean;
  readonlyListDescription?: string;
  selectedDepartmentIds: Set<string>;
  selectedUserIds: Set<string>;
  selectionPath: string;
  users: OrgBrowserUser[];
  onInspectDepartment: (department: OrgBrowserDepartment) => void;
  onInspectUser?: (user: OrgBrowserUser) => void;
  onSelect?: (department: OrgBrowserDepartment) => void;
  onSelectDepartment?: (department: OrgBrowserDepartment, meta: OrgBrowserSelectionMeta) => void;
  onSelectUser?: (user: OrgBrowserUser, meta: OrgBrowserSelectionMeta) => void;
}) {
  const isEmpty = props.departments.length === 0 && props.users.length === 0;

  return (
    <section
      className="grid content-start gap-2 rounded-md border bg-background p-3"
      aria-label={props.readonly ? "组织用户浏览列表" : "待选组织用户列表"}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">{props.readonly ? "组织与用户列表" : "待选组织与用户"}</h4>
        <p className="text-xs text-muted-foreground">
          {props.readonly
            ? props.readonlyListDescription ?? "组织和用户在同一列表中展示，仅用于浏览本地飞书镜像。"
            : "组织和用户在同一列表中展示，保存时仍按主体类型区分。"}
        </p>
      </div>
      {isEmpty ? (
        <p className="px-3 py-8 text-center text-sm text-muted-foreground">当前范围暂无组织或用户</p>
      ) : (
        <ul className="grid max-h-[420px] gap-2 overflow-y-auto">
          {props.departments.map((department) => (
            <li className="flex flex-col gap-3 rounded-md border p-3 text-sm sm:flex-row sm:items-center sm:justify-between" key={`department:${department.departmentId}`}>
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary" aria-hidden="true">
                  <Building2 size={18} />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="break-words">{department.name}</strong>
                    <span className="rounded-md border px-1.5 py-0.5 text-xs text-muted-foreground">组织</span>
                  </div>
                  <code className="mt-1 block break-all text-xs text-muted-foreground">{department.departmentId}</code>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button
                  aria-label={`进入组织 ${department.name}`}
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() => {
                    props.onInspectDepartment(department);
                  }}
                >
                  <ChevronRight aria-hidden="true" size={16} />
                  下钻
                </Button>
                {!props.readonly && props.onSelectDepartment ? (
                  <Button
                    disabled={props.selectedDepartmentIds.has(department.departmentId)}
                    size="sm"
                    type="button"
                    onClick={() => props.onSelectDepartment?.(department, {
                      displayPath: [props.selectionPath, department.name].filter(Boolean).join(" / "),
                    })}
                  >
                    {props.selectedDepartmentIds.has(department.departmentId) ? "已选组织" : "选择组织"}
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
          {props.users.map((user) => {
            const disabled = props.selectedUserIds.has(user.userId) || user.isDeleted === true || user.isActive === false;
            return (
              <li className="flex flex-col gap-3 rounded-md border p-3 text-sm sm:flex-row sm:items-center sm:justify-between" key={`user:${user.userId}`}>
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground" aria-hidden="true">
                    <UserRound size={18} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="break-words">{user.name}</strong>
                      <span className="rounded-md border px-1.5 py-0.5 text-xs text-muted-foreground">用户</span>
                      {user.isDeleted === true || user.isActive === false ? (
                        <span className="rounded-md border border-destructive/30 bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive">不可选</span>
                      ) : null}
                    </div>
                    <code className="mt-1 block break-all text-xs text-muted-foreground">{user.userId}</code>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {props.readonly && props.onInspectUser ? (
                    <Button
                      aria-label={`查看用户 ${user.name}`}
                      size="sm"
                      type="button"
                      variant="outline"
                      onClick={() => props.onInspectUser?.(user)}
                    >
                      查看
                    </Button>
                  ) : null}
                  {!props.readonly && props.onSelectUser ? (
                    <Button
                      disabled={disabled}
                      size="sm"
                      type="button"
                      variant="outline"
                      onClick={() => props.onSelectUser?.(user, { displayPath: props.selectionPath })}
                    >
                      {props.selectedUserIds.has(user.userId) ? "已选用户" : "选择用户"}
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function emptyPage<T>(page: number): PageResult<T> {
  return {
    items: [],
    page,
    pageSize: PAGE_SIZE,
    total: 0,
  };
}

function currentPathLabel(stack: OrgBrowserDepartment[], activeDepartment: OrgBrowserDepartment | null): string {
  if (!activeDepartment) {
    return "顶层组织";
  }
  return ["顶层组织", ...stack.map((department) => department.name)].join(" / ");
}
