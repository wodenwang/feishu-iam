import { Activity, Database, Info, RefreshCw, ShieldCheck, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { AdminMe } from "../../admin-types";
import {
  fetchFeishuDepartment,
  fetchFeishuDepartments,
  fetchFeishuSyncRun,
  fetchFeishuUser,
  fetchFeishuUsers,
  preflightFeishuFullSync,
} from "../../api/feishu";
import type {
  FeishuFieldDiagnostics,
  FeishuFullSyncPreflight,
  FeishuMirrorDepartmentDetail,
  FeishuMirrorUserDetail,
  FeishuStatus,
  FeishuSyncRun,
} from "../../api/feishu";
import type { ApiStatus } from "../../api/status";
import { ConfirmDialog } from "../../components/admin/ConfirmDialog";
import { DataTable } from "../../components/admin/DataTable";
import { PageHeader } from "../../components/admin/PageHeader";
import { PageState } from "../../components/admin/PageState";
import { StatusBadge } from "../../components/admin/StatusBadge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { OrgBrowser } from "../org-browser/org-browser";
import {
  closeSheet,
  parseSystemSettingsSearch,
  serializeSystemSettingsSearch,
} from "../../routes/admin-url-state";
import type { SystemSettingsSearchState, SystemSettingsTab } from "../../routes/admin-url-state";
import { createSyncRunColumns } from "./settings-columns";
import { SystemSyncRunDetailSheet } from "./SystemSyncRunDetailSheet";
import {
  canQueryFeishuMirror,
  canTriggerFeishuLightSync,
  canTriggerFeishuSync,
  canViewFeishuSettings,
  formatConfigStatus,
  formatDateTime,
  formatDiagnosticConclusion,
  formatFieldStatus,
  formatHealthStatus,
  formatReadyStatus,
  formatRunChange,
  formatRunStatus,
} from "./settings-format";

export type SystemApiState =
  | { status: "loading" }
  | { status: "loaded"; data: ApiStatus }
  | { status: "failed"; message: string };

export type FeishuDetailState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "loaded";
      data: FeishuStatus;
      diagnostics: FeishuFieldDiagnostics;
      runs: FeishuSyncRun[];
      syncing: boolean;
      diagnosticsRefreshing?: boolean;
      diagnosticsError?: string;
      syncError?: string;
    }
  | { status: "failed"; message: string };

export type SystemSettingsViewProps = {
  admin: AdminMe;
  apiState: SystemApiState;
  feishuDetailState: FeishuDetailState;
  mode?: "feishu" | "info";
  onRefreshDiagnostics: () => void;
  onLightSync: (target: { type: "user"; id: string } | { type: "department"; id: string }) => boolean | undefined | Promise<boolean | undefined>;
  onSync: (confirmLatestRunId: string) => boolean | undefined | Promise<boolean | undefined>;
  onOpenTrace?: (run: FeishuSyncRun) => void;
};

type SettingItem = {
  key: SystemSettingsTab;
  label: string;
  description: string;
  icon: LucideIcon;
};

type SyncRunDetailState =
  | { status: "idle" }
  | { status: "loading"; id: string }
  | { status: "loaded"; id: string; run: FeishuSyncRun }
  | { status: "failed"; id: string; message: string };

const settingItems: SettingItem[] = [
  {
    key: "feishu",
    label: "飞书同步",
    description: "组织、用户、字段诊断和同步历史",
    icon: Users,
  },
  {
    key: "runtime",
    label: "系统运行",
    description: "API、数据库和运行可用性",
    icon: Activity,
  },
  {
    key: "version",
    label: "版本信息",
    description: "当前版本、部署入口和升级方式",
    icon: Info,
  },
];

