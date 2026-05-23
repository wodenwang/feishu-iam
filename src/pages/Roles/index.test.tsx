import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { listRoles, resetMockIamStore, setMockCurrentSession } from '../../features/iam/mockApi';
import { platformAdminSession } from '../../features/iam/mockData';
import type { CurrentSession } from '../../features/iam/types';
import { RolesPage } from '.';

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

function renderRolesPage(session: CurrentSession = platformAdminSession) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  setMockCurrentSession(session);
  queryClient.setQueryData(['iam', 'session'], session);

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/roles']}>
        <RolesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('RolesPage', () => {
  beforeEach(() => {
    resetMockIamStore();
  });

  it('shows role authorization search, toolbar, and role table columns', async () => {
    renderRolesPage();

    expect(screen.getByText('角色授权')).toBeInTheDocument();
    expect(screen.getByLabelText('keyword')).toBeInTheDocument();
    expect(screen.getByLabelText('application')).toBeInTheDocument();
    expect(screen.getByLabelText('status')).toBeInTheDocument();
    expect(screen.getByText('创建时间')).toBeInTheDocument();
    expect(screen.getByText('新建角色')).toBeInTheDocument();
    expect(screen.getByText('批量停用')).toBeInTheDocument();
    expect(screen.getByText('刷新')).toBeInTheDocument();
    expect(await screen.findByText('销售主管')).toBeInTheDocument();

    ['角色名称', '所属应用', '权限数量', '授权对象', '状态', '更新时间', '操作'].forEach((column) => {
      expect(screen.getAllByText(column).length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText('编辑').length).toBeGreaterThan(0);
    expect(screen.getAllByText('配置授权').length).toBeGreaterThan(0);
  });

  it('opens role drawer with all configured fields', async () => {
    const user = userEvent.setup();
    renderRolesPage();

    await user.click(screen.getByRole('button', { name: /新建角色/ }));

    const drawer = await screen.findByRole('dialog', { name: '新建角色' });
    expect(within(drawer).getByText('所属应用')).toBeInTheDocument();
    expect(within(drawer).getByText('角色名称')).toBeInTheDocument();
    expect(within(drawer).getByText('角色编码')).toBeInTheDocument();
    expect(within(drawer).getByText('描述')).toBeInTheDocument();
    expect(within(drawer).getByText('状态')).toBeInTheDocument();
  });

  it('opens authorization drawer and shows permission tree, Feishu organization and user selectors, then summary modal', async () => {
    const user = userEvent.setup();
    renderRolesPage();

    await screen.findByText('销售主管');
    await user.click(screen.getAllByRole('button', { name: '配置授权' })[0]);

    const drawer = await screen.findByRole('dialog', { name: '配置授权：销售主管' });
    expect(within(drawer).getByText('权限选择')).toBeInTheDocument();
    expect(within(drawer).getByText('客户管理')).toBeInTheDocument();
    expect(within(drawer).getByText('查看客户')).toBeInTheDocument();
    expect(within(drawer).getByText('飞书组织 / 用户选择')).toBeInTheDocument();
    expect(within(drawer).getByText('飞书组织')).toBeInTheDocument();
    expect(within(drawer).getByText('飞书用户')).toBeInTheDocument();

    await user.click(within(drawer).getByRole('button', { name: /保存授权/ }));

    expect(await screen.findByText('授权变更摘要')).toBeInTheDocument();
    expect(screen.getByText(/新增权限：/)).toBeInTheDocument();
    expect(screen.getByText(/移除权限：/)).toBeInTheDocument();
    expect(screen.getByText(/新增组织：/)).toBeInTheDocument();
    expect(screen.getByText(/移除组织：/)).toBeInTheDocument();
    expect(screen.getByText(/新增用户：/)).toBeInTheDocument();
    expect(screen.getByText(/移除用户：/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /确认保存授权/ })).toBeInTheDocument();
  });

  it('limits application admins to roles from their assigned applications even after clearing filters', async () => {
    const user = userEvent.setup();
    renderRolesPage({
      ...platformAdminSession,
      roles: ['application_admin'],
      permissions: ['role:view', 'role:update'],
      applicationIds: ['app_demo_crm'],
    });

    expect(await screen.findByText('销售主管')).toBeInTheDocument();
    expect(screen.queryByText('财务只读')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /重\s*置/ }));

    expect(await screen.findByText('销售主管')).toBeInTheDocument();
    expect(screen.queryByText('财务只读')).not.toBeInTheDocument();
  });

  it('hides row-level role update actions without role:update permission', async () => {
    renderRolesPage({
      ...platformAdminSession,
      permissions: platformAdminSession.permissions.filter((permission) => permission !== 'role:update'),
    });

    expect(await screen.findByText('销售主管')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '编辑' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '配置授权' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '停用' })).not.toBeInTheDocument();
  });

  it('filters roles by created time range', async () => {
    const result = await listRoles({
      createdAtFrom: '2026-05-23T00:00:00.000Z',
      createdAtTo: '2026-05-23T23:59:59.999Z',
      page: 1,
      pageSize: 20,
    });

    expect(result.items.map((role) => role.name)).toEqual(['销售主管']);
  });

  it('summarizes changed permissions, departments, and users from current authorization selections', async () => {
    const user = userEvent.setup();
    renderRolesPage();

    await screen.findByText('销售主管');
    await user.click(screen.getAllByRole('button', { name: '配置授权' })[0]);

    const drawer = await screen.findByRole('dialog', { name: '配置授权：销售主管' });
    await user.click(within(drawer).getByRole('checkbox', { name: '查看合同' }));
    await user.click(within(drawer).getByLabelText('飞书组织'));
    await user.click(await screen.findByText('飞书 IAM 演示组织 / 信息化中心'));
    await user.click(within(drawer).getByLabelText('飞书用户'));
    await user.click(await screen.findByText('李停用 / ou_sales_disabled_002'));
    await user.click(screen.getByRole('button', { name: /保存授权/ }));

    await screen.findByText('授权变更摘要');
    expect(screen.getByText('移除权限：1 个')).toBeInTheDocument();
    expect(screen.getByText('新增组织：1 个')).toBeInTheDocument();
    expect(screen.getByText('新增用户：1 个')).toBeInTheDocument();
  });
});
