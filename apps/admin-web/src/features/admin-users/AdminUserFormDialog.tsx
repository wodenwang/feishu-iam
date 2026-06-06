import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { searchFeishuUsers } from "../../api/feishu";
import type { FeishuUserCandidate } from "../../api/feishu";
import type { Application } from "../../api/permission";
import { FormDialog } from "../../components/admin/FormDialog";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  editableAdminRoles,
  validateAdminUserDraft,
} from "./admin-user-form";
import type { AdminUserDraft, EditableAdminRole } from "./admin-user-form";

export type AdminUserFormDialogProps = {
  open: boolean;
  draft: AdminUserDraft;
  applications: Application[];
  pending: boolean;
  error?: string | null;
  onDraftChange: (draft: AdminUserDraft) => void;
  onSubmit: () => void;
  onOpenChange: (open: boolean) => void;
};

export function AdminUserFormDialog(props: AdminUserFormDialogProps) {
  const fieldErrors = useMemo(
    () => validateAdminUserDraft(props.draft),
    [props.draft],
  );
  const isCreateMode = props.draft.mode === "create";
  const isApplicationAdmin = props.draft.roleKey === "application_admin";
  const [userKeyword, setUserKeyword] = useState(props.draft.feishuUserId);
  const [userCandidates, setUserCandidates] = useState<FeishuUserCandidate[]>(
    [],
  );
  const [searchPending, setSearchPending] = useState(false);
  const [searchError, setSearchError] = useState<string>();

  useEffect(() => {
    if (!props.open) {
      return;
    }
    setUserKeyword(props.draft.feishuUserId);
    setUserCandidates([]);
    setSearchError(undefined);
    setSearchPending(false);
  }, [props.draft.adminUserId, props.draft.mode, props.open]);

  async function handleSearchUsers() {
    const keyword = userKeyword.trim();
    if (!keyword) {
      setSearchError("请输入姓名、邮箱或飞书 user_id 后再搜索");
      setUserCandidates([]);
      return;
    }

    setSearchPending(true);
    setSearchError(undefined);
    try {
      setUserCandidates(await searchFeishuUsers(keyword));
    } catch (error: unknown) {
      setUserCandidates([]);
      setSearchError(error instanceof Error ? error.message : "无法搜索飞书用户");
    } finally {
      setSearchPending(false);
    }
  }

  function updateDraft(nextDraft: AdminUserDraft) {
    props.onDraftChange(nextDraft);
  }

  return (
    <FormDialog
      contentClassName="sm:max-w-2xl"
      error={props.error ?? undefined}
      onOpenChange={props.onOpenChange}
      open={props.open}
      pending={props.pending}
      title={isCreateMode ? "新增管理员" : "编辑管理员授权"}
    >
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          props.onSubmit();
        }}
      >
        {isCreateMode ? (
          <div className="grid gap-2">
            <Label htmlFor="admin-user-search">飞书用户</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="admin-user-search"
                disabled={props.pending || searchPending}
                placeholder="搜索姓名、邮箱或 user_id"
                value={userKeyword}
                onChange={(event) => {
                  setUserKeyword(event.target.value);
                  updateDraft({
                    ...props.draft,
                    feishuUserId: event.target.value,
                  });
                }}
              />
              <Button
                className="whitespace-nowrap"
                disabled={
                  props.pending ||
                  searchPending ||
                  userKeyword.trim().length === 0
                }
                type="button"
                variant="outline"
                onClick={() => {
                  void handleSearchUsers();
                }}
              >
                <Search aria-hidden="true" size={16} />
                {searchPending ? "搜索中" : "搜索用户"}
              </Button>
            </div>
            {fieldErrors.feishuUserId ? (
              <p className="text-sm text-destructive">
                {fieldErrors.feishuUserId}
              </p>
            ) : null}
            {searchError ? (
              <p className="text-sm text-destructive">{searchError}</p>
            ) : null}
            {userCandidates.length > 0 ? (
              <div
                aria-label="飞书用户搜索结果"
                className="grid max-h-[220px] gap-2 overflow-y-auto rounded-md border p-2"
              >
                {userCandidates.map((candidate) => (
                  <button
                    className="grid gap-1 rounded-md px-3 py-2 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    key={candidate.userId}
                    type="button"
                    onClick={() => {
                      setUserKeyword(candidate.userId);
                      updateDraft({
                        ...props.draft,
                        feishuUserId: candidate.userId,
                      });
                    }}
                  >
                    <span className="font-medium">{candidate.name}</span>
                    <span className="break-all text-xs text-muted-foreground">
                      {candidate.userId}
                      {candidate.email ? ` / ${candidate.email}` : ""}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-2">
            <Label htmlFor="admin-user-feishu-id">飞书 user_id</Label>
            <Input
              disabled
              id="admin-user-feishu-id"
              value={props.draft.feishuUserId}
            />
          </div>
        )}

        <div className="grid gap-2">
          <Label htmlFor="admin-user-role">管理员类型</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            disabled={props.pending}
            id="admin-user-role"
            value={props.draft.roleKey}
            onChange={(event) => {
              const roleKey = event.target.value as EditableAdminRole;
              updateDraft({
                ...props.draft,
                roleKey,
                applicationIds:
                  roleKey === "platform_admin" ? [] : props.draft.applicationIds,
              });
            }}
          >
            {editableAdminRoles.map((role) => (
              <option key={role.roleKey} value={role.roleKey}>
                {role.label}
              </option>
            ))}
          </select>
        </div>

        {isApplicationAdmin ? (
          <fieldset className="grid gap-2 rounded-md border p-3">
            <legend className="px-1 text-sm font-medium">应用范围</legend>
            {props.applications.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无可选择应用</p>
            ) : (
              <div className="grid max-h-[260px] gap-2 overflow-y-auto">
                {props.applications.map((application) => (
                  <label
                    className="flex items-start gap-2 rounded-md border px-3 py-2 text-sm"
                    key={application.id}
                  >
                    <input
                      checked={props.draft.applicationIds.includes(application.id)}
                      className="mt-1"
                      disabled={props.pending}
                      type="checkbox"
                      onChange={(event) => {
                        updateDraft({
                          ...props.draft,
                          applicationIds: event.target.checked
                            ? [...props.draft.applicationIds, application.id]
                            : props.draft.applicationIds.filter(
                                (applicationId) =>
                                  applicationId !== application.id,
                              ),
                        });
                      }}
                    />
                    <span className="min-w-0">
                      <span className="block font-medium">
                        {application.name}
                      </span>
                      <code className="block break-all text-xs text-muted-foreground">
                        {application.appKey}
                      </code>
                    </span>
                  </label>
                ))}
              </div>
            )}
            {fieldErrors.applicationIds ? (
              <p className="text-sm text-destructive">
                {fieldErrors.applicationIds}
              </p>
            ) : null}
          </fieldset>
        ) : (
          <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            平台管理员默认拥有全部应用范围，不需要单独选择应用。
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <Button
            disabled={props.pending}
            type="button"
            variant="outline"
            onClick={() => {
              props.onOpenChange(false);
            }}
          >
            取消
          </Button>
          <Button disabled={props.pending} type="submit">
            {props.pending ? "保存中" : "保存授权"}
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}