export function SystemSettingsView({
  admin,
  apiState,
  feishuDetailState,
  mode,
  onRefreshDiagnostics,
  onLightSync,
  onSync,
  onOpenTrace,
}: SystemSettingsViewProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const search = parseSystemSettingsSearch(searchParams);
  const activeTab = resolveActiveTab(mode, search.tab);
  const pageMeta = getPageMeta(mode);
  const visibleSettingItems = getVisibleSettingItems(mode);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [detailState, setDetailState] = useState<SyncRunDetailState>({ status: "idle" });
  const wasSyncingRef = useRef(false);
  const syncRunId = parseSyncRunSheetId(search.sheet);
  const syncRunFromList =
    syncRunId && feishuDetailState.status === "loaded"
      ? feishuDetailState.runs.find((run) => run.id === syncRunId) ?? null
      : null;
  const canViewFeishu = canViewFeishuSettings(admin.roles);
  const canTriggerSync = canTriggerFeishuSync(admin.roles);
  const canTriggerLightSync = canTriggerFeishuLightSync(admin.roles);
  const canQueryMirror = canQueryFeishuMirror(admin.roles);

  useEffect(() => {
    if (feishuDetailState.status !== "loaded") {
      wasSyncingRef.current = false;
      return;
    }

    if (wasSyncingRef.current && !feishuDetailState.syncing && !feishuDetailState.syncError) {
      setConfirmOpen(false);
    }
    wasSyncingRef.current = feishuDetailState.syncing;
  }, [feishuDetailState]);

  useEffect(() => {
    if (!syncRunId) {
      setDetailState((current) => (current.status === "idle" ? current : { status: "idle" }));
      return;
    }
    if (syncRunFromList) {
      return;
    }
    if ((detailState.status === "loading" || detailState.status === "failed") && detailState.id === syncRunId) {
      return;
    }
    if (detailState.status === "loaded" && detailState.id === syncRunId) {
      return;
    }

    setDetailState({ status: "loading", id: syncRunId });
    void fetchFeishuSyncRun(syncRunId)
      .then((run) => {
        setDetailState({ status: "loaded", id: syncRunId, run });
      })
      .catch((error: unknown) => {
        setDetailState({
          status: "failed",
          id: syncRunId,
          message: error instanceof Error ? error.message : "无法读取同步记录详情",
        });
      });
  }, [detailState.status, detailState, syncRunFromList, syncRunId]);

  const detailRun = syncRunFromList ?? (detailState.status === "loaded" ? detailState.run : null);
  const columns = useMemo(
    () =>
      createSyncRunColumns({
        onAction: (action) => {
          updateSearch({ sheet: `sync:${action.run.id}` });
        },
      }),
    [activeTab, search.sheet],
  );

  function updateSearch(next: Partial<SystemSettingsSearchState>) {
    setSearchParams(serializeSystemSettingsSearch({ ...search, ...next }));
  }

  function selectTab(tab: SystemSettingsTab) {
    updateSearch({ tab, sheet: undefined });
  }

  function closeDetailSheet() {
    setSearchParams(closeSheet(searchParams));
  }

  return (
    <main aria-label={pageMeta.title} className="flex min-h-full flex-col bg-background">
      <PageHeader
        title={pageMeta.title}
        description={pageMeta.description}
        breadcrumbs={[
          { label: "后台", href: "/admin/workspace" },
          ...(mode
            ? [{ label: "系统管理", href: "/admin/system/info" }]
            : []),
          { label: pageMeta.title, current: true },
        ]}
      />

      <div className={mode === "feishu" ? "grid min-h-0 flex-1 gap-4 p-6" : "grid min-h-0 flex-1 gap-4 p-6 lg:grid-cols-[280px_minmax(0,1fr)]"}>
        {mode === "feishu" ? null : (
          <aside className="rounded-md border bg-background p-3" aria-label={`${pageMeta.title}清单`}>
            <div className="px-2 pb-3">
              <h2 className="text-sm font-medium">{mode ? "系统管理" : "设置项"}</h2>
              <p className="text-xs text-muted-foreground">{pageMeta.asideDescription}</p>
            </div>
            <div className="grid gap-2">
              {visibleSettingItems.map((item) => (
                <SettingButton key={item.key} item={item} active={activeTab === item.key} onClick={selectTab} />
              ))}
            </div>
          </aside>
        )}

        <section className="min-w-0 space-y-4" aria-label={`${pageMeta.title}内容区`}>
          {activeTab === "feishu" ? (
            <FeishuSyncPanel
              state={feishuDetailState}
              canView={canViewFeishu}
              canQueryMirror={canQueryMirror}
              canTriggerLight={canTriggerLightSync}
              canTriggerFull={canTriggerSync}
              columns={columns}
              confirmOpen={confirmOpen}
              onConfirmOpenChange={setConfirmOpen}
              onLightSync={onLightSync}
              onRefreshDiagnostics={onRefreshDiagnostics}
              onSync={onSync}
            />
          ) : null}
          {activeTab === "runtime" ? <SystemRunPanel state={apiState} /> : null}
          {activeTab === "version" ? <VersionInfoPanel state={apiState} /> : null}
        </section>
      </div>

      <SystemSyncRunDetailSheet
        open={Boolean(syncRunId)}
        run={detailRun}
        loading={detailState.status === "loading"}
        error={detailState.status === "failed" ? detailState.message : null}
        onOpenTrace={onOpenTrace}
        onOpenChange={(open) => {
          if (!open) {
            closeDetailSheet();
          }
        }}
      />
    </main>
  );
}

