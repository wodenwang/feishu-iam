import type { ReactNode, SyntheticEvent } from "react";
import { useEffect, useState } from "react";
import { createIamRole } from "../../api/permission";
import type { IamRole } from "../../api/permission";
import { FormDialog } from "../../components/admin/FormDialog";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import {
  emptyPermissionRoleDraft,
  hasRoleFormErrors,
  toCreateRolePayload,
  validateCreateRoleDraft,
} from "./permission-form";
import type { PermissionRoleDraft, PermissionRoleFormErrors } from "./permission-form";

export function PermissionRoleCreateDialog(props: {
  appKey?: string;
  open: boolean;
  onCreated: (role: IamRole) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [draft, setDraft] = useState<PermissionRoleDraft>(emptyPermissionRoleDraft);
  const [errors, setErrors] = useState<PermissionRoleFormErrors>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (props.open) {
      setDraft(emptyPermissionRoleDraft);
      setErrors({});
      setError(undefined);
    }
  }, [props.open]);

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!props.appKey) {
      setError("请先选择应用");
      return;
    }

    const nextErrors = validateCreateRoleDraft(draft);
    setErrors(nextErrors);
    if (hasRoleFormErrors(nextErrors)) {
      return;
    }

    setPending(true);
    setError(undefined);
    try {
      const role = await createIamRole(props.appKey, toCreateRolePayload(draft));
      props.onOpenChange(false);
      props.onCreated(role);
    } catch (createError: unknown) {
      setError(createError instanceof Error ? createError.message : "无法创建 IAM 角色");
    } finally {
      setPending(false);
    }
  }

  return (
    <FormDialog error={error} onOpenChange={props.onOpenChange} open={props.open} pending={pending} title="创建 IAM 角色">
      <form className="grid gap-4" onSubmit={(event) => void handleSubmit(event)}>
        <RoleField label="角色 key" error={errors.key}>
          <Input
            aria-label="角色 key"
            autoComplete="off"
            disabled={pending}
            placeholder={`${props.appKey ?? "app"}.operator`}
            value={draft.key}
            onChange={(event) => {
              setDraft((current) => ({ ...current, key: event.target.value }));
            }}
          />
        </RoleField>
        <RoleField label="角色名称" error={errors.name}>
          <Input
            aria-label="角色名称"
            autoComplete="off"
            disabled={pending}
            placeholder="业务操作员"
            value={draft.name}
            onChange={(event) => {
              setDraft((current) => ({ ...current, name: event.target.value }));
            }}
          />
        </RoleField>
        <RoleField label="描述" error={errors.description}>
          <Textarea
            aria-label="角色描述"
            disabled={pending}
            placeholder="说明该角色负责的业务授权范围"
            value={draft.description}
            onChange={(event) => {
              setDraft((current) => ({ ...current, description: event.target.value }));
            }}
          />
        </RoleField>
        <div className="flex justify-end gap-2">
          <Button disabled={pending} type="button" variant="outline" onClick={() => { props.onOpenChange(false); }}>
            取消
          </Button>
          <Button disabled={pending || draft.key.trim().length === 0 || draft.name.trim().length === 0} type="submit">
            {pending ? "创建中" : "创建角色"}
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}

export function RoleField(props: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-foreground">
      <span>{props.label}</span>
      {props.children}
      {props.error ? <span className="text-xs font-normal text-destructive">{props.error}</span> : null}
    </label>
  );
}
