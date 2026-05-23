import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetMockIamStore } from '../../features/iam/mockApi';
import { DirectoryPage } from '.';

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

function renderDirectoryPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/directory']}>
        <DirectoryPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('DirectoryPage', () => {
  beforeEach(() => {
    resetMockIamStore();
  });

  it('shows read-only Feishu directory browser with department tree and user table columns', async () => {
    renderDirectoryPage();

    expect(screen.getByText('组织与用户')).toBeInTheDocument();
    expect(screen.getByText('只读目录投影')).toBeInTheDocument();
    expect(screen.getByText('组织结构与用户信息只来自飞书同步结果，本页面不直接编辑飞书组织或用户。')).toBeInTheDocument();
    expect(screen.getByText('部门树')).toBeInTheDocument();
    expect(await screen.findByText('飞书 IAM 演示组织 (3)')).toBeInTheDocument();
    expect(await screen.findByText('王文哲')).toBeInTheDocument();

    ['姓名', '部门', '状态', '邮箱', '手机遮罩', '最近同步时间', '操作'].forEach((column) => {
      expect(screen.getAllByText(column).length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText(/飞书 user_id：/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('查看详情').length).toBeGreaterThan(0);
  });

  it('opens user detail drawer with Feishu id, department, status, and local role summary', async () => {
    const user = userEvent.setup();
    renderDirectoryPage();

    await screen.findByText('王文哲');
    await user.click(screen.getAllByRole('button', { name: /查看详情/ })[0]);

    const drawer = await screen.findByRole('dialog', { name: '用户详情' });
    expect(within(drawer).getByText(/飞书 user_id：ou_feishu_admin_001/)).toBeInTheDocument();
    expect(within(drawer).getByText('飞书 IAM 演示组织 / 信息化中心')).toBeInTheDocument();
    expect(within(drawer).getByText('在职')).toBeInTheDocument();
    expect(within(drawer).getByText('平台管理员；Demo CRM / 销售主管')).toBeInTheDocument();
    expect(within(drawer).getByText('最近登录时间')).toBeInTheDocument();
    expect(within(drawer).getByText('最近权限查询时间')).toBeInTheDocument();
  });
});
