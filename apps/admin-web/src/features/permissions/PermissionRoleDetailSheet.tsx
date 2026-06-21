import { useEffect, useMemo, useState } from "react";
import {
  fetchApplicationFeishuDepartments,
  fetchApplicationFeishuUsers,
} from "../../api/feishu";
import {
  replaceIamRolePermissionGroups,
  replaceIamRoleSubjects,
} from "../../api/permission";
import type { Application, IamRole, IamRoleSubject, PermissionGroup, PermissionPoint } from "../../api/permission";
import { ConfirmDialog } from "../../components/admin/ConfirmDialog";
import { DetailSheet } from "../../components/admin/DetailSheet";
import type { DetailSheetProps } from "../../components/admin/DetailSheet";
import { ResponsiveTabsList } from "../../components/admin/ResponsiveTabsList";
import { StatusBadge } from "../../components/admin/StatusBadge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Tabs, TabsContent, TabsTrigger } from "../../components/ui/tabs";
import { cn } from "../../lib/utils";
import { OrgUserSelector } from "../org-browser/org-user-selector";
import { readBoundPermissionGroupIds } from "./permission-columns";
import { formatRoleStatus } from "./permission-form";
import { RoleApplicationBindingDialog } from "./RoleApplicationBindingDialog";

export type PermissionRoleDetailSheetProps = {
  role: IamRole | null;
  appKey?: string;
  applications?: Application[];
  canBindApplications?: boolean;
  canManageSubjects?: boolean;
  onAppKeyChange?: (appKey: string) => void;
  onBindApplication?: (appKey: string) => Promise<void>;
  onSetApplicationBindingStatus?: (appKey: string, status: Application["status"]) => Promise<void>;
  roleMissing?: boolean;
  permissionGroups: PermissionGroup[];
  permissionGroupsById: Map<string, PermissionGroup>;
  readOnly?: boolean;
  readOnlyReason?: string;
  open: boolean;
  onSaved: () => void;
  onOpenChange: (open: boolean) => void;
  presentation?: DetailSheetProps["presentation"];
  activeTab?: string;
  onActiveTabChange?: (tab: string) => void;
};

type SaveIntent = "subjects" | "groups" | null;

