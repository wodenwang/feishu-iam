import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { UserMenu } from './index';
import type { CurrentSession } from '../../features/iam/types';

const session: CurrentSession = {
  user: {
    feishuUserId: 'ou_f3a1234567890abcdefb8c9',
    displayName: '王平台',
    departmentPath: '总部 / 信息化',
    status: 'active',
  },
  roles: ['platform_admin'],
  permissions: ['application:view'],
  applicationIds: [],
};

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

describe('UserMenu', () => {
  it('prioritizes user, role, environment and truncates open_id in the dropdown', async () => {
    const user = userEvent.setup();
    renderWithClient(<UserMenu session={session} environmentName="HTTP runtime" />);

    await user.click(screen.getByRole('button', { name: /打开用户菜单/ }));

    expect(screen.getAllByText('王平台')[0]).toBeInTheDocument();
    expect(screen.getAllByText('平台管理员')[0]).toBeInTheDocument();
    expect(screen.getAllByText('HTTP runtime')[0]).toBeInTheDocument();
    expect(screen.getByText('ou_f3a...b8c9')).toBeInTheDocument();
    expect(screen.queryByText('ou_f3a1234567890abcdefb8c9')).not.toBeInTheDocument();
  });

  it('copies the full Feishu open_id from an accessible control', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });

    renderWithClient(<UserMenu session={session} environmentName="HTTP runtime" />);

    await user.click(screen.getByRole('button', { name: /打开用户菜单/ }));
    await user.click(screen.getByRole('button', { name: /复制飞书 open_id/ }));

    expect(writeText).toHaveBeenCalledWith('ou_f3a1234567890abcdefb8c9');
  });

  it('keeps the current UI and allows retry when logout fails', async () => {
    const user = userEvent.setup();
    const logout = vi.fn().mockRejectedValueOnce(new Error('network failed')).mockResolvedValueOnce(undefined);
    const onLogoutSuccess = vi.fn();

    renderWithClient(<UserMenu session={session} environmentName="HTTP runtime" logout={logout} onLogoutSuccess={onLogoutSuccess} />);

    await user.click(screen.getByRole('button', { name: /打开用户菜单/ }));
    await user.click(screen.getByRole('menuitem', { name: '退出登录' }));
    await user.click(screen.getByRole('button', { name: '确认退出' }));

    expect(await screen.findByText('退出失败，请重试。')).toBeInTheDocument();
    expect(screen.getByText('当前 IAM 管理会话将结束。')).toBeInTheDocument();
    expect(onLogoutSuccess).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /重试退出/ }));

    await waitFor(() => expect(onLogoutSuccess).toHaveBeenCalledTimes(1));
  });
});

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}
