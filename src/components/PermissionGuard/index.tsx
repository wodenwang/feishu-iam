import type { ReactNode } from 'react';
import { useCurrentSession } from '../../features/iam/queries';
import type { PermissionCode } from '../../features/iam/types';

interface PermissionGuardBaseProps {
  requireAll?: boolean;
  fallback?: ReactNode;
  children: ReactNode;
}

type PermissionGuardProps =
  | (PermissionGuardBaseProps & { permission: PermissionCode; permissions?: never })
  | (PermissionGuardBaseProps & { permission?: never; permissions: PermissionCode[] })
  | (PermissionGuardBaseProps & { permission?: never; permissions?: never });

export function PermissionGuard({
  permission,
  permissions = permission ? [permission] : [],
  requireAll = true,
  fallback = null,
  children,
}: PermissionGuardProps) {
  const { data: session } = useCurrentSession();

  if (!session) {
    return fallback;
  }

  const allowed =
    permissions.length === 0 ||
    (requireAll
      ? permissions.every((item) => session.permissions.includes(item))
      : permissions.some((item) => session.permissions.includes(item)));

  return allowed ? children : fallback;
}