export function PermissionRoleDetailSheet(props: PermissionRoleDetailSheetProps) {
  const role = props.role;
  const [internalActiveTab, setInternalActiveTab] = useState("overview");
  const [subjectsDraft, setSubjectsDraft] = useState<IamRoleSubject[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [groupQuery, setGroupQuery] = useState("");
  const [pending, setPending] = useState(false);
  const [bindingAppKey, setBindingAppKey] = useState("");
  const [bindingPending, setBindingPending] = useState(false);
  const [applicationBindingOpen, setApplicationBindingOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [saveIntent, setSaveIntent] = useState<SaveIntent>(null);
  const activeTab = normalizeRoleDetailTab(props.activeTab ?? internalActiveTab);
  const setActiveTab = props.onActiveTabChange ?? setInternalActiveTab;

  useEffect(() => {
    if (!props.open || !role) {
      return;
    }
    if (!props.activeTab) {
      setInternalActiveTab("overview");
    }
    setSubjectsDraft([...(role.subjects ?? [])]);
    setSelectedGroupIds(readBoundPermissionGroupIds(role));
    setGroupQuery("");
    setError(undefined);
    setSaveIntent(null);
  }, [props.appKey, props.open, role?.id]);

  useEffect(() => {
    if (!props.open || !role) {
      return;
    }
    const boundKeys = new Set((role.applications ?? []).map((application) => application.appKey));
    const firstUnbound = (props.applications ?? []).find(
      (application) => !boundKeys.has(application.appKey),
    );
    setBindingAppKey(firstUnbound?.appKey ?? "");
  }, [props.applications, props.open, role]);

  const subjectDiff = useMemo(
    () => diffSubjects(role?.subjects ?? [], subjectsDraft),
    [role?.subjects, subjectsDraft],
  );
  const groupDiff = useMemo(
    () => diffIds(readBoundPermissionGroupIdsFromNullable(role), selectedGroupIds),
    [role, selectedGroupIds],
  );
  const permissionGroups = useMemo(
    () => mergePermissionGroupDetails(props.permissionGroups, role),
    [props.permissionGroups, role],
  );
  const permissionGroupsById = useMemo(
    () => new Map(permissionGroups.map((group) => [group.id, group])),
    [permissionGroups],
  );
  const filteredGroups = useMemo(() => {
    const keyword = groupQuery.trim().toLowerCase();
    if (!keyword) {
      return permissionGroups;
    }
    return permissionGroups.filter((group) =>
      [group.name, group.key, group.description ?? ""].some((value) => value.toLowerCase().includes(keyword)),
    );
  }, [groupQuery, permissionGroups]);
  const confirmation = saveIntent ? buildConfirmation(saveIntent, subjectDiff, groupDiff, selectedGroupIds.length) : null;

  async function handleConfirmSave() {
    if (!props.appKey || !role || !saveIntent) {
      return;
    }
    setPending(true);
    setError(undefined);
    try {
      if (saveIntent === "subjects") {
        await replaceIamRoleSubjects(props.appKey, role.id, subjectsDraft);
      } else {
        await replaceIamRolePermissionGroups(props.appKey, role.id, selectedGroupIds);
      }
      props.onSaved();
      setSaveIntent(null);
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "无法保存角色授权变更");
      setSaveIntent(null);
    } finally {
      setPending(false);
    }
  }

  async function handleBindApplication() {
    if (!bindingAppKey || !props.onBindApplication) {
      return;
    }
    setBindingPending(true);
    setError(undefined);
    try {
      await props.onBindApplication(bindingAppKey);
    } catch (bindError: unknown) {
      setError(bindError instanceof Error ? bindError.message : "无法绑定应用");
    } finally {
      setBindingPending(false);
    }
  }

  return (
    <DetailSheet
      defaultSize="full"
      description={
        role ? (
          <span className="flex flex-wrap items-center gap-2">
            <code className="break-all text-xs">{role.key}</code>
            <StatusBadge tone={role.status === "active" ? "success" : "muted"}>{formatRoleStatus(role.status)}</StatusBadge>
            {props.readOnly ? <StatusBadge tone="warning">只读</StatusBadge> : null}
          </span>
        ) : props.roleMissing ? (
          <span>角色不存在或已不在当前应用中</span>
        ) : (
          <span>IAM 角色详情</span>
        )
      }
      onOpenChange={props.onOpenChange}
      open={props.open}
      presentation={props.presentation}
      sizeStorageKey="feishu-iam:permissions-role-detail-sheet-size"
      title={props.presentation === "page" && role ? role.name : "角色配置工作台"}
    >
      {role ? (
        <div className="grid gap-4">
          {props.readOnly ? (
            <div className="rounded-md border border-[hsl(var(--status-warning))]/35 bg-[hsl(var(--status-warning))]/10 px-3 py-2 text-sm text-foreground" role="status">
              {props.readOnlyReason ?? "当前角色授权为只读状态，不能保存变更。"}
            </div>
          ) : null}
          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              {error}
            </div>
          ) : null}

          <Tabs className="min-w-0" value={activeTab} onValueChange={setActiveTab}>
            <ResponsiveTabsList aria-label="角色详情标签">
              <TabsTrigger value="overview">总览</TabsTrigger>
              <TabsTrigger value="subjects">组织与用户</TabsTrigger>
              <TabsTrigger value="groups">应用权限</TabsTrigger>
            </ResponsiveTabsList>

            <TabsContent className="min-w-0" value="overview">
              <OverviewTab
                groupCount={readBoundPermissionGroupIds(role).length}
                groupsById={permissionGroupsById}
                role={role}
              />
            </TabsContent>

            <TabsContent className="min-w-0" value="subjects">
              <OrgUserSelector
                disabled={props.readOnly || !props.canManageSubjects}
                error={saveIntent === "subjects" ? error : undefined}
                loadDepartments={(input) => {
                  if (!props.appKey) {
                    throw new Error("请先选择应用");
                  }
                  return fetchApplicationFeishuDepartments(props.appKey, input);
                }}
                loadUsers={(input) => {
                  if (!props.appKey) {
                    throw new Error("请先选择应用");
                  }
                  return fetchApplicationFeishuUsers(props.appKey, input);
                }}
                originalSubjects={role.subjects ?? []}
                readOnlyReason={!props.canManageSubjects ? "只有平台管理员可以维护组织与用户绑定。" : undefined}
                saving={pending && saveIntent === "subjects"}
                subjects={subjectsDraft}
                onSave={() => { setSaveIntent("subjects"); }}
                onSubjectsChange={setSubjectsDraft}
              />
            </TabsContent>

            <TabsContent className="min-w-0" value="groups">
              <GroupsTab
                appKey={props.appKey}
                applications={props.applications ?? []}
                bindingAppKey={bindingAppKey}
                bindingPending={bindingPending}
                canBindApplications={Boolean(props.canBindApplications && props.onBindApplication)}
                disabled={props.readOnly || pending || bindingPending}
                filteredGroups={filteredGroups}
                groupDiff={groupDiff}
                groupQuery={groupQuery}
                permissionGroups={permissionGroups}
                role={role}
                selectedGroupIds={selectedGroupIds}
                onAppKeyChange={props.onAppKeyChange}
                onBindApplication={() => { void handleBindApplication(); }}
                onBindingAppKeyChange={setBindingAppKey}
                onOpenApplicationDialog={() => { setApplicationBindingOpen(true); }}
                onGroupQueryChange={setGroupQuery}
                onSave={() => { setSaveIntent("groups"); }}
                onToggleGroup={(groupId) => {
                  setSelectedGroupIds((current) =>
                    current.includes(groupId) ? current.filter((id) => id !== groupId) : [...current, groupId],
                  );
                }}
              />
            </TabsContent>

          </Tabs>

          {props.onBindApplication ? (
            <RoleApplicationBindingDialog
              applications={props.applications ?? []}
              canManage={Boolean(props.canBindApplications)}
              onBindApplication={async (nextAppKey) => {
                await props.onBindApplication?.(nextAppKey);
                props.onSaved();
              }}
              onOpenChange={setApplicationBindingOpen}
              onSetApplicationBindingStatus={props.onSetApplicationBindingStatus}
              open={applicationBindingOpen}
              role={role}
            />
          ) : null}

          {confirmation ? (
            <ConfirmDialog
              description={confirmation.description}
              onConfirm={() => void handleConfirmSave()}
              onOpenChange={(open) => {
                if (!open && !pending) {
                  setSaveIntent(null);
                }
              }}
              open
              pending={pending}
              title={confirmation.title}
            />
          ) : null}
        </div>
      ) : props.roleMissing ? (
        <div className="rounded-md border bg-background px-4 py-10 text-center">
          <h3 className="font-semibold">角色不存在或已不在当前筛选结果中</h3>
          <p className="mt-2 text-sm text-muted-foreground">请调整筛选条件，或关闭详情后重新选择角色。</p>
          <Button className="mt-4" type="button" variant="outline" onClick={() => { props.onOpenChange(false); }}>
            关闭详情
          </Button>
        </div>
      ) : null}
    </DetailSheet>
  );
}

