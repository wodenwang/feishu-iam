import { Search } from "lucide-react";
import type { SyntheticEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type {
  AdminAuditLog,
  AdminSecurityEvent,
  AdminTraceResult,
} from "../../api/admin";
import {
  fetchAdminAuditLogs,
  fetchAdminSecurityEvents,
  fetchAdminTrace,
} from "../../api/admin";
import type { FeishuSyncRun } from "../../api/feishu";
import { fetchFeishuSyncRuns } from "../../api/feishu";
import { DataTable } from "../../components/admin/DataTable";
import { DetailSheet } from "../../components/admin/DetailSheet";
import { FilterBar } from "../../components/admin/FilterBar";
import { PageHeader } from "../../components/admin/PageHeader";
import { ResponsiveTabsList } from "../../components/admin/ResponsiveTabsList";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsTrigger,
} from "../../components/ui/tabs";
import {
  closeSheet,
  parseRecordSearch,
  serializeRecordSearch,
} from "../../routes/admin-url-state";
import type {
  RecordSearchState,
  RecordTab,
} from "../../routes/admin-url-state";
import { createRecordColumns, formatResult } from "./record-columns";
import type { RecordRow } from "./record-mappers";
import {
  formatDateTime,
  formatRecordValue,
  formatRunChange,
  formatRunStatus,
  mapAuditLog,
  mapSecurityEvent,
  mapSyncRun,
} from "./record-mappers";
import { TraceResultPanel } from "./TraceResultPanel";

export type RecordQueryViewProps = {
  initialApplicationId?: string | null;
};

type RecordState =
  | { status: "loading" }
  | { status: "loaded"; rows: RecordRow[]; total: number; trace?: AdminTraceResult | null }
  | { status: "failed"; message: string; forbidden: boolean };

type FilterDraft = {
  requestId: string;
  action: string;
  applicationId: string;
  clientId: string;
  feishuUserId: string;
  from: string;
  to: string;
  result: string;
};

const tabItems: Array<{
  value: RecordTab;
  label: string;
  emptyText: string;
  detailLabel: string;
}> = [
  {
    value: "trace",
    label: "追踪",
    emptyText: "暂无追踪结果",
    detailLabel: "追踪详情",
  },
  {
    value: "audit",
    label: "审计日志",
    emptyText: "暂无审计日志",
    detailLabel: "审计日志详情",
  },
  {
    value: "security",
    label: "安全事件",
    emptyText: "暂无安全事件",
    detailLabel: "安全事件详情",
  },
  {
    value: "sync",
    label: "同步记录",
    emptyText: "暂无同步记录",
    detailLabel: "同步记录详情",
  },
  {
    value: "tokens",
    label: "登录与 Token 记录",
    emptyText: "暂无登录与 Token 记录",
    detailLabel: "token 记录详情",
  },
];
const defaultTabItem = tabItems[0] as (typeof tabItems)[number];

const loginTokenEventTypes = [
  "oauth_authorize",
  "oauth_authorize_failed",
  "oauth_token",
  "oauth_token_invalid",
  "oauth_userinfo",
  "oauth_revoke",
  "developer_api_credential_invalid",
];

