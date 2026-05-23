import userEvent from '@testing-library/user-event';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { GlobalErrorPage } from './GlobalError';

describe('GlobalErrorPage', () => {
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

  it('shows global error recovery metadata and retry/workspace actions', () => {
    const retry = vi.fn();

    render(
      <MemoryRouter>
        <GlobalErrorPage onRetry={retry} occurredAt="2026-05-23T08:30:00.000Z" />
      </MemoryRouter>,
    );

    expect(screen.getByText('全局错误')).toBeInTheDocument();
    expect(screen.getByText(/页面加载失败/)).toBeInTheDocument();
    expect(screen.getByText('需要处理')).toBeInTheDocument();
    expect(screen.getByText('Admin Console 诊断')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /重\s*试/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '返回工作台' })).toBeInTheDocument();

    const recoveryCard = screen.getByText('错误恢复信息').closest('.ant-card') as HTMLElement | null;
    expect(recoveryCard).not.toBeNull();
    expect(within(recoveryCard!).getByText('Request ID')).toBeInTheDocument();
    expect(within(recoveryCard!).getByText('req_global_error_001')).toBeInTheDocument();
    expect(within(recoveryCard!).getByText('发生时间')).toBeInTheDocument();
    expect(within(recoveryCard!).getByText('错误类型')).toBeInTheDocument();
    expect(within(recoveryCard!).getByText('全局运行时错误')).toBeInTheDocument();
    expect(within(recoveryCard!).getByText('影响范围')).toBeInTheDocument();
    expect(within(recoveryCard!).getByText(/当前页面不可用/)).toBeInTheDocument();
    expect(within(recoveryCard!).getByText('排查入口')).toBeInTheDocument();
    expect(within(recoveryCard!).getAllByText(/审计日志/).length).toBeGreaterThan(0);
    expect(within(recoveryCard!).getByRole('button', { name: '复制 Request ID' })).toBeInTheDocument();
    expect(within(recoveryCard!).getByText('恢复建议')).toBeInTheDocument();
    expect(within(recoveryCard!).getByText(/不要在反馈中附带 secret、token 或飞书应用凭证/)).toBeInTheDocument();
  });

  it('copies request id and calls retry callback', async () => {
    const user = userEvent.setup();
    const retry = vi.fn();
    const copyRequestId = vi.fn().mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <GlobalErrorPage onRetry={retry} requestId="req_custom_error_001" onCopyRequestId={copyRequestId} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: '复制 Request ID' }));
    expect(copyRequestId).toHaveBeenCalledWith('req_custom_error_001');

    await user.click(screen.getByRole('button', { name: /重\s*试/ }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