function OverviewTab(props: {
  role: IamRole;
  groupsById: Map<string, PermissionGroup>;
  groupCount: number;
}) {
  const subjects = groupSubjects(props.role.subjects ?? []);
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="grid gap-3 rounded-md border bg-background p-4">
        <div>
          <h3 className="text-base font-semibold">基础信息概览</h3>
          <p className="mt-1 text-sm text-muted-foreground">{props.role.description ?? "暂无描述"}</p>
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <InfoItem label="角色名称" value={props.role.name} />
          <InfoItem label="角色 key" value={props.role.key} code />
          <InfoItem label="状态" value={formatRoleStatus(props.role.status)} />
          <InfoItem label="创建时间" value={formatDateTime(props.role.createdAt)} />
          <InfoItem label="更新时间" value={formatDateTime(props.role.updatedAt)} />
        </dl>
      </section>
      <section className="grid gap-3 rounded-md border bg-muted/20 p-4">
        <h3 className="text-base font-semibold">授权概览</h3>
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <Metric label="组织" value={subjects.departments.length} />
          <Metric label="用户" value={subjects.users.length} />
          <Metric label="权限组" value={props.groupCount} />
        </div>
        <p className="text-sm text-muted-foreground">
          本页维护角色授权和基础状态。角色新增、编辑、启停与配置统一从权限管理进入。
        </p>
      </section>
      <section className="grid gap-3 rounded-md border bg-background p-4 lg:col-span-2" aria-label="当前绑定摘要">
        <h3 className="text-base font-semibold">当前绑定摘要</h3>
        <div className="grid gap-3 lg:grid-cols-2">
          <SubjectSummary subjects={props.role.subjects ?? []} />
          <PermissionGroupSummary role={props.role} groupsById={props.groupsById} />
        </div>
      </section>
    </div>
  );
}

