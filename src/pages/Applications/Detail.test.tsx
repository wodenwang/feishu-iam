import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import { App as AntdApp } from 'antd';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetMockIamStore, setMockCurrentSession } from '../../features/iam/mockApi';
import { platformAdminSession } from '../../features/iam/mockData';
import type { CurrentSession } from '../../features/iam/types';
import { ApplicationDetailPage } from './Detail';

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

const applicationAdminSession: CurrentSession = {
  user: {
    feishuUserId: 'ou_app_admin_001',
    displayName: '应用管理员',
    departmentPath: '业务系统组',
    status: 'active',
  },
  roles: ['application_admin'],
  permissions: ['application:view'],
  applicationIds: ['app_demo_crm'],
};

function renderApplicationDetail(session: CurrentSession = platformAdminSession) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  queryClient.setQueryData(['iam', 'session'], session);

  return render(
    <QueryClientProvider client={queryClient}>
      <AntdApp>
        <MemoryRouter initialEntries={['/applications/app_demo_crm']}>
          <Routes>
            <Route path="/applications/:id" element={<ApplicationDetailPage />} />
          </Routes>
        </MemoryRouter>
      </AntdApp>
    </QueryClientProvider>,
  );
}

describe('ApplicationDetailPage', () => {
  beforeEach(() => {
    resetMockIamStore();
  });

  it('shows application detail tabs and overview fields', async () => {
    renderApplicationDetail();

    expect(screen.getByText('应用详情')).toBeInTheDocument();
    ['概览', '接入配置', '权限注册', '应用管理员', '审计记录'].forEach((tab) => {
      expect(screen.getByRole('tab', { name: tab })).toBeInTheDocument();
    });

    expect(await screen.findByText('Demo CRM')).toBeInTheDocument();
    ['应用名称', 'appKey', '应用 Code', '状态', '接入状态', '创建人', '创建时间', '最近 API 调用'].forEach((field) => {
      expect(screen.getByText(field)).toBeInTheDocument();
    });
    expect(screen.getByText('app_demo_crm_key')).toBeInTheDocument();
    expect(screen.getByText('配置可用')).toBeInTheDocument();
  });

  it('exposes the v0.2 configuration surface from the tab model', async () => {
    renderApplicationDetail();

    await screen.findByText('Demo CRM');
    expect(screen.getByRole('tab', { name: '接入配置' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '应用管理员' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '审计记录' })).toBeInTheDocument();
    expect(screen.getByText('启用 redirect URI')).toBeInTheDocument();
    expect(screen.getAllByText('应用管理员').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('配置审计')).toBeInTheDocument();
  });

  it('shows permission registration empty state or readonly table', async () => {
    const user = userEvent.setup();
    renderApplicationDetail();

    await user.click(screen.getByRole('tab', { name: '权限注册' }));

    expect(await screen.findByText('该应用还没有注册权限点')).toBeInTheDocument();
    expect(screen.getByText('第三方系统需要调用 Application API 注册权限组和权限点。')).toBeInTheDocument();
    ['权限组 Code', '权限组名称', '权限点 Code', '权限点名称', '状态', '最近注册/更新时间'].forEach((column) => {
      expect(screen.getAllByText(column).length).toBeGreaterThan(0);
    });
  });

  it('allows application admins with application:view to inspect readonly detail without dangerous actions', async () => {
    setMockCurrentSession(applicationAdminSession);
    renderApplicationDetail(applicationAdminSession);

    expect(await screen.findByText('Demo CRM')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /新增 redirect URI/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /轮换 appSecret/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /轮换 API secret/ })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '接入配置' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '应用管理员' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '审计记录' })).toBeInTheDocument();
    expect(screen.getAllByText('王文哲').length).toBeGreaterThan(0);
  });

  it('keeps v0.2 admin protection and audit behavior covered by service tests', async () => {
    renderApplicationDetail();

    await screen.findByText('Demo CRM');
    expect(screen.queryByRole('button', { name: '编辑' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '应用管理员' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '审计记录' })).toBeInTheDocument();
  });
});