function resolveActiveTab(
  mode: SystemSettingsViewProps["mode"],
  tab: SystemSettingsTab,
): SystemSettingsTab {
  if (mode === "feishu") {
    return "feishu";
  }
  if (mode === "info") {
    return tab === "version" ? "version" : "runtime";
  }
  return tab;
}

function getVisibleSettingItems(mode: SystemSettingsViewProps["mode"]): SettingItem[] {
  if (mode === "feishu") {
    return settingItems.filter((item) => item.key === "feishu");
  }
  if (mode === "info") {
    return settingItems.filter((item) => item.key !== "feishu");
  }
  return settingItems;
}

function getPageMeta(mode: SystemSettingsViewProps["mode"]): {
  title: string;
  description: string;
  asideDescription: string;
} {
  if (mode === "feishu") {
    return {
      title: "飞书同步",
      description: "查看飞书组织、用户、字段诊断和同步历史。",
      asideDescription: "查看和操作飞书同步能力。",
    };
  }
  if (mode === "info") {
    return {
      title: "系统信息",
      description: "查看系统运行状态、版本信息和部署方式。",
      asideDescription: "选择需要查看的系统信息。",
    };
  }
  return {
    title: "系统设置",
    description: "管理飞书同步、系统运行和版本信息。",
    asideDescription: "选择需要查看或操作的系统能力。",
  };
}

function SettingButton(props: {
  item: SettingItem;
  active: boolean;
  onClick: (tab: SystemSettingsTab) => void;
}) {
  const Icon = props.item.icon;
  return (
    <button
      type="button"
      aria-current={props.active ? "page" : undefined}
      className={[
        "flex w-full items-start gap-3 rounded-md px-3 py-3 text-left text-sm transition",
        props.active ? "bg-primary text-primary-foreground" : "hover:bg-muted",
      ].join(" ")}
      onClick={() => {
        props.onClick(props.item.key);
      }}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0">
        <strong className="block truncate">{props.item.label}</strong>
        <small className={props.active ? "block text-primary-foreground/80" : "block text-muted-foreground"}>
          {props.item.description}
        </small>
      </span>
    </button>
  );
}

