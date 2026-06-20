import { Eye, Plus, Search } from "lucide-react";
import type { SyntheticEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useLocation, useNavigate } from "react-router-dom";
import type { AdminMe } from "../../admin-types";
import {
  disableApplication,
  enableApplication,
  fetchApplicationPage,
} from "../../api/permission";
import type {
  Application,
  ApplicationOnboardingPackage,
} from "../../api/permission";
import { ConfirmDialog } from "../../components/admin/ConfirmDialog";
import { DataTable } from "../../components/admin/DataTable";
import { FilterBar } from "../../components/admin/FilterBar";
import { PageHeader } from "../../components/admin/PageHeader";
import { StatusBadge } from "../../components/admin/StatusBadge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  closeSheet,
  parseApplicationSearch,
  serializeApplicationSearch,
} from "../../routes/admin-url-state";
import type { ApplicationSearchState } from "../../routes/admin-url-state";
import { ApplicationCreateDialog } from "./ApplicationCreateDialog";
import { ApplicationDetailSheet } from "./ApplicationDetailSheet";
import type { StatusAction } from "./ApplicationDetailSheet";
import type { OpenApplicationRecordsOptions } from "./ApplicationDetailSheet";

export type ApplicationManagementViewProps = {
  admin: AdminMe;
  initialAppKey?: string | null;
  onManagePermissions: (appKey: string) => void;
  onOpenRecords: (applicationId: string, options?: OpenApplicationRecordsOptions) => void;
};

type ApplicationListState =
  | { status: "loading" }
  | { status: "loaded"; items: Application[]; total: number }
  | { status: "failed"; message: string; forbidden: boolean };

type FilterDraft = {
  q: string;
  status: ApplicationSearchState["status"];
};