export function RecordQueryView({
  initialApplicationId,
}: RecordQueryViewProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const parsedSearch = parseRecordSearch(searchParams);
  const search = withInitialApplicationId(parsedSearch, initialApplicationId);
  const [draft, setDraft] = useState<FilterDraft>(() =>
    filterDraftFromSearch(search),
  );
  const [state, setState] = useState<RecordState>({ status: "loading" });
  const latestRequestRef = useRef(0);

  useEffect(() => {
    setDraft(filterDraftFromSearch(search));
  }, [
    search.requestId,
    search.action,
    search.applicationId,
    search.clientId,
    search.feishuUserId,
    search.from,
    search.to,
    search.result,
    search.returnTo,
  ]);

  useEffect(() => {
    const requestSeq = latestRequestRef.current + 1;
    latestRequestRef.current = requestSeq;
    if (search.tab === "trace" && !hasTraceCriteria(search)) {
      setState({ status: "loaded", rows: [], total: 0, trace: null });
      return;
    }

    setState({ status: "loading" });

    void loadRecords(search)
      .then(({ rows, total, trace }) => {
        if (latestRequestRef.current !== requestSeq) {
          return;
        }
        setState({ status: "loaded", rows, total, trace });
      })
      .catch((error: unknown) => {
        if (latestRequestRef.current !== requestSeq) {
          return;
        }
        setState({
          status: "failed",
          message:
            error instanceof Error ? error.message : "无法读取操作审计数据",
          forbidden: isForbiddenError(error),
        });
      });
  }, [
    search.tab,
    search.requestId,
    search.action,
    search.applicationId,
    search.clientId,
    search.feishuUserId,
    search.from,
    search.to,
    search.result,
    search.returnTo,
    search.page,
    search.pageSize,
    search.sort,
  ]);

  const rows = state.status === "loaded" ? state.rows : [];
  const trace = state.status === "loaded" ? state.trace ?? null : null;
  const currentTab =
    tabItems.find((item) => item.value === search.tab) ?? defaultTabItem;
  const selectedRow = rows.find((row) => sheetMatchesRow(search.sheet, row));
  const columns = useMemo(
    () =>
      createRecordColumns({
        detailLabel: currentTab.detailLabel,
        onOpenDetail: (row) => {
          updateSearch({
            sheet: `${row.kind === "security" && search.tab === "tokens" ? "token" : row.kind}:${row.id}`,
          });
        },
      }),
    [currentTab.detailLabel, search],
  );

  function updateSearch(next: Partial<RecordSearchState>) {
    setSearchParams(serializeRecordSearch({ ...search, ...next }));
  }

  function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    updateSearch({
      requestId: cleanDraft(draft.requestId),
      action: cleanDraft(draft.action),
      applicationId: cleanDraft(draft.applicationId),
      clientId: cleanDraft(draft.clientId),
      feishuUserId: cleanDraft(draft.feishuUserId),
      from: cleanDraft(draft.from),
      to: cleanDraft(draft.to),
      result: cleanDraft(draft.result),
      page: 1,
      sheet: undefined,
    });
  }

  return (
    <main
      className="flex min-h-full flex-col bg-muted/20"
      aria-label="操作审计"
    >
      <PageHeader
        breadcrumbs={[
          { label: "后台", href: "/admin/workspace" },
          { label: "系统管理", href: "/admin/system/info" },
          { label: "操作审计", current: true },
        ]}
        title="操作审计"
        description="集中查询审计日志、安全事件、飞书同步记录以及登录与 Token 相关事件。"
      />

      <section className="flex flex-1 flex-col gap-4 p-6">
        <Tabs
          value={search.tab}
          onValueChange={(value) => {
            updateSearch({
              tab: value as RecordTab,
              page: 1,
              sheet: undefined,
            });
          }}
        >
          <ResponsiveTabsList aria-label="操作审计标签">
            {tabItems.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </ResponsiveTabsList>

          {tabItems.map((tab) => (
            <TabsContent key={tab.value} value={tab.value}>
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
                      requestId: undefined,
                      action: undefined,
                      applicationId: undefined,
                      clientId: undefined,
                      feishuUserId: undefined,
                      from: undefined,
                      to: undefined,
                      result: undefined,
                      page: 1,
                      sheet: undefined,
                    });
                  }}
                >
                  <FilterField
                    label="request id"
                    value={draft.requestId}
                    onChange={(value) => {
                      setDraft((current) => ({ ...current, requestId: value }));
                    }}
                  />
                  <FilterField
                    label="application id"
                    value={draft.applicationId}
                    onChange={(value) => {
                      setDraft((current) => ({
                        ...current,
                        applicationId: value,
                      }));
                    }}
                  />
                  {search.tab === "trace" ? (
                    <>
                      <FilterField
                        label="client id"
                        value={draft.clientId}
                        onChange={(value) => {
                          setDraft((current) => ({ ...current, clientId: value }));
                        }}
                      />
                      <FilterField
                        label="飞书 user_id"
                        value={draft.feishuUserId}
                        onChange={(value) => {
                          setDraft((current) => ({ ...current, feishuUserId: value }));
                        }}
                      />
                      <FilterField
                        label="from"
                        value={draft.from}
                        onChange={(value) => {
                          setDraft((current) => ({ ...current, from: value }));
                        }}
                      />
                      <FilterField
                        label="to"
                        value={draft.to}
                        onChange={(value) => {
                          setDraft((current) => ({ ...current, to: value }));
                        }}
                      />
                    </>
                  ) : (
                    <FilterField
                      label="action"
                      value={draft.action}
                      onChange={(value) => {
                        setDraft((current) => ({ ...current, action: value }));
                      }}
                    />
                  )}
                  <ResultFilter
                    value={draft.result}
                    onChange={(value) => {
                      setDraft((current) => ({ ...current, result: value }));
                    }}
                  />
                </FilterBar>

                {tab.value === "trace" ? (
                  <TraceResultPanel
                    result={search.tab === "trace" ? trace : null}
                    loading={search.tab === "trace" && state.status === "loading"}
                    error={state.status === "failed" && !state.forbidden ? state.message : null}
                    forbidden={state.status === "failed" && state.forbidden}
                    returnTo={search.returnTo}
                  />
                ) : (
                  <DataTable
                    aria-label={`${tab.label}列表`}
                    columns={columns}
                    emptyText={tab.emptyText}
                    error={
                      state.status === "failed" && !state.forbidden
                        ? state.message
                        : null
                    }
                    forbidden={
                      state.status === "failed" && state.forbidden
                        ? "当前管理员无权查看操作审计数据。"
                        : false
                    }
                    getRowKey={(row) => `${row.kind}:${row.id}`}
                    loading={state.status === "loading"}
                    mobileCard={{
                      title: (row) => row.action,
                      description: (row) => row.target,
                      fields: [
                        {
                          label: "结果",
                          render: (row) => formatResult(row.result),
                        },
                        {
                          label: "操作者",
                          render: (row) => row.actor,
                        },
                        {
                          label: "request id",
                          render: (row) =>
                            row.requestId
                              ? `request id: ${row.requestId}`
                              : "-",
                        },
                        {
                          label: "时间",
                          render: (row) => formatDateTime(row.createdAt),
                        },
                      ],
                      actions: (row) => (
                        <Button
                          aria-label={`查看 ${currentTab.detailLabel} ${row.id}`}
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={() => {
                            updateSearch({
                              sheet: `${row.kind === "security" && search.tab === "tokens" ? "token" : row.kind}:${row.id}`,
                            });
                          }}
                        >
                          查看详情
                        </Button>
                      ),
                    }}
                    rows={search.tab === tab.value ? rows : []}
                  />
                )}

                {state.status === "loaded" && search.tab === tab.value && tab.value !== "trace" ? (
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
            </TabsContent>
          ))}
        </Tabs>
      </section>

      <RecordDetailSheet
        row={selectedRow}
        tab={search.tab}
        onClose={() => {
          setSearchParams(closeSheet(searchParams));
        }}
      />
    </main>
  );
}

