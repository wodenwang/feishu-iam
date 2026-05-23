import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { Result } from 'antd';
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { PermissionGuard } from '../components/PermissionGuard';
import { AdminLayout } from '../layouts/AdminLayout';
import { canAccess, getMenuSelectedKey, getVisibleMenuItems, matchRouteItem, routeItems } from './routes';
import type { CurrentSession } from '../features/iam/types';

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

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

  it('keeps application detail and onboarding routes out of the menu', () => {
    expect(routeItems.find((item) => item.path === '/applications/:id')).toMatchObject({
      label: '应用详情',
      showInMenu: false,
    });
    expect(routeItems.find((item) => item.path === '/applications/onboarding')).toMatchObject({
      label: '接入配置',
      showInMenu: false,
    });
  });

  it('matches dynamic application detail routes and keeps the applications menu selected', () => {
    expect(matchRouteItem(routeItems, '/applications/app_demo_crm')?.path).toBe('/applications/:id');
    expect(getMenuSelectedKey(routeItems, '/applications/app_demo_crm')).toBe('/applications');
    expect(getMenuSelectedKey(routeItems, '/applications/onboarding')).toBe('/applications');
  });

  it('renders application detail placeholder for dynamic path instead of layout 404', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/applications/app_demo_crm']}>
          <Routes>
            <Route element={<AdminLayout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              {routeItems.map((item) => (
                <Route
                  key={item.path}
                  path={item.path}
                  element={
                    <PermissionGuard
                      permission={item.permission}
                      fallback={<Result status="403" title="无权限" subTitle={`缺少权限码：${item.permission}`} />}
                    >
                      {item.element}
                    </PermissionGuard>
                  }
                />
              ))}
            </Route>
            <Route path="*" element={<Result status="404" title="页面不存在" />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText('应用详情占位页')).toBeInTheDocument();
    expect(screen.queryByText('页面不存在')).not.toBeInTheDocument();
  });
});