export function ApplicationManagementView({
  admin,
  initialAppKey,
  onOpenRecords,
}: ApplicationManagementViewProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const search = withInitialAppKey(
    parseApplicationSearch(searchParams),
    initialAppKey,
  );
  const [draft, setDraft] = useState<FilterDraft>(() =>
    filterDraftFromSearch(search),
  );
  const [state, setState] = useState<ApplicationListState>({
    status: "loading",
  });
  const [createdApplication, setCreatedApplication] =
    useState<Application | null>(null);
  const [statusConfirmation, setStatusConfirmation] = useState<{
    action: StatusAction;
    application: Application;
  } | null>(null);
  const [statusPending, setStatusPending] = useState(false);
  const [statusError, setStatusError] = useState<string>();
  const [reloadKey, setReloadKey] = useState(0);
  const latestRequestRef = useRef(0);

  useEffect(() => {
    setDraft(filterDraftFromSearch(search));
  }, [search.q, search.status]);

  useEffect(() => {
    const requestSeq = latestRequestRef.current + 1;
    latestRequestRef.current = requestSeq;
    setState({ status: "loading" });

    void fetchApplicationPage({
      page: search.page,
      pageSize: search.pageSize,
      query: search.q,
      status: search.status,
    })
      .then((pageResult) => {
        if (latestRequestRef.current !== requestSeq) {
          return;
        }
        setState({
          status: "loaded",
          items: pageResult.items,
          total:
            typeof pageResult.total === "number"
              ? pageResult.total
              : pageResult.items.length,
        });
      })
      .catch((error: unknown) => {
        if (latestRequestRef.current !== requestSeq) {
          return;
        }
        setState({
          status: "failed",
          message: error instanceof Error ? error.message : "无法读取应用列表",
          forbidden: isForbiddenError(error),
        });
      });
  }, [
    admin.adminUserId,
    reloadKey,
    search.page,
    search.pageSize,
    search.q,
    search.status,
    search.sort,
  ]);

  const rows = state.status === "loaded" ? state.items : [];
  const detailAppKey = parseDetailAppKey(search.sheet);
  const selectedApplication = useMemo(
    () =>
      rows.find((application) => application.appKey === detailAppKey) ??
      (createdApplication && createdApplication.appKey === detailAppKey
        ? createdApplication
        : undefined),
    [createdApplication, detailAppKey, rows],
  );
  const columns = useMemo(
    () => [
      {
        key: "application",
        header: "应用",
        minWidth: "220px",
        render: (application: Application) => (
          <div className="grid min-w-0 gap-1">
            <span className="font-medium text-foreground">
              {application.name}
            </span>
            <span className="break-all text-xs text-muted-foreground">
              {application.description ?? "暂无描述"}
            </span>
          </div>
        ),
      },
      {
        key: "appKey",
        header: "app_key",
        minWidth: "180px",
        render: (application: Application) => (
          <code className="break-all rounded bg-muted px-2 py-1 text-xs">
            {application.appKey}
          </code>
        ),
      },
      {
        key: "integration",
        header: "接入完整度",
        minWidth: "220px",
        render: (application: Application) => (
          <IntegrationSummaryCell application={application} />
        ),
      },
      {
        key: "status",
        header: "状态",
        width: "96px",
        nowrap: true,
        render: (application: Application) => (
          <StatusBadge
            tone={application.status === "active" ? "success" : "muted"}
          >
            {formatEntityStatus(application.status)}
          </StatusBadge>
        ),
      },
      {
        key: "owner",
        header: "负责人",
        minWidth: "120px",
        render: (application: Application) =>
          application.ownerUserId ?? "未配置",
      },
      {
        key: "updatedAt",
        header: "更新时间",
        minWidth: "160px",
        nowrap: true,
        render: (application: Application) =>
          formatDateTime(application.updatedAt),
      },
      {
        key: "actions",
        header: "操作",
        width: "112px",
        nowrap: true,
        render: (application: Application) => (
          <Button
            aria-label={`查看 ${application.appKey} 详情`}
            className="h-8 w-8 min-h-8 p-0"
            size="sm"
            title="详情"
            type="button"
            variant="outline"
            onClick={() => {
              const from = `${location.pathname}${location.search}`;
              void navigate(
                `/admin/applications/${encodeURIComponent(application.appKey)}?from=${encodeURIComponent(from)}`,
              );
            }}
          >
            <Eye aria-hidden="true" size={16} />
          </Button>
        ),
      },
    ],
    [location.pathname, location.search, navigate, search],
  );

  function updateSearch(next: Partial<ApplicationSearchState>) {
    setSearchParams(serializeApplicationSearch({ ...search, ...next }));
  }

  function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    updateSearch({
      q: cleanDraft(draft.q),
      status: draft.status,
      page: 1,
      sheet: undefined,
    });
  }

  function handleCreated(createdPackage: ApplicationOnboardingPackage) {
    setCreatedApplication(createdPackage.application);
    setReloadKey((current) => current + 1);
  }

  function handleApplicationChanged(updatedApplication: Application) {
    setCreatedApplication((current) =>
      current?.appKey === updatedApplication.appKey
        ? updatedApplication
        : current,
    );
    setState((current) =>
      current.status === "loaded"
        ? {
            ...current,
            items: current.items.map((application) =>
              application.appKey === updatedApplication.appKey
                ? updatedApplication
                : application,
            ),
          }
        : current,
    );
  }

  async function handleStatusConfirm() {
    if (!statusConfirmation) {
      return;
    }

    setStatusPending(true);
    setStatusError(undefined);
    try {
      const updated =
        statusConfirmation.action === "enable"
          ? await enableApplication(statusConfirmation.application.appKey)
          : await disableApplication(statusConfirmation.application.appKey);
      handleApplicationChanged(updated);
      setStatusConfirmation(null);
    } catch (error: unknown) {
      setStatusError(
        error instanceof Error ? error.message : "无法更新应用状态",
      );
    } finally {
      setStatusPending(false);
    }
  }

  const statusConfirmCopy = statusConfirmation
    ? statusActionCopy[statusConfirmation.action]
    : null;

  return (
    <main
      className="flex min-h-full flex-col bg-muted/20"
      aria-label="应用管理"
    >
      <PageHeader
        breadcrumbs={[
          { label: "后台", href: "/admin/workspace" },
          { label: "应用管理", current: true },
        ]}
        description="管理应用、应用级回调地址、OAuth 凭证、开发者凭证和接入提示词。"
        primaryAction={
          <Button
            type="button"
            onClick={() => {
              updateSearch({ sheet: "create" });
            }}
          >
            <Plus aria-hidden="true" size={16} />
            新增应用
          </Button>
        }
        title="应用管理"
      />

      <section className="flex flex-1 flex-col gap-4 p-6">
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
                page: 1,
                sheet: undefined,
              });
            }}
          >
            <label className="grid gap-1.5 text-sm font-medium text-foreground">
              <span>应用查询</span>
              <Input
                aria-label="应用查询"
                placeholder="搜索应用名称 / app_key / owner"
                value={draft.q}
                onChange={(event) => {
                  setDraft((current) => ({
                    ...current,
                    q: event.target.value,
                  }));
                }}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-foreground">
              <span>状态</span>
              <select
                aria-label="应用状态"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
                value={draft.status}
                onChange={(event) => {
                  setDraft((current) => ({
                    ...current,
                    status: event.target.value as FilterDraft["status"],
                  }));
                }}
              >
                <option value="all">全部</option>
                <option value="active">启用</option>
                <option value="disabled">停用</option>
              </select>
            </label>
          </FilterBar>

          <DataTable
            aria-label="应用清单"
            columns={columns}
            emptyText="暂无应用"
            error={
              state.status === "failed" && !state.forbidden
                ? state.message
                : null
            }
            forbidden={
              state.status === "failed" && state.forbidden
                ? "当前管理员无权查看应用清单。"
                : false
            }
            getRowKey={(application) => application.id}
            loading={state.status === "loading"}
            mobileCard={{
              title: (application) => application.name,
              description: (application) => (
                <code className="break-all rounded bg-muted px-2 py-1 text-xs">
                  {application.appKey}
                </code>
              ),
              fields: [
                {
                  label: "状态",
                  render: (application) => (
                    <StatusBadge
                      tone={
                        application.status === "active" ? "success" : "muted"
                      }
                    >
                      {formatEntityStatus(application.status)}
                    </StatusBadge>
                  ),
                },
                {
                  label: "负责人",
                  render: (application) =>
                    application.ownerUserId ?? "未配置",
                },
                {
                  label: "更新时间",
                  render: (application) =>
                    formatDateTime(application.updatedAt),
                },
                {
                  label: "接入",
                  render: (application) => (
                    <IntegrationSummaryCell application={application} />
                  ),
                },
              ],
              actions: (application) => (
                <Button
                  aria-label={`查看 ${application.appKey} 详情`}
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const from = `${location.pathname}${location.search}`;
                    void navigate(
                      `/admin/applications/${encodeURIComponent(application.appKey)}?from=${encodeURIComponent(from)}`,
                    );
                  }}
                >
                  查看详情
                </Button>
              ),
            }}
            rows={rows}
          />

          {state.status === "loaded" ? (
            <PaginationBar
              page={search.page}
              pageSize={search.pageSize}
              total={state.total}
              onPageChange={(page) => {
                updateSearch({ page, sheet: undefined });
              }}
              onPageSizeChange={(pageSize) => {
                updateSearch({ page: 1, pageSize, sheet: undefined });
              }}
            />
          ) : null}
        </form>
      </section>

      <ApplicationCreateDialog
        defaultOwnerUserId={admin.feishuUserId}
        open={search.sheet === "create"}
        onCreated={handleCreated}
        onOpenChange={(open) => {
          if (!open) {
            setSearchParams(closeSheet(searchParams));
          } else {
            updateSearch({ sheet: "create" });
          }
        }}
      />

      <ApplicationDetailSheet
        application={selectedApplication}
        open={Boolean(detailAppKey && selectedApplication)}
        onApplicationChanged={handleApplicationChanged}
        onOpenRecords={onOpenRecords}
        onRequestStatusChange={(action, application) => {
          setStatusError(undefined);
          setStatusConfirmation({ action, application });
        }}
        onOpenChange={(open) => {
          if (!open) {
            setSearchParams(closeSheet(searchParams));
          }
        }}
        statusError={statusError}
        statusPending={statusPending}
      />

      {statusConfirmCopy ? (
        <ConfirmDialog
          danger={statusConfirmation?.action === "disable"}
          description={statusConfirmCopy.description}
          onConfirm={() => void handleStatusConfirm()}
          onOpenChange={(open) => {
            if (!open && !statusPending) {
              setStatusConfirmation(null);
            }
          }}
          open
          pending={statusPending}
          title={statusConfirmCopy.title}
        />
      ) : null}
    </main>
  );
}

