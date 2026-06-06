import { Eye, Pencil, Power, PowerOff } from "lucide-react";
import type { AdminUser } from "../../api/admin";
import type { DataTableColumn } from "../../components/admin/DataTable";
import { StatusBadge } from "../../components/admin/StatusBadge";
import { Button } from "../../components/ui/button";
import {
  formatAdminRoleLabel,
  formatAdminStatus,
  formatApplicationScopes,
  formatDateTime,
  isReadonlyAdminUser,
} from "./admin-user-form";

export type AdminUserRowAction =
  | { type: "detail"; adminUser: AdminUser }
  | { type: "edit"; adminUser: AdminUser }
  | { type: "enable"; adminUser: AdminUser }
  | { type: "disable"; adminUser: AdminUser };

export function createAdminUserColumns(options: {
  onAction: (action: AdminUserRowAction) => void;
}): DataTableColumn<AdminUser>[] {
  return [
    {
      key: "admin",
      header: "管理员",
      minWidth: "240px",
      render: (adminUser) => (
        <div className="grid min-w-0 gap-1">
          <span className="font-medium text-foreground">
            {adminUser.displayName || "未命名管理员"}
          </span>
          <code
            className="block max-w-[220px] truncate rounded bg-muted px-2 py-1 text-xs"
            title={`飞书 user_id: ${adminUser.feishuUserId}`}
          >
            飞书 user_id: {adminUser.feishuUserId}
          </code>
        </div>
      ),
    },
    {
      key: "roles",
      header: "后台角色",
      minWidth: "200px",
      render: (adminUser) => formatAdminRoleLabel(adminUser.roles),
    },
    {
      key: "status",
      header: "状态",
      width: "96px",
      minWidth: "96px",
      nowrap: true,
      render: (adminUser) => (
        <StatusBadge
          tone={adminUser.status === "disabled" ? "muted" : "success"}
        >
          {formatAdminStatus(adminUser.status)}
        </StatusBadge>
      ),
    },
    {
      key: "applications",
      header: "应用范围",
      minWidth: "260px",
      render: (adminUser) => (
        <span
          className="line-clamp-2"
          title={formatApplicationScopes(adminUser.applicationScopes)}
        >
          {formatApplicationScopes(adminUser.applicationScopes)}
        </span>
      ),
    },
    {
      key: "createdAt",
      header: "创建时间",
      width: "180px",
      minWidth: "180px",
      nowrap: true,
      render: (adminUser) => formatDateTime(adminUser.createdAt),
    },
    {
      key: "actions",
      header: "操作",
      className:
        "sticky right-0 z-10 bg-background shadow-[-12px_0_16px_-16px_rgba(15,23,42,0.35)]",
      headerClassName:
        "sticky right-0 z-20 bg-background shadow-[-12px_0_16px_-16px_rgba(15,23,42,0.35)]",
      width: "168px",
      minWidth: "168px",
      nowrap: true,
      render: (adminUser) => {
        const readonly = isReadonlyAdminUser(adminUser);
        const statusAction =
          adminUser.status === "disabled" ? "enable" : "disable";

        return (
          <div className="flex w-full items-center justify-end gap-1.5">
            <Button
              aria-label={`查看 ${adminUser.displayName || adminUser.feishuUserId} 详情`}
              className="h-8 w-8 min-h-8 p-0"
              size="icon"
              title="详情"
              type="button"
              variant="outline"
              onClick={() => {
                options.onAction({ type: "detail", adminUser });
              }}
            >
              <Eye aria-hidden="true" size={16} />
              <span className="sr-only">详情</span>
            </Button>
            {readonly ? (
              <span className="whitespace-nowrap rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                历史角色只读
              </span>
            ) : (
              <>
                <Button
                  aria-label="编辑"
                  className="h-8 w-8 min-h-8 p-0"
                  size="icon"
                  title="编辑"
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    options.onAction({ type: "edit", adminUser });
                  }}
                >
                  <Pencil aria-hidden="true" size={16} />
                  <span className="sr-only">编辑</span>
                </Button>
                <Button
                  aria-label={statusAction === "disable" ? "停用" : "启用"}
                  className="h-8 w-8 min-h-8 p-0"
                  size="icon"
                  title={statusAction === "disable" ? "停用" : "启用"}
                  type="button"
                  variant={statusAction === "disable" ? "destructive" : "secondary"}
                  onClick={() => {
                    options.onAction({ type: statusAction, adminUser });
                  }}
                >
                  {statusAction === "disable" ? (
                    <PowerOff aria-hidden="true" size={16} />
                  ) : (
                    <Power aria-hidden="true" size={16} />
                  )}
                  <span className="sr-only">
                    {statusAction === "disable" ? "停用" : "启用"}
                  </span>
                </Button>
              </>
            )}
          </div>
        );
      },
    },
  ];
}