async function loadRecords(
  search: RecordSearchState,
): Promise<{ rows: RecordRow[]; total: number; trace?: AdminTraceResult | null }> {
  if (search.tab === "trace") {
    const trace = await fetchAdminTrace({
      requestId: search.requestId,
      applicationId: search.applicationId,
      clientId: search.clientId,
      feishuUserId: search.feishuUserId,
      from: search.from,
      to: search.to,
      result: search.result,
    });
    return { rows: [], total: trace.timeline.length, trace };
  }

  if (search.tab === "audit") {
    const result = await fetchAdminAuditLogs({
      page: search.page,
      pageSize: search.pageSize,
      requestId: search.requestId,
      action: search.action,
      applicationId: search.applicationId,
      result: search.result,
    });
    return { rows: result.items.map(mapAuditLog), total: result.total };
  }

  if (search.tab === "security" || search.tab === "tokens") {
    const result = await fetchAdminSecurityEvents({
      page: search.page,
      pageSize: search.pageSize,
      requestId: search.requestId,
      eventType: search.action,
      eventTypes: search.tab === "tokens" ? loginTokenEventTypes : undefined,
      applicationId: search.applicationId,
      result: search.result,
    });
    return { rows: result.items.map(mapSecurityEvent), total: result.total };
  }

  const items = await fetchFeishuSyncRuns();
  const filtered = items.filter((item) => syncRunMatches(item, search));
  const start = (search.page - 1) * search.pageSize;
  return {
    rows: filtered.slice(start, start + search.pageSize).map(mapSyncRun),
    total: filtered.length,
  };
}

