import { describe, expect, it } from 'vitest';
import { canAccess, getVisibleMenuItems, routeItems } from './routes';
import type { CurrentSession } from '../features/iam/types';

const appAdminSession: CurrentSession = {
  user: {
    feishuUserId: 'ou_app_admin_001',
    displayName: '应用管理员',
    departmentPath: '业务系统组',
    status: 'active',
  },
  roles: ['application_admin'],
  permissions: ['dashboard:view', 'application:view', 'role:view', 'directory:view', 'audit:view'],
  applicationIds: ['app_demo_crm'],
};

describe('routes', () => {
  it('hides sync center from application admins', () => {
    const menu = getVisibleMenuItems(routeItems, appAdminSession);

    expect(menu.map((item) => item.path)).not.toContain('/sync');
  });

  it('keeps application management visible to application admins', () => {
    const menu = getVisibleMenuItems(routeItems, appAdminSession);

    expect(menu.map((item) => item.path)).toContain('/applications');
  });

  it('returns false when the session lacks application:create', () => {
    expect(canAccess(appAdminSession, 'application:create')).toBe(false);
  });
});