function PaginationBar(props: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
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
          onChange={(event) => {
            props.onPageSizeChange(Number(event.target.value));
          }}
        >
          <option value={10}>10 条/页</option>
          <option value={20}>20 条/页</option>
          <option value={50}>50 条/页</option>
        </select>
        <Button
          disabled={props.page <= 1}
          onClick={() => {
            props.onPageChange(props.page - 1);
          }}
          size="sm"
          type="button"
          variant="outline"
        >
          上一页
        </Button>
        <Button
          disabled={props.page >= pageCount}
          onClick={() => {
            props.onPageChange(props.page + 1);
          }}
          size="sm"
          type="button"
          variant="outline"
        >
          下一页
        </Button>
      </div>
    </div>
  );
}

function filterDraftFromSearch(search: ApplicationSearchState): FilterDraft {
  return {
    q: search.q ?? "",
    status: search.status,
  };
}

function withInitialAppKey(
  search: ApplicationSearchState,
  initialAppKey?: string | null,
): ApplicationSearchState {
  if (search.sheet || !initialAppKey?.trim()) {
    return search;
  }
  return { ...search, sheet: `app:${initialAppKey.trim()}` };
}

function parseDetailAppKey(
  sheet: ApplicationSearchState["sheet"],
): string | undefined {
  return sheet?.startsWith("app:") ? sheet.slice("app:".length) : undefined;
}

