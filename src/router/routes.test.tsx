import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Result } from 'antd';
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';
import { beforeAll, afterEach, describe, expect, it, vi } from 'vitest';
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

  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const appAdminSession: CurrentSession = {
  user: {
    feishuUserId: 'ou_app_admin_001',
    displayName: '应用管理员',
    departmentPath: '业务系统组',
    status: 'active',
  },
  roles: ['application_admin'],
  permissions: ['dashboard:view', 'application:view', 'application:secret', 'role:view', 'role:update', 'audit:view'],
  applicationIds: ['app_demo_crm'],
};

const platformAdminSession: CurrentSession = {
  user: {
    feishuUserId: 'ou_platform_admin_001',
    displayName: '平台管理员',
    departmentPath: 'IT 部',
    status: 'active',
  },
  roles: ['platform_admin'],
  permissions: [
    'dashboard:view',
    'application:view',
    'application:create',
    'application:update',
    'application:disable',
    'application:secret',
    'role:view',
    'role:update',
    'directory:view',
    'sync:view',
    'sync:run',
    'audit:view',
  ],
  applicationIds: [],
};

describe('routes', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

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

  it('renders application detail page for dynamic path instead of layout 404', async () => {
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

    expect((await screen.findAllByText('应用详情')).length).toBeGreaterThan(0);
    expect(await screen.findByText('Demo CRM')).toBeInTheDocument();
    expect(screen.queryByText('页面不存在')).not.toBeInTheDocument();
  });

  it('renders approved admin shell dimensions and keeps runtime labels out of the top bar', async () => {
    vi.stubEnv('VITE_IAM_API_MODE', 'http');
    const user = userEvent.setup();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(['iam', 'session'], appAdminSession);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/applications']}>
          <Routes>
            <Route element={<AdminLayout />}>
              <Route path="/applications" element={<div>应用页内容</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText('应用页内容')).toBeInTheDocument();
    expect(screen.getByTestId('admin-sider')).toHaveStyle({ flex: '0 0 224px', maxWidth: '224px', minWidth: '224px', width: '224px' });
    expect(screen.getByTestId('admin-header')).toHaveStyle({ height: '56px' });
    expect(screen.getByTestId('admin-content')).toHaveStyle({ padding: '24px' });
    expect(screen.getByLabelText('feishu-iam')).toBeInTheDocument();
    expect(screen.queryByText('生产环境')).not.toBeInTheDocument();
    expect(screen.queryByText('HTTP runtime')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /打开用户菜单/ })).toBeInTheDocument();

    expect(screen.queryByText('工作台')).not.toBeInTheDocument();
    expect(screen.queryByText('飞书同步')).not.toBeInTheDocument();
    expect(screen.getAllByText('应用管理').length).toBeGreaterThan(0);
    expect(screen.getByText('角色授权')).toBeInTheDocument();
    expect(screen.queryByText('组织与用户')).not.toBeInTheDocument();
    expect(screen.queryByText('审计日志')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /打开用户菜单/ }));

    expect(screen.getByText('生产环境')).toBeInTheDocument();
    expect(screen.getByText('HTTP runtime')).toBeInTheDocument();
  });

  it('toggles the side navigation from the top bar control', async () => {
    vi.stubEnv('VITE_IAM_API_MODE', 'http');
    const user = userEvent.setup();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(['iam', 'session'], platformAdminSession);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/applications']}>
          <Routes>
            <Route element={<AdminLayout />}>
              <Route path="/applications" element={<div>应用页内容</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText('应用页内容')).toBeInTheDocument();
    expect(screen.getByTestId('admin-sider')).toHaveStyle({ flex: '0 0 224px', maxWidth: '224px', minWidth: '224px', width: '224px' });

    await user.click(screen.getByRole('button', { name: '收起侧边导航' }));

    expect(screen.getByTestId('admin-sider')).toHaveStyle({ flex: '0 0 64px', maxWidth: '64px', minWidth: '64px', width: '64px' });
    expect(screen.getByRole('button', { name: '展开侧边导航' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '展开侧边导航' }));

    expect(screen.getByTestId('admin-sider')).toHaveStyle({ flex: '0 0 224px', maxWidth: '224px', minWidth: '224px', width: '224px' });
  });

  it('keeps http-mode global directory, sync, and audit menu entries for platform admins', async () => {
    vi.stubEnv('VITE_IAM_API_MODE', 'http');
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(['iam', 'session'], platformAdminSession);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/applications']}>
          <Routes>
            <Route element={<AdminLayout />}>
              <Route path="/applications" element={<div>应用页内容</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText('应用页内容')).toBeInTheDocument();
    expect(screen.getByText('组织与用户')).toBeInTheDocument();
    expect(screen.getByText('飞书同步')).toBeInTheDocument();
    expect(screen.getByText('审计日志')).toBeInTheDocument();
  });
});