function FilterField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-foreground">
      <span>{props.label}</span>
      <Input
        value={props.value}
        onChange={(event) => {
          props.onChange(event.target.value);
        }}
        placeholder={props.label}
      />
    </label>
  );
}

function ResultFilter(props: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-foreground">
      <span>result</span>
      <select
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
        value={props.value}
        onChange={(event) => {
          props.onChange(event.target.value);
        }}
      >
        <option value="">全部</option>
        <option value="success">success</option>
        <option value="failed">failed</option>
        <option value="running">running</option>
      </select>
    </label>
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

function RecordDetailSheet(props: {
  row: RecordRow | undefined;
  tab: RecordTab;
  onClose: () => void;
}) {
  const title = getDetailTitle(props.row, props.tab);
  return (
    <DetailSheet
      description={
        <span>展示当前记录的追踪字段和上下文信息，敏感字段已脱敏。</span>
      }
      defaultSize="normal"
      open={Boolean(props.row)}
      sizeStorageKey="feishu-iam:records-detail-sheet-size"
      title={title}
      onOpenChange={(open) => {
        if (!open) {
          props.onClose();
        }
      }}
    >
      {props.row ? (
        <RecordDetailContent row={props.row} tab={props.tab} />
      ) : (
        <div />
      )}
    </DetailSheet>
  );
}

function RecordDetailContent(props: { row: RecordRow; tab: RecordTab }) {
  if (props.row.kind === "audit") {
    return <AuditDetail item={props.row.raw} />;
  }

  if (props.row.kind === "security") {
    return (
      <SecurityDetail item={props.row.raw} tokenView={props.tab === "tokens"} />
    );
  }

  return <SyncDetail item={props.row.raw} />;
}

function AuditDetail({ item }: { item: AdminAuditLog }) {
  return (
    <div className="grid gap-5 pt-4">
      <InfoGrid
        items={[
          ["动作", item.action],
          ["结果", item.result],
          ["资源类型", item.resourceType],
          ["资源 ID", item.resourceId],
          ["操作者", `${item.actorType} / ${item.actorId}`],
          ["来源", item.source],
          ["应用 ID", item.applicationId ?? "-"],
          ["request id", item.requestId ?? "-"],
          ["IP", item.ip ?? "-"],
          ["时间", formatDateTime(item.createdAt)],
        ]}
      />
      <RecordJsonBlock title="before" value={item.before} />
      <RecordJsonBlock title="after" value={item.after} />
      <RecordJsonBlock title="User-Agent" value={item.userAgent ?? "-"} />
    </div>
  );
}

function SecurityDetail({
  item,
  tokenView,
}: {
  item: AdminSecurityEvent;
  tokenView: boolean;
}) {
  return (
    <div className="grid gap-5 pt-4">
      <InfoGrid
        items={[
          ["事件类型", item.eventType],
          ["reason code", item.reasonCode],
          ["结果", item.result],
          ["应用 ID", item.applicationId ?? "-"],
          ["client id", item.clientId ?? "-"],
          ["飞书 user_id", item.feishuUserId ?? "-"],
          ["request id", item.requestId ?? "-"],
          ["IP", item.ip ?? "-"],
          ["时间", formatDateTime(item.createdAt)],
          ["User-Agent", item.userAgent ?? "-"],
        ]}
      />
      {tokenView ? (
        <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          该视图只展示 OAuth、Token、userinfo、revoke 与开发者 API
          凭证事件元数据，不展示 secret 或 token 明文。
        </p>
      ) : null}
    </div>
  );
}

function SyncDetail({ item }: { item: FeishuSyncRun }) {
  return (
    <div className="grid gap-5 pt-4">
      <InfoGrid
        items={[
          ["run id", item.id],
          ["状态", formatRunStatus(item.status)],
          ["触发来源", item.triggerSource],
          ["开始时间", formatDateTime(item.startedAt)],
          [
            "结束时间",
            item.finishedAt ? formatDateTime(item.finishedAt) : "运行中",
          ],
          [
            "部门变更",
            formatRunChange(
              item.departmentCreatedCount,
              item.departmentUpdatedCount,
              item.departmentDeletedCount,
            ),
          ],
          [
            "用户变更",
            formatRunChange(
              item.userCreatedCount,
              item.userUpdatedCount,
              item.userDeletedCount,
            ),
          ],
          [
            "关系变更",
            formatRunChange(
              item.relationCreatedCount,
              item.relationUpdatedCount,
              item.relationDeletedCount,
            ),
          ],
          ["错误码", item.errorCode ?? "-"],
          ["错误信息", item.errorMessage ?? "-"],
        ]}
      />
    </div>
  );
}

function InfoGrid({ items }: { items: Array<[string, string]> }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div
          className="min-w-0 rounded-md border bg-background p-3"
          key={label}
        >
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="mt-1 break-all text-sm font-medium text-foreground">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function RecordJsonBlock(props: { title: string; value: unknown }) {
  return (
    <section className="grid gap-2" aria-label={props.title}>
      <h3 className="text-sm font-medium text-foreground">{props.title}</h3>
      <pre className="max-h-72 overflow-auto rounded-md border bg-muted/30 p-3 text-xs leading-relaxed">
        {formatRecordValue(props.value)}
      </pre>
    </section>
  );
}

function getDetailTitle(row: RecordRow | undefined, tab: RecordTab): string {
  if (tab === "tokens") {
    return "登录与 Token 记录详情";
  }
  if (row?.kind === "audit") {
    return "审计日志详情";
  }
  if (row?.kind === "security") {
    return "安全事件详情";
  }
  if (row?.kind === "sync") {
    return "同步记录详情";
  }
  return "记录详情";
}

function sheetMatchesRow(
  sheet: RecordSearchState["sheet"],
  row: RecordRow,
): boolean {
  if (!sheet) {
    return false;
  }

  const [kind, id] = sheet.split(":");
  if (kind === "token") {
    return row.kind === "security" && row.id === id;
  }

  return row.kind === kind && row.id === id;
}

function filterDraftFromSearch(search: RecordSearchState): FilterDraft {
  return {
    requestId: search.requestId ?? "",
    action: search.action ?? "",
    applicationId: search.applicationId ?? "",
    clientId: search.clientId ?? "",
    feishuUserId: search.feishuUserId ?? "",
    from: search.from ?? "",
    to: search.to ?? "",
    result: search.result ?? "",
  };
}

function withInitialApplicationId(
  search: RecordSearchState,
  initialApplicationId?: string | null,
): RecordSearchState {
  if (search.applicationId || !initialApplicationId?.trim()) {
    return search;
  }

  return { ...search, applicationId: initialApplicationId.trim() };
}

function cleanDraft(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function isForbiddenError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    Number((error as { status?: unknown }).status) === 403
  );
}

function syncRunMatches(
  item: FeishuSyncRun,
  search: RecordSearchState,
): boolean {
  const action = search.action?.toLowerCase();
  const requestId = search.requestId?.toLowerCase();
  const applicationId = search.applicationId?.toLowerCase();
  const result = search.result?.toLowerCase();

  return (
    (!action ||
      "feishu.sync".includes(action) ||
      item.triggerSource.toLowerCase().includes(action)) &&
    (!requestId || (item.requestId ?? item.id).toLowerCase().includes(requestId)) &&
    (!applicationId || item.id.toLowerCase().includes(applicationId)) &&
    (!result || item.status.toLowerCase() === result)
  );
}

function hasTraceCriteria(search: RecordSearchState): boolean {
  return Boolean(
    search.requestId ||
      search.applicationId ||
      search.clientId ||
      search.feishuUserId ||
      search.from ||
      search.to ||
      search.result,
  );
}
