import { X } from "lucide-react";
import { useMemo, useState } from "react";
import type { IamRoleSubject } from "../../api/permission";
import { Button } from "../../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { StatusBadge } from "../../components/admin/StatusBadge";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { OrgBrowser } from "./org-browser";
import type {
  OrgBrowserDepartment,
  OrgBrowserLoadDepartments,
  OrgBrowserLoadUsers,
  OrgBrowserSelectionMeta,
  OrgBrowserUser,
} from "./org-browser-types";
import { diffRoleSubjects, subjectKey } from "./org-browser-types";

export type OrgUserSelectorProps = {
  originalSubjects: IamRoleSubject[];
  subjects: IamRoleSubject[];
  disabled?: boolean;
  readOnlyReason?: string;
  saving?: boolean;
  error?: string;
  loadDepartments: OrgBrowserLoadDepartments;
  loadUsers: OrgBrowserLoadUsers;
  onSubjectsChange: (subjects: IamRoleSubject[]) => void;
  onSave: () => void;
};

export function OrgUserSelector(props: OrgUserSelectorProps) {
  const [mobileStep, setMobileStep] = useState("pick");
  const isDesktop = useMediaQuery("(min-width: 1280px)");
  const diff = useMemo(() => diffRoleSubjects(props.originalSubjects, props.subjects), [props.originalSubjects, props.subjects]);
  const orgSubjects = props.subjects.filter((subject) => subject.type === "feishu_department");
  const userSubjects = props.subjects.filter((subject) => subject.type === "feishu_user");
  const changed = diff.added.length > 0 || diff.removed.length > 0;

  function addDepartment(department: OrgBrowserDepartment, meta: OrgBrowserSelectionMeta) {
    addSubject({
      type: "feishu_department",
      id: department.departmentId,
      displayName: department.name,
      avatarLabel: fallbackAvatarLabel(department.name),
      subjectKindLabel: "组织",
      displayPath: meta.displayPath,
    });
  }

  function addUser(user: OrgBrowserUser, meta: OrgBrowserSelectionMeta) {
    addSubject({
      type: "feishu_user",
      id: user.userId,
      displayName: user.name,
      avatarLabel: fallbackAvatarLabel(user.name),
      subjectKindLabel: "用户",
      displayPath: meta.displayPath,
    });
  }

  function addSubject(subject: IamRoleSubject) {
    props.onSubjectsChange(
      props.subjects.some((item) => item.type === subject.type && item.id === subject.id)
        ? props.subjects
        : [...props.subjects, subject],
    );
  }

  function removeSubject(subject: IamRoleSubject) {
    props.onSubjectsChange(props.subjects.filter((item) => item.type !== subject.type || item.id !== subject.id));
  }

  const makeBrowser = (enabled: boolean) => (
    <OrgBrowser
      description="选择部门会保存为组织主体；不会展开成该部门下所有用户。用户可以单独选择。"
      enabled={enabled}
      loadDepartments={props.loadDepartments}
      loadUsers={props.loadUsers}
      readonly={props.disabled}
      readonlyListDescription={
        props.disabled
          ? props.readOnlyReason ?? "当前绑定不可编辑；组织和用户在同一列表中仅用于核对可选主体。"
          : undefined
      }
      selectedDepartmentIds={orgSubjects.map((subject) => subject.id)}
      selectedUserIds={userSubjects.map((subject) => subject.id)}
      title="待选组织与用户"
      onSelectDepartment={addDepartment}
      onSelectUser={addUser}
    />
  );
  const desktopBrowser = makeBrowser(isDesktop);
  const mobileBrowser = makeBrowser(!isDesktop);
  const selected = (
    <SelectedPanel
      disabled={props.disabled || props.saving}
      orgSubjects={orgSubjects}
      userSubjects={userSubjects}
      onRemove={removeSubject}
    />
  );
  const summary = (
    <SummaryPanel
      changed={changed}
      diff={diff}
      disabled={props.disabled || props.saving || !changed}
      error={props.error}
      saving={props.saving}
      onSave={props.onSave}
    />
  );

  return (
    <div className="grid gap-4">
      <div className="hidden items-start gap-4 xl:grid xl:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)]">
        {desktopBrowser}
        <div className="grid content-start gap-4">
          {selected}
          {summary}
        </div>
      </div>

      <div className="xl:hidden">
        <Tabs value={mobileStep} onValueChange={setMobileStep}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pick">待选</TabsTrigger>
            <TabsTrigger value="selected">已选</TabsTrigger>
            <TabsTrigger value="summary">摘要</TabsTrigger>
          </TabsList>
          <TabsContent value="pick">{mobileBrowser}</TabsContent>
          <TabsContent value="selected">{selected}</TabsContent>
          <TabsContent value="summary">{summary}</TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function SelectedPanel(props: {
  orgSubjects: IamRoleSubject[];
  userSubjects: IamRoleSubject[];
  disabled?: boolean;
  onRemove: (subject: IamRoleSubject) => void;
}) {
  return (
    <section className="grid gap-3 rounded-md border bg-background p-4" aria-label="已选组织与用户">
      <div>
        <h3 className="text-base font-semibold">已选组织与用户</h3>
        <p className="text-sm text-muted-foreground">
          部门主体和用户主体分开保存；半选和重复覆盖只影响展示说明。
        </p>
      </div>
      <SubjectGroup disabled={props.disabled} subjects={props.orgSubjects} title="已选组织" onRemove={props.onRemove} />
      <SubjectGroup disabled={props.disabled} subjects={props.userSubjects} title="已选用户" onRemove={props.onRemove} />
    </section>
  );
}

function SubjectGroup(props: {
  title: string;
  subjects: IamRoleSubject[];
  disabled?: boolean;
  onRemove: (subject: IamRoleSubject) => void;
}) {
  return (
    <div className="grid gap-2 rounded-md border bg-muted/20 p-3">
      <h4 className="text-sm font-semibold">{props.title}</h4>
      {props.subjects.length === 0 ? (
        <p className="rounded-md border bg-background px-3 py-6 text-center text-sm text-muted-foreground">暂无{props.title}</p>
      ) : (
        <ul className="grid gap-2">
          {props.subjects.map((subject) => (
            <li
              className="flex items-start justify-between gap-3 rounded-md border bg-background p-3 text-sm"
              key={subjectKey(subject)}
            >
              <div className="flex min-w-0 items-start gap-3">
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary"
                  aria-hidden="true"
                >
                  {subject.avatarLabel ?? fallbackAvatarLabel(subject.id)}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="break-words">{subjectDisplayName(subject)}</strong>
                    <span className="rounded-md border px-1.5 py-0.5 text-xs text-muted-foreground">
                      {subject.subjectKindLabel ?? subjectKindLabel(subject)}
                    </span>
                    {subject.isOrphaned ? (
                      <span className="rounded-md border border-[hsl(var(--status-warning))]/35 bg-[hsl(var(--status-warning))]/10 px-1.5 py-0.5 text-xs text-foreground">
                        已失效或未同步
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 break-words text-xs text-muted-foreground">
                    {subject.displayPath ?? "未返回组织路径"}
                  </p>
                  <code className="mt-1 block break-all text-xs text-muted-foreground">{subject.id}</code>
                </div>
              </div>
              <Button
                aria-label={`移除${subject.type === "feishu_department" ? "组织" : "用户"} ${subjectDisplayName(subject)}`}
                disabled={props.disabled}
                size="icon"
                title="移除"
                type="button"
                variant="ghost"
                onClick={() => {
                  props.onRemove(subject);
                }}
              >
                <X aria-hidden="true" size={16} />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function subjectKindLabel(subject: IamRoleSubject): "组织" | "用户" {
  return subject.type === "feishu_department" ? "组织" : "用户";
}

function subjectDisplayName(subject: IamRoleSubject): string {
  if (subject.displayName?.trim()) {
    return subject.displayName;
  }
  return subject.type === "feishu_department" ? "未返回名称的组织" : "未返回名称的用户";
}

function fallbackAvatarLabel(value: string): string {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 1) : "?";
}

function SummaryPanel(props: {
  changed: boolean;
  diff: { added: IamRoleSubject[]; removed: IamRoleSubject[] };
  disabled: boolean;
  saving?: boolean;
  error?: string;
  onSave: () => void;
}) {
  const addedOrgs = props.diff.added.filter((subject) => subject.type === "feishu_department").length;
  const addedUsers = props.diff.added.filter((subject) => subject.type === "feishu_user").length;
  const removedOrgs = props.diff.removed.filter((subject) => subject.type === "feishu_department").length;
  const removedUsers = props.diff.removed.filter((subject) => subject.type === "feishu_user").length;

  return (
    <section className="sticky bottom-0 grid gap-3 rounded-md border bg-background p-4" aria-label="保存摘要">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold">变更摘要</h3>
        <StatusBadge tone={props.changed ? "warning" : "muted"}>{props.changed ? "有未保存变更" : "无变更"}</StatusBadge>
      </div>
      <div className="grid gap-2 text-sm text-muted-foreground">
        <p>新增组织 {addedOrgs} 个，移除组织 {removedOrgs} 个。</p>
        <p>新增用户 {addedUsers} 个，移除用户 {removedUsers} 个。</p>
        <p>部门主体不等于自动绑定全部用户；用户主体可以单独选择，重复覆盖不会重复保存。</p>
      </div>
      {props.error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {props.error}；草稿已保留，可修正后重试。
        </div>
      ) : null}
      <Button disabled={props.disabled} type="button" onClick={props.onSave}>
        {props.saving ? "保存中" : "保存组织与用户"}
      </Button>
    </section>
  );
}
