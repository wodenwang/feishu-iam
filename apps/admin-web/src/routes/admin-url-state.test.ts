import { describe, expect, it } from 'vitest';
import { adminRoutes, getActiveAdminRoute, routePath } from './admin-routes';
import {
  closeSheet,
  parseAdminUserSearch,
  parseApplicationSearch,
  parsePermissionSearch,
  parseRecordSearch,
  parseSystemSettingsSearch,
  serializeAdminUserSearch,
  serializeApplicationSearch,
  serializePermissionSearch,
  serializeRecordSearch,
  serializeSystemSettingsSearch
} from './admin-url-state';
import type {
  AdminUserSearchState,
  ApplicationSearchState,
  PermissionSearchState,
  SystemSettingsSearchState
} from './admin-url-state';

describe('admin routes', () => {
  it('exposes stable admin route paths', () => {
    expect(adminRoutes.map((route) => route.id)).toEqual([
      'workspace',
      'applications',
      'permissions',
      'system'
    ]);
    expect(adminRoutes.find((route) => route.id === 'permissions')?.children?.map((route) => route.id)).toEqual([
      'permissionsRoleAuth',
      'permissionsMatrix'
    ]);
    expect(adminRoutes.find((route) => route.id === 'system')?.children?.map((route) => route.id)).toEqual([
      'systemFeishu',
      'systemAdmins',
      'systemAudit',
      'systemInfo'
    ]);
    expect(routePath('applications')).toBe('/admin/applications');
    expect(routePath('permissions')).toBe('/admin/permissions');
    expect(routePath('permissionsRoleAuth')).toBe('/admin/permissions');
    expect(routePath('permissionsMatrix')).toBe('/admin/permissions/matrix');
    expect(routePath('systemAudit')).toBe('/admin/system/audit');
    expect(routePath('records')).toBe('/admin/records');
    expect(getActiveAdminRoute('/admin/permissions')).toBe('permissionsRoleAuth');
    expect(getActiveAdminRoute('/admin/permissions/matrix')).toBe('permissionsMatrix');
    expect(getActiveAdminRoute('/admin/permissions/roles/role-1')).toBe('permissionsRoleAuth');
    expect(getActiveAdminRoute('/admin/permissions/crm/roles/role-1')).toBe('permissionsRoleAuth');
  });
});

