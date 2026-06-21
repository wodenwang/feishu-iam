import { useMemo, useState } from "react";
import type { Application, EntityStatus, IamRole } from "../../api/permission";
import { FormDialog } from "../../components/admin/FormDialog";
import { StatusBadge } from "../../components/admin/StatusBadge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { formatRoleStatus } from "./permission-form";

export function RoleApplicationBindingDialog(props: {
  applications: Application[];
  canManage: boolean;
  onBindApplication: (appKey: string) => Promise<void>;
  onOpenChange: (open: boolean) => void;
  onSetApplicationBindingStatus?: (appKey: string, status: EntityStatus) => Promise<void>;
  open: boolean;
  role: IamRole;
}) {
  const [query, setQuery] = useState("");
  const [pendingAppKey, setPendingAppKey] = useState<string>();
  const [error, setError] = useState<string>();
  const normalizedQuery = query.trim().toLowerCase();
  const activeApplications = useMemo(
    () => (props.role.applications ?? []).filter((application) => application.bindingStatus === "active"),
    [props.role.applications],
  );
  const activeAppKeys = useMemo(
    () => new Set(activeApplications.map((application) => application.appKey)),
    [activeApplications],
  );
  const disabledAppKeys = useMemo(
    () => new Set(
      (props.role.applications ?? [])
        .filter((application) => application.bindingStatus !== "active")
        .map((application) => application.appKey),
    ),
    [props.role.applications],
  );
  const unboundApplications = props.applications.filter(
    (application) => !activeAppKeys.has(application.appKey),
  );
  const filteredActiveApplications = activeApplications.filter((application) =>
    matchesApplicationQuery(application, normalizedQuery),
  );
  const filteredUnboundApplications = unboundApplications.filter((application) =>
    matchesApplicationQuery(application, normalizedQuery),
  );

  async function runAction(appKey: string, action: () => Promise<void>) {
    setPendingAppKey(appKey);
    setError(undefined);
    try {
      await action();
    } catch (actionError: unknown) {
      setError(actionError instanceof Error ? actionError.message : "无法更新角色关联应用");
    } finally {
      setPendingAppKey(undefined);
    }
  }

  return (
    <FormDialog
      contentClassName="max-w-3xl"
      error={error}
      onOpenChange={props.onOpenChange}
      open={props.open}
      pending={Boolean(pendingAppKey)}
      title="管理角色关联应用"
    >
      <div className="grid gap-4">
        <label className="grid gap-1.5 text-sm font-medium">
          <span>搜索应用</span>
          <Input
            aria-label="搜索应用"
            placeholder="搜索应用名称 / app key"
            value={query}
            onChange={(event) => { setQuery(event.target.value); }}
          />
        </label>
        <section className="grid gap-2">
          <div>
            <h3 className="text-sm font-semibold">已关联应用</h3>
            <p className="text-xs text-muted-foreground">
              移除应用会将绑定状态置为停用，不会删除历史关系，并会写入审计日志。
            </p>
          </div>
          <div className="grid gap-2">
            {filteredActiveApplications.map((application) => (
              <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" key={application.appKey}>
                <div className="grid min-w-0 gap-1">
                  <span className="truncate text-sm font-medium">{application.name}</span>
                  <code className="break-all text-xs text-muted-foreground">{application.appKey}</code>
                  <span className="flex flex-wrap gap-1.5">
                    <StatusBadge tone={application.status === "active" ? "success" : "muted"}>
                      {formatRoleStatus(application.status)}
                    </StatusBadge>
                    <StatusBadge tone={application.bindingStatus === "active" ? "success" : "muted"}>
                      {application.bindingStatus === "active" ? "已绑定" : "绑定停用"}
                    </StatusBadge>
                  </span>
                </div>
                <Button
                  disabled={
                    !props.canManage ||
                    !props.onSetApplicationBindingStatus ||
                    application.bindingStatus !== "active" ||
                    Boolean(pendingAppKey)
                  }
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() => {
                    void runAction(application.appKey, async () => {
                      await props.onSetApplicationBindingStatus?.(application.appKey, "disabled");
                    });
                  }}
                >
                  {pendingAppKey === application.appKey ? "移除中..." : "移除"}
                </Button>
              </div>
            ))}
            {filteredActiveApplications.length === 0 ? (
              <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                {activeApplications.length === 0 ? "当前角色暂无关联应用。" : "当前搜索下暂无已关联应用。"}
              </p>
            ) : null}
          </div>
        </section>

        <section className="grid gap-2">
          <div>
            <h3 className="text-sm font-semibold">可添加应用</h3>
            <p className="text-xs text-muted-foreground">
              添加后可在该应用下维护权限组绑定。
            </p>
          </div>
          <div className="grid gap-2">
            {filteredUnboundApplications.map((application) => (
              <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" key={application.appKey}>
                <div className="grid min-w-0 gap-1">
                  <span className="truncate text-sm font-medium">{application.name}</span>
                  <code className="break-all text-xs text-muted-foreground">{application.appKey}</code>
                  <StatusBadge tone={application.status === "active" ? "success" : "muted"}>
                    {formatRoleStatus(application.status)}
                  </StatusBadge>
                  {disabledAppKeys.has(application.appKey) ? (
                    <StatusBadge tone="muted">可恢复绑定</StatusBadge>
                  ) : null}
                </div>
                <Button
                  disabled={!props.canManage || Boolean(pendingAppKey)}
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() => {
                    void runAction(application.appKey, async () => {
                      await props.onBindApplication(application.appKey);
                    });
                  }}
                >
                  {pendingAppKey === application.appKey ? "添加中..." : "添加"}
                </Button>
              </div>
            ))}
            {filteredUnboundApplications.length === 0 ? (
              <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                {unboundApplications.length === 0 ? "所有应用均已关联。" : "当前搜索下暂无可添加应用。"}
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </FormDialog>
  );
}

function matchesApplicationQuery(
  application: Pick<Application, "appKey" | "name"> | { appKey: string; name: string },
  query: string,
): boolean {
  if (!query) {
    return true;
  }
  return [application.name, application.appKey].some((value) => value.toLowerCase().includes(query));
}
