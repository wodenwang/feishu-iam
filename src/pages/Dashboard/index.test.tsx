import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetMockIamStore } from '../../features/iam/mockApi';
import { DashboardPage } from './index';

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

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('DashboardPage', () => {
  beforeEach(() => {
    resetMockIamStore();
  });

  it('shows workspace metrics, access loop progress, recent audit table, and partial sync failure', async () => {
    renderDashboard();

    expect(screen.getByRole('heading', { name: '工作台' })).toBeInTheDocument();
    expect(await screen.findByText('应用数量')).toBeInTheDocument();
    expect(screen.getByText('已注册权限点数量')).toBeInTheDocument();
    expect(screen.getByText('最近一次飞书同步状态')).toBeInTheDocument();
    expect(screen.getByText('近 24 小时审计事件数量')).toBeInTheDocument();
    expect(screen.getByText('接入闭环进度')).toBeInTheDocument();
    expect(screen.getByText('完成飞书同步')).toBeInTheDocument();
    expect(screen.getByText('创建应用')).toBeInTheDocument();
    expect(screen.getByText('导出接入配置')).toBeInTheDocument();
    expect(screen.getByText('第三方系统注册权限点')).toBeInTheDocument();
    expect(screen.getByText('创建角色授权')).toBeInTheDocument();
    expect(screen.getByText('第三方系统查询权限')).toBeInTheDocument();
    expect(screen.getByText('最近同步摘要')).toBeInTheDocument();
    expect(screen.getByText('最近审计事件')).toBeInTheDocument();
    expect((await screen.findAllByText('部分失败')).length).toBeGreaterThan(0);
  });
});
