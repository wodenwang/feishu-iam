import {
  AppstoreOutlined,
  AuditOutlined,
  DashboardOutlined,
  DeploymentUnitOutlined,
  SafetyCertificateOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import type { ReactNode } from 'react';
import type { CurrentSession, PermissionCode } from '../features/iam/types';

export interface RouteItem {
  path: string;
  label: string;
  permission: PermissionCode;
  showInMenu: boolean;
  icon: ReactNode;
  element: ReactNode;
}

function Placeholder({ title }: { title: string }) {
  return <div>{title}</div>;
}

export const routeItems: RouteItem[] = [
  {
    path: '/dashboard',
    label: '工作台',
    permission: 'dashboard:view',
    showInMenu: true,
    icon: <DashboardOutlined />,
    element: <Placeholder title="工作台" />,
  },
  {
    path: '/applications',
    label: '应用管理',
    permission: 'application:view',
    showInMenu: true,
    icon: <AppstoreOutlined />,
    element: <Placeholder title="应用管理" />,
  },
  {
    path: '/roles',
    label: '角色授权',
    permission: 'role:view',
    showInMenu: true,
    icon: <SafetyCertificateOutlined />,
    element: <Placeholder title="角色授权" />,
  },
  {
    path: '/directory',
    label: '组织与用户',
    permission: 'directory:view',
    showInMenu: true,
    icon: <DeploymentUnitOutlined />,
    element: <Placeholder title="组织与用户" />,
  },
  {
    path: '/sync',
    label: '飞书同步',
    permission: 'sync:view',
    showInMenu: true,
    icon: <SyncOutlined />,
    element: <Placeholder title="飞书同步" />,
  },
  {
    path: '/audit-logs',
    label: '审计日志',
    permission: 'audit:view',
    showInMenu: true,
    icon: <AuditOutlined />,
    element: <Placeholder title="审计日志" />,
  },
];

export function canAccess(session: CurrentSession, permission: PermissionCode) {
  return session.permissions.includes(permission);
}

export function getVisibleMenuItems(items: RouteItem[], session: CurrentSession) {
  return items.filter((item) => item.showInMenu && canAccess(session, item.permission));
}
