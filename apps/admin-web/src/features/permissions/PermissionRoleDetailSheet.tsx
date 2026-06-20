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
import { OrgUserSelector } from "../org-browser/org-user-selector";
import { readBoundPermissionGroupIds } from "./permission-columns";
import { formatRoleStatus } from "./permission-form";

export type PermissionRoleDetailSheetProps = {
  role: IamRole | null;
  appKey?: string;
  applications?: Application[];
  canBindApplications?: boolean;
  canManageSubjects?: boolean;
  onAppKeyChange?: (appKey: string) => void;
  onBindApplication?: (appKey: string) => Promise<void>;
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
  const [error, setError] = useState<string>();
  const [saveIntent, setSaveIntent] = useState<SaveIntent>(null);
  const activeTab = props.activeTab ?? internalActiveTab;
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
      title="角色配置工作台"
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
              <TabsTrigger value="base">基础信息</TabsTrigger>
              <TabsTrigger value="audit">变更记录</TabsTrigger>
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
                onGroupQueryChange={setGroupQuery}
                onSave={() => { setSaveIntent("groups"); }}
                onToggleGroup={(groupId) => {
                  setSelectedGroupIds((current) =>
                    current.includes(groupId) ? current.filter((id) => id !== groupId) : [...current, groupId],
                  );
                }}
              />
            </TabsContent>

            <TabsContent className="min-w-0" value="base">
              <BaseInfoTab role={role} />
            </TabsContent>

            <TabsContent className="min-w-0" value="audit">
              <AuditTab />
            </TabsContent>
          </Tabs>

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
          <h3 className="text-base font-semibold">{props.role.name}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{props.role.description ?? "暂无描述"}</p>
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
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
  onGroupQueryChange: (value: string) => void;
  onToggleGroup: (groupId: string) => void;
  onSave: () => void;
}) {
  const [expandedGroupIds, setExpandedGroupIds] = useState<string[]>([]);
  const [effectiveQuery, setEffectiveQuery] = useState("");
  const changed = props.groupDiff.added.length > 0 || props.groupDiff.removed.length > 0;
  const boundAppKeys = new Set((props.role.applications ?? []).map((application) => application.appKey));
  const unboundApplications = props.applications.filter(
    (application) => !boundAppKeys.has(application.appKey),
  );
  const canSubmitApplicationBinding =
    props.canBindApplications &&
    !props.disabled &&
    !props.bindingPending &&
    Boolean(props.bindingAppKey);
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

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="grid min-w-0 gap-3 rounded-md border bg-background p-4" aria-label="可选权限组">
        <div>
          <h3 className="text-base font-semibold">应用权限</h3>
          <p className="text-sm text-muted-foreground">先选择当前应用，再绑定该应用下的权限组并核对权限点差异。</p>
        </div>
        <div className="grid gap-1.5 text-sm font-medium">
          <span>当前应用</span>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              aria-label="当前应用"
              className="flex h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
              disabled={props.disabled || !props.onAppKeyChange}
              value={props.appKey ?? ""}
              onChange={(event) => {
                props.onAppKeyChange?.(event.target.value);
              }}
            >
              {(props.role.applications ?? []).map((application) => (
                <option key={application.appKey} value={application.appKey}>
                  {application.name} / {application.appKey}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid gap-1.5 text-sm font-medium">
          <span>添加应用</span>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              aria-label="选择要添加的应用"
              className="flex h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
              disabled={!props.canBindApplications || props.disabled || props.bindingPending || unboundApplications.length === 0}
              value={props.bindingAppKey}
              onChange={(event) => {
                props.onBindingAppKeyChange(event.target.value);
              }}
            >
              {unboundApplications.length === 0 ? (
                <option value="">所有应用均已绑定</option>
              ) : null}
              {unboundApplications.map((application) => (
                <option key={application.appKey} value={application.appKey}>
                  {application.name} / {application.appKey}
                </option>
              ))}
            </select>
            <Button
              disabled={!canSubmitApplicationBinding}
              size="sm"
              title={props.canBindApplications ? "将当前角色绑定到选中的应用" : "只有平台管理员可以为角色添加应用"}
              type="button"
              variant="outline"
              onClick={props.onBindApplication}
            >
              {props.bindingPending ? "添加中..." : "添加应用"}
            </Button>
          </div>
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
      </section>
      <section className="grid min-w-0 content-start gap-3 rounded-md border bg-background p-4" aria-label="绑定结果预览">
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
        <PermissionPointComparePanel
          permissionGroups={props.permissionGroups}
          selectedGroupIds={props.selectedGroupIds}
        />
      </section>
    </div>
  );
}

type EffectivePermissionPoint = PermissionPoint & {
  direct: boolean;
  sourceGroups: PermissionGroup[];
  sourceLabel: "直接绑定" | "权限组" | "直接 + 权限组";
};

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

function PermissionPointComparePanel(props: {
  permissionGroups: PermissionGroup[];
  selectedGroupIds: string[];
}) {
  const selectedGroups = props.permissionGroups.filter((group) =>
    props.selectedGroupIds.includes(group.id),
  );
  const points = buildPermissionCompareRows(selectedGroups);

  return (
    <div className="grid min-w-0 gap-3 border-t pt-3" aria-label="权限点对比">
      <div>
        <h4 className="text-sm font-semibold">权限点对比</h4>
        <p className="text-xs text-muted-foreground">
          对比当前已选权限组覆盖的权限点，帮助判断重复授权和差异。
        </p>
      </div>
      {selectedGroups.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
          选择权限组后展示权限点对比。
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground">
              <tr>
                <th className="w-[220px] px-3 py-2 text-left font-medium">权限点</th>
                {selectedGroups.map((group) => (
                  <th className="min-w-[120px] px-3 py-2 text-center font-medium" key={group.id}>
                    {group.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr className="border-t" key={point.key}>
                  <td className="px-3 py-2">
                    <span className="block font-medium">{point.name}</span>
                    <code className="break-all text-xs text-muted-foreground">{point.key}</code>
                  </td>
                  {selectedGroups.map((group) => (
                    <td className="px-3 py-2 text-center" key={group.id}>
                      {point.groupIds.has(group.id) ? (
                        <StatusBadge tone="success">包含</StatusBadge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function buildPermissionCompareRows(groups: PermissionGroup[]): Array<{
  key: string;
  name: string;
  groupIds: Set<string>;
}> {
  const byKey = new Map<string, { key: string; name: string; groupIds: Set<string> }>();
  for (const group of groups) {
    for (const point of group.permissionPoints ?? []) {
      const key = point.key;
      const current = byKey.get(key) ?? { key, name: point.name, groupIds: new Set<string>() };
      current.groupIds.add(group.id);
      byKey.set(key, current);
    }
  }
  return [...byKey.values()].sort((left, right) => left.key.localeCompare(right.key));
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

function BaseInfoTab({ role }: { role: IamRole }) {
  return (
    <section className="grid gap-4 rounded-md border bg-background p-4">
      <div>
        <h3 className="text-base font-semibold">基础信息</h3>
        <p className="text-sm text-muted-foreground">角色基础信息由权限管理统一维护，列表页可进入编辑和启停操作。</p>
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <InfoItem label="角色名称" value={role.name} />
        <InfoItem label="角色 key" value={role.key} code />
        <InfoItem label="角色描述" value={role.description ?? "暂无描述"} />
        <InfoItem label="状态" value={formatRoleStatus(role.status)} />
        <InfoItem label="创建时间" value={formatDateTime(role.createdAt)} />
        <InfoItem label="更新时间" value={formatDateTime(role.updatedAt)} />
      </dl>
    </section>
  );
}

function AuditTab() {
  return (
    <section className="grid gap-3 rounded-md border bg-background p-4">
      <h3 className="text-base font-semibold">变更记录</h3>
      <p className="text-sm text-muted-foreground">
        角色授权变更写入系统审计日志；如需追溯具体操作者、before/after diff、IP、User-Agent 和 request id，请在审计日志中按角色 key 或 request id 查询。
      </p>
      <ul className="grid gap-2 text-sm text-muted-foreground">
        <li>保存前必须确认新增和移除的主体或权限组摘要。</li>
        <li>保存失败会保留当前草稿，管理员可以修正后重试。</li>
        <li>后端会记录操作者、目标角色、before/after diff、结果、IP、User-Agent 和 request id。</li>
        <li>应用权限页展示权限组、最终权限点和权限点对比，权限点定义仍由应用侧权限资产维护。</li>
      </ul>
    </section>
  );
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
