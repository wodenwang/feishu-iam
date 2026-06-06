import { PermissionDomainError } from './permission.types';

const APPLICATION_KEY_PATTERN = /^[a-z][a-z0-9_-]{1,31}$/;
const ROLE_KEY_PATTERN = /^[a-z0-9][a-z0-9._-]{0,127}$/;

export function assertApplicationKey(appKey: string): void {
  if (!APPLICATION_KEY_PATTERN.test(appKey)) {
    throw new PermissionDomainError('APPLICATION_KEY_INVALID', '应用 key 不符合规则');
  }
}

export function assertPermissionKey(
  appKey: string,
  key: string,
  kind: 'permission_group' | 'permission_point'
): void {
  const pattern = new RegExp(`^${escapeRegExp(appKey)}\\.[a-z0-9][a-z0-9._-]{0,127}$`);
  if (!pattern.test(key)) {
    throw new PermissionDomainError(
      kind === 'permission_group' ? 'PERMISSION_GROUP_KEY_INVALID' : 'PERMISSION_POINT_KEY_INVALID',
      `${kind === 'permission_group' ? '权限组' : '权限点'} key 必须以 ${appKey}. 开头`
    );
  }
}

export function assertRoleKey(key: string): void {
  if (!ROLE_KEY_PATTERN.test(key)) {
    throw new PermissionDomainError('IAM_ROLE_KEY_INVALID', 'IAM 角色 key 不符合规则');
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
