import { Pencil, Power, PowerOff } from "lucide-react";
import type { AdminUser } from "../../api/admin";
import { DetailSheet } from "../../components/admin/DetailSheet";
import { StatusBadge } from "../../components/admin/StatusBadge";
import { Button } from "../../components/ui/button";
import {
  formatAdminRoleLabel,
  formatAdminStatus,
  formatApplicationScopes,
  formatDateTime,
  isReadonlyAdminUser,
} from "./admin-user-form";

export type AdminUserDetailSheetProps = {
  adminUser: AdminUser | null;
  roleMissing?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (adminUser: AdminUser) => void;
  onEnable: (adminUser: AdminUser) => void;
  onDisable: (adminUser: AdminUser) => void;
};

export function AdminUserDetailSheet(props: AdminUserDetailSheetProps) {
  const adminUser = props.adminUser;

  return (
    <DetailSheet
      defaultSize="wide"
      description={
        adminUser ? (
          <span className="flex flex-wrap items-center gap-2">
            <code className="break-all text-xs">
              飞书 user_id: {adminUser.feishuUserId}
            </code>
            <StatusBadge
              tone={adminUser.status === "disabled" ? "muted" : "success"}
            >
              {formatAdminStatus(adminUser.status)}
            </StatusBadge>
          </span>
        ) : props.roleMissing ? (
          <span>管理员授权不存在或已不在当前筛选结果中</span>
        ) : (
          <span>管理员授权详情</span>
        )
      }
      onOpenChange={props.onOpenChange}
      open={props.open}
      sizeStorageKey="feishu-iam:admin-users-detail-sheet-size"
      title="管理员详情"
    >
      {adminUser ? (
        <AdminUserDetailContent
          adminUser={adminUser}
          onDisable={props.onDisable}
          onEdit={props.onEdit}
          onEnable={props.onEnable}
        />
      ) : props.roleMissing ? (
        <div className="rounded-md border bg-background px-4 py-10 text-center">
          <h3 className="font-semibold">
            管理员授权不存在或已不在当前筛选结果中
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            请调整筛选条件，或关闭详情后重新选择管理员授权。
          </p>
          <Button
            className="mt-4"
            type="button"
            variant="outline"
            onClick={() => {
              props.onOpenChange(false);
            }}
          >
            关闭详情
          </Button>
        </div>
      ) : null}
    </DetailSheet>
  );
}

function AdminUserDetailContent(props: {
  adminUser: AdminUser;
  onEdit: (adminUser: AdminUser) => void;
  onEnable: (adminUser: AdminUser) => void;
  onDisable: (adminUser: AdminUser) => void;
}) {
  const readonly = isReadonlyAdminUser(props.adminUser);
  const disabled = props.adminUser.status === "disabled";

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 rounded-md border bg-background p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h3 className="text-base font-semibold">
              {props.adminUser.displayName || "未命名管理员"}
            </h3>
            <p className="mt-1 break-all text-sm text-muted-foreground">
              飞书 user_id: {props.adminUser.feishuUserId}
            </p>
          </div>
          {readonly ? (
            <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              历史角色只读展示，当前版本不支持在后台修改。
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                type="button"
                variant="outline"
                onClick={() => {
                  props.onEdit(props.adminUser);
                }}
              >
                <Pencil aria-hidden="true" size={16} />
                编辑授权
              </Button>
              <Button
                size="sm"
                type="button"
                variant={disabled ? "secondary" : "destructive"}
                onClick={() => {
                  if (disabled) {
                    props.onEnable(props.adminUser);
                  } else {
                    props.onDisable(props.adminUser);
                  }
                }}
              >
                {disabled ? (
                  <Power aria-hidden="true" size={16} />
                ) : (
                  <PowerOff aria-hidden="true" size={16} />
                )}
                {disabled ? "启用管理员" : "停用管理员"}
              </Button>
            </div>
          )}
        </div>

        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <InfoItem label="基本信息" value={props.adminUser.displayName || "-"} />
          <InfoItem label="飞书 user_id" value={props.adminUser.feishuUserId} code />
          <InfoItem
            label="后台角色"
            value={formatAdminRoleLabel(props.adminUser.roles)}
          />
          <InfoItem
            label="状态"
            value={formatAdminStatus(props.adminUser.status)}
          />
          <InfoItem
            label="创建时间"
            value={formatDateTime(props.adminUser.createdAt)}
          />
        </dl>
      </section>

      <section className="grid gap-3 rounded-md border bg-background p-4">
        <div>
          <h3 className="text-base font-semibold">应用范围</h3>
          <p className="text-sm text-muted-foreground">
            平台管理员默认拥有全部应用范围；应用管理员按授权应用生效。
          </p>
        </div>
        <p className="break-words text-sm">
          {formatApplicationScopes(props.adminUser.applicationScopes)}
        </p>
        {props.adminUser.applicationScopes.length > 0 ? (
          <ul className="grid gap-2">
            {props.adminUser.applicationScopes.map((scope) => (
              <li
                className="flex flex-col gap-2 rounded-md border p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                key={scope.id}
              >
                <span className="min-w-0">
                  <strong>{scope.name || "未命名应用"}</strong>
                  <code className="ml-2 break-all text-xs text-muted-foreground">
                    {scope.appKey}
                  </code>
                </span>
                {scope.status ? (
                  <StatusBadge
                    tone={scope.status === "disabled" ? "muted" : "success"}
                  >
                    {formatAdminStatus(scope.status)}
                  </StatusBadge>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
        审计说明：新增、编辑、启用和停用管理员授权后，后端会写入审计日志，可通过操作审计追溯操作者、来源、变更结果和 request id。
      </p>
    </div>
  );
}

function InfoItem(props: { label: string; value: string; code?: boolean }) {
  return (
    <div className="grid gap-1">
      <dt className="text-xs text-muted-foreground">{props.label}</dt>
      <dd className={props.code ? "break-all font-mono text-xs" : "break-all"}>
        {props.value}
      </dd>
    </div>
  );
}