function FeishuSyncPanel(props: {
  state: FeishuDetailState;
  canView: boolean;
  canQueryMirror: boolean;
  canTriggerLight: boolean;
  canTriggerFull: boolean;
  columns: ReturnType<typeof createSyncRunColumns>;
  confirmOpen: boolean;
  onConfirmOpenChange: (open: boolean) => void;
  onLightSync: (target: { type: "user"; id: string } | { type: "department"; id: string }) => boolean | undefined | Promise<boolean | undefined>;
  onRefreshDiagnostics: () => void;
  onSync: (confirmLatestRunId: string) => boolean | undefined | Promise<boolean | undefined>;
}) {
  const { state } = props;
  const [consoleTab, setConsoleTab] = useState("org");
  const [fullSyncConfirm, setFullSyncConfirm] = useState("");
  const [preflightState, setPreflightState] = useState<
    | { status: "idle" }
    | { status: "loading" }
    | { status: "loaded"; data: FeishuFullSyncPreflight }
    | { status: "failed"; message: string }
  >({ status: "idle" });
  const requiredRunId =
    preflightState.status === "loaded"
      ? preflightState.data.requiredLatestRunId
      : state.status === "loaded"
        ? state.data.latestRun?.id ?? "NO_SYNC_RUN"
        : "NO_SYNC_RUN";
  const fullSyncConfirmMatched = fullSyncConfirm.trim() === requiredRunId;

  useEffect(() => {
    if (consoleTab !== "advanced" || !props.canTriggerFull || preflightState.status !== "idle") {
      return;
    }
    void loadPreflight();
  }, [consoleTab, preflightState.status, props.canTriggerFull]);

  async function loadPreflight(): Promise<void> {
    setPreflightState({ status: "loading" });
    try {
      const data = await preflightFeishuFullSync();
      setPreflightState({ status: "loaded", data });
      setFullSyncConfirm("");
    } catch (error: unknown) {
      setPreflightState({
        status: "failed",
        message: error instanceof Error ? error.message : "无法读取全量同步预确认信息",
      });
    }
  }

  if (!props.canView) {
    return (
      <PageState
        type="forbidden"
        title="没有权限"
        description="当前管理员无权查看飞书同步信息。"
      />
    );
  }

  return (
    <section className="space-y-4" aria-label="飞书同步">
      <section className="rounded-md border bg-background p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-semibold">同步健康</h2>
            <p className="text-sm text-muted-foreground">查看配置、最近同步、运行中状态和本地镜像规模。</p>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setConsoleTab("advanced");
              }}
            >
              高级操作
            </Button>
          </div>
        </div>
        {state.status === "loaded" && state.data.running ? (
          <p className="mt-3 text-sm text-muted-foreground">已有同步运行中</p>
        ) : null}
        {state.status === "loaded" && state.syncError && !props.confirmOpen ? (
          <p className="mt-3 text-sm text-destructive">{state.syncError}</p>
        ) : null}
      </section>

      {state.status === "loaded" ? (
        <Tabs value={consoleTab} onValueChange={setConsoleTab}>
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 md:h-10 md:w-auto md:grid-cols-4">
            <TabsTrigger value="org">组织与用户</TabsTrigger>
            <TabsTrigger value="history">同步历史</TabsTrigger>
            <TabsTrigger value="diagnostics">字段诊断</TabsTrigger>
            <TabsTrigger value="advanced">高级操作</TabsTrigger>
          </TabsList>

          <TabsContent value="org" className="mt-4 space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <StatusCard
                icon={<Users className="h-5 w-5" aria-hidden="true" />}
                title="配置状态"
                value={formatConfigStatus(state.data.configStatus)}
              />
              <StatusCard
                icon={<Users className="h-5 w-5" aria-hidden="true" />}
                title="有效用户"
                value={String(state.data.counts.activeUsers)}
              />
              <StatusCard
                icon={<Database className="h-5 w-5" aria-hidden="true" />}
                title="有效部门"
                value={String(state.data.counts.activeDepartments)}
              />
            </div>
            <FeishuOrgUsersTab
              canQueryMirror={props.canQueryMirror}
              canTriggerLight={props.canTriggerLight}
              syncing={state.syncing || state.data.running}
              onLightSync={props.onLightSync}
            />
          </TabsContent>

          <TabsContent value="history" className="mt-4 space-y-4">
            <LatestRunSummary run={state.data.latestRun} />
            <section className="space-y-3 rounded-md border bg-background p-5" aria-label="同步历史">
              <div>
                <h3 className="text-sm font-semibold">同步历史</h3>
                <p className="text-sm text-muted-foreground">最近 50 次飞书同步记录，点击详情查看执行摘要。</p>
              </div>
              <DataTable
                aria-label="同步历史"
                columns={props.columns}
                rows={state.runs}
                getRowKey={(run) => run.id}
                emptyText="暂无同步记录"
              />
            </section>
          </TabsContent>

          <TabsContent value="diagnostics" className="mt-4">
            <FieldDiagnosticsCard
              activeUsers={state.data.counts.activeUsers}
              diagnostics={state.diagnostics}
              error={state.diagnosticsError}
              onRefresh={props.onRefreshDiagnostics}
              refreshing={Boolean(state.diagnosticsRefreshing)}
            />
          </TabsContent>

          <TabsContent value="advanced" className="mt-4">
            <section className="space-y-4 rounded-md border bg-background p-5" aria-label="高级操作">
              <div>
                <h3 className="text-sm font-semibold">全量同步强确认</h3>
                <p className="text-sm text-muted-foreground">
                  全量同步会重新扫描飞书部门、用户和关系，并写入审计日志。生产验收默认只验证本预确认路径。
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                <label className="space-y-2 text-sm">
                  <span className="font-medium">输入当前最新 run id</span>
                  <Input
                    value={fullSyncConfirm}
                    onChange={(event) => {
                      setFullSyncConfirm(event.target.value);
                    }}
                    placeholder={requiredRunId}
                  />
                </label>
                <Button
                  className="self-end"
                  type="button"
                  disabled={!props.canTriggerFull || state.syncing || state.data.running || !fullSyncConfirmMatched}
                  onClick={() => {
                    props.onConfirmOpenChange(true);
                  }}
                >
                  <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                  确认触发全量同步
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>当前确认口令：<code className="break-all rounded bg-muted px-1.5 py-0.5">{requiredRunId}</code></span>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!props.canTriggerFull || preflightState.status === "loading"}
                  onClick={() => void loadPreflight()}
                >
                  {preflightState.status === "loading" ? "读取中..." : "刷新预确认"}
                </Button>
              </div>
              {preflightState.status === "loaded" ? (
                <p className="text-sm text-muted-foreground">
                  预确认范围：用户 {preflightState.data.counts.activeUsers} 个，部门 {preflightState.data.counts.activeDepartments} 个。
                </p>
              ) : null}
              {preflightState.status === "failed" ? (
                <p className="text-sm text-destructive">{preflightState.message}</p>
              ) : null}
              {!props.canTriggerFull ? (
                <p className="text-sm text-muted-foreground">当前管理员无权触发飞书全量同步。</p>
              ) : null}
            </section>
          </TabsContent>
        </Tabs>
      ) : state.status === "failed" ? (
        <PageState type="error" title="无法读取飞书同步状态" description={state.message} />
      ) : (
        <PageState type="loading" title="正在读取飞书同步状态" />
      )}

      <ConfirmDialog
        open={props.confirmOpen}
        title="确认触发飞书全量同步"
        description={
          state.status === "loaded" && state.syncError
            ? `该操作会立即发起飞书组织与用户全量同步。上次请求失败：${state.syncError}`
            : "该操作会立即发起飞书组织与用户全量同步，并写入审计日志。"
        }
        pending={state.status === "loaded" && state.syncing}
        onOpenChange={props.onConfirmOpenChange}
        onConfirm={() => {
          const result = props.onSync(requiredRunId);
          if (result instanceof Promise) {
            void result.then((synced) => {
              if (synced === true) {
                props.onConfirmOpenChange(false);
              }
            });
            return;
          }
          if (result === true) {
            props.onConfirmOpenChange(false);
          }
        }}
      />
    </section>
  );
}

