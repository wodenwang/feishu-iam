import type { DbPool } from '../db/pool';
import type { CurrentActor } from '../plugins/requestContext';
import { forbidden, unauthorized } from './errors/httpError';

export const applicationAdminPermissions = [
  'dashboard:view',
  'application:view',
  'application:secret',
  'role:view',
  'role:update',
  'audit:view',
];

export function requireAdminActor(actor: CurrentActor | null, message = '没有权限执行此操作'): CurrentActor {
  if (!actor) {
    throw unauthorized();
  }
  if (!actor.isPlatformAdmin && actor.applicationIds.length === 0) {
    throw forbidden(message);
  }
  return actor;
}

export function getScopedApplicationIds(actor: CurrentActor): string[] | undefined {
  return actor.isPlatformAdmin ? undefined : actor.applicationIds;
}

export function requireApplicationScope(actor: CurrentActor | null, applicationId: string, message = '没有权限访问该应用'): CurrentActor {
  const currentActor = requireAdminActor(actor, message);
  if (!currentActor.isPlatformAdmin && !currentActor.applicationIds.includes(applicationId)) {
    throw forbidden(message);
  }
  return currentActor;
}

export function addApplicationScopeFilter(
  actor: CurrentActor,
  filters: string[],
  values: Array<string | number | string[]>,
  columnExpression: string,
): void {
  const scopedApplicationIds = getScopedApplicationIds(actor);
  if (!scopedApplicationIds) {
    return;
  }
  if (scopedApplicationIds.length === 0) {
    throw forbidden('没有可访问的应用');
  }
  values.push(scopedApplicationIds);
  filters.push(`${columnExpression} = any($${values.length}::uuid[])`);
}

export async function requireRoleScope(pool: DbPool, actor: CurrentActor | null, roleId: string): Promise<void> {
  const currentActor = requireAdminActor(actor, '没有权限管理角色');
  if (currentActor.isPlatformAdmin) {
    return;
  }

  const result = await pool.query('select application_id from roles where id = $1', [roleId]);
  const applicationId = result.rows[0]?.application_id as string | undefined;
  if (!applicationId) {
    return;
  }
  requireApplicationScope(currentActor, applicationId, '没有权限管理该应用的角色');
}
