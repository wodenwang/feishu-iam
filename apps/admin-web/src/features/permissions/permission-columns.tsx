import { Eye } from "lucide-react";
import type { IamRole, IamRoleSubject, PermissionGroup } from "../../api/permission";
import type { DataTableColumn } from "../../components/admin/DataTable";
import { StatusBadge } from "../../components/admin/StatusBadge";
import { Button } from "../../components/ui/button";
import { formatRoleStatus } from "./permission-form";

export type PermissionRoleRowAction =
  | { type: "detail"; role: IamRole };

export function createPermissionRoleColumns(options: {
  permissionGroupsById: Map<string, PermissionGroup>;
  onAction: (action: PermissionRoleRowAction) => void;
}): DataTableColumn<IamRole>[] {
  return [
    {
      key: "role",
      header: "角色名称",
      minWidth: "180px",
      render: (role) => (
        <div className="grid min-w-0 gap-1">
          <span className="font-medium text-foreground">{role.name}</span>
          <code className="block max-w-full truncate rounded bg-muted px-2 py-1 text-xs md:hidden" title={role.key}>
            {role.key}
          </code>
          <span className="line-clamp-2 text-xs text-muted-foreground">
            {role.description ?? "暂无描述"}
          </span>
        </div>
      ),
    },
    {
      key: "key",
      header: "角色 key",
      className: "hidden md:table-cell",
      headerClassName: "hidden md:table-cell",
      width: "240px",
      minWidth: "240px",
      render: (role) => (
        <code className="block max-w-[220px] truncate rounded bg-muted px-2 py-1 text-xs" title={role.key}>
          {role.key}
        </code>
      ),
    },
    {
      key: "status",
      header: "状态",
      className: "hidden lg:table-cell",
      headerClassName: "hidden lg:table-cell",
      width: "96px",
      minWidth: "96px",
      nowrap: true,
      render: (role) => (
        <StatusBadge tone={role.status === "active" ? "success" : "muted"}>
          {formatRoleStatus(role.status)}
        </StatusBadge>
      ),
    },
    {
      key: "groups",
      header: "权限组",
      className: "hidden lg:table-cell",
      headerClassName: "hidden lg:table-cell",
      minWidth: "220px",
      render: (role) => <PermissionGroupSummary role={role} groupsById={options.permissionGroupsById} />,
    },
    {
      key: "subjects",
      header: "成员",
      className: "hidden xl:table-cell",
      headerClassName: "hidden xl:table-cell",
      minWidth: "180px",
      render: (role) => <SubjectSummary subjects={role.subjects ?? []} />,
    },
    {
      key: "updatedAt",
      header: "更新时间",
      className: "hidden xl:table-cell",
      headerClassName: "hidden xl:table-cell",
      width: "180px",
      minWidth: "180px",
      nowrap: true,
      render: (role) => formatDateTime(role.updatedAt),
    },
    {
      key: "actions",
      header: "操作",
      className: "sticky right-0 z-10 bg-background shadow-[-12px_0_16px_-16px_rgba(15,23,42,0.35)]",
      headerClassName: "sticky right-0 z-20 bg-background shadow-[-12px_0_16px_-16px_rgba(15,23,42,0.35)]",
      width: "88px",
      minWidth: "88px",
      nowrap: true,
      render: (role) => {
        return (
          <div className="flex w-full items-center justify-end gap-1.5">
            <Button
              aria-label={`查看 ${role.key} 详情`}
              className="h-8 w-8 min-h-8 p-0"
              size="icon"
              title="详情"
              type="button"
              variant="outline"
              onClick={() => { options.onAction({ type: "detail", role }); }}
            >
              <Eye aria-hidden="true" size={16} />
              <span className="sr-only">详情</span>
            </Button>
          </div>
        );
      },
    },
  ];
}

function PermissionGroupSummary(props: { role: IamRole; groupsById: Map<string, PermissionGroup> }) {
  const groupIds = readBoundPermissionGroupIds(props.role);
  if (groupIds.length === 0) {
    return <span className="text-sm text-muted-foreground">暂无权限组</span>;
  }

  const visible = groupIds.slice(0, 2);
  const overflow = groupIds.length - visible.length;

  return (
    <div className="flex min-w-0 flex-wrap gap-1.5">
      {visible.map((groupId) => {
        const group = props.groupsById.get(groupId);
        return (
          <span className="max-w-[160px] truncate rounded border bg-muted px-2 py-1 text-xs" key={groupId} title={group?.key ?? groupId}>
            {group?.name ?? "已失效权限组"}
          </span>
        );
      })}
      {overflow > 0 ? <span className="rounded border bg-background px-2 py-1 text-xs text-muted-foreground">+{overflow}</span> : null}
    </div>
  );
}

function SubjectSummary({ subjects }: { subjects: IamRoleSubject[] }) {
  const userCount = subjects.filter((subject) => subject.type === "feishu_user").length;
  const departmentCount = subjects.filter((subject) => subject.type === "feishu_department").length;
  const orphanedCount = subjects.filter((subject) => subject.isOrphaned).length;

  if (subjects.length === 0) {
    return <span className="text-sm text-muted-foreground">暂无成员</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5 text-xs">
      <span className="rounded bg-muted px-2 py-1">用户 {userCount}</span>
      <span className="rounded bg-muted px-2 py-1">部门 {departmentCount}</span>
      {orphanedCount > 0 ? <span className="rounded bg-[hsl(var(--status-warning))]/10 px-2 py-1 text-foreground">失效 {orphanedCount}</span> : null}
    </div>
  );
}

export function readBoundPermissionGroupIds(role: IamRole): string[] {
  const groups = role.permissionGroups ?? [];
  if (groups.length > 0) {
    return groups.map((group) => group.id);
  }
  return role.permissionGroupIds ?? [];
}

export function hasRoleBindingDetails(role: IamRole): boolean {
  return Array.isArray(role.permissionGroupIds) && Array.isArray(role.subjects);
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