type MirrorSelection =
  | { type: "department"; id: string }
  | { type: "user"; id: string };

function FeishuOrgUsersTab(props: {
  canQueryMirror: boolean;
  canTriggerLight: boolean;
  syncing: boolean;
  onLightSync: (target: { type: "user"; id: string } | { type: "department"; id: string }) => boolean | undefined | Promise<boolean | undefined>;
}) {
  const [selection, setSelection] = useState<MirrorSelection | null>(null);
  const [detailState, setDetailState] = useState<
    | { status: "idle" | "loading" }
    | { status: "department"; data: FeishuMirrorDepartmentDetail }
    | { status: "user"; data: FeishuMirrorUserDetail }
    | { status: "failed"; message: string }
  >({ status: "idle" });
  const [lightSyncError, setLightSyncError] = useState<string | null>(null);

  useEffect(() => {
    if (!props.canQueryMirror || !selection) {
      setDetailState({ status: "idle" });
      return;
    }
    void loadDetail(selection);
  }, [props.canQueryMirror, selection]);

  async function loadDetail(nextSelection: MirrorSelection): Promise<void> {
    setDetailState({ status: "loading" });
    try {
      if (nextSelection.type === "department") {
        const data = await fetchFeishuDepartment(nextSelection.id);
        setDetailState({ status: "department", data });
      } else {
        const data = await fetchFeishuUser(nextSelection.id);
        setDetailState({ status: "user", data });
      }
    } catch (error: unknown) {
      setDetailState({
        status: "failed",
        message: error instanceof Error ? error.message : "无法读取镜像详情",
      });
    }
  }

  async function triggerLightSync(target: MirrorSelection): Promise<void> {
    setLightSyncError(null);
    const synced = await props.onLightSync(target);
    if (synced === true) {
      await loadDetail(target);
      return;
    }
    setLightSyncError("轻量同步未完成，请查看同步历史或稍后重试。");
  }

  if (!props.canQueryMirror) {
    return (
      <PageState
        type="forbidden"
        title="仅可查看同步历史和诊断"
        description="当前管理员无权查看用户或部门 PII 详情。"
      />
    );
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)]" aria-label="组织与用户">
      <OrgBrowser
        description="浏览本地飞书镜像，组织下钻和用户详情只读取当前可见范围。"
        loadDepartments={(input) =>
          fetchFeishuDepartments({
            keyword: input.keyword,
            parentDepartmentId: input.parentDepartmentId,
            page: input.page,
            pageSize: input.pageSize,
          })
        }
        loadUsers={(input) =>
          fetchFeishuUsers({
            keyword: input.keyword,
            departmentId: input.departmentId,
            page: input.page,
            pageSize: input.pageSize,
          })
        }
        readonly
        title="组织用户浏览"
        onInspectDepartment={(department) => {
          setSelection({ type: "department", id: department.departmentId });
        }}
        onInspectUser={(user) => {
          setSelection({ type: "user", id: user.userId });
        }}
      />

      <div className="min-w-0 space-y-4">
        <FeishuMirrorDetail
          canTriggerLight={props.canTriggerLight}
          detailState={detailState}
          lightSyncError={lightSyncError}
          syncing={props.syncing}
          onLightSync={(target) => void triggerLightSync(target)}
        />
      </div>
    </section>
  );
}