function GroupsTab(props: {
  appKey?: string;
  applications: Application[];
  bindingAppKey: string;
  bindingPending: boolean;
  canBindApplications: boolean;
  disabled: boolean;
  groupQuery: string;
  filteredGroups: PermissionGroup[];
  permissionGroups: PermissionGroup[];
  role: IamRole;
  selectedGroupIds: string[];
  groupDiff: IdDiff;
  onAppKeyChange?: (appKey: string) => void;
  onBindApplication: () => void;
  onBindingAppKeyChange: (appKey: string) => void;
  onOpenApplicationDialog: () => void;
  onGroupQueryChange: (value: string) => void;
  onToggleGroup: (groupId: string) => void;
  onSave: () => void;
}) {
  const [expandedGroupIds, setExpandedGroupIds] = useState<string[]>([]);
  const [effectiveQuery, setEffectiveQuery] = useState("");
  const changed = props.groupDiff.added.length > 0 || props.groupDiff.removed.length > 0;
  const effectivePermissionPoints = useMemo(
    () => buildEffectivePermissionPoints(props.role, props.permissionGroups, props.selectedGroupIds),
    [props.permissionGroups, props.role, props.selectedGroupIds],
  );
  const filteredEffectivePermissionPoints = useMemo(() => {
    const keyword = effectiveQuery.trim().toLowerCase();
    if (!keyword) {
      return effectivePermissionPoints;
    }
    return effectivePermissionPoints.filter((item) =>
      [
        item.key,
        item.name,
        item.description ?? "",
        item.sourceLabel,
        ...item.sourceGroups.map((group) => group.name),
        ...item.sourceGroups.map((group) => group.key),
      ].some((value) => value.toLowerCase().includes(keyword)),
    );
  }, [effectivePermissionPoints, effectiveQuery]);

  function toggleExpandedGroup(groupId: string) {
    setExpandedGroupIds((current) =>
      current.includes(groupId) ? current.filter((id) => id !== groupId) : [...current, groupId],
    );
  }

  const boundApplications = buildBoundApplications(props.role, props.applications, props.appKey);
  const currentAppKey = props.appKey ?? boundApplications[0]?.appKey ?? "";

  return (
    <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="grid min-w-0 content-start gap-3 rounded-md border bg-background p-4" aria-label="可选权限组">
        <div>
          <h3 className="text-base font-semibold">应用权限</h3>
          <p className="text-sm text-muted-foreground">先选择当前应用，再绑定该应用下的权限组并核对权限点差异。</p>
        </div>

        <div className="grid min-w-0 content-start gap-4 xl:grid-cols-[240px_minmax(0,1fr)]">
          <div className="grid content-start gap-2 text-sm font-medium">
            <span>当前应用</span>
            <div
              aria-label="当前应用"
              aria-orientation="vertical"
              className="grid content-start gap-2"
              role="tablist"
            >
              {boundApplications.map((application) => {
                const selected = application.appKey === currentAppKey;
                return (
                  <button
                    aria-selected={selected}
                    className={cn(
                      "grid min-w-0 gap-1 rounded-md border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      selected
                        ? "border-primary bg-primary/10 text-foreground"
                        : "bg-background text-muted-foreground hover:border-primary/40 hover:bg-muted/50 hover:text-foreground",
                    )}
                    disabled={props.disabled || !props.onAppKeyChange}
                    key={application.appKey}
                    role="tab"
                    title={`切换到 ${application.name}`}
                    type="button"
                    onClick={() => {
                      if (!selected) {
                        props.onAppKeyChange?.(application.appKey);
                      }
                    }}
                  >
                    <span className="truncate font-medium">{application.name}</span>
                    <code className="break-all text-xs">{application.appKey}</code>
                    <span className="flex flex-wrap gap-1.5">
                      <StatusBadge tone={application.status === "active" ? "success" : "muted"}>
                        {formatRoleStatus(application.status)}
                      </StatusBadge>
                      <StatusBadge tone={application.bindingStatus === "active" ? "success" : "muted"}>
                        {application.bindingStatus === "active" ? "已绑定" : "绑定停用"}
                      </StatusBadge>
                    </span>
                  </button>
                );
              })}
              {boundApplications.length === 0 ? (
                <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                  当前角色暂无已绑定应用。
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid min-w-0 content-start gap-3">
            <div className="flex flex-col gap-2 rounded-md border bg-muted/20 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span className="text-muted-foreground">
                当前角色关联 {String(boundApplications.length)} 个应用。
              </span>
              <Button
                disabled={!props.canBindApplications || props.disabled}
                size="sm"
                title={props.canBindApplications ? "管理角色关联应用" : "只有平台管理员可以管理角色关联应用"}
                type="button"
                variant="outline"
                onClick={props.onOpenApplicationDialog}
              >
                管理应用
              </Button>
            </div>
            <label className="grid gap-1.5 text-sm font-medium">
              <span>搜索权限组</span>
              <Input
                aria-label="搜索权限组"
                disabled={props.disabled}
                placeholder="搜索权限组名称 / key / 描述"
                value={props.groupQuery}
                onChange={(event) => { props.onGroupQueryChange(event.target.value); }}
              />
            </label>
            <div className="grid max-h-[520px] gap-2 overflow-y-auto rounded-md border p-2">
              {props.filteredGroups.length === 0 ? (
                <p className="px-2 py-10 text-center text-sm text-muted-foreground">暂无可绑定权限组</p>
              ) : (
                props.filteredGroups.map((group) => (
                  <label className="flex min-w-0 items-start gap-3 rounded-md border bg-background p-3 text-sm" key={group.id}>
                    <input
                      className="mt-1"
                      checked={props.selectedGroupIds.includes(group.id)}
                      disabled={props.disabled || (group.status !== "active" && !props.selectedGroupIds.includes(group.id))}
                      type="checkbox"
                      onChange={() => { props.onToggleGroup(group.id); }}
                    />
                    <span className="grid min-w-0 flex-1 gap-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <strong>{group.name}</strong>
                        <StatusBadge tone={group.status === "active" ? "success" : "muted"}>{formatRoleStatus(group.status)}</StatusBadge>
                      </span>
                      <code className="break-all text-xs text-muted-foreground">{group.key}</code>
                      <span className="text-xs text-muted-foreground">{group.description ?? "暂无描述"}</span>
                      <Button
                        className="mt-1 w-fit px-2"
                        size="sm"
                        type="button"
                        variant="ghost"
                        onClick={(event) => {
                          event.preventDefault();
                          toggleExpandedGroup(group.id);
                        }}
                      >
                        {expandedGroupIds.includes(group.id) ? "收起权限点" : "查看权限点"}
                      </Button>
                      {expandedGroupIds.includes(group.id) ? (
                        <PermissionPointMiniList
                          emptyText="该权限组暂无权限点"
                          permissionPoints={group.permissionPoints ?? []}
                        />
                      ) : null}
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
      <section className="grid min-w-0 content-start gap-3 rounded-md border bg-background p-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto" aria-label="绑定结果预览">
        <h3 className="text-base font-semibold">绑定结果预览</h3>
        <DiffNote text={`新增 ${String(props.groupDiff.added.length)} 个，移除 ${String(props.groupDiff.removed.length)} 个。`} />
        <p className="text-sm text-muted-foreground">
          保存时替换当前角色在当前应用下的应用权限，并写入操作审计。
        </p>
        <div className="flex justify-end">
          <Button disabled={props.disabled || !changed} type="button" onClick={props.onSave}>
            保存应用权限
          </Button>
        </div>
        <div className="grid min-w-0 gap-3 border-t pt-3" aria-label="最终权限点">
          <div>
            <h4 className="text-sm font-semibold">最终权限点</h4>
            <p className="text-xs text-muted-foreground">
              汇总直接绑定和权限组带来的有效权限点。
            </p>
          </div>
          <label className="grid gap-1.5 text-sm font-medium">
            <span>搜索最终权限点</span>
            <Input
              aria-label="搜索最终权限点"
              placeholder="搜索权限点 key / 名称 / 来源"
              value={effectiveQuery}
              onChange={(event) => {
                setEffectiveQuery(event.target.value);
              }}
            />
          </label>
          <p className="text-xs text-muted-foreground">
            共 {String(effectivePermissionPoints.length)} 个，当前显示 {String(filteredEffectivePermissionPoints.length)} 个。
          </p>
          <EffectivePermissionPointList permissionPoints={filteredEffectivePermissionPoints} />
        </div>
      </section>
    </div>
  );
}

type EffectivePermissionPoint = PermissionPoint & {
  direct: boolean;
  sourceGroups: PermissionGroup[];
  sourceLabel: "直接绑定" | "权限组" | "直接 + 权限组";
};

type BoundApplicationTab = {
  appKey: string;
  bindingStatus: Application["status"];
  name: string;
  status: Application["status"];
};

function buildBoundApplications(
  role: IamRole,
  applications: Application[],
  currentAppKey?: string,
): BoundApplicationTab[] {
  const applicationsByKey = new Map(applications.map((application) => [application.appKey, application]));
  const roleApplications = role.applications ?? [];
  const activeRoleApplications = roleApplications.filter((application) => application.bindingStatus === "active");
  const bound = roleApplications.length > 0
    ? activeRoleApplications
    : [
        {
          appKey: role.appKey,
          bindingStatus: "active" as const,
          name: role.appKey,
          status: "active" as const,
        },
      ];
  const tabs = bound.map((application) => {
    const fullApplication = applicationsByKey.get(application.appKey);
    return {
      appKey: application.appKey,
      bindingStatus: application.bindingStatus,
      name: fullApplication?.name ?? application.name,
      status: fullApplication?.status ?? application.status,
    };
  });

  const currentBinding = roleApplications.find((application) => application.appKey === currentAppKey);
  if (
    currentAppKey &&
    !tabs.some((application) => application.appKey === currentAppKey) &&
    currentBinding?.bindingStatus !== "disabled"
  ) {
    const currentApplication = applicationsByKey.get(currentAppKey);
    tabs.unshift({
      appKey: currentAppKey,
      bindingStatus: "active",
      name: currentApplication?.name ?? currentAppKey,
      status: currentApplication?.status ?? "active",
    });
  }

  return tabs;
}

function PermissionPointMiniList(props: { permissionPoints: PermissionPoint[]; emptyText: string }) {
  if (props.permissionPoints.length === 0) {
    return (
      <p className="rounded-md border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        {props.emptyText}
      </p>
    );
  }
  return (
    <ul className="grid gap-1 rounded-md border bg-muted/20 p-2">
      {props.permissionPoints.map((point) => (
        <li className="grid gap-0.5 text-xs" key={point.id}>
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="font-medium text-foreground">{point.name}</span>
            <StatusBadge tone={point.status === "active" ? "success" : "muted"}>
              {formatRoleStatus(point.status)}
            </StatusBadge>
          </span>
          <code className="break-all text-muted-foreground">{point.key}</code>
          {point.description ? <span className="text-muted-foreground">{point.description}</span> : null}
        </li>
      ))}
    </ul>
  );
}

function EffectivePermissionPointList({ permissionPoints }: { permissionPoints: EffectivePermissionPoint[] }) {
  if (permissionPoints.length === 0) {
    return (
      <p className="rounded-md border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
        当前角色暂无匹配的最终权限点。
      </p>
    );
  }
  return (
    <div className="grid min-w-0 max-h-[360px] gap-2 overflow-y-auto rounded-md border p-2" aria-label="最终权限点清单">
      {permissionPoints.map((point) => (
        <article className="grid min-w-0 gap-1 rounded-md border bg-background px-3 py-2 text-sm" key={point.id}>
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
            <span className="min-w-0 break-all font-medium">{point.name}</span>
            <StatusBadge tone={point.direct && point.sourceGroups.length > 0 ? "warning" : "muted"}>
              {point.sourceLabel}
            </StatusBadge>
          </div>
          <code className="break-all text-xs text-muted-foreground">{point.key}</code>
          {point.description ? (
            <span className="text-xs text-muted-foreground">{point.description}</span>
          ) : null}
          {point.sourceGroups.length > 0 ? (
            <span className="break-all text-xs text-muted-foreground">
              来源权限组：{point.sourceGroups.map((group) => `${group.name} / ${group.key}`).join("、")}
            </span>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function buildEffectivePermissionPoints(
  role: IamRole,
  permissionGroups: PermissionGroup[],
  selectedGroupIds: string[],
): EffectivePermissionPoint[] {
  const pointMap = new Map<string, EffectivePermissionPoint>();

  for (const point of role.permissionPoints ?? []) {
    if (point.status !== "active") {
      continue;
    }
    const key = point.id || point.key;
    pointMap.set(key, {
      ...point,
      direct: true,
      sourceGroups: [],
      sourceLabel: "直接绑定",
    });
  }

  const selectedGroups = permissionGroups.filter((group) => selectedGroupIds.includes(group.id));
  for (const group of selectedGroups) {
    if (group.status !== "active") {
      continue;
    }
    for (const point of group.permissionPoints ?? []) {
      if (point.status !== "active") {
        continue;
      }
      const key = point.id || point.key;
      const current = pointMap.get(key);
      if (current) {
        const sourceGroups = current.sourceGroups.some((item) => item.id === group.id)
          ? current.sourceGroups
          : [...current.sourceGroups, group];
        pointMap.set(key, {
          ...current,
          sourceGroups,
          sourceLabel: current.direct ? "直接 + 权限组" : "权限组",
        });
      } else {
        pointMap.set(key, {
          ...point,
          direct: false,
          sourceGroups: [group],
          sourceLabel: "权限组",
        });
      }
    }
  }

  return [...pointMap.values()].sort((left, right) => left.key.localeCompare(right.key));
}

function mergePermissionGroupDetails(groups: PermissionGroup[], role: IamRole | null): PermissionGroup[] {
  const byId = new Map(groups.map((group) => [group.id, group]));
  for (const roleGroup of role?.permissionGroups ?? []) {
    const current = byId.get(roleGroup.id);
    byId.set(roleGroup.id, {
      ...current,
      ...roleGroup,
      permissionPoints: roleGroup.permissionPoints ?? current?.permissionPoints ?? [],
    });
  }
  return [...byId.values()];
}

function SubjectSummary({ subjects }: { subjects: IamRoleSubject[] }) {
  const grouped = groupSubjects(subjects);
  return (
    <div className="grid gap-2 rounded-md border p-3">
      <h4 className="text-sm font-semibold">组织与用户</h4>
      <p className="text-sm text-muted-foreground">
        已绑定组织 {grouped.departments.length} 个，用户 {grouped.users.length} 个。
      </p>
    </div>
  );
}

function PermissionGroupSummary(props: { role: IamRole; groupsById: Map<string, PermissionGroup> }) {
  const groupIds = readBoundPermissionGroupIds(props.role);
  return (
    <div className="grid gap-2 rounded-md border p-3">
      <h4 className="text-sm font-semibold">权限组</h4>
      {groupIds.length === 0 ? (
        <p className="text-sm text-muted-foreground">暂无已绑定权限组。</p>
      ) : (
        <ul className="grid gap-1 text-sm text-muted-foreground">
          {groupIds.slice(0, 4).map((groupId) => {
            const group = props.groupsById.get(groupId);
            return <li className="break-all" key={groupId}>{group?.name ?? "已失效权限组"} / {group?.key ?? groupId}</li>;
          })}
        </ul>
      )}
    </div>
  );
}

function InfoItem(props: { label: string; value: string; code?: boolean }) {
  return (
    <div className="grid gap-1">
      <dt className="text-xs text-muted-foreground">{props.label}</dt>
      <dd className={props.code ? "break-all font-mono text-xs" : "break-all"}>{props.value}</dd>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-background px-3 py-2">
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function DiffNote({ text }: { text: string }) {
  return <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">{text}</p>;
}

type SubjectDiff = {
  added: IamRoleSubject[];
  removed: IamRoleSubject[];
};

type IdDiff = {
  added: string[];
  removed: string[];
};

function diffSubjects(original: IamRoleSubject[], current: IamRoleSubject[]): SubjectDiff {
  return {
    added: current.filter((subject) => !original.some((item) => sameSubject(item, subject))),
    removed: original.filter((subject) => !current.some((item) => sameSubject(item, subject))),
  };
}

function diffIds(original: string[], current: string[]): IdDiff {
  return {
    added: current.filter((id) => !original.includes(id)),
    removed: original.filter((id) => !current.includes(id)),
  };
}

function buildConfirmation(
  intent: "subjects" | "groups",
  subjectDiff: SubjectDiff,
  groupDiff: IdDiff,
  selectedGroupCount: number,
): { title: string; description: string } {
  if (intent === "subjects") {
    return {
      title: "确认保存组织与用户绑定",
      description: `本次将新增 ${String(subjectDiff.added.length)} 个主体，移除 ${String(subjectDiff.removed.length)} 个主体。保存后会替换当前角色的组织与用户绑定，并写入操作审计。`,
    };
  }
  return {
    title: "确认保存应用权限",
    description: `本次将新增 ${String(groupDiff.added.length)} 个权限组，移除 ${String(groupDiff.removed.length)} 个权限组，保存后角色在当前应用共绑定 ${String(selectedGroupCount)} 个权限组，并写入操作审计。`,
  };
}

function groupSubjects(subjects: IamRoleSubject[]): { users: IamRoleSubject[]; departments: IamRoleSubject[] } {
  return {
    users: subjects.filter((subject) => subject.type === "feishu_user"),
    departments: subjects.filter((subject) => subject.type === "feishu_department"),
  };
}

function readBoundPermissionGroupIdsFromNullable(role: IamRole | null): string[] {
  return role ? readBoundPermissionGroupIds(role) : [];
}

function normalizeRoleDetailTab(tab: string): string {
  if (tab === "base" || tab === "audit" || tab === "permissions") {
    return tab === "permissions" ? "groups" : "overview";
  }
  return tab;
}

function sameSubject(left: IamRoleSubject, right: IamRoleSubject): boolean {
  return left.type === right.type && left.id === right.id;
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
