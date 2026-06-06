import { useEffect, useMemo, useState } from "react";
import {
  searchApplicationFeishuDepartments,
  searchApplicationFeishuUsers,
} from "../../api/feishu";
import type { FeishuDepartmentCandidate, FeishuUserCandidate } from "../../api/feishu";
import { replaceIamRoleSubjects } from "../../api/permission";
import type { IamRole, IamRoleSubject } from "../../api/permission";
import { FormDialog } from "../../components/admin/FormDialog";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { formatSubjectType } from "./permission-form";
type SubjectSearch = "users" | "departments";

export function PermissionSubjectBindingDialog(props: {
  open: boolean;
  appKey?: string;
  role: IamRole | null;
  onSaved: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [subjects, setSubjects] = useState<IamRoleSubject[]>([]);
  const [userKeyword, setUserKeyword] = useState("");
  const [departmentKeyword, setDepartmentKeyword] = useState("");
  const [userCandidates, setUserCandidates] = useState<FeishuUserCandidate[]>([]);
  const [departmentCandidates, setDepartmentCandidates] = useState<FeishuDepartmentCandidate[]>([]);
  const [searching, setSearching] = useState<SubjectSearch | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (props.open && props.role) {
      setSubjects([...(props.role.subjects ?? [])]);
      setUserKeyword("");
      setDepartmentKeyword("");
      setUserCandidates([]);
      setDepartmentCandidates([]);
      setError(undefined);
    }
  }, [props.open, props.role]);

  const originalSubjects = useMemo(() => props.role?.subjects ?? [], [props.role]);
  const diff = countSubjectDiff(originalSubjects, subjects);

  async function handleSearchUsers() {
    if (!props.appKey) {
      setError("请先选择应用");
      return;
    }
    setSearching("users");
    setError(undefined);
    try {
      setUserCandidates(await searchApplicationFeishuUsers(props.appKey, userKeyword));
    } catch (searchError: unknown) {
      setError(searchError instanceof Error ? searchError.message : "无法搜索飞书用户");
    } finally {
      setSearching(null);
    }
  }

  async function handleSearchDepartments() {
    if (!props.appKey) {
      setError("请先选择应用");
      return;
    }
    setSearching("departments");
    setError(undefined);
    try {
      setDepartmentCandidates(await searchApplicationFeishuDepartments(props.appKey, departmentKeyword));
    } catch (searchError: unknown) {
      setError(searchError instanceof Error ? searchError.message : "无法搜索飞书部门");
    } finally {
      setSearching(null);
    }
  }

  async function handleSave() {
    if (!props.appKey || !props.role) {
      setError("请先选择 IAM 角色");
      return;
    }
    setPending(true);
    setError(undefined);
    try {
      await replaceIamRoleSubjects(props.appKey, props.role.id, subjects);
      props.onSaved();
      props.onOpenChange(false);
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "无法保存成员绑定");
    } finally {
      setPending(false);
    }
  }

  function addSubject(subject: IamRoleSubject) {
    setSubjects((current) =>
      current.some((item) => item.type === subject.type && item.id === subject.id) ? current : [...current, subject],
    );
  }

  function removeSubject(subject: IamRoleSubject) {
    setSubjects((current) => current.filter((item) => item.type !== subject.type || item.id !== subject.id));
  }

  return (
    <FormDialog
      contentClassName="sm:max-w-3xl"
      error={error}
      onOpenChange={props.onOpenChange}
      open={props.open}
      pending={pending}
      title="绑定成员"
    >
      <div className="grid gap-4">
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          新增用户 {diff.addedUsers} 个、部门 {diff.addedDepartments} 个；移除用户 {diff.removedUsers} 个、部门 {diff.removedDepartments} 个。
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="grid gap-2" aria-label="飞书用户候选">
            <h3 className="text-sm font-semibold">飞书用户</h3>
            <CandidateSearch
              addLabel="添加飞书用户"
              label="飞书 user_id"
              keyword={userKeyword}
              pending={searching === "users"}
              searchLabel="搜索飞书用户"
              onKeywordChange={setUserKeyword}
              onManualAdd={() => { addSubject({ type: "feishu_user", id: userKeyword.trim() }); }}
              onSearch={() => void handleSearchUsers()}
            />
            <UserCandidateList candidates={userCandidates} onAdd={(candidate) => { addSubject({ type: "feishu_user", id: candidate.userId }); }} />
          </section>
          <section className="grid gap-2" aria-label="飞书部门候选">
            <h3 className="text-sm font-semibold">飞书部门</h3>
            <CandidateSearch
              addLabel="添加飞书部门"
              label="飞书 department_id"
              keyword={departmentKeyword}
              pending={searching === "departments"}
              searchLabel="搜索飞书部门"
              onKeywordChange={setDepartmentKeyword}
              onManualAdd={() => { addSubject({ type: "feishu_department", id: departmentKeyword.trim() }); }}
              onSearch={() => void handleSearchDepartments()}
            />
            <DepartmentCandidateList
              candidates={departmentCandidates}
              onAdd={(candidate) => { addSubject({ type: "feishu_department", id: candidate.departmentId }); }}
            />
          </section>
        </div>
        <section className="grid gap-2" aria-label="已绑定成员草稿">
          <h3 className="text-sm font-semibold">已绑定成员</h3>
          {subjects.length === 0 ? (
            <p className="rounded-md border px-3 py-6 text-center text-sm text-muted-foreground">暂无已绑定成员</p>
          ) : (
            <ul className="grid max-h-[220px] gap-2 overflow-y-auto">
              {subjects.map((subject) => (
                <li className="flex items-center justify-between gap-3 rounded-md border bg-background p-3 text-sm" key={`${subject.type}:${subject.id}`}>
                  <span className="min-w-0">
                    <strong>{formatSubjectType(subject.type)}</strong>
                    <code className="ml-2 break-all text-xs text-muted-foreground">{subject.id}</code>
                    {subject.isOrphaned ? <span className="ml-2 rounded bg-amber-100 px-2 py-1 text-xs text-amber-800">orphaned</span> : null}
                  </span>
                  <Button size="sm" type="button" variant="ghost" onClick={() => { removeSubject(subject); }}>
                    移除
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <div className="flex justify-end gap-2">
          <Button disabled={pending} type="button" variant="outline" onClick={() => { props.onOpenChange(false); }}>
            取消
          </Button>
          <Button disabled={pending} type="button" onClick={() => void handleSave()}>
            {pending ? "保存中" : "保存成员绑定"}
          </Button>
        </div>
      </div>
    </FormDialog>
  );
}

function CandidateSearch(props: {
  label: string;
  addLabel: string;
  keyword: string;
  pending: boolean;
  searchLabel: string;
  onKeywordChange: (value: string) => void;
  onManualAdd: () => void;
  onSearch: () => void;
}) {
  return (
    <div className="mb-3 grid gap-2">
      <Input
        aria-label={props.label}
        disabled={props.pending}
        placeholder="输入姓名、邮箱、部门名称或 ID"
        value={props.keyword}
        onChange={(event) => { props.onKeywordChange(event.target.value); }}
      />
      <div className="flex flex-wrap gap-2">
        <Button className="whitespace-nowrap" disabled={props.pending} type="button" onClick={props.onSearch}>
          {props.pending ? "搜索中" : props.searchLabel}
        </Button>
        <Button
          className="whitespace-nowrap"
          disabled={props.pending || props.keyword.trim().length === 0}
          type="button"
          variant="outline"
          onClick={props.onManualAdd}
        >
          {props.addLabel}
        </Button>
      </div>
    </div>
  );
}

function UserCandidateList(props: { candidates: FeishuUserCandidate[]; onAdd: (candidate: FeishuUserCandidate) => void }) {
  if (props.candidates.length === 0) {
    return <p className="rounded-md border px-3 py-6 text-center text-sm text-muted-foreground">暂无用户候选</p>;
  }
  return (
    <ul className="grid max-h-[220px] gap-2 overflow-y-auto">
      {props.candidates.map((candidate) => (
        <li className="flex items-center justify-between gap-3 rounded-md border bg-background p-3 text-sm" key={candidate.userId}>
          <span className="min-w-0">
            <strong>{candidate.name}</strong>
            <code className="ml-2 break-all text-xs text-muted-foreground">{candidate.userId}</code>
          </span>
          <Button size="sm" type="button" variant="outline" onClick={() => { props.onAdd(candidate); }}>
            选择用户 {candidate.name}
          </Button>
        </li>
      ))}
    </ul>
  );
}

function DepartmentCandidateList(props: {
  candidates: FeishuDepartmentCandidate[];
  onAdd: (candidate: FeishuDepartmentCandidate) => void;
}) {
  if (props.candidates.length === 0) {
    return <p className="rounded-md border px-3 py-6 text-center text-sm text-muted-foreground">暂无部门候选</p>;
  }
  return (
    <ul className="grid max-h-[220px] gap-2 overflow-y-auto">
      {props.candidates.map((candidate) => (
        <li className="flex items-center justify-between gap-3 rounded-md border bg-background p-3 text-sm" key={candidate.departmentId}>
          <span className="min-w-0">
            <strong>{candidate.name}</strong>
            <code className="ml-2 break-all text-xs text-muted-foreground">{candidate.departmentId}</code>
          </span>
          <Button size="sm" type="button" variant="outline" onClick={() => { props.onAdd(candidate); }}>
            选择部门 {candidate.name}
          </Button>
        </li>
      ))}
    </ul>
  );
}

function countSubjectDiff(original: IamRoleSubject[], next: IamRoleSubject[]) {
  const originalKeys = new Set(original.map(subjectKey));
  const nextKeys = new Set(next.map(subjectKey));
  const added = next.filter((subject) => !originalKeys.has(subjectKey(subject)));
  const removed = original.filter((subject) => !nextKeys.has(subjectKey(subject)));

  return {
    addedUsers: added.filter((subject) => subject.type === "feishu_user").length,
    addedDepartments: added.filter((subject) => subject.type === "feishu_department").length,
    removedUsers: removed.filter((subject) => subject.type === "feishu_user").length,
    removedDepartments: removed.filter((subject) => subject.type === "feishu_department").length,
  };
}

function subjectKey(subject: IamRoleSubject): string {
  return `${subject.type}:${subject.id}`;
}