function FeishuMirrorDetail(props: {
  canTriggerLight: boolean;
  detailState:
    | { status: "idle" | "loading" }
    | { status: "department"; data: FeishuMirrorDepartmentDetail }
    | { status: "user"; data: FeishuMirrorUserDetail }
    | { status: "failed"; message: string };
  lightSyncError: string | null;
  syncing: boolean;
  onLightSync: (target: MirrorSelection) => void;
}) {
  const { detailState } = props;
  switch (detailState.status) {
    case "idle":
      return <PageState type="empty" title="选择部门或用户" description="选择后展示本地镜像详情、登录资格、所属部门和最近同步时间。" />;
    case "loading":
      return <PageState type="loading" title="正在读取镜像详情" />;
    case "failed":
      return <PageState type="error" title={detailState.message} />;
    case "user": {
      const target: MirrorSelection = { type: "user", id: detailState.data.userId };
      return (
        <section className="space-y-4 rounded-md border bg-muted/20 p-4" aria-label="详情工作区">
          <MirrorDetailHeader
            canTriggerLight={props.canTriggerLight}
            lightSyncError={props.lightSyncError}
            name={detailState.data.name}
            syncing={props.syncing}
            target={target}
            title="同步该用户"
            onLightSync={props.onLightSync}
          />
          <FeishuUserDetail data={detailState.data} />
        </section>
      );
    }
    case "department":
      return (
        <section className="space-y-4 rounded-md border bg-muted/20 p-4" aria-label="详情工作区">
          <MirrorDetailHeader
            canTriggerLight={props.canTriggerLight}
            lightSyncError={props.lightSyncError}
            name={detailState.data.name}
            syncing={props.syncing}
            target={{ type: "department", id: detailState.data.departmentId }}
            title="同步该部门"
            onLightSync={props.onLightSync}
          />
          <FeishuDepartmentDetail data={detailState.data} />
        </section>
      );
  }
}

function MirrorDetailHeader(props: {
  canTriggerLight: boolean;
  lightSyncError: string | null;
  name: string;
  syncing: boolean;
  target: MirrorSelection;
  title: string;
  onLightSync: (target: MirrorSelection) => void;
}) {
  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold">{props.name}</h3>
          <code className="mt-1 block break-all text-xs text-muted-foreground">{props.target.id}</code>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={!props.canTriggerLight || props.syncing}
          onClick={() => {
            props.onLightSync(props.target);
          }}
        >
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          {props.title}
        </Button>
      </div>
      {!props.canTriggerLight ? (
        <p className="text-sm text-muted-foreground">当前管理员无权触发用户级或部门级轻量同步。</p>
      ) : null}
      {props.lightSyncError ? <p className="text-sm text-destructive">{props.lightSyncError}</p> : null}
    </>
  );
}

