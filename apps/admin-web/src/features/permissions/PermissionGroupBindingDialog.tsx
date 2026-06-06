import { useEffect, useMemo, useState } from "react";
import { replaceIamRolePermissionGroups } from "../../api/permission";
import type { IamRole, PermissionGroup } from "../../api/permission";
import { FormDialog } from "../../components/admin/FormDialog";
import { StatusBadge } from "../../components/admin/StatusBadge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { readBoundPermissionGroupIds } from "./permission-columns";
import { formatRoleStatus } from "./permission-form";

export function PermissionGroupBindingDialog(props: {
  open: boolean;
  appKey?: string;
  role: IamRole | null;
  groups: PermissionGroup[];
  onSaved: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (props.open && props.role) {
      setSelectedIds(readBoundPermissionGroupIds(props.role));
      setQuery("");
      setError(undefined);
    }
  }, [props.open, props.role]);

  const filteredGroups = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) {
      return props.groups;
    }
    return props.groups.filter((group) =>
      [group.name, group.key, group.description ?? ""].some((value) => value.toLowerCase().includes(keyword)),
    );
  }, [props.groups, query]);

  const originalIds = props.role ? readBoundPermissionGroupIds(props.role) : [];
  const addedCount = selectedIds.filter((id) => !originalIds.includes(id)).length;
  const removedCount = originalIds.filter((id) => !selectedIds.includes(id)).length;

  async function handleSave() {
    if (!props.appKey || !props.role) {
      setError("请先选择 IAM 角色");
      return;
    }
    setPending(true);
    setError(undefined);
    try {
      await replaceIamRolePermissionGroups(props.appKey, props.role.id, selectedIds);
      props.onSaved();
      props.onOpenChange(false);
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "无法保存权限组绑定");
    } finally {
      setPending(false);
    }
  }

  return (
    <FormDialog error={error} onOpenChange={props.onOpenChange} open={props.open} pending={pending} title="绑定权限组">
      <div className="grid gap-4">
        <label className="grid gap-1.5 text-sm font-medium">
          <span>搜索权限组</span>
          <Input
            aria-label="搜索权限组"
            disabled={pending}
            placeholder="搜索权限组名称 / key / 描述"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
          />
        </label>
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          新增 {addedCount} 个，移除 {removedCount} 个。{selectedIds.length === 0 ? "保存后该角色将不绑定任何权限组。" : null}
        </div>
        <div className="grid max-h-[360px] gap-2 overflow-y-auto rounded-md border p-2">
          {filteredGroups.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">暂无可绑定权限组</p>
          ) : (
            filteredGroups.map((group) => (
              <label className="flex items-start gap-3 rounded-md border bg-background p-3 text-sm" key={group.id}>
                <input
                  className="mt-1"
                  checked={selectedIds.includes(group.id)}
                  disabled={pending}
                  type="checkbox"
                  onChange={() => {
                    setSelectedIds((current) =>
                      current.includes(group.id) ? current.filter((id) => id !== group.id) : [...current, group.id],
                    );
                  }}
                />
                <span className="grid min-w-0 flex-1 gap-1">
                  <span className="flex items-center gap-2">
                    <strong>{group.name}</strong>
                    <StatusBadge tone={group.status === "active" ? "success" : "muted"}>{formatRoleStatus(group.status)}</StatusBadge>
                  </span>
                  <code className="break-all text-xs text-muted-foreground">{group.key}</code>
                  <span className="text-xs text-muted-foreground">{group.description ?? "暂无描述"}</span>
                </span>
              </label>
            ))
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button disabled={pending} type="button" variant="outline" onClick={() => { props.onOpenChange(false); }}>
            取消
          </Button>
          <Button disabled={pending} type="button" onClick={() => void handleSave()}>
            {pending ? "保存中" : "保存权限组绑定"}
          </Button>
        </div>
      </div>
    </FormDialog>
  );
}
