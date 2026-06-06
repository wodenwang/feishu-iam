import type { SyntheticEvent } from "react";
import { useEffect, useState } from "react";
import { updateIamRole } from "../../api/permission";
import type { IamRole } from "../../api/permission";
import { FormDialog } from "../../components/admin/FormDialog";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { RoleField } from "./PermissionRoleCreateDialog";
import {
  draftFromRole,
  hasRoleFormErrors,
  toUpdateRolePayload,
  validateEditRoleDraft,
} from "./permission-form";
import type { PermissionRoleDraft, PermissionRoleFormErrors } from "./permission-form";

export function PermissionRoleEditDialog(props: {
  appKey?: string;
  role: IamRole | null;
  open: boolean;
  onUpdated: (role: IamRole) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [draft, setDraft] = useState<PermissionRoleDraft>(() =>
    props.role ? draftFromRole(props.role) : { name: "", key: "", description: "", enabled: true },
  );
  const [errors, setErrors] = useState<PermissionRoleFormErrors>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (props.open && props.role) {
      setDraft(draftFromRole(props.role));
      setErrors({});
      setError(undefined);
    }
  }, [props.open, props.role]);

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!props.appKey || !props.role) {
      setError("请先选择 IAM 角色");
      return;
    }

    const nextErrors = validateEditRoleDraft(draft);
    setErrors(nextErrors);
    if (hasRoleFormErrors(nextErrors)) {
      return;
    }

    setPending(true);
    setError(undefined);
    try {
      const role = await updateIamRole(props.appKey, props.role.id, toUpdateRolePayload(draft));
      props.onUpdated(role);
      props.onOpenChange(false);
    } catch (updateError: unknown) {
      setError(updateError instanceof Error ? updateError.message : "无法更新 IAM 角色");
    } finally {
      setPending(false);
    }
  }

  return (
    <FormDialog error={error} onOpenChange={props.onOpenChange} open={props.open} pending={pending} title="编辑 IAM 角色">
      <form className="grid gap-4" onSubmit={(event) => void handleSubmit(event)}>
        <RoleField label="角色 key">
          <Input aria-label="角色 key" disabled readOnly value={draft.key} />
        </RoleField>
        <RoleField label="角色名称" error={errors.name}>
          <Input
            aria-label="编辑角色名称"
            autoComplete="off"
            disabled={pending}
            value={draft.name}
            onChange={(event) => {
              setDraft((current) => ({ ...current, name: event.target.value }));
            }}
          />
        </RoleField>
        <RoleField label="描述" error={errors.description}>
          <Textarea
            aria-label="编辑角色描述"
            disabled={pending}
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
          <Button disabled={pending} type="submit">
            {pending ? "保存中" : "保存角色"}
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}