function FeishuUserDetail(props: { data: FeishuMirrorUserDetail }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <InfoCard label="登录资格" value={props.data.loginEligible ? "可登录" : props.data.loginBlockReason ?? "不可登录"} />
      <InfoCard label="最近同步" value={formatDateTime(props.data.lastSyncedAt)} />
      <InfoCard label="邮箱" value={props.data.emailMasked ?? "未返回"} />
      <InfoCard label="手机" value={props.data.mobileMasked ?? "未返回"} />
      <InfoCard label="岗位" value={props.data.jobTitle ?? "未返回"} />
      <InfoCard label="员工号" value={props.data.employeeNo ?? "未返回"} />
      <div className="rounded-md border bg-background p-4 md:col-span-2">
        <div className="text-xs text-muted-foreground">所属部门</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {props.data.departments.length === 0 ? (
            <span className="text-sm text-muted-foreground">暂无部门关系</span>
          ) : (
            props.data.departments.map((department) => (
              <span key={department.departmentId} className="rounded-md border px-2 py-1 text-sm">
                {department.name}{department.isPrimary ? " · 主部门" : ""}
              </span>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function FeishuDepartmentDetail(props: { data: FeishuMirrorDepartmentDetail }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <InfoCard label="上级部门" value={props.data.parent?.name ?? "根部门"} />
      <InfoCard label="最近同步" value={formatDateTime(props.data.lastSyncedAt)} />
      <InfoCard label="负责人 user_id" value={props.data.leaderUserId ?? "未返回"} />
      <InfoCard label="状态" value={props.data.isDeleted ? "已删除" : "有效"} />
      <div className="rounded-md border bg-background p-4">
        <div className="text-xs text-muted-foreground">子部门</div>
        <div className="mt-2 space-y-1 text-sm">
          {props.data.children.length === 0 ? "暂无子部门" : props.data.children.map((department) => (
            <div key={department.departmentId} className="truncate">{department.name}</div>
          ))}
        </div>
      </div>
      <div className="rounded-md border bg-background p-4">
        <div className="text-xs text-muted-foreground">直属用户</div>
        <div className="mt-2 space-y-1 text-sm">
          {props.data.users.length === 0 ? "暂无直属用户" : props.data.users.map((user) => (
            <div key={user.userId} className="truncate">{user.name}{user.isPrimary ? " · 主部门" : ""}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SystemRunPanel(props: { state: SystemApiState }) {
  return (
    <section className="rounded-md border bg-background p-5" aria-label="系统运行信息">
      <div className="mb-4">
        <h2 className="text-base font-semibold">系统运行</h2>
        <p className="text-sm text-muted-foreground">查看 API、数据库和管理后台运行可用性。</p>
      </div>
      {props.state.status === "loaded" ? (
        <div className="grid gap-4 md:grid-cols-3">
          <StatusCard
            icon={<Activity className="h-5 w-5" aria-hidden="true" />}
            title="API health"
            value={formatHealthStatus(props.state.data.health)}
          />
          <StatusCard
            icon={<Database className="h-5 w-5" aria-hidden="true" />}
            title="DB ready"
            value={formatReadyStatus(props.state.data.ready)}
          />
          <StatusCard
            icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}
            title="运行状态"
            value={props.state.data.health === "ok" && props.state.data.ready === "ready" ? "可用" : "异常"}
          />
        </div>
      ) : props.state.status === "failed" ? (
        <PageState type="error" title="无法读取系统运行信息" description={props.state.message} />
      ) : (
        <PageState type="loading" title="正在读取系统运行信息" />
      )}
    </section>
  );
}

function VersionInfoPanel(props: { state: SystemApiState }) {
  return (
    <section className="rounded-md border bg-background p-5" aria-label="版本信息">
      <div className="mb-4">
        <h2 className="text-base font-semibold">版本信息</h2>
        <p className="text-sm text-muted-foreground">查看当前版本、部署入口和升级方式。</p>
      </div>
      {props.state.status === "loaded" ? (
        <div className="grid gap-4 md:grid-cols-3">
          <InfoCard label="当前版本" value={props.state.data.version} />
          <InfoCard label="部署入口" value="Docker Compose 单机部署" />
          <InfoCard label="升级方式" value="停机静态升级" />
        </div>
      ) : props.state.status === "failed" ? (
        <PageState type="error" title="无法读取版本信息" description={props.state.message} />
      ) : (
        <PageState type="loading" title="正在读取版本信息" />
      )}
    </section>
  );
}

function StatusCard(props: { icon: ReactNode; title: string; value: string }) {
  return (
    <article className="rounded-md border bg-muted/20 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">{props.icon}</div>
        <div className="min-w-0">
          <h3 className="text-xs text-muted-foreground">{props.title}</h3>
          <p className="truncate text-sm font-semibold text-foreground">{props.value}</p>
        </div>
      </div>
    </article>
  );
}

function InfoCard(props: { label: string; value: string }) {
  return (
    <article className="rounded-md border bg-muted/20 p-4">
      <div className="text-xs text-muted-foreground">{props.label}</div>
      <div className="mt-2 break-all text-sm font-semibold text-foreground">{props.value}</div>
    </article>
  );
}

function FieldDiagnosticsCard(props: {
  diagnostics: FeishuFieldDiagnostics;
  activeUsers: number;
  refreshing: boolean;
  error?: string;
  onRefresh: () => void;
}) {
  return (
    <section className="space-y-4 rounded-md border bg-background p-5" aria-label="字段完整性诊断">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold">字段完整性诊断</h3>
          <p className="text-sm text-muted-foreground">{props.diagnostics.loginReadiness.reason}</p>
        </div>
        <Button type="button" variant="outline" disabled={props.refreshing} onClick={props.onRefresh}>
          {props.refreshing ? "刷新中..." : "刷新诊断"}
        </Button>
      </div>
      {props.error ? <p className="text-sm text-destructive">{props.error}</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge tone={props.diagnostics.status === "failed" ? "danger" : "success"}>
          {formatDiagnosticConclusion(props.diagnostics.status)}
        </StatusBadge>
        <span className="text-sm text-muted-foreground">
          {props.activeUsers > 0 ? "active_users > 0 已满足" : "active_users > 0 未满足"}
        </span>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <DiagnosticFieldList fields={props.diagnostics.departmentFields} title="部门字段" />
        <DiagnosticFieldList fields={props.diagnostics.userFields} title="用户字段" />
      </div>
      <DiagnosticMessages items={props.diagnostics.blockingIssues} title="阻断项" />
      <DiagnosticMessages items={props.diagnostics.warnings} title="警告" />
      <DiagnosticMessages items={props.diagnostics.nextActions} title="下一步" />
    </section>
  );
}

function DiagnosticFieldList(props: { title: string; fields: FeishuFieldDiagnostics["userFields"] }) {
  return (
    <div className="rounded-md border bg-muted/20 p-4">
      <h4 className="text-sm font-medium">{props.title}</h4>
      {props.fields.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">暂无字段样本</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {props.fields.map((field) => (
            <li className="flex items-center justify-between gap-3" key={`${props.title}-${field.field}`}>
              <span className="min-w-0 break-all text-muted-foreground">{field.field}</span>
              <strong className="shrink-0">{formatFieldStatus(field.status)}</strong>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DiagnosticMessages(props: { title: string; items: string[] }) {
  if (props.items.length === 0) {
    return null;
  }

  return (
    <div className="rounded-md border bg-muted/20 p-4">
      <h4 className="text-sm font-medium">{props.title}</h4>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        {props.items.map((item) => (
          <li className="break-all" key={`${props.title}-${item}`}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function LatestRunSummary(props: { run: FeishuSyncRun | null }) {
  const run = props.run;

  return (
    <section className="space-y-3 rounded-md border bg-background p-5" aria-label="最近一次同步">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">最近一次同步</h3>
        {run ? (
          <StatusBadge tone={run.status === "success" ? "success" : run.status === "running" ? "warning" : "danger"}>
            {formatRunStatus(run.status)}
          </StatusBadge>
        ) : (
          <span className="text-sm text-muted-foreground">暂无记录</span>
        )}
      </div>
      {run ? (
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <InfoCard label="开始" value={formatDateTime(run.startedAt)} />
          <InfoCard label={run.finishedAt ? "结束" : "耗时"} value={run.finishedAt ? formatDateTime(run.finishedAt) : "运行中"} />
          <InfoCard
            label="部门"
            value={formatRunChange(null, run.departmentCreatedCount, run.departmentUpdatedCount, run.departmentDeletedCount)}
          />
          <InfoCard label="用户" value={formatRunChange(null, run.userCreatedCount, run.userUpdatedCount, run.userDeletedCount)} />
          <InfoCard
            label="关系"
            value={formatRunChange(null, run.relationCreatedCount, run.relationUpdatedCount, run.relationDeletedCount)}
          />
          <InfoCard label="结果" value={run.status === "failed" ? run.errorMessage ?? run.errorCode ?? "同步失败" : "完成"} />
        </div>
      ) : null}
    </section>
  );
}

function parseSyncRunSheetId(sheet: SystemSettingsSearchState["sheet"]): string | null {
  if (!sheet?.startsWith("sync:")) {
    return null;
  }
  return sheet.slice("sync:".length);
}