describe('admin url state', () => {
  it('normalizes invalid record pagination, tab and sort', () => {
    const parsed = parseRecordSearch(new URLSearchParams('tab=bad&page=0&pageSize=-1&sort=createdAt:down'));
    expect(parsed).toMatchObject({ tab: 'trace', page: 1, pageSize: 20, sort: 'createdAt:desc' });
  });

  it('serializes record defaults without noisy query params', () => {
    expect(serializeRecordSearch({ tab: 'trace', page: 1, pageSize: 20, sort: 'createdAt:desc' }).toString()).toBe('');
  });

  it('supports every record tab and recognized record sheet prefixes', () => {
    expect(parseRecordSearch(new URLSearchParams('tab=trace&sheet=trace:item-1')).sheet).toBe('trace:item-1');
    expect(parseRecordSearch(new URLSearchParams('tab=security&sheet=security:evt-1')).sheet).toBe('security:evt-1');
    expect(parseRecordSearch(new URLSearchParams('tab=sync&sheet=sync:run-1')).sheet).toBe('sync:run-1');
    expect(parseRecordSearch(new URLSearchParams('tab=tokens&sheet=token:tok-1')).sheet).toBe('token:tok-1');
    expect(parseRecordSearch(new URLSearchParams('tab=audit&sheet=unknown:item')).sheet).toBeUndefined();
  });

  it('解析和序列化 trace 查询状态', () => {
    const parsed = parseRecordSearch(
      new URLSearchParams(
        'tab=trace&requestId=req-1&applicationId=app-finance&clientId=client-finance&feishuUserId=ou_user&from=2026-05-29T00:00:00.000Z&to=2026-05-29T01:00:00.000Z&returnTo=/admin/applications/crm%3Ftab%3Ddevelopment&sheet=trace:sec-1'
      )
    );

    expect(parsed).toMatchObject({
      tab: 'trace',
      requestId: 'req-1',
      applicationId: 'app-finance',
      clientId: 'client-finance',
      feishuUserId: 'ou_user',
      from: '2026-05-29T00:00:00.000Z',
      to: '2026-05-29T01:00:00.000Z',
      returnTo: '/admin/applications/crm?tab=development',
      sheet: 'trace:sec-1'
    });

    const serialized = serializeRecordSearch(parsed).toString();
    expect(serialized).toContain('clientId=client-finance');
    expect(serialized).toContain('feishuUserId=ou_user');
    expect(serialized).toContain('returnTo=%2Fadmin%2Fapplications%2Fcrm%3Ftab%3Ddevelopment');
    expect(serialized).not.toContain('secret');
    expect(serialized).not.toContain('token=');
  });

  it('rejects unsafe trace return targets', () => {
    expect(parseRecordSearch(new URLSearchParams('returnTo=https://example.com/admin')).returnTo).toBeUndefined();
    expect(parseRecordSearch(new URLSearchParams('returnTo=//example.com/admin')).returnTo).toBeUndefined();
  });

  it('keeps filters when closing a sheet', () => {
    expect(closeSheet(new URLSearchParams('tab=security&page=2&sheet=security:evt-1')).toString()).toBe(
      'tab=security&page=2'
    );
  });

  it('normalizes invalid application status, pagination and sort', () => {
    const parsed = parseApplicationSearch(new URLSearchParams('status=archived&page=-9&pageSize=0&sort=name:desc'));
    expect(parsed).toMatchObject({ status: 'all', page: 1, pageSize: 20, sort: 'updatedAt:desc' });
  });

  it('serializes application defaults without noisy query params', () => {
    expect(
      serializeApplicationSearch({ status: 'all', page: 1, pageSize: 20, sort: 'updatedAt:desc' }).toString()
    ).toBe('');
  });

  it('allows application create and detail sheets', () => {
    expect(parseApplicationSearch(new URLSearchParams('sheet=create')).sheet).toBe('create');
    expect(parseApplicationSearch(new URLSearchParams('sheet=app:crm')).sheet).toBe('app:crm');
    expect(parseApplicationSearch(new URLSearchParams('sheet=client:crm')).sheet).toBe('client:crm');
    expect(parseApplicationSearch(new URLSearchParams('sheet=rotate:crm')).sheet).toBe('rotate:crm');
    expect(parseApplicationSearch(new URLSearchParams('sheet=prompt:crm')).sheet).toBe('prompt:crm');
  });

  it('does not parse or serialize secrets or tokens into url', () => {
    const parsed = parseApplicationSearch(
      new URLSearchParams('q=crm&unsafeSecretDraft=client-secret-value&secrets=abc&tokens=token-value')
    );
    expect(parsed).not.toHaveProperty('unsafeSecretDraft');

    const unsafeState = {
      q: 'crm',
      status: 'active',
      page: 1,
      pageSize: 20,
      sort: 'updatedAt:desc',
      sheet: 'app:crm',
      unsafeSecretDraft: 'client-secret-value'
    } satisfies ApplicationSearchState & { unsafeSecretDraft: string };
    const params = serializeApplicationSearch(unsafeState);
    expect(params.toString()).not.toContain('secret');
    expect(params.toString()).not.toContain('token');
  });

  it('normalizes invalid permission status, pagination, sort and sheet', () => {
    const parsed = parsePermissionSearch(
      new URLSearchParams('status=active&page=0&pageSize=10&sort=name:desc&sheet=group:pg-1')
    );
    expect(parsed).toMatchObject({ status: 'all', page: 1, pageSize: 20, sort: 'key:asc' });
    expect(parsed.authStatus).toBe('all');
    expect(parsed.sheet).toBeUndefined();
  });

  it('serializes permission defaults without noisy query params', () => {
    expect(serializePermissionSearch({ authStatus: 'all', status: 'all', page: 1, pageSize: 20, sort: 'key:asc' }).toString()).toBe('');
  });

  it('allows permission create and role detail sheets', () => {
    expect(parsePermissionSearch(new URLSearchParams('sheet=create')).sheet).toBe('create');
    expect(parsePermissionSearch(new URLSearchParams('sheet=role:role-1')).sheet).toBe('role:role-1');
    expect(parsePermissionSearch(new URLSearchParams('sheet=role:')).sheet).toBeUndefined();
  });

  it('keeps permission filters when closing a sheet', () => {
    const params = closeSheet(
      new URLSearchParams('appKey=crm&q=operator&status=enabled&page=2&pageSize=50&sort=updatedAt%3Adesc&sheet=role%3Arole-1')
    );
    expect(params.toString()).toBe('appKey=crm&q=operator&status=enabled&page=2&pageSize=50&sort=updatedAt%3Adesc');
  });

  it('does not serialize permission dialog drafts into url', () => {
    const unsafeState = {
      appKey: 'crm',
      q: 'operator',
      code: 'crm.admin',
      authStatus: 'configured',
      status: 'enabled',
      page: 1,
      pageSize: 20,
      sort: 'key:asc',
      sheet: 'role:role-1',
      roleNameDraft: '敏感草稿'
    } satisfies PermissionSearchState & { roleNameDraft: string };
    const params = serializePermissionSearch(unsafeState);
    expect(params.toString()).toBe('appKey=crm&q=operator&code=crm.admin&authStatus=configured&status=enabled&sheet=role%3Arole-1');
    expect(params.toString()).not.toContain('Draft');
    expect(params.toString()).not.toContain('敏感草稿');
  });

  it('normalizes invalid admin role, status and sheet', () => {
    const parsed = parseAdminUserSearch(
      new URLSearchParams('q=张三&role=owner&status=locked&sheet=user%3Aadmin-1')
    );
    expect(parsed).toEqual({ q: '张三', role: 'all', status: 'all' });
  });

  it('allows admin detail sheet', () => {
    expect(parseAdminUserSearch(new URLSearchParams('sheet=admin%3Aadmin-1')).sheet).toBe('admin:admin-1');
    expect(parseAdminUserSearch(new URLSearchParams('sheet=admin%3A')).sheet).toBeUndefined();
  });

  it('serializes admin filters without default values and keeps them when closing a sheet', () => {
    const params = serializeAdminUserSearch({
      q: '张三',
      role: 'platform_admin',
      status: 'active',
      sheet: 'admin:admin-1'
    });
    expect(params.toString()).toBe('q=%E5%BC%A0%E4%B8%89&role=platform_admin&status=active&sheet=admin%3Aadmin-1');
    expect(closeSheet(params).toString()).toBe('q=%E5%BC%A0%E4%B8%89&role=platform_admin&status=active');
    expect(serializeAdminUserSearch({ role: 'all', status: 'all' }).toString()).toBe('');
  });

  it('does not serialize admin drafts, secrets or tokens into url', () => {
    const parsed = parseAdminUserSearch(
      new URLSearchParams('q=张三&role=readonly&status=disabled&roleDraft=platform_admin&secret=abc&token=def')
    );
    expect(parsed).not.toHaveProperty('roleDraft');

    const unsafeState = {
      q: '张三',
      role: 'application_admin',
      status: 'disabled',
      sheet: 'admin:admin-1',
      roleDraft: 'platform_admin',
      secret: 'abc',
      token: 'def'
    } satisfies AdminUserSearchState & { roleDraft: string; secret: string; token: string };
    const params = serializeAdminUserSearch(unsafeState);
    expect(params.toString()).toBe(
      'q=%E5%BC%A0%E4%B8%89&role=application_admin&status=disabled&sheet=admin%3Aadmin-1'
    );
    expect(params.toString()).not.toContain('Draft');
    expect(params.toString()).not.toContain('secret');
    expect(params.toString()).not.toContain('token');
  });

  it('normalizes invalid system settings tab and sheet', () => {
    const parsed = parseSystemSettingsSearch(new URLSearchParams('tab=secrets&sheet=user:1'));
    expect(parsed).toEqual({ tab: 'feishu' });
  });

  it('allows sync run detail sheet and keeps tab when closing it', () => {
    const parsed = parseSystemSettingsSearch(new URLSearchParams('tab=runtime&sheet=sync:sync-run-1'));
    expect(parsed).toEqual({ tab: 'runtime', sheet: 'sync:sync-run-1' });
    expect(closeSheet(new URLSearchParams('tab=runtime&sheet=sync:sync-run-1')).toString()).toBe('tab=runtime');
  });

  it('does not serialize transient system settings state into url', () => {
    const unsafeState = {
      tab: 'version',
      sheet: 'sync:sync-run-1',
      confirmOpen: true,
      sheetSize: 'full'
    } satisfies SystemSettingsSearchState & { confirmOpen: boolean; sheetSize: string };
    const params = serializeSystemSettingsSearch(unsafeState);
    expect(params.toString()).toBe('tab=version&sheet=sync%3Async-run-1');
    expect(params.toString()).not.toContain('confirmOpen');
    expect(params.toString()).not.toContain('sheetSize');
  });
});
