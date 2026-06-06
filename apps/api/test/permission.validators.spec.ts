import { describe, expect, it } from 'vitest';
import {
  assertApplicationKey,
  assertPermissionKey,
  assertRoleKey
} from '../src/permission/permission.validators';

describe('permission validators', () => {
  it('接受合法应用 key', () => {
    expect(() => {
      assertApplicationKey('finance');
    }).not.toThrow();
  });

  it.each(['Finance', 'f'])('拒绝非法应用 key：%s', (appKey) => {
    expectPermissionDomainCode(() => {
      assertApplicationKey(appKey);
    }, 'APPLICATION_KEY_INVALID');
  });

  it('接受以应用 key 开头的权限点 key', () => {
    expect(() => {
      assertPermissionKey('finance', 'finance.invoice.read', 'permission_point');
    }).not.toThrow();
  });

  it.each(['invoice.read', 'crm.customer.read'])('拒绝非法权限点 key：%s', (key) => {
    expectPermissionDomainCode(() => {
      assertPermissionKey('finance', key, 'permission_point');
    }, 'PERMISSION_POINT_KEY_INVALID');
  });

  it('拒绝非法权限组 key', () => {
    expectPermissionDomainCode(() => {
      assertPermissionKey('finance', 'invoice_manager', 'permission_group');
    }, 'PERMISSION_GROUP_KEY_INVALID');
  });

  it('接受合法 IAM 角色 key', () => {
    expect(() => {
      assertRoleKey('invoice_manager');
    }).not.toThrow();
  });

  it('拒绝非法 IAM 角色 key', () => {
    expectPermissionDomainCode(() => {
      assertRoleKey('Invoice Manager');
    }, 'IAM_ROLE_KEY_INVALID');
  });
});

function expectPermissionDomainCode(action: () => void, code: string): void {
  try {
    action();
  } catch (error) {
    expect(error).toMatchObject({ code });
    return;
  }

  throw new Error(`Expected PermissionDomainError with code ${code}`);
}
