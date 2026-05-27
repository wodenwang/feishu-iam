import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { render, screen, within } from '@testing-library/react';
import { App as AntdApp } from 'antd';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetMockIamStore, setMockCurrentSession } from '../../features/iam/mockApi';
import { platformAdminSession } from '../../features/iam/mockData';
import type { CurrentSession } from '../../features/iam/types';
import { SyncPage } from '.';

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

function renderSyncPage(session: CurrentSession = platformAdminSession) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  setMockCurrentSession(session);
  queryClient.setQueryData(['iam', 'session'], session);

  return render(
    <QueryClientProvider client={queryClient}>
      <AntdApp>
        <MemoryRouter initialEntries={['/sync']}>
          <SyncPage />
        </MemoryRouter>
      </AntdApp>
    </QueryClientProvider>,
  );
}

describe('SyncPage', () => {
  beforeEach(() => {
    resetMockIamStore();
  });

  it('shows summary, manual sync, and sync run table columns', async () => {
    renderSyncPage();

    expect(screen.getByText('飞书同步')).toBeInTheDocument();
    expect(screen.getByText('同步状态摘要')).toBeInTheDocument();
    expect(screen.getByText('最近同步状态')).toBeInTheDocument();
    expect(screen.getByText('最近成功同步时间')).toBeInTheDocument();
    expect(screen.getByText('用户数量')).toBeInTheDocument();
    expect(screen.getByText('部门数量')).toBeInTheDocument();
    expect(screen.getByText('最近失败同步时间')).toBeInTheDocument();
    expect(screen.getByText('最近定时同步')).toBeInTheDocument();
    expect(screen.getByText('最近同步差异')).toBeInTheDocument();
    expect(screen.getByText(/健康判断/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /手动同步/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /运行预检/ })).toBeInTheDocument();

    expect(await screen.findByText('sync_run_202605230035')).toBeInTheDocument();
    expect(screen.getByText('系统任务')).toBeInTheDocument();
    ['Run ID', '触发方式', '状态', '开始时间', '耗时', '用户变化', '部门变化', '操作人', '操作'].forEach((column) => {
      expect(screen.getAllByText(column).length).toBeGreaterThan(0);
    });
  });

  it('runs Feishu directory preflight and shows stage results without creating a sync run', async () => {
    const user = userEvent.setup();
    renderSyncPage();

    expect(await screen.findByText('sync_run_202605230035')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /运行预检/ }));

    const drawerTitle = await screen.findByText('飞书通讯录权限预检');
    const drawer = drawerTitle.closest('.ant-drawer');
    if (!drawer) {
      throw new Error('飞书通讯录权限预检 Drawer 未打开');
    }
    const drawerScope = within(drawer as HTMLElement);
    expect(drawerScope.getByText('预检通过')).toBeInTheDocument();
    expect(drawerScope.getByText('Tenant Token')).toBeInTheDocument();
    expect(drawerScope.getByText('部门读取')).toBeInTheDocument();
    expect(drawerScope.getByText('用户读取')).toBeInTheDocument();
    expect(screen.getAllByText('sync_run_202605230035').length).toBe(1);
  });

  it('shows failed reason, retry sync, and opens detail drawer', async () => {
    const user = userEvent.setup();
    renderSyncPage();

    const failedRunId = await screen.findByText('sync_run_202605230035');
    expect(screen.getByText('飞书部门列表接口限流，部分批次未完成。')).toBeInTheDocument();

    const failedRunRow = failedRunId.closest('tr');
    expect(failedRunRow).not.toBeNull();
    const failedRunScope = within(failedRunRow as HTMLTableRowElement);

    const retryButton = failedRunScope.getByText('重试同步').closest('button');
    expect(retryButton).toBeEnabled();

    const detailButton = failedRunScope.getByText('查看详情').closest('button');
    expect(detailButton).toBeEnabled();
    await user.click(detailButton as HTMLButtonElement);

    const drawerTitle = await screen.findByText('同步详情：sync_run_202605230035');
    const drawer = drawerTitle.closest('.ant-drawer');
    if (!drawer) {
      throw new Error('同步详情 Drawer 未打开');
    }
    const drawerScope = within(drawer as HTMLElement);
    expect(drawerScope.getByText('请求批次数')).toBeInTheDocument();
    expect(drawerScope.getByText('成功数量')).toBeInTheDocument();
    expect(drawerScope.getByText('失败数量')).toBeInTheDocument();
    expect(drawerScope.getByText('差异摘要')).toBeInTheDocument();
    expect(drawerScope.getByText('失败链路 Request ID')).toBeInTheDocument();
    expect(drawerScope.getByText('req_sync_failed_001')).toBeInTheDocument();
    expect(drawerScope.getByText('错误信息')).toBeInTheDocument();
    expect(drawerScope.getByText('关联审计日志入口')).toBeInTheDocument();
  });

  it('allows sync:view users to read sync runs without triggering sync:run actions', async () => {
    renderSyncPage({
      ...platformAdminSession,
      roles: ['application_admin'],
      permissions: ['sync:view'],
    });

    expect(screen.getByText('飞书同步')).toBeInTheDocument();
    expect(await screen.findByText('sync_run_202605230035')).toBeInTheDocument();
    expect(screen.getByText('飞书部门列表接口限流，部分批次未完成。')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /手动同步/ })).toBeDisabled();
    const failedRunRow = screen.getByText('sync_run_202605230035').closest('tr');
    expect(failedRunRow).not.toBeNull();
    expect(within(failedRunRow as HTMLTableRowElement).getByRole('button', { name: '重试同步' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /运行预检/ })).toBeDisabled();
    expect(screen.getByText('需要 sync:run 权限才能发起同步、预检或重试。')).toBeInTheDocument();
  });
});
