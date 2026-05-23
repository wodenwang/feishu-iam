import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { rejectNextAuditLogsList, resetMockIamStore } from '../../features/iam/mockApi';
import { AuditLogsPage } from '.';

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

function renderAuditLogsPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/audit-logs']}>
        <AuditLogsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AuditLogsPage', () => {
  beforeEach(() => {
    resetMockIamStore();
  });

  it('shows filters, toolbar actions, disabled export, and audit table', async () => {
    renderAuditLogsPage();

    expect(screen.getByText('审计日志')).toBeInTheDocument();
    expect(screen.getByText('时间范围')).toBeInTheDocument();
    expect(screen.getByLabelText('application')).toBeInTheDocument();
    expect(screen.getByLabelText('action')).toBeInTheDocument();
    expect(screen.getByLabelText('result')).toBeInTheDocument();
    expect(screen.getByLabelText('keyword')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /刷新/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /导出当前筛选结果/ })).toBeDisabled();

    expect(await screen.findByText('req_sync_failed_001')).toBeInTheDocument();
    ['时间', '动作类型', '结果', '操作者', '应用', '说明', 'Request ID', '操作'].forEach((column) => {
      expect(screen.getAllByText(column).length).toBeGreaterThan(0);
    });
  });

  it('opens detail drawer with request id, actor, and action', async () => {
    const user = userEvent.setup();
    renderAuditLogsPage();

    const failedRequestId = await screen.findByText('req_sync_failed_001');
    const failedAuditRow = failedRequestId.closest('tr');
    if (!failedAuditRow) {
      throw new Error('未找到失败同步审计行');
    }
    await user.click(within(failedAuditRow).getByRole('button', { name: /详情/ }));

    const drawer = await screen.findByRole('dialog', { name: '审计日志详情' });
    expect(within(drawer).getByText('requestId')).toBeInTheDocument();
    expect(within(drawer).getByText('req_sync_failed_001')).toBeInTheDocument();
    expect(within(drawer).getByText('actorFeishuUserId')).toBeInTheDocument();
    expect(within(drawer).getByText('ou_feishu_admin_001')).toBeInTheDocument();
    expect(within(drawer).getByText('action')).toBeInTheDocument();
    expect(within(drawer).getByText('同步任务')).toBeInTheDocument();
  });

  it('shows retryable error block when loading audit logs fails and recovers after retry', async () => {
    const user = userEvent.setup();
    rejectNextAuditLogsList(new Error('audit logs unavailable'));
    renderAuditLogsPage();

    expect(await screen.findByText('加载审计日志失败')).toBeInTheDocument();
    expect(screen.getByText(/Request ID：req_audit_error_001/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /重\s*试/ }));

    await waitFor(() => expect(screen.queryByText('加载审计日志失败')).not.toBeInTheDocument());
    expect(await screen.findByText('req_sync_failed_001')).toBeInTheDocument();
  });
});
