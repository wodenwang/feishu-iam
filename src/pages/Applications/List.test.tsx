import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { App as AntdApp, Modal } from 'antd';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { rejectNextApplicationsList, resetMockIamStore, setMockCurrentSession } from '../../features/iam/mockApi';
import { platformAdminSession } from '../../features/iam/mockData';
import type { CurrentSession } from '../../features/iam/types';
import { ApplicationsListPage } from './List';

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

function renderApplicationsList(session: CurrentSession = platformAdminSession) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  queryClient.setQueryData(['iam', 'session'], session);

  function LocationProbe() {
    const location = useLocation();
    return <div data-testid="location-path">{location.pathname}</div>;
  }

  return render(
    <QueryClientProvider client={queryClient}>
      <AntdApp>
        <MemoryRouter initialEntries={['/applications']}>
          <ApplicationsListPage />
          <LocationProbe />
        </MemoryRouter>
      </AntdApp>
    </QueryClientProvider>,
  );
}

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

async function findDemoCrmRow() {
  const cell = await screen.findByText('Demo CRM');
  const row = cell.closest('tr');
  expect(row).not.toBeNull();
  return row!;
}

describe('ApplicationsListPage', () => {
  beforeEach(() => {
    resetMockIamStore();
  });

  afterEach(() => {
    Modal.destroyAll();
    vi.clearAllMocks();
    cleanup();
    document.querySelectorAll('.ant-modal-root, .ant-message, .ant-popover').forEach((element) => element.remove());
  });

  it('shows application management search, toolbar, and demo application row', async () => {
    renderApplicationsList();

    expect(screen.getByText('应用管理')).toBeInTheDocument();
    expect(screen.getByLabelText('keyword')).toBeInTheDocument();
    expect(screen.getByLabelText('status')).toBeInTheDocument();
    expect(screen.getByText('新增应用')).toBeInTheDocument();
    expect(screen.getByText('批量停用')).toBeInTheDocument();
    expect(screen.getByText('刷新')).toBeInTheDocument();
    expect(await screen.findByText('Demo CRM')).toBeInTheDocument();
    ['应用名称', 'appkey', '状态', '权限组', '权限点', '应用管理员', '最近 API 调用', '创建时间', '操作'].forEach((column) => {
      expect(screen.getAllByText(column).length).toBeGreaterThan(0);
    });
    const row = await findDemoCrmRow();
    expect(within(row).getByText('查看')).toBeInTheDocument();
    expect(within(row).getByText('接入配置')).toBeInTheDocument();
    expect(within(row).getAllByText('停用').length).toBeGreaterThan(0);
  });

  it('navigates to application detail and onboarding from row actions', async () => {
    const user = userEvent.setup();
    renderApplicationsList();

    const row = await findDemoCrmRow();
    await user.click(within(row).getByRole('button', { name: '查看' }));
    await waitFor(() => expect(screen.getByTestId('location-path')).toHaveTextContent('/applications/app_demo_crm'));

    await user.click(within(row).getByRole('button', { name: '接入配置' }));
    await waitFor(() => expect(screen.getByTestId('location-path')).toHaveTextContent('/applications/onboarding'));
  });

  it('keeps create application in the page header before search and table regions', async () => {
    renderApplicationsList();

    await screen.findByText('Demo CRM');
    const pageHeader = screen.getByRole('region', { name: '应用管理页头' });
    const searchRegion = screen.getByRole('region', { name: '应用筛选' });
    const tableShell = screen.getByTestId('app-table-shell');

    expect(Boolean(pageHeader.compareDocumentPosition(searchRegion) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(Boolean(searchRegion.compareDocumentPosition(tableShell) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(within(pageHeader).getByRole('button', { name: /新增应用/ })).toBeInTheDocument();
    expect(within(searchRegion).getByRole('button', { name: /查询/ })).toBeInTheDocument();
  });

  it('filters applications by status select', async () => {
    const user = userEvent.setup();
    renderApplicationsList();

    await screen.findByText('Demo CRM');
    await user.click(screen.getByLabelText('status'));
    await user.click(await screen.findByTitle('停用'));
    await user.click(screen.getByRole('button', { name: /查\s*询/ }));

    await waitFor(() => expect(screen.getByText('没有匹配的应用')).toBeInTheDocument());
    expect(screen.queryByText('Demo CRM')).not.toBeInTheDocument();
  });

  it('shows confirmation before disabling an application row', async () => {
    const user = userEvent.setup();
    renderApplicationsList();

    const row = await findDemoCrmRow();
    await user.click(within(row).getByRole('button', { name: '停用' }));

    expect(await screen.findByText('停用 Demo CRM？')).toBeInTheDocument();
    const confirmation = screen.getByRole('tooltip');
    expect(within(confirmation).getByRole('button', { name: /取\s*消/ })).toBeInTheDocument();
    expect(within(confirmation).getByRole('button', { name: /停\s*用/ })).toBeInTheDocument();
  });

  it('disables an application row after confirming row action', async () => {
    const user = userEvent.setup();
    renderApplicationsList();

    const row = await findDemoCrmRow();
    await user.click(within(row).getByRole('button', { name: '停用' }));
    const confirmation = await screen.findByRole('tooltip');
    await user.click(within(confirmation).getByRole('button', { name: /停\s*用/ }));

    expect(await screen.findByText('已停用 Demo CRM')).toBeInTheDocument();
    await waitFor(() => {
      expect(within(row).getAllByText('停用').length).toBeGreaterThan(1);
    });
  });

  it('batch disables selected applications after confirmation', async () => {
    const user = userEvent.setup();
    renderApplicationsList();

    const row = await findDemoCrmRow();
    await user.click(within(row).getByRole('checkbox'));

    const batchDisableButton = screen.getByRole('button', { name: /批量停用/ });
    expect(batchDisableButton).toBeEnabled();
    await user.click(batchDisableButton);

    const modal = await screen.findByRole('dialog', { name: '批量停用应用' });
    expect(within(modal).getByText('确认停用已选中的 1 个应用？')).toBeInTheDocument();
    await user.click(within(modal).getByRole('button', { name: /确\s*认\s*停\s*用/ }));

    await waitFor(() => {
      expect(within(row).getAllByText('停用').length).toBeGreaterThan(1);
    });
  });

  it('shows refresh feedback after refetching applications', async () => {
    const user = userEvent.setup();
    renderApplicationsList();

    await screen.findByText('Demo CRM');
    await user.click(screen.getByRole('button', { name: /刷新/ }));

    expect(await screen.findByText('列表已刷新')).toBeInTheDocument();
  });

  it('shows search empty state when keyword has no matches', async () => {
    const user = userEvent.setup();
    renderApplicationsList();

    await user.type(screen.getByLabelText('keyword'), 'no-such-app');
    await user.click(screen.getByRole('button', { name: /查\s*询/ }));

    await waitFor(() => expect(screen.getByText('没有匹配的应用')).toBeInTheDocument());
  });

  it('resets filters from search empty state and restores application data', async () => {
    const user = userEvent.setup();
    renderApplicationsList();

    await user.type(screen.getByLabelText('keyword'), 'no-such-app');
    await user.click(screen.getByRole('button', { name: /查询/ }));
    await screen.findByText('没有匹配的应用');

    await user.click(screen.getByRole('button', { name: /重置筛选/ }));

    expect(await screen.findByText('Demo CRM')).toBeInTheDocument();
    expect(screen.getByLabelText('keyword')).toHaveValue('');
  });

  it('opens create drawer with required application fields', async () => {
    const user = userEvent.setup();
    renderApplicationsList();

    await user.click(screen.getByRole('button', { name: /新增应用/ }));

    await screen.findByRole('dialog', { name: '创建应用' });
    expect(screen.getAllByText('应用名称').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('应用编码')).toBeInTheDocument();
    expect(screen.getByLabelText('描述')).toBeInTheDocument();
    expect(screen.getByLabelText('回调地址')).toBeInTheDocument();
    expect(screen.getByLabelText('应用管理员')).toBeInTheDocument();
  });

  it('hides create and disable actions when application admin only has application:view', async () => {
    setMockCurrentSession(applicationAdminSession);
    renderApplicationsList(applicationAdminSession);

    expect(await screen.findByText('Demo CRM')).toBeInTheDocument();
    const row = screen.getByText('Demo CRM').closest('tr');
    expect(row).not.toBeNull();

    expect(screen.queryByText('新增应用')).not.toBeInTheDocument();
    expect(screen.queryByText('批量停用')).not.toBeInTheDocument();
    expect(within(row!).queryByText('停用')).not.toBeInTheDocument();
    expect(within(row!).getByText('查看')).toBeInTheDocument();
    expect(within(row!).getByText('接入配置')).toBeInTheDocument();
  });

  it('shows retryable error block when loading applications fails', async () => {
    const user = userEvent.setup();
    rejectNextApplicationsList(new Error('network unavailable'));
    renderApplicationsList();

    expect(await screen.findByText('加载应用列表失败')).toBeInTheDocument();
    const retryButton = screen.getByRole('button', { name: /重\s*试/ });
    await user.click(retryButton);

    expect(await screen.findByText('Demo CRM')).toBeInTheDocument();
  });

  it('shows request id in retryable application errors', async () => {
    const httpError = Object.assign(new Error('服务暂时不可用'), {
      name: 'IamHttpError',
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
      requestId: 'req_applications_500',
    });
    rejectNextApplicationsList(httpError);
    renderApplicationsList();

    expect(await screen.findByText('加载应用列表失败')).toBeInTheDocument();
    expect(screen.getByText('req_applications_500')).toBeInTheDocument();
  });

  it('keeps table structure stable while the application list is loading', () => {
    renderApplicationsList();

    expect(screen.getByTestId('app-table-shell')).toBeInTheDocument();
    expect(screen.getAllByText('应用名称').length).toBeGreaterThan(0);
    expect(screen.getByText('加载应用数据')).toBeInTheDocument();
  });

  it('submits create application mutation, closes drawer, and shows the new application', async () => {
    const user = userEvent.setup();
    renderApplicationsList();

    await user.click(screen.getByRole('button', { name: /新增应用/ }));
    expect(await screen.findByRole('dialog', { name: '创建应用' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('应用名称'), '采购系统');
    await user.type(screen.getByLabelText('应用编码'), 'purchase-system');
    await user.type(screen.getByLabelText('描述'), '采购流程接入应用');
    await user.type(screen.getByLabelText('回调地址'), 'https://purchase.example.com/auth/callback');

    const submitButton = screen.getByRole('button', { name: /提\s*交/ });
    await user.click(submitButton);

    await waitFor(() => expect(submitButton).toHaveClass('ant-btn-loading'));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '创建应用' })).not.toBeInTheDocument());
    expect(await screen.findByText('采购系统')).toBeInTheDocument();

    const successModal = await screen.findByRole('dialog', { name: '应用已创建' });
    await user.click(within(successModal).getByRole('button', { name: /查看详情/ }));
    await waitFor(() => expect(screen.getByTestId('location-path')).toHaveTextContent('/applications/app_purchase_system'));
  });
});