function cleanDraft(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function formatEntityStatus(status: string): string {
  const labels: Record<string, string> = {
    active: "启用",
    disabled: "停用",
  };
  return labels[status] ?? status;
}

function formatDateTime(value?: string | null): string {
  if (!value) {
    return "尚未记录";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

function isForbiddenError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    Number((error as { status?: unknown }).status) === 403
  );
}

const statusActionCopy: Record<
  StatusAction,
  { title: string; description: string }
> = {
  enable: {
    title: "确认启用应用",
    description:
      "启用后该应用可以继续用于接入、授权和凭证校验，该操作会写入审计日志。",
  },
  disable: {
    title: "确认停用应用",
    description:
      "停用后该应用的授权、换取 token、userinfo、权限查询和 developer API 都会被阻断；配置、凭证摘要和角色元数据保留可读。该操作会写入审计日志。",
  },
};

function IntegrationSummaryCell({ application }: { application: Application }) {
  const summary = application.integrationSummary;
  if (!summary) {
    return <span className="text-sm text-muted-foreground">详情中查看</span>;
  }
  const missing: string[] = [];
  if (summary.activeRedirectUriCount === 0) {
    missing.push("回调地址");
  }
  if (summary.activeOauthClientCount === 0) {
    missing.push("OAuth client");
  }
  if (summary.activeDeveloperCredentialCount === 0) {
    missing.push("developer credential");
  }
  const ready = missing.length === 0;
  return (
    <div className="grid gap-1 text-sm">
      <span
        className={
          ready
            ? "text-[hsl(var(--status-success))]"
            : "text-[hsl(var(--status-warning))]"
        }
      >
        {ready ? "接入配置完整" : `缺少 ${missing.join("、")}`}
      </span>
      <span className="text-xs text-muted-foreground">
        回调 {summary.activeRedirectUriCount}/{summary.redirectUriCount} · OAuth{" "}
        {summary.activeOauthClientCount}/{summary.oauthClientCount} · API{" "}
        {summary.activeDeveloperCredentialCount}/
        {summary.developerCredentialCount} · 关联角色 {summary.activeIamRoleCount}/
        {summary.iamRoleCount}
      </span>
    </div>
  );
}
