import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetMockIamStore } from '../../features/iam/mockApi';
import { applications } from '../../features/iam/mockData';
import { ApplicationOnboardingPage } from './Onboarding';

const writeTextMock = vi.fn().mockResolvedValue(undefined);

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

function renderApplicationOnboarding() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/applications/onboarding']}>
        <ApplicationOnboardingPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ApplicationOnboardingPage', () => {
  beforeEach(() => {
    resetMockIamStore();
    writeTextMock.mockClear();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: writeTextMock,
      },
    });
  });

  it('shows onboarding title and five steps', async () => {
    renderApplicationOnboarding();

    expect(screen.getByText('应用接入向导')).toBeInTheDocument();
    ['配置回调地址', '复制运行时环境变量', '导出 Agent Prompt', '注册权限组和权限点', '验证登录和权限查询'].forEach(
      (step) => {
        expect(screen.getAllByText(step).length).toBeGreaterThan(0);
      },
    );
    expect(await screen.findByText('Demo CRM')).toBeInTheDocument();
    expect(screen.getByText('接入检查清单')).toBeInTheDocument();
  });

  it('renders Agent Prompt with secret placeholders and without preview secrets', async () => {
    const user = userEvent.setup();
    renderApplicationOnboarding();

    await screen.findByText('Demo CRM');
    await user.click(screen.getByRole('button', { name: /3 导出 Agent Prompt/ }));
    const promptBlock = screen.getByText(/你正在把业务系统接入 feishu-iam/);
    const promptText = promptBlock.textContent ?? '';

    expect(promptText).toContain('IAM_APP_SECRET=IAM_APP_SECRET');
    expect(promptText).toContain('IAM_API_SECRET=IAM_API_SECRET');
    expect(promptText).not.toContain(applications[0].appSecretPreview);
    expect(promptText).not.toContain(applications[0].apiSecretPreview);
    expect(screen.getAllByText(/你正在把业务系统接入 feishu-iam/)).toHaveLength(1);
    expect(screen.getAllByRole('link', { name: '查看 API 文档' })).toHaveLength(2);
  });

  it('shows actionable onboarding checks instead of a static completed checklist', async () => {
    const user = userEvent.setup();
    renderApplicationOnboarding();

    await screen.findByText('Demo CRM');
    expect(screen.getAllByText('待检查')).toHaveLength(5);
    expect(screen.getByRole('button', { name: /运行接入检查/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '查看 API 文档' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /运行接入检查/ }));

    expect(screen.getAllByText('通过')).toHaveLength(2);
    expect(screen.getAllByText('失败')).toHaveLength(3);
    expect(screen.getByText(/请第三方系统按 API 文档注册后复查/)).toBeInTheDocument();
  });

  it('opens confirmation modal before copying .env and shows audit feedback after confirming', async () => {
    const user = userEvent.setup();
    renderApplicationOnboarding();

    await screen.findByText('Demo CRM');
    await user.click(screen.getByRole('button', { name: /2 复制运行时环境变量/ }));
    await user.click(await screen.findByRole('button', { name: /复制 `\.env` 配置/ }));

    const modal = await screen.findByRole('dialog', { name: '复制运行时密钥' });
    expect(within(modal).getByText('复制运行时密钥')).toBeInTheDocument();
    expect(
      within(modal).getByText(
        '以下内容包含 secret。只允许写入运行时环境变量，不得提交到 Git、AGENTS.md、CLAUDE.md、README 或测试日志。',
      ),
    ).toBeInTheDocument();

    await user.click(within(modal).getByRole('button', { name: '我已理解风险，复制配置' }));

    expect(await screen.findByText('已复制，并记录审计事件。')).toBeInTheDocument();
  });
});
