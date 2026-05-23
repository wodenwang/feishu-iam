import type { AdminRole, CurrentSession, PermissionCode } from './types';

export const hasPermission = (session: CurrentSession | undefined, permission: PermissionCode) =>
  Boolean(session?.permissions.includes(permission));

export const hasAllPermissions = (session: CurrentSession | undefined, permissions: PermissionCode[]) =>
  permissions.every((permission) => hasPermission(session, permission));

export const hasAnyPermission = (session: CurrentSession | undefined, permissions: PermissionCode[]) =>
  permissions.some((permission) => hasPermission(session, permission));

export const hasRole = (session: CurrentSession | undefined, role: AdminRole) => Boolean(session?.roles.includes(role));

export const isPlatformAdmin = (session: CurrentSession | undefined) => hasRole(session, 'platform_admin');

export const isApplicationAdminOnly = (session: CurrentSession | undefined) =>
  Boolean(session?.roles.includes('application_admin') && !session.roles.includes('platform_admin'));

export const getScopedApplicationIds = (session: CurrentSession | undefined) =>
  isApplicationAdminOnly(session) ? (session?.applicationIds ?? []) : undefined;

export const canCreateApplication = (session: CurrentSession | undefined) =>
  isPlatformAdmin(session) && hasPermission(session, 'application:create');

export const canDisableApplications = (session: CurrentSession | undefined) =>
  isPlatformAdmin(session) && hasPermission(session, 'application:disable');

export const canUpdateRoles = (session: CurrentSession | undefined) => hasPermission(session, 'role:update');

export const canRunSync = (session: CurrentSession | undefined) => hasPermission(session, 'sync:run');

export const canDisableApplication = (session: CurrentSession | undefined) => hasPermission(session, 'application:disable');

export const canRotateApplicationSecret = (session: CurrentSession | undefined) =>
  hasPermission(session, 'application:secret');
